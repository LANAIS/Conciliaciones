import { PrismaClient, Transaction, Liquidation, PaymentButton } from '@prisma/client';
import { addBusinessDays, differenceInBusinessDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClickPaymentApiClient } from './clickPaymentApi';
import { TRANSACTION_STATUSES } from '../../utils/transactionUtils';

const prisma = new PrismaClient();

export class ReconciliationService {
  /**
   * Calcula la fecha esperada de acreditación basada en el método de pago
   * @param transactionDate Fecha de la transacción
   * @param paymentMethod Método de pago (DEBIT_CARD, CREDIT_CARD, QR, etc.)
   * @param installments Número de cuotas (para tarjetas de crédito)
   */
  static calculateExpectedPaymentDate(
    transactionDate: Date,
    paymentMethod: string,
    installments: number = 1
  ): Date {
    // Aseguramos que la fecha sea un objeto Date
    const date = typeof transactionDate === 'string' 
      ? parseISO(transactionDate) 
      : new Date(transactionDate);
    
    if (paymentMethod === 'DEBIT_CARD' || paymentMethod === 'QR') {
      // Para débito y QR: siguiente día hábil
      return addBusinessDays(date, 1);
    } else if (paymentMethod === 'CREDIT_CARD') {
      // Para crédito: 18 días hábiles
      return addBusinessDays(date, 18);
    } else {
      // Para otros métodos, asumimos 5 días hábiles
      return addBusinessDays(date, 5);
    }
  }

  /**
   * Concilia las transacciones con las liquidaciones para una organización específica
   * @param organizationId ID de la organización
   */
  static async reconcileTransactionsWithLiquidations(organizationId: string): Promise<{
    matched: number;
    pending: number;
    totalMatched: number;
    totalPending: number;
  }> {
    let matched = 0;
    let pending = 0;
    let totalMatched = 0;
    let totalPending = 0;

    try {
      // Obtenemos todos los botones de pago de la organización
      const paymentButtons = await prisma.paymentButton.findMany({
        where: { organizationId }
      });

      for (const button of paymentButtons) {
        // Obtenemos todas las transacciones con estado REALIZADA sin liquidación asociada
        const transactions = await prisma.transaction.findMany({
          where: {
            paymentButtonId: button.id,
            status: TRANSACTION_STATUSES.REALIZADA,
            liquidationId: null
          }
        });

        // Obtenemos todas las liquidaciones
        const liquidations = await prisma.liquidation.findMany({
          where: { paymentButtonId: button.id }
        });

        // Para cada transacción, buscamos su liquidación correspondiente
        for (const transaction of transactions) {
          const matchedLiquidation = liquidations.find(liquidation => {
            // Verificamos si la fecha de la liquidación es posterior o igual a la fecha esperada de pago
            return transaction.expectedPayDate && 
                   isAfter(liquidation.date, transaction.expectedPayDate) &&
                   // Verificamos que no esté ya asignada (esto sería un chequeo adicional)
                   !(transaction.liquidationId);
          });

          if (matchedLiquidation) {
            // Actualizamos la transacción con la liquidación correspondiente
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { liquidationId: matchedLiquidation.id }
            });
            matched++;
            totalMatched += transaction.amount;
          } else {
            pending++;
            totalPending += transaction.amount;
          }
        }
      }

      return { matched, pending, totalMatched, totalPending };
    } catch (error) {
      console.error('Error al conciliar transacciones con liquidaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene el resumen de conciliación para una organización
   * @param organizationId ID de la organización
   * @param fromDate Fecha de inicio
   * @param toDate Fecha de fin
   */
  static async getReconciliationSummary(
    organizationId: string,
    fromDate?: Date,
    toDate?: Date
  ) {
    const start = fromDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = toDate || new Date();

    try {
      const paymentButtons = await prisma.paymentButton.findMany({
        where: { organizationId }
      });

      const buttonIds = paymentButtons.map(b => b.id);

      // Obtener transacciones liquidadas dentro del rango
      const reconciled = await prisma.transaction.findMany({
        where: {
          paymentButtonId: { in: buttonIds },
          date: { gte: start, lte: end },
          status: TRANSACTION_STATUSES.REALIZADA,
          liquidationId: { not: null }
        }
      });

      // Obtener transacciones pendientes de liquidar dentro del rango
      const pending = await prisma.transaction.findMany({
        where: {
          paymentButtonId: { in: buttonIds },
          date: { gte: start, lte: end },
          status: TRANSACTION_STATUSES.REALIZADA,
          liquidationId: null
        }
      });

      // Liquidaciones en el período
      const liquidations = await prisma.liquidation.findMany({
        where: {
          paymentButtonId: { in: buttonIds },
          date: { gte: start, lte: end }
        }
      });

      // Calculamos totales
      const totalReconciled = reconciled.reduce((sum, t) => sum + t.amount, 0);
      const totalPending = pending.reduce((sum, t) => sum + t.amount, 0);
      const totalLiquidated = liquidations.reduce((sum, l) => sum + l.amount, 0);

      // Agrupamos por método de pago
      const byPaymentMethod = this.groupByPaymentMethod(reconciled, pending);

      return {
        totalReconciled,
        totalPending,
        totalLiquidated,
        reconciledCount: reconciled.length,
        pendingCount: pending.length,
        liquidationCount: liquidations.length,
        byPaymentMethod
      };
    } catch (error) {
      console.error('Error al obtener resumen de conciliación:', error);
      throw error;
    }
  }

  /**
   * Agrupa transacciones por método de pago
   */
  private static groupByPaymentMethod(
    reconciledTransactions: Transaction[],
    pendingTransactions: Transaction[]
  ) {
    const methods: Record<string, { reconciled: number, pending: number, total: number }> = {};

    // Procesamos las transacciones conciliadas
    reconciledTransactions.forEach(t => {
      if (!methods[t.paymentMethod]) {
        methods[t.paymentMethod] = { reconciled: 0, pending: 0, total: 0 };
      }
      methods[t.paymentMethod].reconciled += t.amount;
      methods[t.paymentMethod].total += t.amount;
    });

    // Procesamos las transacciones pendientes
    pendingTransactions.forEach(t => {
      if (!methods[t.paymentMethod]) {
        methods[t.paymentMethod] = { reconciled: 0, pending: 0, total: 0 };
      }
      methods[t.paymentMethod].pending += t.amount;
      methods[t.paymentMethod].total += t.amount;
    });

    return methods;
  }
}

export default ReconciliationService; 