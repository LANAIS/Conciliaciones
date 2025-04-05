import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';

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
    const { 
      organizationId, 
      paymentButtonId,
      startDate,
      endDate,
      status
    } = req.query;

    // Construir la consulta
    const queryConditions: any = {};
    
    // Filtro de organización o botón de pago
    if (paymentButtonId && typeof paymentButtonId === 'string') {
      // Si viene un botón específico, filtrar directamente por él
      queryConditions.paymentButtonId = paymentButtonId;
      
      // Verificar que el usuario tiene acceso al botón
      const paymentButton = await prisma.paymentButton.findFirst({
        where: {
          id: paymentButtonId,
          organization: {
            memberships: {
              some: {
                userId: session.user?.id as string
              }
            }
          }
        }
      });
      
      if (!paymentButton) {
        return res.status(403).json({ error: 'No tienes acceso a este botón de pago' });
      }
    } 
    else if (organizationId && typeof organizationId === 'string') {
      // Si solo viene la organización, obtener los botones a los que tiene acceso
      // y filtrar por ellos
      const membership = await prisma.membership.findFirst({
        where: {
          userId: session.user?.id as string,
          organizationId: organizationId
        }
      });

      if (!membership) {
        return res.status(403).json({ error: 'No tienes permiso para acceder a esta organización' });
      }
      
      // Obtener los botones de la organización
      const paymentButtons = await prisma.paymentButton.findMany({
        where: {
          organizationId: organizationId
        },
        select: {
          id: true
        }
      });
      
      if (paymentButtons.length === 0) {
        return res.status(200).json([]);
      }
      
      queryConditions.paymentButtonId = {
        in: paymentButtons.map(button => button.id)
      };
    } else {
      // Si no hay organización ni botón, obtener todas las organizaciones a las que tiene acceso
      const memberships = await prisma.membership.findMany({
        where: {
          userId: session.user?.id as string
        },
        select: {
          organizationId: true
        }
      });
      
      if (memberships.length === 0) {
        return res.status(200).json([]);
      }
      
      // Obtener todos los botones de esas organizaciones
      const paymentButtons = await prisma.paymentButton.findMany({
        where: {
          organizationId: {
            in: memberships.map(m => m.organizationId)
          }
        },
        select: {
          id: true
        }
      });
      
      if (paymentButtons.length === 0) {
        return res.status(200).json([]);
      }
      
      queryConditions.paymentButtonId = {
        in: paymentButtons.map(button => button.id)
      };
    }
    
    // Filtrar por fecha
    if (startDate && typeof startDate === 'string' && endDate && typeof endDate === 'string') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Ajustar al final del día
      
      queryConditions.date = {
        gte: start,
        lte: end
      };
    }
    // Si no hay fechas especificadas, no aplicamos filtro por fecha
    // Esto permitirá obtener todas las liquidaciones disponibles
    
    // Filtrar por estado
    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.status = status;
    }

    // Obtener las liquidaciones filtradas
    const liquidations = await prisma.liquidation.findMany({
      where: queryConditions,
      include: {
        paymentButton: {
          select: {
            id: true,
            name: true,
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
            transactionId: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Transformar los datos para que sean serializables (JSON)
    const serializedLiquidations = liquidations.map(liq => {
      // Formato básico de la liquidación
      const basicInfo = {
        id: liq.id,
        liquidationId: liq.liquidationId,
        date: liq.date.toISOString(),
        amount: liq.amount,
        status: liq.status,
        currency: liq.currency,
        transactionCount: liq.transactions.length,
        organizationId: liq.paymentButton.organization.id,
        organization: liq.paymentButton.organization.name,
        paymentButtonId: liq.paymentButton.id,
        paymentButton: liq.paymentButton.name
      };

      // Formato compatible con ClickPagoLiquidacion para el calendario
      if (req.headers.referer?.includes("/calendar")) {
        return {
          ...basicInfo,
          // Campos requeridos por el calendario (formato ClickPagoLiquidacion)
          IdLiquidacion: liq.liquidationId,
          FechaLiquidacion: liq.date.toISOString(),
          FechaNegocio: liq.date.toISOString(),
          FechaProceso: liq.date.toISOString(),
          CantidadTX: liq.transactions.length,
          CantidadTXRechazos: 0,
          NetoLiquidacion: liq.amount.toString(),
          Recaudacion: liq.amount.toString(),
          // Otros campos obligatorios
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
          Sellado: "0",
          Tipo: "",
          TipoRechazo: "",
          CodigoProvincia: 0,
          PercepcionIIBB: "0",
          PercepcionIVA: "0",
          RetencionGanancias: "0",
          RetencionIVA: "0",
          MontoPromocion: "0",
          RET_T30_IIBB: "0",
          RET_T30_IIGG: "0",
          RET_T30_IVA: "0"
        };
      }

      // Para otras páginas, devolver el formato básico
      return basicInfo;
    });

    return res.status(200).json(serializedLiquidations);
  } catch (error) {
    console.error('Error al obtener liquidaciones:', error);
    return res.status(500).json({ error: 'Error al obtener liquidaciones' });
  } finally {
    await prisma.$disconnect();
  }
} 