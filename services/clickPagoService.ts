import axios from 'axios';
import https from 'https';
import { 
  ClickPagoComercio, 
  ClickPagoLiquidacion, 
  ClickPagoRespuestaPaginada, 
  ClickPagoRespuestaVerificacion, 
  ClickPagoServiceResponse, 
  ClickPagoTransaccion,
  ClickPagoSesionResponse
} from '../types/clickPagoTypes';

// URL base de la API de Click de Pago
const API_BASE_URL = 'https://botonpp.macroclickpago.com.ar:8082/v1';

// Crear instancia de axios con configuración personalizada
const axiosInstance = axios.create({
  timeout: 10000, // 10 segundos de timeout
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false // Ignorar problemas de certificados
  })
});

/**
 * Servicio para interactuar con la API de Click de Pago
 */
export class ClickPagoService {
  private guid: string;
  private frase: string;
  private token: string | null = null;
  private secretKey: string | null = null;

  constructor(guid: string, frase: string) {
    this.guid = guid;
    this.frase = frase;
  }

  /**
   * Obtiene los headers de autenticación para las peticiones
   * @returns Headers con el token de autenticación
   */
  private getAuthHeaders() {
    if (!this.token) {
      throw new Error('No se ha obtenido un token de sesión. Llama a iniciarSesion() primero.');
    }
    
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Inicia sesión en la API para obtener un token de autenticación
   * @returns Promise con el resultado de la autenticación
   */
  async iniciarSesion(): Promise<ClickPagoServiceResponse<ClickPagoSesionResponse>> {
    try {
      console.log(`Intentando conexión a ${API_BASE_URL}/sesion con credenciales:`, {
        guid: this.guid,
        frase: '[OCULTA]'
      });
      
      const response = await axiosInstance({
        method: 'POST',
        url: `${API_BASE_URL}/sesion`,
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          guid: this.guid,
          frase: this.frase
        }
      });
      
      console.log('Respuesta recibida del servidor:', response.status);
      
      if (response.data && response.data.status === true) {
        // Guardar el token y secretKey para futuras solicitudes
        this.token = response.data.data;
        this.secretKey = response.data.secretKey;
        
        console.log('Sesión iniciada correctamente con token');
        
        return {
          success: true,
          data: response.data
        };
      } else {
        console.log('Respuesta de error del servidor:', response.data);
        
        return {
          success: false,
          error: response.data?.message || 'Error en la respuesta del servidor',
          data: response.data
        };
      }
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      
      // Información detallada del error
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        url: `${API_BASE_URL}/sesion`
      };
      
      console.log('Detalles del error:', JSON.stringify(errorDetails, null, 2));
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status,
        details: errorDetails
      };
    }
  }

  /**
   * Verifica si las credenciales son válidas
   * @returns Promise con el resultado de la verificación
   */
  async verificarCredenciales(): Promise<ClickPagoServiceResponse<ClickPagoSesionResponse>> {
    return this.iniciarSesion();
  }

  /**
   * Consulta las transacciones de un período específico
   * @param fechaDesde Fecha de inicio en formato YYYY-MM-DD
   * @param fechaHasta Fecha de fin en formato YYYY-MM-DD
   * @param paginaActual Número de página (opcional)
   * @param cantidadRegistros Registros por página (opcional)
   * @returns Promise con el resultado de la consulta
   */
  async consultarTransacciones(
    fechaDesde: string, 
    fechaHasta: string, 
    paginaActual = 0, 
    cantidadRegistros = 10
  ): Promise<ClickPagoServiceResponse<ClickPagoRespuestaPaginada<ClickPagoTransaccion>>> {
    try {
      // Iniciar sesión si no tenemos token
      if (!this.token) {
        const sesion = await this.iniciarSesion();
        if (!sesion.success) {
          return {
            success: false,
            error: 'Error al autenticar con la API'
          };
        }
      }
      
      const response = await axiosInstance({
        method: 'GET',
        url: `${API_BASE_URL}/transacciones`,
        headers: this.getAuthHeaders(),
        params: {
          fechaDesde,
          fechaHasta,
          paginaActual,
          cantidadRegistros
        }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Consulta los detalles de una transacción específica
   * @param idTransaccion ID de la transacción
   * @returns Promise con el resultado de la consulta
   */
  async consultarDetalleTransaccion(
    idTransaccion: string
  ): Promise<ClickPagoServiceResponse<ClickPagoTransaccion>> {
    try {
      // Iniciar sesión si no tenemos token
      if (!this.token) {
        const sesion = await this.iniciarSesion();
        if (!sesion.success) {
          return {
            success: false,
            error: 'Error al autenticar con la API'
          };
        }
      }
      
      const response = await axiosInstance({
        method: 'GET',
        url: `${API_BASE_URL}/transacciones/${idTransaccion}`,
        headers: this.getAuthHeaders()
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Consulta las liquidaciones de un período específico
   * @param fechaDesde Fecha de inicio en formato YYYY-MM-DD
   * @param fechaHasta Fecha de fin en formato YYYY-MM-DD
   * @param paginaActual Número de página (opcional)
   * @param cantidadRegistros Registros por página (opcional)
   * @returns Promise con el resultado de la consulta
   */
  async consultarLiquidaciones(
    fechaDesde: string, 
    fechaHasta: string, 
    paginaActual = 0, 
    cantidadRegistros = 10
  ): Promise<ClickPagoServiceResponse<ClickPagoRespuestaPaginada<ClickPagoLiquidacion>>> {
    try {
      // Iniciar sesión si no tenemos token
      if (!this.token) {
        const sesion = await this.iniciarSesion();
        if (!sesion.success) {
          return {
            success: false,
            error: 'Error al autenticar con la API'
          };
        }
      }
      
      const response = await axiosInstance({
        method: 'GET',
        url: `${API_BASE_URL}/liquidaciones`,
        headers: this.getAuthHeaders(),
        params: {
          fechaDesde,
          fechaHasta,
          paginaActual,
          cantidadRegistros
        }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Consulta los detalles de una liquidación específica
   * @param idLiquidacion ID de la liquidación
   * @returns Promise con el resultado de la consulta
   */
  async consultarDetalleLiquidacion(
    idLiquidacion: string
  ): Promise<ClickPagoServiceResponse<ClickPagoLiquidacion>> {
    try {
      // Iniciar sesión si no tenemos token
      if (!this.token) {
        const sesion = await this.iniciarSesion();
        if (!sesion.success) {
          return {
            success: false,
            error: 'Error al autenticar con la API'
          };
        }
      }
      
      const response = await axiosInstance({
        method: 'GET',
        url: `${API_BASE_URL}/liquidaciones/${idLiquidacion}`,
        headers: this.getAuthHeaders()
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Consulta la información del comercio
   * @returns Promise con el resultado de la consulta
   */
  async consultarInformacionComercio(): Promise<ClickPagoServiceResponse<ClickPagoComercio>> {
    try {
      // Iniciar sesión si no tenemos token
      if (!this.token) {
        const sesion = await this.iniciarSesion();
        if (!sesion.success) {
          return {
            success: false,
            error: 'Error al autenticar con la API'
          };
        }
      }
      
      const response = await axiosInstance({
        method: 'GET',
        url: `${API_BASE_URL}/comercio`,
        headers: this.getAuthHeaders()
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }
} 