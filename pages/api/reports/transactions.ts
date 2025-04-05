import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { generateTransactionsReport } from '../../../lib/services/reportService';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar que sea una solicitud POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar la autenticación del usuario
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Obtener los parámetros de la solicitud
    const { 
      format,
      dateRange,
      organizationId,
      paymentButtonId,
      status
    } = req.body;

    // Validar parámetros
    if (!format || !dateRange || !dateRange.startDate || !dateRange.endDate) {
      return res.status(400).json({ message: 'Parámetros incorrectos' });
    }

    // Construir filtros de búsqueda
    const filters: any = {
      date: {
        gte: new Date(dateRange.startDate),
        lte: new Date(dateRange.endDate)
      }
    };

    // Agregar filtros opcionales
    if (status && status !== 'all') {
      filters.status = status;
    }

    if (paymentButtonId) {
      filters.paymentButtonId = paymentButtonId;
    } else if (organizationId) {
      // Si no se especifica un botón de pago pero sí una organización,
      // obtener todos los botones de pago de esa organización
      const paymentButtons = await prisma.paymentButton.findMany({
        where: { organizationId }
      });

      if (paymentButtons.length > 0) {
        filters.paymentButtonId = {
          in: paymentButtons.map(btn => btn.id)
        };
      }
    }

    // Consultar transacciones en la base de datos
    const transactions = await prisma.transaction.findMany({
      where: filters,
      orderBy: {
        date: 'desc'
      },
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
        }
      }
    });

    // Generar el informe
    const reportData = await generateTransactionsReport(
      transactions,
      format,
      dateRange
    );

    // Configurar la respuesta según el formato
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=transacciones.xlsx');
      // Convertir Buffer a ArrayBuffer
      const buffer = Buffer.from(reportData as Buffer);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transacciones.pdf');
      // Convertir Uint8Array a Buffer
      const buffer = Buffer.from(reportData as Uint8Array);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error al generar informe de transacciones:', error);
    res.status(500).json({ 
      message: 'Error al generar el informe', 
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 