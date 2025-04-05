import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Roles permitidos para exportar informes
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
    // Validar permisos
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { 
        memberships: {
          include: {
            organization: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Verificar si el usuario tiene algún rol permitido
    const userRoles = user.memberships.map(m => m.role.name);
    const hasAllowedRole = userRoles.some(role => ALLOWED_ROLES.includes(role));
    
    if (!hasAllowedRole) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Obtener parámetros
    const { 
      format, 
      organizationId, 
      paymentButtonId, 
      startDate, 
      endDate 
    } = req.query;

    // Validar parámetros requeridos
    if (!format || !organizationId || !paymentButtonId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (format, organizationId, paymentButtonId)' });
    }

    // Validar formato solicitado
    if (format !== 'excel' && format !== 'pdf') {
      return res.status(400).json({ error: 'Formato no soportado. Use "excel" o "pdf"' });
    }

    // Verificar si el usuario es super admin
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    
    // Verificar acceso a la organización
    if (!isSuperAdmin) {
      const hasAccess = user.memberships.some(m => m.organization.id === organizationId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tiene acceso a esta organización' });
      }
    }

    // Obtener información de la organización y botón de pago
    const [organization, paymentButton] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId as string } }),
      prisma.paymentButton.findUnique({ where: { id: paymentButtonId as string } })
    ]);

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    if (!paymentButton) {
      return res.status(404).json({ error: 'Botón de pago no encontrado' });
    }

    if (paymentButton.organizationId !== organizationId) {
      return res.status(400).json({ error: 'El botón de pago no pertenece a la organización seleccionada' });
    }

    // Construir condiciones de consulta para transacciones
    const where: any = {
      paymentButtonId: paymentButtonId as string
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    // Obtener datos de conciliación
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Obtener resumen de conciliación
    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
      matchedTransactions: transactions.filter(tx => tx.status === 'MATCHED').length,
      matchedAmount: transactions.filter(tx => tx.status === 'MATCHED')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
      pendingTransactions: transactions.filter(tx => tx.status === 'PENDING').length,
      pendingAmount: transactions.filter(tx => tx.status === 'PENDING')
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
    };

    // Generar el reporte según el formato solicitado
    if (format === 'excel') {
      return await generateExcelReport(
        res, 
        organization, 
        paymentButton, 
        transactions, 
        summary,
        startDate as string | undefined,
        endDate as string | undefined
      );
    } else {
      return await generatePdfReport(
        res, 
        organization, 
        paymentButton, 
        transactions, 
        summary,
        startDate as string | undefined,
        endDate as string | undefined
      );
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    return res.status(500).json({ error: 'Error al generar el reporte' });
  } finally {
    await prisma.$disconnect();
  }
}

// Generar reporte Excel
async function generateExcelReport(
  res: NextApiResponse,
  organization: any,
  paymentButton: any,
  transactions: any[],
  summary: any,
  startDate?: string,
  endDate?: string
) {
  // Crear libro y hoja de trabajo Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Conciliaciones';
  workbook.created = new Date();
  
  // Hoja de resumen
  const summarySheet = workbook.addWorksheet('Resumen');
  
  // Encabezado con información del reporte
  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Informe de Conciliación';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };
  
  // Información básica
  summarySheet.mergeCells('A2:F2');
  const subTitleCell = summarySheet.getCell('A2');
  subTitleCell.value = `Organización: ${organization.name} - Botón de pago: ${paymentButton.name}`;
  subTitleCell.alignment = { horizontal: 'center' };
  
  if (startDate && endDate) {
    summarySheet.mergeCells('A3:F3');
    const dateRangeCell = summarySheet.getCell('A3');
    dateRangeCell.value = `Período: ${format(new Date(startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(endDate), 'dd/MM/yyyy', { locale: es })}`;
    dateRangeCell.alignment = { horizontal: 'center' };
  }
  
  // Espacio
  summarySheet.addRow([]);
  
  // Datos de resumen
  summarySheet.addRow(['Resumen de conciliación']);
  const headerRow = summarySheet.lastRow;
  if (headerRow) {
    headerRow.font = { bold: true };
  }
  
  summarySheet.addRow(['Total de transacciones', summary.totalTransactions]);
  summarySheet.addRow(['Monto total', formatCurrency(summary.totalAmount)]);
  summarySheet.addRow(['Transacciones conciliadas', summary.matchedTransactions]);
  summarySheet.addRow(['Monto conciliado', formatCurrency(summary.matchedAmount)]);
  summarySheet.addRow(['Transacciones pendientes', summary.pendingTransactions]);
  summarySheet.addRow(['Monto pendiente', formatCurrency(summary.pendingAmount)]);
  
  // Espacio
  summarySheet.addRow([]);
  summarySheet.addRow([]);
  
  // Gráfico de estado
  const chartData = [
    ['Estado', 'Cantidad'],
    ['Conciliadas', summary.matchedTransactions],
    ['Pendientes', summary.pendingTransactions]
  ];
  
  // Añadir datos para el gráfico
  for (const row of chartData) {
    summarySheet.addRow(row);
  }
  
  // Ajustar anchos de columna
  summarySheet.columns.forEach(column => {
    if (column && typeof column === 'object') {
      column.width = 20;
    }
  });
  
  // Hoja de transacciones
  const txSheet = workbook.addWorksheet('Transacciones');
  
  // Encabezados de tabla
  txSheet.addRow([
    'ID',
    'Referencia',
    'Fecha',
    'Monto',
    'Estado',
    'Método de pago',
    'Última actualización'
  ]);
  
  const txHeaderRow = txSheet.lastRow;
  if (txHeaderRow) {
    txHeaderRow.font = { bold: true };
    txHeaderRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
  }
  
  // Agregar datos de transacciones
  for (const tx of transactions) {
    txSheet.addRow([
      tx.id,
      tx.reference,
      format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm', { locale: es }),
      Number(tx.amount),
      getStatusText(tx.status),
      tx.paymentMethod,
      format(new Date(tx.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })
    ]);
    
    // Dar formato a la celda de monto
    const lastRow = txSheet.lastRow;
    if (lastRow) {
      const amountCell = lastRow.getCell(4);
      amountCell.numFmt = '$#,##0.00';
    }
  }
  
  // Formato condicional para estado
  txSheet.addConditionalFormatting({
    ref: `E2:E${transactions.length + 1}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'Conciliado',
        priority: 1,
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFE0FFE0' }
          }
        }
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'Pendiente',
        priority: 2,
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFF0C0' }
          }
        }
      }
    ]
  });
  
  // Ajustar anchos de columna
  txSheet.columns.forEach(column => {
    if (column && typeof column === 'object') {
      column.width = 18;
    }
  });
  
  // Configurar respuesta
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=conciliacion_${formatDateForFilename(new Date())}.xlsx`
  );
  
  // Escribir archivo
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(buffer);
}

// Generar reporte PDF
async function generatePdfReport(
  res: NextApiResponse,
  organization: any,
  paymentButton: any,
  transactions: any[],
  summary: any,
  startDate?: string,
  endDate?: string
) {
  // Crear documento PDF
  const doc = new PDFDocument({ margin: 50 });
  
  // Configurar respuesta
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=conciliacion_${formatDateForFilename(new Date())}.pdf`
  );
  
  // Pipe al response
  doc.pipe(res);
  
  // Título e información básica
  doc.fontSize(20).text('Informe de Conciliación', { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(12).text(`Organización: ${organization.name}`, { align: 'center' });
  doc.fontSize(12).text(`Botón de pago: ${paymentButton.name}`, { align: 'center' });
  
  if (startDate && endDate) {
    doc.fontSize(12).text(
      `Período: ${format(new Date(startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(endDate), 'dd/MM/yyyy', { locale: es })}`,
      { align: 'center' }
    );
  }
  
  doc.moveDown(2);
  
  // Resumen de conciliación
  doc.fontSize(16).text('Resumen de conciliación', { underline: true });
  doc.moveDown();
  
  const summaryTableData = [
    ['Métrica', 'Valor'],
    ['Total de transacciones', summary.totalTransactions.toString()],
    ['Monto total', formatCurrency(summary.totalAmount)],
    ['Transacciones conciliadas', summary.matchedTransactions.toString()],
    ['Monto conciliado', formatCurrency(summary.matchedAmount)],
    ['Transacciones pendientes', summary.pendingTransactions.toString()],
    ['Monto pendiente', formatCurrency(summary.pendingAmount)]
  ];
  
  // Dibujar tabla de resumen
  drawTable(doc, summaryTableData, 50, doc.y, 500);
  
  doc.moveDown(3);
  
  // Sección de gráficos
  doc.fontSize(16).text('Distribución de estado', { underline: true });
  doc.moveDown();
  
  const total = summary.matchedTransactions + summary.pendingTransactions;
  const matchedPercentage = total > 0 ? (summary.matchedTransactions / total) * 100 : 0;
  const pendingPercentage = total > 0 ? (summary.pendingTransactions / total) * 100 : 0;
  
  // Dibujar "gráfico" simple
  doc.text(`Transacciones conciliadas: ${matchedPercentage.toFixed(1)}%`);
  doc.rect(50, doc.y + 5, matchedPercentage * 4, 15).fill('#90EE90');
  doc.moveDown(1.5);
  
  doc.text(`Transacciones pendientes: ${pendingPercentage.toFixed(1)}%`);
  doc.rect(50, doc.y + 5, pendingPercentage * 4, 15).fill('#FFD700');
  doc.moveDown(3);
  
  // Lista de transacciones
  doc.addPage();
  doc.fontSize(16).text('Detalle de transacciones', { underline: true });
  doc.moveDown();
  
  // Datos de tabla de transacciones
  const txTableHeaders = ['ID', 'Referencia', 'Fecha', 'Monto', 'Estado'];
  const txTableData = [txTableHeaders];
  
  // Limitar a 20 transacciones para no hacer el PDF demasiado grande
  const displayTransactions = transactions.slice(0, 20);
  
  for (const tx of displayTransactions) {
    txTableData.push([
      tx.id.substring(0, 8) + '...',
      tx.reference || '-',
      format(new Date(tx.createdAt), 'dd/MM/yy', { locale: es }),
      formatCurrency(tx.amount),
      getStatusText(tx.status)
    ]);
  }
  
  // Dibujar tabla de transacciones
  drawTable(doc, txTableData, 50, doc.y, 500);
  
  if (transactions.length > 20) {
    doc.moveDown();
    doc.fontSize(10).text(`Mostrando 20 de ${transactions.length} transacciones totales.`, { align: 'center' });
  }
  
  // Finalizar documento
  doc.end();
}

// Función auxiliar para dibujar tablas en PDF
function drawTable(
  doc: PDFKit.PDFDocument, 
  data: string[][], 
  x: number, 
  y: number, 
  width: number
) {
  const rowHeight = 20;
  const columnCount = data[0].length;
  const columnWidth = width / columnCount;
  
  // Dibujar filas
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowY = y + i * rowHeight;
    
    // Sombreado para encabezado
    if (i === 0) {
      doc.rect(x, rowY, width, rowHeight).fill('#E0E0E0');
    } else if (i % 2 === 1) {
      doc.rect(x, rowY, width, rowHeight).fill('#F5F5F5');
    }
    
    // Dibujar bordes de celda
    doc.rect(x, rowY, width, rowHeight).stroke();
    
    // Dibujar divisiones de columna
    for (let j = 1; j < columnCount; j++) {
      doc.moveTo(x + j * columnWidth, rowY)
         .lineTo(x + j * columnWidth, rowY + rowHeight)
         .stroke();
    }
    
    // Dibujar texto en celdas
    for (let j = 0; j < row.length; j++) {
      const cellX = x + j * columnWidth;
      
      doc.fontSize(i === 0 ? 10 : 9)
         .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .text(
           row[j], 
           cellX + 2, 
           rowY + 5, 
           { width: columnWidth - 4, align: 'center' }
         );
    }
  }
  
  // Actualizar posición Y
  return y + data.length * rowHeight;
}

// Función auxiliar para formatear moneda
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

// Función auxiliar para traducir estados
function getStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'PENDING': 'Pendiente',
    'MATCHED': 'Conciliado',
    'LOCAL_ONLY': 'Solo Local',
    'API_ONLY': 'Solo API'
  };
  
  return statusMap[status] || status;
}

// Función auxiliar para formatear fecha para nombre de archivo
function formatDateForFilename(date: Date): string {
  return format(date, 'yyyyMMdd_HHmmss');
} 