import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar método HTTP
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Obtener sesión
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Obtener parámetros
  const { organizationId, paymentButtonId, startDate, endDate } = req.query;

  // Validar parámetros requeridos
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Fechas no especificadas' });
  }

  // Inicializar el cliente de Prisma
  const prisma = new PrismaClient();

  try {
    // Construir condiciones de búsqueda
    const queryConditions: any = {
      date: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    };

    // Filtrar por organización si se especifica
    if (organizationId) {
      queryConditions.paymentButton = {
        organizationId: organizationId as string
      };
    }

    // Filtrar por botón de pago si se especifica
    if (paymentButtonId) {
      queryConditions.paymentButtonId = paymentButtonId as string;
    }

    // Obtener transacciones que cumplan con los criterios
    const transactions = await prisma.transaction.findMany({
      where: queryConditions,
      include: {
        paymentButton: {
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        liquidation: {
          select: {
            id: true,
            liquidationId: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log(`Se encontraron ${transactions.length} transacciones en la base de datos.`);

    // Transformar a formato compatible con ClickPagoTransaccion
    const formattedTransactions = transactions.map(tx => ({
      idTransaccion: tx.transactionId,
      fechaTransaccion: tx.date.toISOString(),
      monto: tx.amount,
      moneda: tx.currency,
      estado: tx.status,
      medioPago: tx.paymentMethod,
      cuotas: tx.quotas,
      fechaAcreditacionEstimada: tx.expectedPayDate ? tx.expectedPayDate.toISOString() : null,
      comision: 0,
      montoAcreditado: tx.amount,
      idLiquidacion: tx.liquidationId
    }));

    // Si no hay transacciones, informamos pero devolvemos un array vacío
    if (formattedTransactions.length === 0) {
      console.log('No se encontraron transacciones en la base de datos para los criterios especificados');
    }

    return res.status(200).json(formattedTransactions);
  } catch (error) {
    console.error('Error en API de transacciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 