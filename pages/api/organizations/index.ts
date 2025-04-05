import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Obtener el email del usuario de la sesión
  const userEmail = session.user?.email;
  if (!userEmail) {
    return res.status(401).json({ error: 'No se pudo identificar al usuario' });
  }

  try {
    // GET: Obtener organizaciones
    if (req.method === 'GET') {
      // Primero, obtenemos el usuario
      const user = await prisma.user.findUnique({
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

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Verificar si el usuario es Super Admin en alguna organización
      const isSuperAdmin = user.memberships.some(
        membership => mapRoleName(membership.role.name) === 'Super Admin'
      );

      let organizations;

      if (isSuperAdmin) {
        // Si es Super Admin, obtener todas las organizaciones
        organizations = await prisma.organization.findMany({
          include: {
            paymentButtons: {
              include: {
                transactions: {
                  select: {
                    transactionId: true,
                  },
                },
              },
            },
            memberships: {
              include: {
                user: true,
                role: true,
              },
            },
          },
        });
      } else {
        // Si no es Super Admin, obtener solo las organizaciones a las que pertenece
        const organizationIds = user.memberships.map(membership => membership.organization.id);
        
        organizations = await prisma.organization.findMany({
          where: {
            id: {
              in: organizationIds
            }
          },
          include: {
            paymentButtons: {
              include: {
                transactions: {
                  select: {
                    transactionId: true,
                  },
                },
              },
            },
            memberships: {
              include: {
                user: true,
                role: true,
              },
            },
          },
        });
      }

      // Transformar los datos para que sean serializables (JSON)
      const serializedOrganizations = organizations.map(org => ({
        id: org.id,
        name: org.name,
        paymentButtons: org.paymentButtons.map(btn => ({
          id: btn.id,
          name: btn.name,
          apiKey: btn.apiKey,
          transactions: btn.transactions.length,
        })),
        users: org.memberships.map(mem => ({
          id: mem.user.id,
          name: mem.user.name,
          email: mem.user.email,
          role: mapRoleName(mem.role.name),
        })),
      }));

      return res.status(200).json(serializedOrganizations);
    }
    
    // POST: Crear una nueva organización
    if (req.method === 'POST') {
      // Verificar si el usuario es Super Admin (solo ellos pueden crear organizaciones)
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: {
          memberships: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const isSuperAdmin = user.memberships.some(
        membership => mapRoleName(membership.role.name) === 'Super Admin'
      );

      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'No tiene permisos para crear organizaciones' });
      }

      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'El nombre de la organización es requerido' });
      }
      
      const newOrganization = await prisma.organization.create({
        data: {
          name,
        },
      });

      // Además, agregamos al usuario actual como Administrador de la nueva organización
      // Primero, buscamos el rol de Administrador
      let adminRole = await prisma.role.findFirst({
        where: { name: 'Administrador' }
      });

      // Si no encontramos el rol con el nombre exacto, buscamos con el nombre en minúsculas
      if (!adminRole) {
        adminRole = await prisma.role.findFirst({
          where: { name: 'admin' }
        });
      }

      if (adminRole) {
        await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: newOrganization.id,
            roleId: adminRole.id
          }
        });
      }

      // Si el usuario es Super Admin, también lo agregamos como Super Admin a la nueva organización
      if (isSuperAdmin) {
        let superAdminRole = await prisma.role.findFirst({
          where: { name: 'Super Admin' }
        });
        
        // Si no encontramos el rol con el nombre exacto, buscamos con el nombre en minúsculas
        if (!superAdminRole) {
          superAdminRole = await prisma.role.findFirst({
            where: { name: 'superadmin' }
          });
        }

        if (superAdminRole) {
          await prisma.membership.create({
            data: {
              userId: user.id,
              organizationId: newOrganization.id,
              roleId: superAdminRole.id
            }
          });
        }
      }
      
      return res.status(201).json(newOrganization);
    }
    
    // Método no permitido
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en API de organizaciones:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 