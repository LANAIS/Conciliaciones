import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { clickPaymentApi, ClickPaymentApiClient } from '../../../lib/services/clickPaymentApi';
import { addBusinessDays, isBefore, isAfter } from 'date-fns';

const prisma = new PrismaClient();

// Función principal que maneja la sincronización
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar que sea una solicitud autorizada (puedes implementar algún tipo de autenticación)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener todos los botones de pago registrados
    const paymentButtons = await prisma.paymentButton.findMany();

    if (paymentButtons.length === 0) {
      return res.status(200).json({ message: 'No hay botones de pago registrados' });
    }

    const syncResults = [];

    // Para cada botón de pago, sincronizar transacciones y liquidaciones
    for (const button of paymentButtons) {
      // Configuramos las claves de API para este botón específico
      process.env.CLIC_API_KEY = button.apiKey;
      process.env.CLIC_API_SECRET = button.secretKey;
      
      // Creamos una instancia del cliente para este botón específico
      const buttonApiClient = new ClickPaymentApiClient();
      
      // Sincronizar transacciones
      const transactionsResult = await syncTransactions(buttonApiClient, button);
      syncResults.push({
        buttonId: button.id,
        buttonName: button.name,
        transactions: transactionsResult
      });

      // Sincronizar liquidaciones
      const liquidationsResult = await syncLiquidations(buttonApiClient, button);
      syncResults.push({
        buttonId: button.id,
        buttonName: button.name,
        liquidations: liquidationsResult
      });

      // Actualizar las relaciones entre transacciones y liquidaciones
      await matchTransactionsWithLiquidations(buttonApiClient, button.id);
    }

    // Calcular fechas estimadas de pago para transacciones pendientes
    await calculateExpectedPaymentDates();

    return res.status(200).json({ 
      success: true,
      message: 'Sincronización completada con éxito',
      results: syncResults
    });
  } catch (error) {
    console.error('Error en la sincronización:', error);
    
    // Registrar el error en la base de datos
    await prisma.syncLog.create({
      data: {
        type: 'SYNC',
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }
    });

    return res.status(500).json({ 
      success: false,
      message: 'Error en la sincronización',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

// Función para sincronizar transacciones desde la API de Click de Pago
async function syncTransactions(apiClient: ClickPaymentApiClient, paymentButton: any) {
  try {
    // Obtener la última fecha de sincronización para este botón
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        type: 'TRANSACTION',
        status: 'SUCCESS'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Configurar la fecha desde la cual sincronizar (última sincronización o 30 días atrás)
    const fromDate = lastSync 
      ? new Date(lastSync.createdAt) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Llamar a la API de Click de Pago para obtener transacciones
    const transactionsResponse = await apiClient.getTransactions({
      fromDate,
      toDate: new Date()
    });

    // Procesar las transacciones recibidas
    const transactions = transactionsResponse.data || [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const tx of transactions) {
      // Buscar si la transacción ya existe en la base de datos
      const existingTransaction = await prisma.transaction.findUnique({
        where: { transactionId: tx.id }
      });

      // Calcular la fecha estimada de pago
      const expectedPayDate = ClickPaymentApiClient.calculateExpectedPaymentDate(
        new Date(tx.date),
        tx.payment_method,
        tx.installments || 1
      );

      if (existingTransaction) {
        // Actualizar transacción existente
        await prisma.transaction.update({
          where: { transactionId: tx.id },
          data: {
            status: tx.status,
            amount: tx.amount,
            paymentMethod: tx.payment_method,
            quotas: tx.installments || 1,
            expectedPayDate,
            updatedAt: new Date()
          }
        });
        updatedCount++;
      } else {
        // Crear nueva transacción
        await prisma.transaction.create({
          data: {
            transactionId: tx.id,
            amount: tx.amount,
            currency: tx.currency || 'ARS',
            status: tx.status,
            paymentMethod: tx.payment_method,
            quotas: tx.installments || 1,
            date: new Date(tx.date),
            expectedPayDate,
            paymentButtonId: paymentButton.id
          }
        });
        createdCount++;
      }
    }

    // Registrar la sincronización exitosa
    await prisma.syncLog.create({
      data: {
        type: 'TRANSACTION',
        status: 'SUCCESS',
        message: `Sincronizadas ${transactions.length} transacciones (${createdCount} nuevas, ${updatedCount} actualizadas)`
      }
    });

    return {
      success: true,
      total: transactions.length,
      created: createdCount,
      updated: updatedCount
    };
  } catch (error) {
    // Registrar el error
    await prisma.syncLog.create({
      data: {
        type: 'TRANSACTION',
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para sincronizar liquidaciones desde la API de Click de Pago
async function syncLiquidations(apiClient: ClickPaymentApiClient, paymentButton: any) {
  try {
    // Obtener la última fecha de sincronización para este botón
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        type: 'LIQUIDATION',
        status: 'SUCCESS'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Configurar la fecha desde la cual sincronizar (última sincronización o 60 días atrás)
    const fromDate = lastSync 
      ? new Date(lastSync.createdAt) 
      : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Llamar a la API de Click de Pago para obtener liquidaciones
    const liquidationsResponse = await apiClient.getLiquidations({
      fromDate,
      toDate: new Date()
    });

    // Verificar la respuesta según la nueva estructura
    if (!liquidationsResponse.status || liquidationsResponse.code !== 200) {
      throw new Error(`Error en respuesta de API: ${liquidationsResponse.message || 'Error desconocido'}`);
    }

    // Procesar las liquidaciones recibidas
    const liquidations = liquidationsResponse.data.liquidaciones || [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const liq of liquidations) {
      // Buscar si la liquidación ya existe en la base de datos
      const existingLiquidation = await prisma.liquidation.findUnique({
        where: { liquidationId: liq.liquidacionId }
      });

      if (existingLiquidation) {
        // Actualizar liquidación existente
        await prisma.liquidation.update({
          where: { liquidationId: liq.liquidacionId },
          data: {
            amount: parseFloat(liq.NetoLiquidacion.replace(/\s/g, '')),
            status: liq.NumeroSubente.includes('TARJETA DE DEBITO') ? 'DÉBITO' : 'PROCESADO',
            updatedAt: new Date()
          }
        });
        updatedCount++;
      } else {
        // Crear nueva liquidación
        await prisma.liquidation.create({
          data: {
            liquidationId: liq.liquidacionId,
            amount: parseFloat(liq.NetoLiquidacion.replace(/\s/g, '')),
            currency: 'ARS',
            date: new Date(liq.FechaLiquidacion),
            status: liq.NumeroSubente.includes('TARJETA DE DEBITO') ? 'DÉBITO' : 'PROCESADO',
            paymentButtonId: paymentButton.id
          }
        });
        createdCount++;
      }
    }

    // Registrar la sincronización exitosa
    await prisma.syncLog.create({
      data: {
        type: 'LIQUIDATION',
        status: 'SUCCESS',
        message: `Sincronizadas ${liquidations.length} liquidaciones (${createdCount} nuevas, ${updatedCount} actualizadas)`
      }
    });

    return {
      success: true,
      total: liquidations.length,
      created: createdCount,
      updated: updatedCount
    };
  } catch (error) {
    // Registrar el error
    await prisma.syncLog.create({
      data: {
        type: 'LIQUIDATION',
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para asociar transacciones con sus liquidaciones correspondientes
async function matchTransactionsWithLiquidations(apiClient: ClickPaymentApiClient, paymentButtonId: string) {
  try {
    // Obtener liquidaciones para este botón de pago
    const liquidations = await prisma.liquidation.findMany({
      where: {
        paymentButtonId: paymentButtonId,
        status: 'PROCESSED' // Asumimos que PROCESSED es el estado de liquidaciones completadas
      }
    });

    let matchedCount = 0;

    // Para cada liquidación, obtener sus transacciones asociadas desde la API
    for (const liquidation of liquidations) {
      try {
        const liquidationTransactionsResponse = await apiClient.getLiquidationTransactions(liquidation.liquidationId);
        const liquidationTransactions = liquidationTransactionsResponse.data || [];

        // Actualizar cada transacción para asociarla con esta liquidación
        for (const tx of liquidationTransactions) {
          const transaction = await prisma.transaction.findUnique({
            where: { transactionId: tx.id }
          });

          if (transaction && !transaction.liquidationId) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { 
                liquidationId: liquidation.id,
                updatedAt: new Date()
              }
            });
            matchedCount++;
          }
        }
      } catch (error) {
        console.error(`Error al obtener transacciones para liquidación ${liquidation.liquidationId}:`, error);
        continue; // Continuar con la siguiente liquidación
      }
    }

    // Registrar el resultado del matching
    await prisma.syncLog.create({
      data: {
        type: 'MATCHING',
        status: 'SUCCESS',
        message: `Asociadas ${matchedCount} transacciones con sus liquidaciones correspondientes`
      }
    });

    return {
      success: true,
      matched: matchedCount
    };
  } catch (error) {
    // Registrar el error
    await prisma.syncLog.create({
      data: {
        type: 'MATCHING',
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para calcular fechas estimadas de pago para transacciones pendientes
async function calculateExpectedPaymentDates() {
  try {
    // Obtener transacciones pendientes sin fecha estimada de pago
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        expectedPayDate: null
      }
    });

    let updatedCount = 0;

    for (const tx of pendingTransactions) {
      // Calcular fecha estimada usando la función estática
      const expectedPayDate = ClickPaymentApiClient.calculateExpectedPaymentDate(
        new Date(tx.date),
        tx.paymentMethod,
        tx.quotas
      );
      
      // Actualizar la transacción con la fecha estimada
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { 
          expectedPayDate,
          updatedAt: new Date()
        }
      });
      
      updatedCount++;
    }

    // Registrar el resultado del cálculo
    await prisma.syncLog.create({
      data: {
        type: 'EXPECTED_DATES',
        status: 'SUCCESS',
        message: `Calculadas ${updatedCount} fechas estimadas de pago`
      }
    });

    return {
      success: true,
      updated: updatedCount
    };
  } catch (error) {
    // Registrar el error
    await prisma.syncLog.create({
      data: {
        type: 'EXPECTED_DATES',
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
} 