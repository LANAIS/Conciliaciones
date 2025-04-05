import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

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
    const { id, format } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de liquidación inválido' });
    }

    if (!format || (format !== 'excel' && format !== 'pdf')) {
      return res.status(400).json({ error: 'Formato inválido. Debe ser "excel" o "pdf"' });
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

    // Verificar que el usuario tiene acceso a esta liquidación
    const userHasAccess = await prisma.membership.findFirst({
      where: {
        userId: session.user?.id as string,
        organization: {
          paymentButtons: {
            some: {
              id: liquidation.paymentButtonId
            }
          }
        }
      }
    });

    if (!userHasAccess) {
      return res.status(403).json({ error: 'No tienes acceso a esta liquidación' });
    }

    // Generar datos ficticios de detalle similares a los del endpoint [id].ts
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

    // Manejar la exportación según el formato solicitado
    if (format === 'excel') {
      // Crear un nuevo libro de Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CLIC de Pago';
      workbook.created = new Date();
      
      // Crear hoja de información general
      const infoSheet = workbook.addWorksheet('Información General');
      
      // Establecer encabezados y estilos
      infoSheet.columns = [
        { header: 'Campo', key: 'campo', width: 30 },
        { header: 'Valor', key: 'valor', width: 40 }
      ];
      
      // Añadir datos de información general
      infoSheet.addRow({ campo: 'ID de Liquidación', valor: detailedInfo.liquidacionId });
      infoSheet.addRow({ campo: 'Organización', valor: liquidation.paymentButton.organization.name });
      infoSheet.addRow({ campo: 'Botón de Pago', valor: liquidation.paymentButton.name });
      infoSheet.addRow({ campo: 'Fecha de Liquidación', valor: new Date(detailedInfo.FechaLiquidacion).toLocaleString() });
      infoSheet.addRow({ campo: 'Estado', valor: liquidation.status });
      infoSheet.addRow({ campo: 'CBU', valor: detailedInfo.cbu });
      infoSheet.addRow({ campo: 'CUIT', valor: detailedInfo.cuit });
      
      // Sección de montos
      infoSheet.addRow({ campo: '', valor: '' }); // Fila vacía para separación
      infoSheet.addRow({ campo: '--- MONTOS ---', valor: '' });
      infoSheet.addRow({ campo: 'Recaudación', valor: `$${detailedInfo.Recaudacion}` });
      infoSheet.addRow({ campo: 'Comisión', valor: `$${detailedInfo.Comision}` });
      infoSheet.addRow({ campo: 'IVA', valor: `$${detailedInfo.IVA}` });
      infoSheet.addRow({ campo: 'Retención', valor: `$${detailedInfo.Retencion}` });
      infoSheet.addRow({ campo: 'Neto Liquidación', valor: `$${detailedInfo.NetoLiquidacion}` });
      
      // Crear hoja para transacciones
      const txSheet = workbook.addWorksheet('Transacciones');
      
      // Establecer encabezados para transacciones
      txSheet.columns = [
        { header: 'ID Transacción', key: 'id', width: 20 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Monto', key: 'monto', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Método de Pago', key: 'metodo', width: 20 },
        { header: 'Cuotas', key: 'cuotas', width: 10 }
      ];
      
      // Añadir datos de transacciones
      liquidation.transactions.forEach(tx => {
        txSheet.addRow({
          id: tx.transactionId,
          fecha: new Date(tx.date).toLocaleString(),
          monto: `$${tx.amount.toLocaleString('es-AR')}`,
          estado: tx.status,
          metodo: tx.paymentMethod,
          cuotas: tx.quotas
        });
      });
      
      // Establecer el tipo de contenido para la respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=liquidacion_${liquidation.liquidationId}.xlsx`);
      
      // Generar el archivo y enviarlo como respuesta
      const buffer = await workbook.xlsx.writeBuffer();
      res.status(200).send(buffer);
      
    } else if (format === 'pdf') {
      // Para la exportación PDF, utilizaremos un servicio de terceros o un método alternativo
      // Por ahora, retornamos un JSON con los datos para que el cliente pueda generar el PDF
      
      // Formatear las transacciones
      const formattedTransactions = liquidation.transactions.map(tx => ({
        id: tx.transactionId,
        fecha: new Date(tx.date).toLocaleString('es-AR'),
        monto: tx.amount.toLocaleString('es-AR'),
        estado: tx.status,
        metodo: tx.paymentMethod,
        cuotas: tx.quotas
      }));
      
      // Preparar los datos para el PDF
      const pdfData = {
        liquidacion: {
          id: liquidation.liquidationId,
          fecha: new Date(liquidation.date).toLocaleString('es-AR'),
          monto: liquidation.amount.toLocaleString('es-AR'),
          estado: liquidation.status,
          organizacion: liquidation.paymentButton.organization.name,
          boton: liquidation.paymentButton.name
        },
        detalles: {
          cbu: detailedInfo.cbu,
          cuit: detailedInfo.cuit,
          comision: detailedInfo.Comision,
          iva: detailedInfo.IVA,
          retencion: detailedInfo.Retencion,
          netoLiquidacion: detailedInfo.NetoLiquidacion,
          recaudacion: detailedInfo.Recaudacion
        },
        transacciones: formattedTransactions
      };
      
      // Redireccionar a una página HTML donde podemos generar el PDF en el cliente
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        data: pdfData,
        message: 'Para generar el PDF, hemos enviado los datos necesarios. Por favor, utilice un servicio de generación de PDF en el cliente o descargue la versión Excel.'
      });
    }
  } catch (error) {
    console.error('Error al exportar liquidación:', error);
    res.status(500).json({ 
      error: 'Error al exportar la liquidación',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    await prisma.$disconnect();
  }
} 