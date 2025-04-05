import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';

// URL base de la API de Click de Pago (obtener de variable de entorno)
const API_BASE_URL = process.env.CLIC_API_URL || 'https://botonpp.macroclickpago.com.ar:8082/v1';

// Habilitar modo simulación para desarrollo local
const DEV_MODE = process.env.NODE_ENV === 'development';
const SIMULATE_API = DEV_MODE && process.env.SIMULATE_CLIC_API === 'true';

// Funcion para verificar el token CSRF
function validateCSRFToken(req: NextApiRequest): boolean {
  const referer = req.headers.referer || '';
  const allowedDomains = [
    process.env.NEXTAUTH_URL || 'http://localhost:3000'
  ];
  
  const isValidOrigin = allowedDomains.some(domain => referer.startsWith(domain));
  return isValidOrigin;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Validar origen para prevenir CSRF
  if (!validateCSRFToken(req)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  try {
    // Obtener parámetros de autenticación
    const { guid, frase, apiKey, secretKey } = req.body;
    
    // Usar los parámetros nuevos o los antiguos como fallback
    const effectiveGuid = guid || apiKey;
    const effectiveFrase = frase || secretKey;

    // Validar parámetros
    if (!effectiveGuid || !effectiveFrase) {
      return res.status(400).json({ 
        error: 'Se requieren guid (o apiKey) y frase (o secretKey)',
        success: false
      });
    }

    // Solo registrar una versión reducida para no exponer datos sensibles
    const truncatedGuid = effectiveGuid.substring(0, 5) + '...';
    console.log(`Verificando credenciales GUID: ${truncatedGuid}`);

    // Modo simulado para desarrollo
    if (SIMULATE_API) {
      console.log('⚠️ USANDO MODO SIMULADO - NO SE CONECTARÁ AL SERVIDOR REAL');
      
      // En modo simulado, generar una respuesta basada en un hash del GUID
      // para simular consistentemente sin guardar credenciales reales
      const guidHash = crypto.createHash('sha256').update(effectiveGuid).digest('hex');
      const isValid = guidHash.startsWith('a') || guidHash.startsWith('b') || guidHash.startsWith('c');

      if (isValid) {
        // Simular respuesta exitosa
        return res.status(200).json({
          success: true,
          message: 'Credenciales verificadas correctamente (SIMULADO)',
          sessionData: {
            status: true,
            code: 200,
            message: "Identificación del comercio correcta. (SIMULADO)",
            data: `jwt-${guidHash.substring(0, 10)}`,
            secretKey: `sk-${guidHash.substring(0, 8)}`
          },
          simulatedMode: true
        });
      } else {
        // Simular error de credenciales
        return res.status(200).json({
          success: false,
          error: 'Credenciales inválidas (SIMULADO)',
          details: {
            message: 'Las credenciales proporcionadas no son válidas.',
            simulatedMode: true
          }
        });
      }
    }

    try {
      console.log('🔄 Intentando conexión a la API de Click de Pago');
      
      // Configurar headers apropiados sin falsificar User-Agent
      const headers = {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      };
      
      // Datos para la solicitud
      const data = {
        guid: effectiveGuid,
        frase: effectiveFrase
      };
      
      console.log(`Conectando a ${API_BASE_URL}/sesion`);
      
      // Realizar la solicitud usando axios con configuración segura
      const response = await axios.post(
        `${API_BASE_URL}/sesion`,
        data,
        {
          headers: headers,
          timeout: parseInt(process.env.CLIC_API_TIMEOUT || '30000')
        }
      );
      
      console.log('Respuesta API recibida:', response.status);
      
      if (response.status === 200 && response.data && response.data.status === true) {
        // Sanitizar la respuesta para no devolver datos innecesarios
        const sessionData = {
          status: response.data.status,
          code: response.data.code,
          message: response.data.message,
          data: response.data.data,
          // No incluir información sensible adicional
        };
        
        return res.status(200).json({
          success: true,
          message: 'Credenciales verificadas correctamente',
          sessionData
        });
      } else {
        console.log('Error en la verificación API:', response.status);
        return res.status(200).json({
          success: false,
          error: 'Credenciales inválidas o error en la API',
          details: {
            message: 'La API no pudo validar las credenciales proporcionadas.'
          }
        });
      }
    } catch (apiError: any) {
      console.error('Error de conexión a la API:', apiError.message);
      
      // Capturar información de error sin exponer detalles sensibles
      const safeErrorDetails = {
        message: apiError.message,
        code: apiError.code
      };
      
      // Si estamos en desarrollo, podemos usar modo simulado como fallback
      if (DEV_MODE) {
        console.log('⚠️ CAMBIANDO A MODO SIMULADO debido a errores de conexión');
        
        // Generar respuesta simulada basada en un hash del GUID para ser consistente
        const guidHash = crypto.createHash('sha256').update(effectiveGuid).digest('hex');
        
        return res.status(200).json({
          success: true,
          message: 'Credenciales verificadas correctamente (SIMULADO TRAS ERROR)',
          sessionData: {
            status: true,
            code: 200,
            message: "Identificación del comercio correcta. (SIMULADO TRAS ERROR DE CONEXIÓN)",
            data: `jwt-${guidHash.substring(0, 10)}`,
            secretKey: `sk-${guidHash.substring(0, 8)}`
          },
          simulatedMode: true
        });
      }
      
      // En producción, devolver un mensaje de error apropiado
      return res.status(200).json({
        success: false,
        error: 'No se pudo conectar con la API de Click de Pago',
        details: {
          message: 'Hemos detectado problemas de conexión con el servidor de Click de Pago.',
          recommendations: [
            'Puede que esta API requiera una conexión desde IPs específicas.',
            'Contacte a Click de Pago para solicitar que añadan su IP a la lista blanca.'
          ]
        }
      });
    }
  } catch (error: any) {
    console.error('Error general en el servidor:', error.message);
    
    // No exponer detalles de la pila en producción
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'Ha ocurrido un error al procesar la solicitud.'
    });
  }
} 