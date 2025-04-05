import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Mapeo de nombres de roles para mostrarlos correctamente
const roleNameMapping: Record<string, string> = {
  'superadmin': 'Super Admin',
  'admin': 'Administrador',
  'operator': 'Operador',
  'viewer': 'Visualizador'
};

// Función para convertir nombres de roles al formato esperado
const mapRoleName = (roleName: string): string => {
  return roleNameMapping[roleName.toLowerCase()] || roleName;
};

// Función para obtener el nombre interno del rol
const getInternalRoleName = (displayRoleName: string): string => {
  const entries = Object.entries(roleNameMapping);
  for (const [internalName, displayName] of entries) {
    if (displayName === displayRoleName) {
      return internalName;
    }
  }
  return displayRoleName.toLowerCase();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API: Procesando solicitud para usuarios');
  
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación usando getServerSession en lugar de getSession
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      console.log('API: Error de autenticación - Sin sesión');
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Obtener el email del usuario de la sesión
    const userEmail = session.user?.email;
    if (!userEmail) {
      console.log('API: Error de autenticación - Sin email de usuario');
      return res.status(401).json({ error: 'No se pudo identificar al usuario' });
    }

    // Log del cuerpo de la solicitud para debugging
    console.log('API: Datos recibidos para añadir usuario:', JSON.stringify(req.body));
      
    const { name, email, roleName, organizationId } = req.body;
    
    // Validar datos requeridos
    if (!name || !email || !roleName || !organizationId) {
      console.log('API: Faltan campos requeridos:', { name, email, roleName, organizationId });
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos: name, email, roleName, organizationId',
        received: { name, email, roleName, organizationId }
      });
    }
    
    // Verificar que la organización existe
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      console.log(`API: Organización no encontrada con ID: ${organizationId}`);
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Verificar permisos del usuario actual
    const currentUser = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        memberships: {
          include: {
            role: true,
            organization: true
          }
        }
      }
    });

    if (!currentUser) {
      console.log(`API: Usuario actual no encontrado con email: ${userEmail}`);
      return res.status(404).json({ error: 'Usuario actual no encontrado' });
    }

    // Verificar si el usuario es Super Admin o si es Administrador de esta organización
    const isSuperAdmin = currentUser.memberships.some(
      membership => mapRoleName(membership.role.name) === 'Super Admin'
    );

    const isAdmin = currentUser.memberships.some(
      membership => 
        membership.organization.id === organizationId && 
        mapRoleName(membership.role.name) === 'Administrador'
    );

    if (!isSuperAdmin && !isAdmin) {
      console.log(`API: Usuario ${userEmail} no tiene permisos para añadir usuarios a esta organización`);
      return res.status(403).json({ error: 'No tiene permisos para añadir usuarios a esta organización' });
    }

    // Verificar si el usuario intenta crear un Super Admin, verificar que sea Super Admin
    if (roleName === 'Super Admin' && !isSuperAdmin) {
      console.log(`API: Usuario ${userEmail} intentó crear un Super Admin sin tener permisos`);
      return res.status(403).json({ error: 'Solo un Super Admin puede crear otros Super Admin' });
    }

    // Si el rol es Administrador, verificar que no exista otro administrador en la organización
    // a menos que el usuario sea Super Admin
    if (roleName === 'Administrador' && !isSuperAdmin) {
      const existingAdmin = await prisma.membership.findFirst({
        where: {
          organizationId,
          role: {
            OR: [
              { name: 'Administrador' },
              { name: 'admin' }
            ]
          }
        },
        include: {
          user: true
        }
      });

      if (existingAdmin && existingAdmin.user.email !== userEmail) {
        console.log(`API: Ya existe un administrador (${existingAdmin.user.email}) para esta organización`);
        return res.status(403).json({ 
          error: 'Ya existe un administrador para esta organización', 
          adminEmail: existingAdmin.user.email 
        });
      }
    }

    // Buscar usuario existente por email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId },
          include: { role: true }
        }
      }
    });

    // Buscar el rol por nombre (considerando el mapeo de nombres)
    const internalRoleName = getInternalRoleName(roleName);
    let role = await prisma.role.findFirst({
      where: { 
        OR: [
          { name: roleName },
          { name: internalRoleName }
        ]
      }
    });

    if (!role) {
      console.log(`API: Rol no encontrado: ${roleName}`);
      return res.status(404).json({ error: `Rol no encontrado: ${roleName}` });
    }

    // Si el usuario existe, verificar si ya está en la organización
    if (existingUser) {
      if (existingUser.memberships.length > 0) {
        const membership = existingUser.memberships[0];
        console.log(`API: Usuario ya existe en la organización con rol: ${membership.role.name}`);
        
        // Actualizar el rol si es diferente
        if (mapRoleName(membership.role.name) !== roleName) {
          const updatedMembership = await prisma.membership.update({
            where: { id: membership.id },
            data: { roleId: role.id },
            include: {
              user: true,
              role: true
            }
          });
          
          console.log(`API: Rol actualizado para usuario ${email} de ${membership.role.name} a ${role.name}`);
          return res.status(200).json({
            message: 'Usuario actualizado en la organización',
            user: {
              id: updatedMembership.user.id,
              name: updatedMembership.user.name,
              email: updatedMembership.user.email,
              role: mapRoleName(updatedMembership.role.name)
            }
          });
        } else {
          return res.status(409).json({ 
            error: 'El usuario ya existe en la organización con ese rol',
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              role: mapRoleName(membership.role.name)
            }
          });
        }
      } else {
        // El usuario existe pero no está en esta organización
        const newMembership = await prisma.membership.create({
          data: {
            userId: existingUser.id,
            organizationId,
            roleId: role.id
          },
          include: {
            user: true,
            role: true
          }
        });
        
        console.log(`API: Usuario existente ${email} añadido a la organización con rol ${role.name}`);
        return res.status(201).json({
          message: 'Usuario existente añadido a la organización',
          user: {
            id: newMembership.user.id,
            name: newMembership.user.name,
            email: newMembership.user.email,
            role: mapRoleName(newMembership.role.name)
          }
        });
      }
    } else {
      // El usuario no existe, crearlo
      // Generar una contraseña aleatoria (el usuario deberá restablecerla)
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Crear nuevo usuario
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          memberships: {
            create: {
              organizationId,
              roleId: role.id
            }
          }
        }
      });
      
      console.log(`API: Nuevo usuario creado con email ${email} y añadido a la organización con rol ${role.name}`);
      
      // Aquí podríamos enviar un correo al usuario con su contraseña temporal
      // TODO: Implementar envío de correo
      
      return res.status(201).json({
        message: 'Nuevo usuario creado y añadido a la organización',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: mapRoleName(role.name),
          tempPassword // Solo para desarrollo, en producción no devolver la contraseña
        }
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Error del servidor', 
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
    });
  } finally {
    await prisma.$disconnect();
  }
} 