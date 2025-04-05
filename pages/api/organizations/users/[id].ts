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
  // Verificar autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Obtener ID de la membresía de la URL
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de membresía no válido' });
  }

  // Obtener organizationId del query o body
  const organizationId = req.query.organizationId || req.body.organizationId;
  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'ID de organización no válido' });
  }

  try {
    // PUT: Actualizar el rol de un usuario en la organización
    if (req.method === 'PUT') {
      const { roleName } = req.body;
      
      // Validar datos requeridos
      if (!roleName) {
        return res.status(400).json({ error: 'El roleName es requerido' });
      }
      
      // Verificar que el rol existe (buscar por nombre directo o por mapeo)
      const internalRoleName = getInternalRoleName(roleName);
      const role = await prisma.role.findFirst({
        where: { 
          OR: [
            { name: roleName },
            { name: internalRoleName }
          ]
        }
      });
      
      if (!role) {
        return res.status(404).json({ error: 'Rol no encontrado' });
      }
      
      // Verificar que la membresía existe
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: id,
            organizationId,
          },
        },
      });
      
      if (!membership) {
        return res.status(404).json({ error: 'Membresía no encontrada' });
      }
      
      // Actualizar el rol
      const updatedMembership = await prisma.membership.update({
        where: {
          userId_organizationId: {
            userId: id,
            organizationId,
          },
        },
        data: { roleId: role.id },
        include: {
          user: true,
          role: true,
        },
      });
      
      return res.status(200).json({
        id: updatedMembership.user.id,
        name: updatedMembership.user.name,
        email: updatedMembership.user.email,
        role: mapRoleName(updatedMembership.role.name),
      });
    }
    
    // DELETE: Eliminar un usuario de la organización
    if (req.method === 'DELETE') {
      // Verificar que la membresía existe
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: id,
            organizationId,
          },
        },
      });
      
      if (!membership) {
        return res.status(404).json({ error: 'Membresía no encontrada' });
      }
      
      // Eliminar la membresía
      await prisma.membership.delete({
        where: {
          userId_organizationId: {
            userId: id,
            organizationId,
          },
        },
      });
      
      return res.status(204).end();
    }
    
    // Método no permitido
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en API de usuario de organización:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 