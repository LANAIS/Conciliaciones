import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { ClickPaymentApiClient } from '../../../lib/services/clickPaymentApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de liquidación inválido' });
    }

    // Obtener la liquidación de la base de datos
    const liquidation = await prisma.liquidation.findUnique({
      where: { id },
      include: {
        paymentButton: {
          select: {
            name: true,
            organization: {
              select: {
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
            date: true,
            status: true,
            paymentMethod: true,
            quotas: true,
            currency: true
          }
        }
      }
    });

    if (!liquidation) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Generar datos ficticios de detalle basados en la documentación de la API de Click de Pago
    const detailedInfo = {
      liquidacionId: liquidation.liquidationId,
      cbu: `285034533009421${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
      cuit: `30${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      CantidadTX: liquidation.transactions.length,
      CantidadTXRechazos: 0,
      Comision: (liquidation.amount * 0.015).toFixed(2),
      DREI: 0,
      FechaLiquidacion: liquidation.date.toISOString(),
      FechaNegocio: new Date(liquidation.date.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      FechaProceso: new Date(liquidation.date.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      IVA: ((liquidation.amount * 0.015) * 0.21).toFixed(2),
      ImporteRechazos: "0.00",
      IncDecr: "0",
      NetoLiquidacion: liquidation.amount.toFixed(2),
      NombreSubente: liquidation.status === 'DÉBITO' ? "TARJETA DE DEBITO" : "TARJETA DE CRÉDITO",
      NumeroSubente: Math.floor(Math.random() * 100).toString(),
      Recaudacion: (liquidation.amount * 1.03).toFixed(2),
      Retencion: (liquidation.amount * 0.02).toFixed(2),
      Sellado: "0.00",
      Tipo: "0",
      TipoRechazo: "0",
      IdLiquidacion: Math.floor(Math.random() * 1000000).toString(),
      CodigoProvincia: 12,
      PercepcionIIBB: "0.00",
      PercepcionIVA: "0.00",
      RetencionGanancias: "0.00",
      RetencionIVA: "0.00",
      MontoPromocion: "0.00",
      RET_T30_IIBB: "0.00",
      RET_T30_IIGG: "0.00",
      RET_T30_IVA: "0.00"
    };

    return res.status(200).json({
      success: true,
      liquidation: {
        ...liquidation,
        date: liquidation.date.toISOString(),
        createdAt: liquidation.createdAt.toISOString(),
        updatedAt: liquidation.updatedAt.toISOString(),
        transactions: liquidation.transactions.map(tx => ({
          ...tx,
          date: tx.date.toISOString()
        }))
      },
      detailedInfo
    });
  } catch (error) {
    console.error('Error al obtener detalles de la liquidación:', error);
    return res.status(500).json({ error: 'Error al obtener detalles de la liquidación' });
  } finally {
    await prisma.$disconnect();
  }
} 