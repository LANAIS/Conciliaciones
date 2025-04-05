import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { TRANSACTION_STATUSES, LIQUIDATION_STATUSES } from '../../utils/transactionUtils';

// Esta API es específicamente para informes detallados de liquidaciones
// Incluye información extendida compatible con ClickPagoLiquidacion
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
  const { organizationId, paymentButtonId, startDate, endDate, status } = req.query;

  // Fechas ya no son obligatorias para permitir más flexibilidad
  // if (!startDate || !endDate) {
  //   return res.status(400).json({ error: 'Fechas no especificadas' });
  // }

  // Inicializar el cliente de Prisma
  const prisma = new PrismaClient();

  try {
    // Construir condiciones de búsqueda
    const queryConditions: any = {};

    // Agregar filtro de fechas solo si ambas están especificadas
    if (startDate && endDate) {
      queryConditions.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

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

    // Filtrar por estado si se especifica
    if (status && status !== 'all') {
      queryConditions.status = status as string;
    }

    // Obtener liquidaciones que cumplan con los criterios
    const liquidations = await prisma.liquidation.findMany({
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
        transactions: {
          select: {
            id: true,
            transactionId: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            quotas: true,
            date: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log(`Se encontraron ${liquidations.length} liquidaciones en la base de datos.`);

    // Transformar datos para la respuesta, con estructura compatible con ClickPagoLiquidacion
    const formattedLiquidations = liquidations.map(liq => {
      // Calcular montos por método de pago
      const paymentMethodTotals: Record<string, number> = {};
      const validTransactions = liq.transactions.filter(tx => tx.status === TRANSACTION_STATUSES.REALIZADA);
      
      validTransactions.forEach(tx => {
        const method = tx.paymentMethod || 'OTROS';
        if (!paymentMethodTotals[method]) {
          paymentMethodTotals[method] = 0;
        }
        paymentMethodTotals[method] += tx.amount;
      });

      // Calcular monto total
      const totalAmount = validTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        id: liq.id,
        liquidationId: liq.liquidationId,
        IdLiquidacion: liq.liquidationId,
        FechaLiquidacion: liq.date.toISOString(),
        FechaNegocio: liq.date.toISOString(),
        FechaProceso: liq.date.toISOString(),
        date: liq.date.toISOString(),
        amount: liq.amount,
        NetoLiquidacion: liq.amount.toString(),
        status: liq.status,
        currency: liq.currency,
        CantidadTX: validTransactions.length,
        CantidadTXRechazos: 0,
        transactionCount: validTransactions.length,
        paymentMethodTotals: paymentMethodTotals,
        organizationId: liq.paymentButton.organization.id,
        organization: liq.paymentButton.organization.name,
        paymentButtonId: liq.paymentButton.id,
        paymentButton: liq.paymentButton.name,
        Recaudacion: totalAmount.toString(),
        // Otros campos para compatibilidad
        cbu: "",
        cuit: "",
        Comision: "0",
        DREI: 0,
        IVA: "0",
        ImporteRechazos: "0",
        IncDecr: "0",
        NombreSubente: liq.paymentButton.name,
        NumeroSubente: liq.id.substring(0, 5),
        Retencion: "0",
        Sellado: "0"
      };
    });

    // Si no hay liquidaciones, informamos pero devolvemos un array vacío
    if (formattedLiquidations.length === 0) {
      console.log('No se encontraron liquidaciones en la base de datos para los criterios especificados');
    }

    // Si la solicitud viene del calendario, asegurarse de que tiene todos los campos necesarios
    if (req.headers.referer?.includes("/calendar")) {
      console.log("Solicitud desde calendario, formateando respuesta apropiadamente");
      // Asegúrese de que cada liquidación tiene todos los campos esperados por el calendario
      formattedLiquidations.forEach(liq => {
        if (!liq.FechaLiquidacion) liq.FechaLiquidacion = liq.date;
        if (!liq.IdLiquidacion) liq.IdLiquidacion = liq.liquidationId;
        if (!liq.NetoLiquidacion) liq.NetoLiquidacion = liq.amount?.toString() || "0";
      });
    }

    return res.status(200).json(formattedLiquidations);
  } catch (error) {
    console.error('Error en API de liquidaciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 