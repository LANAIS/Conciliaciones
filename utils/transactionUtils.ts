/**
 * Utilidades para trabajar con transacciones
 */

/**
 * Obtiene el ID de liquidación desde una transacción, manejando diferentes formatos
 */
export function getLiquidationId(tx: any): string | undefined {
  return tx.idLiquidacion || tx.liquidacionId || tx.liquidationId || tx.IdLiquidacion || undefined;
}

/**
 * Obtiene el estado de una transacción, manejando diferentes formatos
 */
export function getTransactionStatus(tx: any): string {
  return tx.estado || tx.status || 'Desconocido';
}

/**
 * Determina si una transacción está pendiente (realizada pero sin liquidar)
 */
export function isPendingTransaction(tx: any): boolean {
  const status = getTransactionStatus(tx);
  const liquidationId = getLiquidationId(tx);
  return status === 'REALIZADA' && !liquidationId;
}

/**
 * Determina si una transacción está vencida
 */
export function isTransactionOverdue(tx: any): boolean {
  const status = getTransactionStatus(tx);
  const liquidationId = getLiquidationId(tx);
  
  if (status !== 'REALIZADA' || liquidationId) return false;
  
  let expectedPayDate: string | Date | null = null;
  
  if ('expectedPayDate' in tx && tx.expectedPayDate) {
    expectedPayDate = tx.expectedPayDate;
  } else if ('estimatedPaymentDate' in tx && tx.estimatedPaymentDate) {
    expectedPayDate = tx.estimatedPaymentDate;
  } else if ('fechaAcreditacionEstimada' in tx && tx.fechaAcreditacionEstimada) {
    expectedPayDate = tx.fechaAcreditacionEstimada;
  }
  
  if (!expectedPayDate) return false;
  
  return new Date(expectedPayDate) < new Date();
}

/**
 * Determina si una transacción está completada (realizada y liquidada)
 */
export function isCompletedTransaction(tx: any): boolean {
  const status = getTransactionStatus(tx);
  const liquidationId = getLiquidationId(tx);
  return status === 'REALIZADA' && !!liquidationId;
}

/**
 * Obtiene la clase de color de Tailwind para un badge de estado de transacción
 */
export function getTransactionStatusBadgeClass(status: string, liquidationId?: string | null): string {
  switch (status) {
    case 'REALIZADA':
      return liquidationId 
        ? 'bg-green-100 text-green-800' 
        : 'bg-yellow-100 text-yellow-800';
    case 'CREADA':
    case 'EN_PAGO':
      return 'bg-blue-100 text-blue-800';
    case 'PENDIENTE':
      return 'bg-yellow-100 text-yellow-800';
    case 'RECHAZADA':
    case 'EXPIRADA':
    case 'VENCIDA':
    case 'ERROR_VALIDACION_HASH_TOKEN':
    case 'ERROR_VALIDACION_HASH_PAGO':
      return 'bg-red-100 text-red-800';
    case 'CANCELADA':
      return 'bg-gray-100 text-gray-800';
    case 'DEVUELTA':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Obtiene la clase de color de texto para estados en listados
 */
export function getTransactionStatusTextColor(status: string, liquidationId?: string | null): string {
  switch (status) {
    case 'REALIZADA':
      return liquidationId ? 'text-green-400' : 'text-yellow-400';
    case 'CREADA':
    case 'EN_PAGO':
      return 'text-blue-400';
    case 'PENDIENTE':
      return 'text-yellow-400';
    case 'RECHAZADA':
    case 'EXPIRADA':
    case 'VENCIDA':
    case 'ERROR_VALIDACION_HASH_TOKEN':
    case 'ERROR_VALIDACION_HASH_PAGO':
      return 'text-red-400';
    case 'CANCELADA':
      return 'text-gray-400';
    case 'DEVUELTA':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Constantes con los estados de las transacciones
 */
export const TRANSACTION_STATUSES = {
  CREADA: 'CREADA',                         // 1 - Transacción creada (no procesada)
  EN_PAGO: 'EN_PAGO',                       // 2 - Transacción en pago
  REALIZADA: 'REALIZADA',                   // 3 - Transacción procesada con éxito
  RECHAZADA: 'RECHAZADA',                   // 4 - Transacción rechazada
  ERROR_VALIDACION_HASH_TOKEN: 'ERROR_VALIDACION_HASH_TOKEN', // 5 - Error validación firma al crear
  ERROR_VALIDACION_HASH_PAGO: 'ERROR_VALIDACION_HASH_PAGO',   // 6 - Error validación firma al pagar
  EXPIRADA: 'EXPIRADA',                     // 7 - Transacción expirada
  CANCELADA: 'CANCELADA',                   // 8 - Transacción cancelada por el usuario
  DEVUELTA: 'DEVUELTA',                     // 9 - Transacción devuelta
  PENDIENTE: 'PENDIENTE',                   // 10 - DEBIN creado, esperando aprobación
  VENCIDA: 'VENCIDA'                        // 11 - Transacción vencida porque expiró el DEBIN
};

/**
 * Constantes con los estados de las liquidaciones
 */
export const LIQUIDATION_STATUSES = {
  PROCESADO: 'PROCESADO'                    // Único estado válido para liquidaciones
};

/**
 * Obtiene el monto de una transacción de forma segura, manejando diferentes formatos
 */
export function getTransactionAmount(tx: any): number {
  if (typeof tx.monto === 'number') {
    return tx.monto;
  } else if (typeof tx.amount === 'number') {
    return tx.amount;
  } else {
    return 0;
  }
}

/**
 * Obtiene el ID de una transacción de forma segura, manejando diferentes formatos
 */
export function getTransactionId(tx: any): string {
  return tx.idTransaccion || tx.transactionId || 'ID-Desconocido';
}

/**
 * Obtiene el método de pago de una transacción de forma segura, manejando diferentes formatos
 */
export function getPaymentMethod(tx: any): string {
  return tx.medioPago || tx.paymentMethod || 'N/A';
} 