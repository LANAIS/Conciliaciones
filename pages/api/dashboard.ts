import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { startOfMonth, endOfMonth, format, parseISO, isAfter, isBefore, subMonths, addMonths } from 'date-fns';
import { ReconciliationService } from '../../lib/services/reconciliationService';
import { TRANSACTION_STATUSES } from '../../utils/transactionUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verifica la autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const prisma = new PrismaClient();

  try {
    const { organizationId, paymentButtonId } = req.query;

    // Validar parámetros
    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ 
        error: 'ID de organización no válido',
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          totalAmount: 0,
          pendingAmount: 0,
          liquidatedAmount: 0,
          nextPaymentDate: null,
          nextPaymentAmount: null
        },
        transactionsData: [],
        liquidationsData: [],
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
    }

    if (!paymentButtonId || typeof paymentButtonId !== 'string') {
      return res.status(400).json({ 
        error: 'ID de botón de pago no válido',
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          totalAmount: 0,
          pendingAmount: 0,
          liquidatedAmount: 0,
          nextPaymentDate: null,
          nextPaymentAmount: null
        },
        transactionsData: [],
        liquidationsData: [],
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
    }

    // Comprobar que el usuario tiene acceso a esta organización
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user?.id as string,
        organizationId: organizationId
      }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'No tienes permiso para acceder a esta organización',
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          totalAmount: 0,
          pendingAmount: 0,
          liquidatedAmount: 0,
          nextPaymentDate: null,
          nextPaymentAmount: null
        },
        transactionsData: [],
        liquidationsData: [],
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
    }

    // Verificar que el botón de pago pertenece a la organización
    const paymentButton = await prisma.paymentButton.findFirst({
      where: {
        id: paymentButtonId,
        organizationId: organizationId
      }
    });

    if (!paymentButton) {
      return res.status(404).json({ 
        error: 'Botón de pago no encontrado para esta organización',
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          totalAmount: 0,
          pendingAmount: 0,
          liquidatedAmount: 0,
          nextPaymentDate: null,
          nextPaymentAmount: null
        },
        transactionsData: [],
        liquidationsData: [],
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
    }

    // Obtener transacciones filtradas por el botón de pago
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentButtonId: paymentButtonId
      },
      include: {
        liquidation: true
      }
    });

    // Obtener liquidaciones filtradas por el botón de pago
    const liquidations = await prisma.liquidation.findMany({
      where: {
        paymentButtonId: paymentButtonId
      }
    });

    // Calcular estadísticas para el resumen
    const totalTransactions = transactions.length;
    const completedTransactions = transactions.filter(tx => tx.status === TRANSACTION_STATUSES.REALIZADA).length;
    const pendingTransactions = transactions.filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE).length;
    
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const pendingAmount = transactions
      .filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const liquidatedAmount = transactions
      .filter(tx => tx.liquidationId !== null)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    // Encontrar la próxima fecha de pago (transacción pendiente más cercana)
    const pendingTransactionsWithDates = transactions
      .filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE && tx.expectedPayDate !== null)
      .sort((a, b) => {
        if (!a.expectedPayDate || !b.expectedPayDate) return 0;
        return a.expectedPayDate.getTime() - b.expectedPayDate.getTime();
      });
    
    const nextPaymentTransaction = pendingTransactionsWithDates[0];
    
    // Preparar datos para los gráficos
    // 1. Agrupar transacciones por día para el gráfico de área
    const last30days = new Date();
    last30days.setDate(last30days.getDate() - 30);
    
    const transactionsByDay = transactions
      .filter(tx => tx.date > last30days)
      .reduce((acc: Record<string, number>, tx) => {
        const dateStr = tx.date.toISOString().split('T')[0];
        acc[dateStr] = (acc[dateStr] || 0) + tx.amount;
        return acc;
      }, {});
    
    const transactionsData = Object.keys(transactionsByDay).map(date => ({
      date,
      amount: transactionsByDay[date]
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    // 2. Agrupar liquidaciones por estado para el gráfico de pie
    const liquidationsByStatus = liquidations.reduce((acc: Record<string, number>, liq) => {
      acc[liq.status] = (acc[liq.status] || 0) + 1;
      return acc;
    }, {});
    
    const liquidationsData = Object.keys(liquidationsByStatus).map(status => ({
      status,
      value: liquidationsByStatus[status]
    }));
    
    // 3. Agrupar transacciones por método de pago
    const paymentMethodCounts = transactions.reduce((acc: Record<string, number>, tx) => {
      acc[tx.paymentMethod] = (acc[tx.paymentMethod] || 0) + 1;
      return acc;
    }, {});
    
    const totalPaymentMethods = Object.values(paymentMethodCounts).reduce((sum, count) => sum + count, 0);
    
    const paymentMethodData = Object.keys(paymentMethodCounts).map(method => ({
      name: method,
      value: Math.round((paymentMethodCounts[method] / totalPaymentMethods) * 100)
    }));
    
    // 4. Agrupar liquidaciones pendientes por semana
    const now = new Date();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    // Definir la interfaz para la semana
    interface Week {
      name: string;
      start: Date;
      end: Date;
      amount: number;
    }
    
    // Crear un array con las 4 últimas semanas
    const weeks: Week[] = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(fourWeeksAgo);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weeks.push({
        name: `Semana ${i + 1}`,
        start: weekStart,
        end: weekEnd,
        amount: 0
      });
    }
    
    // Sumar los montos de liquidaciones pendientes por semana
    const pendingLiquidations = liquidations.filter(liq => liq.status === TRANSACTION_STATUSES.PENDIENTE);
    
    pendingLiquidations.forEach(liq => {
      const liquidationDate = liq.date;
      for (const week of weeks) {
        if (liquidationDate >= week.start && liquidationDate <= week.end) {
          week.amount += liq.amount;
          break;
        }
      }
    });
    
    const pendingLiquidationsData = weeks.map(week => ({
      name: week.name,
      amount: week.amount
    }));
    
    // Preparar el objeto de resumen
    const dashboardSummary = {
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      totalAmount,
      pendingAmount,
      liquidatedAmount,
      nextPaymentDate: nextPaymentTransaction?.expectedPayDate?.toISOString() || null,
      nextPaymentAmount: nextPaymentTransaction?.amount || null
    };
    
    return res.status(200).json({
      summary: dashboardSummary,
      transactionsData,
      liquidationsData,
      paymentMethodData,
      pendingLiquidationsData
    });
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    return res.status(500).json({ 
      error: 'Error al obtener datos del dashboard',
      summary: {
        totalTransactions: 0,
        completedTransactions: 0,
        pendingTransactions: 0,
        totalAmount: 0,
        pendingAmount: 0,
        liquidatedAmount: 0,
        nextPaymentDate: null,
        nextPaymentAmount: null
      },
      transactionsData: [],
      liquidationsData: [],
      paymentMethodData: [],
      pendingLiquidationsData: []
    });
  } finally {
    await prisma.$disconnect();
  }
} 