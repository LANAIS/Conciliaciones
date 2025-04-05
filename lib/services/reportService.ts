import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos para los informes
export type ReportType = 'transactions' | 'liquidations' | 'reconciliation';
export type ReportFormat = 'excel' | 'pdf';

// Interfaz para los datos de transacciones
interface Transaction {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  quotas: number;
  date: Date;
  expectedPayDate?: Date | null;
  liquidationId?: string | null;
}

// Interfaz para los datos de liquidaciones
interface Liquidation {
  id: string;
  liquidationId: string;
  amount: number;
  currency: string;
  date: Date;
  status: string;
  transactionCount?: number;
}

// Interfaz para los datos de conciliación
interface ReconciliationReport {
  totalTransactions: number;
  totalAmount: number;
  matchedTransactions: number;
  matchedAmount: number;
  pendingTransactions: number;
  pendingAmount: number;
  nextExpectedLiquidation: string;
  nextExpectedAmount: number;
  transactions: Transaction[];
  liquidations: Liquidation[];
}

/**
 * Genera un informe de transacciones en el formato especificado
 */
export async function generateTransactionsReport(
  transactions: Transaction[],
  format: ReportFormat,
  dateRange: { startDate: string; endDate: string }
): Promise<Buffer | Uint8Array> {
  const reportTitle = `Informe de Transacciones (${format === 'excel' ? 'XLSX' : 'PDF'})`;
  const fileName = `transacciones_${format === 'excel' ? '.xlsx' : '.pdf'}`;
  
  if (format === 'excel') {
    return await generateExcelReport(transactions, reportTitle, fileName, 'transactions', dateRange);
  } else {
    return generatePdfReport(transactions, reportTitle, fileName, 'transactions', dateRange);
  }
}

/**
 * Genera un informe de liquidaciones en el formato especificado
 */
export async function generateLiquidationsReport(
  liquidations: Liquidation[],
  format: ReportFormat,
  dateRange: { startDate: string; endDate: string }
): Promise<Buffer | Uint8Array> {
  const reportTitle = `Informe de Liquidaciones (${format === 'excel' ? 'XLSX' : 'PDF'})`;
  const fileName = `liquidaciones_${format === 'excel' ? '.xlsx' : '.pdf'}`;
  
  if (format === 'excel') {
    return await generateExcelReport(liquidations, reportTitle, fileName, 'liquidations', dateRange);
  } else {
    return generatePdfReport(liquidations, reportTitle, fileName, 'liquidations', dateRange);
  }
}

/**
 * Genera un informe de conciliación en el formato especificado
 */
export async function generateReconciliationReport(
  reconciliationData: ReconciliationReport,
  format: ReportFormat,
  dateRange: { startDate: string; endDate: string }
): Promise<Buffer | Uint8Array> {
  const reportTitle = `Informe de Conciliación (${format === 'excel' ? 'XLSX' : 'PDF'})`;
  const fileName = `conciliacion_${format === 'excel' ? '.xlsx' : '.pdf'}`;
  
  if (format === 'excel') {
    return await generateExcelReconciliationReport(reconciliationData, reportTitle, fileName, dateRange);
  } else {
    return generatePdfReconciliationReport(reconciliationData, reportTitle, fileName, dateRange);
  }
}

/**
 * Genera un informe en formato Excel
 */
async function generateExcelReport(
  data: any[],
  title: string,
  fileName: string,
  type: 'transactions' | 'liquidations',
  dateRange: { startDate: string; endDate: string }
): Promise<Buffer> {
  // Crear un nuevo libro de Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CLIC Conciliaciones';
  workbook.created = new Date();
  
  // Crear una hoja de trabajo
  const worksheet = workbook.addWorksheet('Datos');
  
  // Agregar título
  worksheet.mergeCells('A1:H1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = title;
  titleRow.font = {
    size: 16,
    bold: true
  };
  titleRow.alignment = { horizontal: 'center' };
  
  // Agregar información del rango de fechas
  worksheet.mergeCells('A2:H2');
  const dateRangeCell = worksheet.getCell('A2');
  dateRangeCell.value = `Período: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy', { locale: es })}`;
  dateRangeCell.font = {
    size: 12,
    italic: true
  };
  dateRangeCell.alignment = { horizontal: 'center' };
  
  // Configurar encabezados según el tipo de informe
  let headers: string[] = [];
  
  if (type === 'transactions') {
    headers = ['ID Transacción', 'Fecha', 'Monto', 'Estado', 'Método de Pago', 'Cuotas', 'Fecha de Pago Est.', 'ID Liquidación'];
  } else if (type === 'liquidations') {
    headers = ['ID Liquidación', 'Fecha', 'Monto', 'Estado', 'Cant. Transacciones'];
  }
  
  // Agregar encabezados
  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers);
  if (headerRow) {
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4B5563' }
      };
      cell.font = {
        color: { argb: 'FFFFFF' },
        bold: true
      };
    });
  }
  
  // Agregar datos
  if (type === 'transactions') {
    data.forEach((tx: Transaction) => {
      worksheet.addRow([
        tx.transactionId,
        format(new Date(tx.date), 'dd/MM/yyyy HH:mm', { locale: es }),
        tx.amount.toLocaleString('es-AR', { style: 'currency', currency: tx.currency }),
        tx.status,
        tx.paymentMethod,
        tx.quotas,
        tx.expectedPayDate ? format(new Date(tx.expectedPayDate), 'dd/MM/yyyy', { locale: es }) : '-',
        tx.liquidationId || '-'
      ]);
    });
  } else if (type === 'liquidations') {
    data.forEach((liq: Liquidation) => {
      worksheet.addRow([
        liq.liquidationId,
        format(new Date(liq.date), 'dd/MM/yyyy HH:mm', { locale: es }),
        liq.amount.toLocaleString('es-AR', { style: 'currency', currency: liq.currency }),
        liq.status,
        liq.transactionCount || 0
      ]);
    });
  }
  
  // Ajustar anchos de columna
  worksheet.columns.forEach(column => {
    if (column && typeof column.eachCell === 'function') {  // Verificar que column no sea undefined y tenga el método eachCell
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    }
  });
  
  // Generar el archivo
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Genera un informe de Excel para la conciliación
 */
async function generateExcelReconciliationReport(
  data: ReconciliationReport,
  title: string,
  fileName: string,
  dateRange: { startDate: string; endDate: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CLIC Conciliaciones';
  workbook.created = new Date();
  
  // Crear hojas de trabajo: Resumen, Transacciones y Liquidaciones
  const summarySheet = workbook.addWorksheet('Resumen');
  const txSheet = workbook.addWorksheet('Transacciones');
  const liqSheet = workbook.addWorksheet('Liquidaciones');
  
  // Preparar la hoja de resumen
  summarySheet.mergeCells('A1:D1');
  const titleRow = summarySheet.getCell('A1');
  titleRow.value = title;
  titleRow.font = {
    size: 16,
    bold: true
  };
  titleRow.alignment = { horizontal: 'center' };
  
  summarySheet.mergeCells('A2:D2');
  const dateRangeCell = summarySheet.getCell('A2');
  dateRangeCell.value = `Período: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy', { locale: es })}`;
  dateRangeCell.font = {
    size: 12,
    italic: true
  };
  dateRangeCell.alignment = { horizontal: 'center' };
  
  // Datos de resumen
  summarySheet.addRow([]);
  summarySheet.addRow(['Transacciones totales', data.totalTransactions]);
  summarySheet.addRow(['Monto total', data.totalAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })]);
  summarySheet.addRow(['Transacciones conciliadas', data.matchedTransactions]);
  summarySheet.addRow(['Monto conciliado', data.matchedAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })]);
  summarySheet.addRow(['Transacciones pendientes', data.pendingTransactions]);
  summarySheet.addRow(['Monto pendiente', data.pendingAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })]);
  summarySheet.addRow(['Próxima liquidación', format(new Date(data.nextExpectedLiquidation), 'dd/MM/yyyy', { locale: es })]);
  summarySheet.addRow(['Monto próxima liquidación', data.nextExpectedAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })]);
  
  // Configurar hojas de transacciones y liquidaciones
  // Transacciones
  txSheet.addRow(['ID Transacción', 'Fecha', 'Monto', 'Estado', 'Método de Pago', 'Cuotas', 'Fecha de Pago Est.', 'ID Liquidación']);
  const txHeaderRow = txSheet.getRow(1);
  if (txHeaderRow) {
    txHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4B5563' }
      };
      cell.font = {
        color: { argb: 'FFFFFF' },
        bold: true
      };
    });
  }
  
  data.transactions.forEach((tx) => {
    txSheet.addRow([
      tx.transactionId,
      format(new Date(tx.date), 'dd/MM/yyyy HH:mm', { locale: es }),
      tx.amount.toLocaleString('es-AR', { style: 'currency', currency: tx.currency }),
      tx.status,
      tx.paymentMethod,
      tx.quotas,
      tx.expectedPayDate ? format(new Date(tx.expectedPayDate), 'dd/MM/yyyy', { locale: es }) : '-',
      tx.liquidationId || '-'
    ]);
  });
  
  // Liquidaciones
  liqSheet.addRow(['ID Liquidación', 'Fecha', 'Monto', 'Estado', 'Cant. Transacciones']);
  const liqHeaderRow = liqSheet.getRow(1);
  if (liqHeaderRow) {
    liqHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4B5563' }
      };
      cell.font = {
        color: { argb: 'FFFFFF' },
        bold: true
      };
    });
  }
  
  data.liquidations.forEach((liq) => {
    liqSheet.addRow([
      liq.liquidationId,
      format(new Date(liq.date), 'dd/MM/yyyy HH:mm', { locale: es }),
      liq.amount.toLocaleString('es-AR', { style: 'currency', currency: liq.currency }),
      liq.status,
      liq.transactionCount || 0
    ]);
  });
  
  // Ajustar anchos de columna
  [summarySheet, txSheet, liqSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      if (column && typeof column.eachCell === 'function') {  // Verificar que column no sea undefined y tenga el método eachCell
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });
  });
  
  // Generar el archivo
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Genera un informe en formato PDF
 */
function generatePdfReport(
  data: any[],
  title: string,
  fileName: string,
  type: 'transactions' | 'liquidations',
  dateRange: { startDate: string; endDate: string }
): Uint8Array {
  // Crear un nuevo documento PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // Agregar título
  doc.setFontSize(18);
  doc.text(title, doc.internal.pageSize.width / 2, 15, { align: 'center' });
  
  // Agregar información del rango de fechas
  doc.setFontSize(12);
  doc.setFont("helvetica", 'italic');
  doc.text(
    `Período: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy', { locale: es })}`,
    doc.internal.pageSize.width / 2,
    25,
    { align: 'center' }
  );
  doc.setFont("helvetica", 'normal');
  
  // Configurar datos para la tabla según el tipo de informe
  let headers: string[] = [];
  let rows: any[] = [];
  
  if (type === 'transactions') {
    headers = ['ID Transacción', 'Fecha', 'Monto', 'Estado', 'Método de Pago', 'Cuotas', 'Fecha Est.', 'ID Liquid.'];
    
    rows = data.map((tx: Transaction) => [
      tx.transactionId,
      format(new Date(tx.date), 'dd/MM/yyyy HH:mm', { locale: es }),
      tx.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
      tx.status,
      tx.paymentMethod,
      tx.quotas,
      tx.expectedPayDate ? format(new Date(tx.expectedPayDate), 'dd/MM/yyyy', { locale: es }) : '-',
      tx.liquidationId || '-'
    ]);
  } else if (type === 'liquidations') {
    headers = ['ID Liquidación', 'Fecha', 'Monto', 'Estado', 'Cant. Transacciones'];
    
    rows = data.map((liq: Liquidation) => [
      liq.liquidationId,
      format(new Date(liq.date), 'dd/MM/yyyy HH:mm', { locale: es }),
      liq.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
      liq.status,
      liq.transactionCount || 0
    ]);
  }
  
  // Agregar la tabla al documento
  (doc as any).autoTable({
    startY: 35,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    }
  });
  
  // Generar el archivo
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Genera un informe de PDF para la conciliación
 */
function generatePdfReconciliationReport(
  data: ReconciliationReport,
  title: string,
  fileName: string,
  dateRange: { startDate: string; endDate: string }
): Uint8Array {
  // Crear un nuevo documento PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Agregar título
  doc.setFontSize(18);
  doc.text(title, doc.internal.pageSize.width / 2, 15, { align: 'center' });
  
  // Agregar información del rango de fechas
  doc.setFontSize(12);
  doc.setFont("helvetica", 'italic');
  doc.text(
    `Período: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy', { locale: es })}`,
    doc.internal.pageSize.width / 2,
    25,
    { align: 'center' }
  );
  doc.setFont("helvetica", 'normal');
  
  // Datos del resumen
  const summaryData = [
    ['Transacciones totales', data.totalTransactions.toString()],
    ['Monto total', data.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })],
    ['Transacciones conciliadas', data.matchedTransactions.toString()],
    ['Monto conciliado', data.matchedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })],
    ['Transacciones pendientes', data.pendingTransactions.toString()],
    ['Monto pendiente', data.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })],
    ['Próxima liquidación', format(new Date(data.nextExpectedLiquidation), 'dd/MM/yyyy', { locale: es })],
    ['Monto próxima liquidación', data.nextExpectedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })]
  ];
  
  // Agregar tabla de resumen
  (doc as any).autoTable({
    startY: 35,
    head: [['Concepto', 'Valor']],
    body: summaryData,
    theme: 'grid',
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    }
  });
  
  // Agregar tabla de transacciones
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Transacciones', doc.internal.pageSize.width / 2, 15, { align: 'center' });
  
  const txHeaders = ['ID Transacción', 'Fecha', 'Monto', 'Estado', 'Método', 'ID Liquid.'];
  const txRows = data.transactions.map((tx) => [
    tx.transactionId,
    format(new Date(tx.date), 'dd/MM/yyyy', { locale: es }),
    tx.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
    tx.status,
    tx.paymentMethod,
    tx.liquidationId || '-'
  ]);
  
  (doc as any).autoTable({
    startY: 25,
    head: [txHeaders],
    body: txRows,
    theme: 'grid',
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    }
  });
  
  // Agregar tabla de liquidaciones
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Liquidaciones', doc.internal.pageSize.width / 2, 15, { align: 'center' });
  
  const liqHeaders = ['ID Liquidación', 'Fecha', 'Monto', 'Estado', 'Transacciones'];
  const liqRows = data.liquidations.map((liq) => [
    liq.liquidationId,
    format(new Date(liq.date), 'dd/MM/yyyy', { locale: es }),
    liq.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
    liq.status,
    liq.transactionCount || 0
  ]);
  
  (doc as any).autoTable({
    startY: 25,
    head: [liqHeaders],
    body: liqRows,
    theme: 'grid',
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    }
  });
  
  // Generar el archivo
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
} 