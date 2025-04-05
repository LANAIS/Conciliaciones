import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import prisma from '../../../lib/prisma';
import { sendEmail } from '../../../lib/email';
import { Transaction, User } from '@prisma/client';
import { authOptions } from '../auth/[...nextauth]';

interface TransactionWithAmount extends Transaction {
  amount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación usando getServerSession
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Obtener ID de la conciliación programada
    const { id } = req.query;

    // Validar parámetros
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de conciliación programada requerido' });
    }

    // Buscar la conciliación programada
    const scheduledReconciliation = await prisma.scheduledReconciliation.findUnique({
      where: { id },
      include: {
        organization: true,
        paymentButton: true,
      },
    });

    if (!scheduledReconciliation) {
      return res.status(404).json({ error: 'Conciliación programada no encontrada' });
    }

    // Verificar permisos del usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: {
        memberships: {
          include: {
            organization: true,
            role: true
          }
        }
      },
    });

    if (!user) {
      return res.status(403).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si el usuario es super admin o admin de la organización
    const userRoles = user.memberships.map(m => m.role.name);
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isOrgAdmin = user.memberships.some(m => 
      m.organization.id === scheduledReconciliation.organizationId && 
      m.role.name === 'ADMIN'
    );

    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para ejecutar esta conciliación' });
    }

    // Obtener parámetros
    const { startDate, endDate } = req.body;

    // Validar fechas
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ error: 'Fechas no válidas' });
    }

    if (startDateObj > endDateObj) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la fecha de fin' });
    }

    // Buscar transacciones para el período y botón de pago
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentButtonId: scheduledReconciliation.paymentButtonId,
        createdAt: {
          gte: startDateObj,
          lte: endDateObj,
        },
        status: 'COMPLETED',
      },
    }) as TransactionWithAmount[];

    // Calcular el monto total
    const totalAmount = transactions.reduce((sum: number, tx: TransactionWithAmount) => sum + Number(tx.amount), 0);

    // Registrar la ejecución en el historial
    const reconciliationHistory = await prisma.reconciliationHistory.create({
      data: {
        userId: user.id,
        organizationId: scheduledReconciliation.organizationId,
        paymentButtonId: scheduledReconciliation.paymentButtonId,
        recordsAffected: transactions.length,
        totalAmount: totalAmount,
        startDate: startDateObj,
        endDate: endDateObj,
        status: transactions.length > 0 ? 'SUCCESS' : 'PARTIAL',
        description: `Ejecución automática de conciliación programada: ${scheduledReconciliation.name}`
      },
    });

    // Actualizar la conciliación programada
    await prisma.scheduledReconciliation.update({
      where: { id: scheduledReconciliation.id },
      data: {
        lastRun: new Date(),
        executionCount: (scheduledReconciliation.executionCount || 0) + 1,
        lastExecutionStatus: transactions.length > 0 ? 'SUCCESS' : 'PARTIAL',
      },
    });

    // Enviar correos de notificación si está configurado
    if (
      scheduledReconciliation.notifyEmail && 
      scheduledReconciliation.notifyEmails &&
      scheduledReconciliation.notifyEmails.trim() !== ''
    ) {
      const emails = scheduledReconciliation.notifyEmails.split(',').map((email: string) => email.trim());
      
      for (const email of emails) {
        try {
          await sendEmail({
            to: email,
            subject: `Conciliación "${scheduledReconciliation.name}" completada`,
            text: `
              La conciliación programada "${scheduledReconciliation.name}" ha sido ejecutada.
              
              Organización: ${scheduledReconciliation.organization.name}
              Botón de pago: ${scheduledReconciliation.paymentButton.name}
              Período: ${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}
              Transacciones procesadas: ${transactions.length}
              Monto total: ${totalAmount}
              
              Este es un correo automatizado, por favor no responda.
            `,
          });
        } catch (error) {
          console.error('Error al enviar correo de notificación:', error);
        }
      }
    }

    return res.status(200).json({
      success: true,
      reconciliationId: reconciliationHistory.id,
      recordsAffected: transactions.length,
      totalAmount: totalAmount,
      message: 'Conciliación ejecutada correctamente',
    });
  } catch (error) {
    console.error('Error al ejecutar conciliación programada:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 