import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import ReconciliationService from '../../../lib/services/reconciliationService';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificamos la autenticación
    const session = await getSession({ req });
    if (!session || !session.user || !session.user.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Extraemos parámetros de la solicitud
    const { organizationId, fromDate, toDate, format: outputFormat = 'json' } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ message: 'Se requiere un ID de organización' });
    }

    // Obtenemos el usuario basado en el email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    
    if (!user) {
      return res.status(403).json({ message: 'Usuario no encontrado' });
    }

    // Verificamos que el usuario tenga acceso a esta organización
    const membership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId: organizationId as string
      },
      include: {
        role: true
      }
    });

    if (!membership) {
      return res.status(403).json({ message: 'No tienes acceso a esta organización' });
    }

    // Convertimos las fechas
    const startDate = fromDate ? new Date(fromDate as string) : undefined;
    const endDate = toDate ? new Date(toDate as string) : undefined;

    // Obtenemos los datos de la organización
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId as string }
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organización no encontrada' });
    }

    // Obtenemos el resumen de conciliación
    const summary = await ReconciliationService.getReconciliationSummary(
      organizationId as string, 
      startDate, 
      endDate
    );

    // Obtenemos los detalles de las transacciones
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentButton: {
          organizationId: organizationId as string
        },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        liquidation: true,
        paymentButton: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Generamos el reporte según el formato solicitado
    switch (outputFormat) {
      case 'excel':
        return generateExcelReport(res, organization, summary, transactions);
      
      case 'pdf':
        return generatePdfReport(res, organization, summary, transactions);
      
      default:
        // Formato JSON por defecto
        return res.status(200).json({
          organization,
          summary,
          transactions
        });
    }

  } catch (error: unknown) {
    console.error('Error al generar reporte de conciliación:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return res.status(500).json({
      message: 'Error al generar reporte de conciliación',
      error: errorMessage
    });
  }
}

/**
 * Genera un reporte en formato Excel
 */
async function generateExcelReport(
  res: NextApiResponse,
  organization: any,
  summary: any,
  transactions: any[]
) {
  // Creamos un nuevo libro de Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Conciliación Clic';
  workbook.created = new Date();
  
  // Hoja de resumen
  const summarySheet = workbook.addWorksheet('Resumen de Conciliación');
  
  // Configurar encabezado
  summarySheet.mergeCells('A1:F1');
  const headerRow = summarySheet.getRow(1);
  headerRow.getCell(1).value = `Reporte de Conciliación - ${organization.name}`;
  headerRow.font = { bold: true, size: 16 };
  headerRow.alignment = { horizontal: 'center' };
  
  // Información del periodo
  summarySheet.getRow(3).values = ['Periodo:', `${format(new Date(transactions[0]?.date || new Date()), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(transactions[transactions.length - 1]?.date || new Date()), 'dd/MM/yyyy', { locale: es })}`];
  
  // Totales
  summarySheet.getRow(5).values = ['Total Conciliado:', summary.totalReconciled];
  summarySheet.getRow(6).values = ['Total Pendiente:', summary.totalPending];
  summarySheet.getRow(7).values = ['Total Liquidado:', summary.totalLiquidated];
  
  // Detalles por método de pago
  summarySheet.getRow(9).values = ['Método de Pago', 'Conciliado', 'Pendiente', 'Total'];
  summarySheet.getRow(9).font = { bold: true };
  
  let rowIndex = 10;
  for (const [method, values] of Object.entries(summary.byPaymentMethod)) {
    const methodValues = values as { reconciled: number, pending: number, total: number };
    summarySheet.getRow(rowIndex).values = [
      method, 
      methodValues.reconciled, 
      methodValues.pending, 
      methodValues.total
    ];
    rowIndex++;
  }
  
  // Hoja de transacciones
  const transactionsSheet = workbook.addWorksheet('Transacciones');
  
  // Encabezados
  transactionsSheet.columns = [
    { header: 'ID Transacción', key: 'transactionId', width: 20 },
    { header: 'Fecha', key: 'date', width: 15 },
    { header: 'Monto', key: 'amount', width: 15 },
    { header: 'Método de Pago', key: 'paymentMethod', width: 20 },
    { header: 'Estado', key: 'status', width: 15 },
    { header: 'Botón de Pago', key: 'paymentButton', width: 20 },
    { header: 'ID Liquidación', key: 'liquidationId', width: 20 },
    { header: 'Fecha Esperada', key: 'expectedPayDate', width: 15 }
  ];
  
  // Datos
  transactions.forEach(transaction => {
    transactionsSheet.addRow({
      transactionId: transaction.transactionId,
      date: format(new Date(transaction.date), 'dd/MM/yyyy', { locale: es }),
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      paymentButton: transaction.paymentButton.name,
      liquidationId: transaction.liquidation?.liquidationId || 'Pendiente',
      expectedPayDate: transaction.expectedPayDate 
        ? format(new Date(transaction.expectedPayDate), 'dd/MM/yyyy', { locale: es })
        : 'N/A'
    });
  });
  
  // Enviar el archivo
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="conciliacion_${organization.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx"`);
  
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(buffer);
}

/**
 * Genera un reporte en formato PDF
 */
async function generatePdfReport(
  res: NextApiResponse,
  organization: any,
  summary: any,
  transactions: any[]
) {
  // Crear un nuevo documento PDF
  const doc = new PDFDocument({ margin: 50 });
  
  // Configurar cabecera
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="conciliacion_${organization.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf"`);
  
  // Pipe el PDF a la respuesta
  doc.pipe(res);
  
  // Título
  doc.fontSize(20).text(`Reporte de Conciliación - ${organization.name}`, { align: 'center' });
  doc.moveDown();
  
  // Información del periodo
  doc.fontSize(12).text(`Periodo: ${format(new Date(transactions[0]?.date || new Date()), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(transactions[transactions.length - 1]?.date || new Date()), 'dd/MM/yyyy', { locale: es })}`);
  doc.moveDown();
  
  // Resumen
  doc.fontSize(16).text('Resumen', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Total Conciliado: $${summary.totalReconciled.toFixed(2)}`);
  doc.text(`Total Pendiente: $${summary.totalPending.toFixed(2)}`);
  doc.text(`Total Liquidado: $${summary.totalLiquidated.toFixed(2)}`);
  doc.moveDown();
  
  // Detalle por método de pago
  doc.fontSize(14).text('Por Método de Pago', { underline: true });
  doc.moveDown(0.5);
  
  // Tabla de métodos de pago
  const methodTableTop = doc.y;
  doc.fontSize(10);
  
  // Encabezados de la tabla
  doc.text('Método', 50, methodTableTop);
  doc.text('Conciliado', 170, methodTableTop);
  doc.text('Pendiente', 270, methodTableTop);
  doc.text('Total', 370, methodTableTop);
  
  let rowTop = methodTableTop + 20;
  
  // Filas de la tabla
  for (const [method, values] of Object.entries(summary.byPaymentMethod)) {
    const methodValues = values as { reconciled: number, pending: number, total: number };
    
    doc.text(method, 50, rowTop);
    doc.text(`$${methodValues.reconciled.toFixed(2)}`, 170, rowTop);
    doc.text(`$${methodValues.pending.toFixed(2)}`, 270, rowTop);
    doc.text(`$${methodValues.total.toFixed(2)}`, 370, rowTop);
    
    rowTop += 20;
  }
  
  doc.moveDown(2);
  
  // Lista de transacciones
  doc.fontSize(16).text('Transacciones Recientes', { underline: true });
  doc.moveDown();
  
  // Limitamos a las 20 transacciones más recientes para el PDF
  const recentTransactions = transactions.slice(0, 20);
  
  // Tabla de transacciones
  const transTableTop = doc.y;
  doc.fontSize(9);
  
  // Encabezados
  doc.text('ID', 50, transTableTop, { width: 60, align: 'left' });
  doc.text('Fecha', 110, transTableTop, { width: 60, align: 'left' });
  doc.text('Monto', 170, transTableTop, { width: 50, align: 'right' });
  doc.text('Estado', 220, transTableTop, { width: 60, align: 'left' });
  doc.text('Liquidación', 280, transTableTop, { width: 70, align: 'left' });
  doc.text('F. Esperada', 370, transTableTop, { width: 70, align: 'left' });
  
  rowTop = transTableTop + 15;
  
  // Filas de transacciones
  recentTransactions.forEach(transaction => {
    // Si no hay suficiente espacio en la página, crear una nueva
    if (rowTop > doc.page.height - 100) {
      doc.addPage();
      rowTop = 50;
      
      // Repetir encabezados en la nueva página
      doc.text('ID', 50, rowTop, { width: 60, align: 'left' });
      doc.text('Fecha', 110, rowTop, { width: 60, align: 'left' });
      doc.text('Monto', 170, rowTop, { width: 50, align: 'right' });
      doc.text('Estado', 220, rowTop, { width: 60, align: 'left' });
      doc.text('Liquidación', 280, rowTop, { width: 70, align: 'left' });
      doc.text('F. Esperada', 370, rowTop, { width: 70, align: 'left' });
      
      rowTop += 15;
    }
    
    doc.text(transaction.transactionId.substring(0, 10) + '...', 50, rowTop, { width: 60, align: 'left' });
    doc.text(format(new Date(transaction.date), 'dd/MM/yyyy', { locale: es }), 110, rowTop, { width: 60, align: 'left' });
    doc.text(`$${transaction.amount.toFixed(2)}`, 170, rowTop, { width: 50, align: 'right' });
    doc.text(transaction.status, 220, rowTop, { width: 60, align: 'left' });
    doc.text(transaction.liquidation?.liquidationId?.substring(0, 10) + '...' || 'Pendiente', 280, rowTop, { width: 70, align: 'left' });
    doc.text(
      transaction.expectedPayDate 
        ? format(new Date(transaction.expectedPayDate), 'dd/MM/yyyy', { locale: es })
        : 'N/A', 
      370, rowTop, { width: 70, align: 'left' }
    );
    
    rowTop += 15;
  });
  
  // Nota final
  if (transactions.length > recentTransactions.length) {
    doc.moveDown(2);
    doc.fontSize(10).text(`Nota: Este reporte muestra solo las ${recentTransactions.length} transacciones más recientes de un total de ${transactions.length}.`, { align: 'center' });
  }
  
  // Pie de página con la fecha de generación
  doc.fontSize(8).text(
    `Reporte generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    50,
    doc.page.height - 50,
    { align: 'center' }
  );
  
  // Finalizar el PDF
  doc.end();
} 