import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// URL base de la API de Click de Pago
const API_BASE_URL = process.env.CLIC_API_URL || 'https://botonpp.macroclickpago.com.ar:8082/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Validar origen de la petición y agregar protección CSRF
  const referer = req.headers.referer || '';
  const allowedDomains = [
    process.env.NEXTAUTH_URL || 'http://localhost:3000'
  ];
  
  const isValidOrigin = allowedDomains.some(domain => referer.startsWith(domain));
  if (!isValidOrigin) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  const { endpoint, method, data, headers } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Falta el endpoint' });
  }

  try {
    console.log(`Proxy: Realizando solicitud a ${API_BASE_URL}/${endpoint}`);
    console.log('Proxy: Método:', method || 'POST');
    
    // Sanitizar los headers para evitar inyección de headers maliciosos
    const sanitizedHeaders = headers ? { ...headers } : { 'Content-Type': 'application/json' };
    // Eliminar headers potencialmente peligrosos que no deben ser enviados por el cliente
    ['host', 'connection', 'user-agent', 'referer', 'origin', 'cookie'].forEach(header => {
      delete sanitizedHeaders[header];
    });
    
    console.log('Proxy: Headers:', sanitizedHeaders);
    
    // Si se están enviando credenciales, solo mostrar que están presentes, no sus valores
    if (data) {
      const logData = { ...data };
      if (logData.guid) logData.guid = '[PRESENTE]';
      if (logData.frase) logData.frase = '[PRESENTE]';
      console.log('Proxy: Datos:', logData);
    }

    const response = await axios({
      method: method || 'POST',
      url: `${API_BASE_URL}/${endpoint}`,
      headers: sanitizedHeaders,
      data: data || {},
      timeout: parseInt(process.env.CLIC_API_TIMEOUT || '15000') // Usar valor del env o 15 segundos por defecto
    });

    console.log('Proxy: Respuesta recibida con código', response.status);
    
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Proxy: Error en la solicitud:', error.message);
    
    // Información más detallada para diagnóstico
    const errorDetails = {
      message: error.message,
      code: error.code,
      // Evitar exponer demasiada información en errores
      response: error.response?.status ? { status: error.response.status } : undefined
    };
    
    console.log('Proxy: Detalles del error:', JSON.stringify(errorDetails, null, 2));
    
    // Si hay una respuesta del servidor, devolverla
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Error en la solicitud a la API externa'
      });
    }
    
    return res.status(500).json({
      error: 'Error al conectar con la API externa'
    });
  }
} 