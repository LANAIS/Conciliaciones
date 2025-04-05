import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verifica la autenticación usando getServerSession
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const prisma = new PrismaClient();

  try {
    const { organizationId } = req.query;

    // Validar parámetro
    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: 'ID de organización no válido' });
    }

    // Comprobar que el usuario tiene acceso a esta organización
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user?.id as string,
        organizationId: organizationId
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a esta organización' });
    }

    // Obtener los botones de pago de la organización
    const paymentButtons = await prisma.paymentButton.findMany({
      where: {
        organizationId: organizationId
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        secretKey: false, // No enviamos datos sensibles
        _count: {
          select: {
            transactions: true,
          }
        }
      }
    });

    // Formatear los resultados
    const formattedButtons = paymentButtons.map(button => ({
      id: button.id,
      name: button.name,
      apiKey: button.apiKey,
      organizationId: organizationId,
      transactions: button._count.transactions
    }));

    return res.status(200).json(formattedButtons);
  } catch (error) {
    console.error('Error al obtener botones de pago:', error);
    return res.status(500).json({ error: 'Error al obtener botones de pago' });
  } finally {
    await prisma.$disconnect();
  }
} 