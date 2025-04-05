import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import ReconciliationService from '../../../lib/services/reconciliationService';
import { getSession } from 'next-auth/react';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificamos que sea un método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificamos la autenticación (suponiendo que usas next-auth)
    const session = await getSession({ req });
    if (!session || !session.user || !session.user.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Extraemos el ID de la organización de la solicitud
    const { organizationId } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ message: 'Se requiere un ID de organización' });
    }

    // Obtenemos el usuario basado en el email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    
    if (!user) {
      return res.status(403).json({ message: 'Usuario no encontrado' });
    }

    // Verificamos que el usuario tenga acceso a esta organización
    const membership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId
      },
      include: {
        role: true
      }
    });

    if (!membership) {
      return res.status(403).json({ message: 'No tienes acceso a esta organización' });
    }

    // Ejecutamos la conciliación
    const result = await ReconciliationService.reconcileTransactionsWithLiquidations(organizationId);

    // Registramos la actividad de conciliación
    await prisma.syncLog.create({
      data: {
        type: 'RECONCILIATION',
        status: 'SUCCESS',
        message: `Conciliación completada: ${result.matched} transacciones conciliadas, ${result.pending} pendientes.`
      }
    });

    return res.status(200).json({
      message: 'Conciliación completada exitosamente',
      ...result
    });

  } catch (error: unknown) {
    console.error('Error en la conciliación:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    // Registramos el error
    await prisma.syncLog.create({
      data: {
        type: 'RECONCILIATION',
        status: 'ERROR',
        message: `Error en la conciliación: ${errorMessage}`
      }
    });

    return res.status(500).json({
      message: 'Error al ejecutar la conciliación',
      error: errorMessage
    });
  }
} 