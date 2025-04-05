import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Transaction } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { ClickPagoService } from '../../../services/clickPagoService';
import { differenceInDays, parseISO } from 'date-fns';

// Roles permitidos para acceder a las conciliaciones
const ALLOWED_ROLES = ['TESORERO', 'ADMIN', 'SUPER_ADMIN'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const prisma = new PrismaClient();

  try {
    const { organizationId, paymentButtonId, startDate, endDate } = req.query;

    // Validar parámetros
    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: 'ID de organización no válido' });
    }

    if (!paymentButtonId || typeof paymentButtonId !== 'string') {
      return res.status(400).json({ error: 'ID de botón de pago no válido' });
    }

    // Validar fechas
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'Fechas no válidas' });
    }

    // Convertir fechas y validar rango (máximo 30 días)
    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);
    
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ error: 'Formato de fechas inválido' });
    }
    
    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la fecha final' });
    }
    
    const diffDays = differenceInDays(parsedEndDate, parsedStartDate);
    if (diffDays > 30) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar los 30 días' });
    }

    // Verificar que el usuario tiene acceso a esta organización y tiene un rol permitido
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user?.id as string,
        organizationId: organizationId
      },
      include: {
        role: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a esta organización' });
    }

    // Verificar si el usuario tiene un rol permitido
    if (!ALLOWED_ROLES.includes(membership.role.name.toUpperCase())) {
      return res.status(403).json({ 
        error: 'No tienes permiso para acceder a las conciliaciones. Se requiere rol de tesorero, admin o super admin.' 
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
      return res.status(404).json({ error: 'Botón de pago no encontrado para esta organización' });
    }

    // Crear instancia del servicio de Click de Pago usando las credenciales del botón de pago
    const clickPagoService = new ClickPagoService(
      paymentButton.apiKey, 
      paymentButton.secretKey
    );

    // Formatear fechas para la API
    const fechaDesde = startDate;
    const fechaHasta = endDate;

    // Consultar transacciones en la API externa
    const apiResponse = await clickPagoService.consultarTransacciones(fechaDesde, fechaHasta, 0, 500);
    
    if (!apiResponse.success) {
      return res.status(500).json({ 
        error: 'Error al consultar transacciones en la API externa',
        details: apiResponse.error
      });
    }

    const externalTransactions = apiResponse.data?.data || [];

    // Definir el tipo para las transacciones con relaciones
    type TransactionWithRelations = Transaction & {
      liquidation: {
        id: string;
        date: Date;
      } | null;
      paymentButton: {
        name: string;
      };
    };

    // Obtener transacciones locales para el mismo período
    const localTransactions = await prisma.transaction.findMany({
      where: {
        paymentButtonId: paymentButtonId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        liquidation: true,
        paymentButton: {
          select: {
            name: true
          }
        }
      }
    }) as TransactionWithRelations[];

    // Mapear transacciones externas para comparación
    const mappedExternalTransactions = externalTransactions.map(tx => ({
      transactionId: tx.idTransaccion,
      date: new Date(tx.fechaTransaccion),
      amount: tx.monto,
      status: tx.estado,
      paymentMethod: tx.medioPago,
      quotas: tx.cuotas,
      expectedPayDate: tx.fechaAcreditacionEstimada ? new Date(tx.fechaAcreditacionEstimada) : null,
      liquidationId: tx.idLiquidacion
    }));

    // Mapear transacciones locales para comparación
    const mappedLocalTransactions = localTransactions.map(tx => ({
      id: tx.id,
      transactionId: tx.transactionId,
      date: tx.date,
      amount: tx.amount,
      status: tx.status,
      paymentMethod: tx.paymentMethod,
      quotas: tx.quotas,
      expectedPayDate: tx.expectedPayDate,
      liquidationId: tx.liquidationId,
      localRecord: tx // Guardamos el registro completo para referencia
    }));

    // Comparar transacciones para identificar diferencias
    const differences = {
      // Transacciones que existen en la API pero no en local
      missing: mappedExternalTransactions.filter(
        extTx => !mappedLocalTransactions.some(localTx => localTx.transactionId === extTx.transactionId)
      ),
      // Transacciones con datos diferentes
      mismatched: mappedExternalTransactions
        .filter(extTx => mappedLocalTransactions.some(
          localTx => localTx.transactionId === extTx.transactionId && 
                    (localTx.status !== extTx.status || 
                    localTx.liquidationId !== extTx.liquidationId)
        ))
        .map(extTx => {
          const localTx = mappedLocalTransactions.find(
            localTx => localTx.transactionId === extTx.transactionId
          );
          return {
            external: extTx,
            local: localTx
          };
        })
    };

    // Si se solicitó actualizar los datos, hacerlo
    let updatedRecords: TransactionWithRelations[] = [];
    let reconciliationStatus = 'COMPLETED';
    let reconciliationDetails = '';
    
    if (req.query.update === 'true') {
      try {
        // 1. Crear nuevos registros para transacciones faltantes
        if (differences.missing.length > 0) {
          const newTransactions = differences.missing.map(tx => ({
            transactionId: tx.transactionId,
            date: tx.date,
            amount: tx.amount,
            status: tx.status,
            paymentMethod: tx.paymentMethod,
            quotas: tx.quotas,
            expectedPayDate: tx.expectedPayDate,
            liquidationId: tx.liquidationId,
            paymentButtonId: paymentButtonId,
            currency: "ARS" // Añadir el campo obligatorio
          }));

          await prisma.transaction.createMany({
            data: newTransactions
          });
        }

        // 2. Actualizar registros con diferencias
        for (const diff of differences.mismatched) {
          if (diff.local) {
            await prisma.transaction.update({
              where: { id: diff.local.id },
              data: {
                status: diff.external.status,
                liquidationId: diff.external.liquidationId,
                expectedPayDate: diff.external.expectedPayDate
              }
            });
          }
        }

        // Registrar en el historial
        const history = await prisma.reconciliationHistory.create({
          data: {
            userId: session.user?.id as string,
            paymentButtonId: paymentButtonId,
            organizationId: organizationId,
            recordsAffected: differences.missing.length + differences.mismatched.length,
            totalAmount: 0, // Calcular el monto total si es necesario
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            status: 'COMPLETED',
            description: `Conciliación exitosa. Se encontraron ${differences.missing.length} transacciones nuevas y ${differences.mismatched.length} transacciones con diferencias.`
          }
        });
        
        // Obtener los registros actualizados
        updatedRecords = await prisma.transaction.findMany({
          where: {
            paymentButtonId: paymentButtonId,
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          },
          include: {
            liquidation: true,
            paymentButton: {
              select: {
                name: true
              }
            }
          }
        }) as TransactionWithRelations[];
      } catch (error) {
        reconciliationStatus = 'FAILED';
        reconciliationDetails = `Error durante la conciliación: ${error instanceof Error ? error.message : 'Error desconocido'}`;
        
        // Registrar el error en el historial
        await prisma.reconciliationHistory.create({
          data: {
            userId: session.user?.id as string,
            paymentButtonId: paymentButtonId,
            organizationId: organizationId,
            recordsAffected: 0,
            totalAmount: 0,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            status: 'FAILED',
            description: reconciliationDetails
          }
        });
        
        throw error;
      }
    }

    // Calcular estadísticas actualizadas
    const transactions = updatedRecords.length > 0 ? updatedRecords : localTransactions;
    
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const liquidatedTransactions = transactions.filter(tx => tx.liquidationId !== null);
    const matchedTransactions = liquidatedTransactions.length;
    const matchedAmount = liquidatedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const pendingTransactions = totalTransactions - matchedTransactions;
    const pendingAmount = totalAmount - matchedAmount;
    
    // Buscar la próxima liquidación pendiente
    const nextLiquidation = await prisma.liquidation.findFirst({
      where: {
        paymentButtonId: paymentButtonId,
        status: 'PENDIENTE',
        date: { gte: new Date() }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    const reconciliationSummary = {
      totalTransactions,
      totalAmount,
      matchedTransactions,
      matchedAmount,
      pendingTransactions,
      pendingAmount,
      nextExpectedLiquidation: nextLiquidation ? nextLiquidation.date.toISOString() : null,
      nextExpectedAmount: nextLiquidation ? nextLiquidation.amount : null,
    };

    // Formatear las transacciones para la respuesta
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      transactionId: tx.transactionId,
      date: tx.date,
      amount: tx.amount,
      status: tx.status,
      paymentButtonId: tx.paymentButtonId,
      paymentButtonName: tx.paymentButton.name,
      liquidationId: tx.liquidationId,
      liquidationDate: tx.liquidation?.date || null,
      paymentMethod: tx.paymentMethod,
      quotas: tx.quotas
    }));

    // Ordenar por fecha, las más recientes primero
    formattedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Limitamos a 20 registros para no sobrecargar la respuesta
    const limitedTransactions = formattedTransactions.slice(0, 20);

    return res.status(200).json({
      success: true,
      message: 'Datos sincronizados correctamente',
      summary: reconciliationSummary,
      reconciliations: limitedTransactions,
      differences: {
        missing: differences.missing.length,
        mismatched: differences.mismatched.length,
        details: differences
      },
      updated: req.query.update === 'true',
      reconciliationStatus: req.query.update === 'true' ? reconciliationStatus : null
    });
  } catch (error) {
    console.error('Error al sincronizar datos de conciliación:', error);
    return res.status(500).json({ error: 'Error al sincronizar datos de conciliación' });
  } finally {
    await prisma.$disconnect();
  }
} 