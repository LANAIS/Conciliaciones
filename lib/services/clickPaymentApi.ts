import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { format, subDays } from 'date-fns';
import { 
  ClickPagoLiquidacion, 
  ClickPagoLiquidacionesResponse,
  ClickPagoTransaccion
} from '../../types/clickPagoTypes';

/**
 * Cliente para interactuar con la API de Click de Pago
 */
export class ClickPaymentApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.CLIC_API_KEY || '';
    this.apiSecret = process.env.CLIC_API_SECRET || '';
    
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API Key y API Secret de Click de Pago son requeridos');
    }

    const baseURL = process.env.CLIC_API_URL || 'https://api.clickdepago.com/v1';
    const timeout = parseInt(process.env.CLIC_API_TIMEOUT || '30000', 10);

    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    // Interceptor para añadir autenticación a todas las solicitudes
    this.client.interceptors.request.use((config) => {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      config.headers['X-Api-Secret'] = this.apiSecret;
      return config;
    });
  }

  /**
   * Obtener transacciones en un rango de fechas
   */
  async getTransactions(options: {
    fromDate?: Date;
    toDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      fromDate = subDays(new Date(), 30), // Por defecto, últimos 30 días
      toDate = new Date(),
      status,
      page = 1,
      limit = 100
    } = options;

    try {
      const params: Record<string, any> = {
        from_date: format(fromDate, 'yyyy-MM-dd'),
        to_date: format(toDate, 'yyyy-MM-dd'),
        page,
        limit
      };

      if (status) {
        params.status = status;
      }

      const response = await this.client.get('/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('Error al obtener transacciones:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles de una transacción específica
   */
  async getTransactionDetails(transactionId: string) {
    try {
      const response = await this.client.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener detalles de la transacción ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener liquidaciones en un rango de fechas
   */
  async getLiquidations(options: {
    fromDate?: Date;
    toDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ClickPagoLiquidacionesResponse> {
    const {
      fromDate = subDays(new Date(), 60), // Por defecto, últimos 60 días
      toDate = new Date(),
      status,
      page = 1,
      limit = 100
    } = options;

    try {
      const params: Record<string, any> = {
        dateLiquidacion: format(fromDate, 'dd/MM/yyyy'),
        page,
        limit
      };

      if (status) {
        params.status = status;
      }

      const response = await this.client.get<ClickPagoLiquidacionesResponse>('/liquidaciones', { params });
      return response.data;
    } catch (error) {
      console.error('Error al obtener liquidaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles de una liquidación específica
   */
  async getLiquidationDetails(liquidationId: string) {
    try {
      const response = await this.client.get(`/liquidations/${liquidationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener detalles de la liquidación ${liquidationId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener transacciones asociadas a una liquidación
   */
  async getLiquidationTransactions(liquidationId: string) {
    try {
      const response = await this.client.get(`/liquidations/${liquidationId}/transactions`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener transacciones de la liquidación ${liquidationId}:`, error);
      throw error;
    }
  }

  /**
   * Método para calcular la fecha estimada de acreditación según el método de pago
   * @param transactionDate Fecha de la transacción
   * @param paymentMethod Método de pago (DEBIT_CARD, CREDIT_CARD, QR, etc.)
   * @param installments Número de cuotas (para tarjetas de crédito)
   */
  static calculateExpectedPaymentDate(
    transactionDate: Date,
    paymentMethod: string,
    installments: number = 1
  ): Date {
    // Clonamos la fecha para no modificar la original
    const expectedDate = new Date(transactionDate);
    
    // Ajustar según las reglas de negocio
    if (paymentMethod === 'DEBIT_CARD' || paymentMethod === 'QR') {
      // Para débito y QR: siguiente día hábil (simplificado como +1 día)
      expectedDate.setDate(expectedDate.getDate() + 1);
    } else if (paymentMethod === 'CREDIT_CARD') {
      // Para crédito: 18 días hábiles (simplificado como +25 días calendario)
      // Esta es una aproximación, idealmente se usaría una biblioteca para calcular días hábiles
      expectedDate.setDate(expectedDate.getDate() + 25);
    } else {
      // Para otros métodos, asumimos 5 días hábiles
      expectedDate.setDate(expectedDate.getDate() + 7);
    }
    
    return expectedDate;
  }
}

// Instancia singleton para usar en toda la aplicación
export const clickPaymentApi = new ClickPaymentApiClient(); 