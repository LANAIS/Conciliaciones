/**
 * Tipos de datos para las respuestas de la API de Click de Pago
 */

// Estructura de una transacción
export interface ClickPagoTransaccion {
  idTransaccion: string;
  fechaTransaccion: string;
  monto: number;
  moneda: string;
  estado: string;
  medioPago: string;
  cuotas: number;
  fechaAcreditacionEstimada: string;
  comision: number;
  montoAcreditado: number;
  idLiquidacion?: string;
  // Propiedades adicionales para compatibilidad
  date?: string;
  amount?: number;
  status?: string;
  // Propiedades adicionales para transacciones internas
  liquidationId?: string;
  liquidacionId?: string; // Compatibilidad con ambos formatos
  estimatedPaymentDate?: string;
  expectedPayDate?: string; // Campo usado en la semilla de datos
  transactionId?: string; // Para compatibilidad con el modelo de Prisma
  paymentMethod?: string; // Para compatibilidad con el modelo de Prisma
}

// Estructura de una liquidación
export interface ClickPagoLiquidacion {
  liquidacionId: string;
  cbu: string;
  cuit: string;
  CantidadTX: number;
  CantidadTXRechazos: number;
  Comision: string;
  DREI: number;
  FechaLiquidacion: string;
  FechaNegocio: string;
  FechaProceso: string;
  IVA: string;
  ImporteRechazos: string;
  IncDecr: string;
  NetoLiquidacion: string;
  NombreSubente: string;
  NumeroSubente: string;
  Recaudacion: string;
  Retencion: string;
  Sellado: string;
  Tipo: string;
  TipoRechazo: string;
  IdLiquidacion: string;
  CodigoProvincia: number;
  PercepcionIIBB: string;
  PercepcionIVA: string;
  RetencionGanancias: string;
  RetencionIVA: string;
  MontoPromocion: string;
  RET_T30_IIBB: string;
  RET_T30_IIGG: string;
  RET_T30_IVA: string;
  paymentMethodTotals?: Record<string, number>; // Montos por método de pago
  // Propiedades adicionales para compatibilidad
  id?: string;
  date?: string;
  amount?: number;
  status?: string;
  organization?: string;
  organizationId?: string;
  paymentButton?: string;
  paymentButtonId?: string;
  currency?: string;
  transactionCount?: number;
  // Campos adicionales para compatibilidad
  idLiquidacion?: string;
  liquidationId?: string;
}

// Estructura de la información del comercio
export interface ClickPagoComercio {
  nombre: string;
  cuit: string;
  razonSocial: string;
  fechaAlta: string;
  email: string;
  telefono: string;
  cbu: string;
  banco: string;
  tipoCuenta: string;
  mediosPagoHabilitados: string[];
}

// Respuesta paginada de la API
export interface ClickPagoRespuestaPaginada<T> {
  data: T[];
  paginaActual: number;
  cantidadRegistros: number;
  totalRegistros: number;
  totalPaginas: number;
}

// Estructura de respuesta para verificación
export interface ClickPagoRespuestaVerificacion {
  estado: string;
  mensaje: string;
  timestamp: string;
}

// Estructura de respuesta para inicio de sesión
export interface ClickPagoSesionResponse {
  status: boolean;
  code: number;
  message: string;
  data: string; // Token JWT
  secretKey: string;
}

// Estructura genérica de respuesta del servicio
export interface ClickPagoServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  details?: any; // Detalles adicionales del error
}

// Estructura de respuesta para liquidaciones según la API de Click de Pago
export interface ClickPagoLiquidacionesResponse {
  status: boolean;
  code: number;
  message: string;
  data: {
    liquidaciones: ClickPagoLiquidacion[];
  };
}

// Agrega esta interfaz para información detallada por método de pago
export interface PaymentMethodStats {
  count: number;
  amount: number;
  name: string;
}

// Agrega esta interfaz para información de estado de las transacciones
export interface TransactionStatusStats {
  all: number;           // Total de transacciones
  allAmount: number;     // Monto total de transacciones
  pending: number;       // Transacciones pendientes de acreditar
  pendingAmount: number; // Monto pendiente de acreditar
  completed: number;     // Transacciones ya acreditadas
  completedAmount: number; // Monto ya acreditado
  byPaymentMethod: PaymentMethodStats[]; // Estadísticas por método de pago
} 