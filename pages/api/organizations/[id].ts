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

  // Obtener ID de la organización de la URL
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de organización no válido' });
  }

  try {
    // GET: Obtener una organización específica
    if (req.method === 'GET') {
      const organization = await prisma.organization.findUnique({
        where: { id },
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

      if (!organization) {
        return res.status(404).json({ error: 'Organización no encontrada' });
      }

      // Transformar los datos para que sean serializables (JSON)
      const serializedOrganization = {
        id: organization.id,
        name: organization.name,
        paymentButtons: organization.paymentButtons.map(btn => ({
          id: btn.id,
          name: btn.name,
          apiKey: btn.apiKey,
          transactions: btn.transactions.length,
        })),
        users: organization.memberships.map(mem => ({
          id: mem.user.id,
          name: mem.user.name,
          email: mem.user.email,
          role: mapRoleName(mem.role.name),
        })),
      };

      return res.status(200).json(serializedOrganization);
    }
    
    // PUT: Actualizar una organización
    if (req.method === 'PUT') {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'El nombre de la organización es requerido' });
      }

      const updatedOrganization = await prisma.organization.update({
        where: { id },
        data: { name },
      });
      
      return res.status(200).json(updatedOrganization);
    }
    
    // DELETE: Eliminar una organización
    if (req.method === 'DELETE') {
      // Primero debemos eliminar todas las relaciones
      // Nota: Esto depende de cómo esté configurado tu esquema de Prisma
      // Si tienes cascadas configuradas, esto podría no ser necesario
      
      // 1. Eliminar memberships
      await prisma.membership.deleteMany({
        where: { organizationId: id },
      });
      
      // 2. Eliminar botones de pago (y sus transacciones si hay cascada)
      await prisma.paymentButton.deleteMany({
        where: { organizationId: id },
      });
      
      // 3. Finalmente eliminar la organización
      await prisma.organization.delete({
        where: { id },
      });
      
      return res.status(204).end();
    }
    
    // Método no permitido
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en API de organización:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 