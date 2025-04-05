import { NextApiResponse } from 'next';
import { ZodError } from 'zod';

// Tipos de errores
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  code?: string;
}

interface ErrorOptions {
  severity?: ErrorSeverity;
  shouldReport?: boolean;
  includeDetails?: boolean;
  statusCode?: number;
  errorCode?: string;
}

// Clase base para errores de la aplicación
export class AppError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly shouldReport: boolean;
  public readonly includeDetails: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    {
      severity = 'medium',
      shouldReport = true,
      includeDetails = false,
      statusCode = 500,
      errorCode = 'INTERNAL_ERROR'
    }: ErrorOptions = {},
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.severity = severity;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.shouldReport = shouldReport;
    this.includeDetails = includeDetails;
    this.details = details;
    
    // Capturar la stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Errores específicos
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      severity: 'low',
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      includeDetails: true
    }, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'No autenticado') {
    super(message, {
      severity: 'medium',
      statusCode: 401,
      errorCode: 'AUTHENTICATION_ERROR'
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, {
      severity: 'high',
      statusCode: 403,
      errorCode: 'AUTHORIZATION_ERROR'
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, {
      severity: 'low',
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      shouldReport: false
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Demasiadas solicitudes') {
    super(message, {
      severity: 'medium',
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED'
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      severity: 'high',
      statusCode: 500,
      errorCode: 'DATABASE_ERROR'
    }, details);
  }
}

export class ExternalAPIError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      severity: 'high',
      statusCode: 502,
      errorCode: 'EXTERNAL_API_ERROR'
    }, details);
  }
}

// Función para registrar errores (puede reemplazarse con Sentry u otro servicio)
function logError(error: unknown, severity: ErrorSeverity = 'medium'): void {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(2, 15);
  
  console.error(`[${timestamp}] [${severity.toUpperCase()}] [ID: ${errorId}]`, error);
  
  // Aquí se podría implementar lógica para enviar a un servicio externo
  // como Sentry, LogRocket, etc.
}

// Manejador centralizado de errores
export function handleApiError(error: unknown, res: NextApiResponse): void {
  // Determinar el tipo de error
  if (error instanceof AppError) {
    // Si es un error de nuestra aplicación
    const response: ErrorResponse = {
      error: error.errorCode,
      message: error.message
    };

    // Solo incluir detalles si está configurado así y estamos en desarrollo
    if (error.includeDetails && process.env.NODE_ENV === 'development' && error.details) {
      response.details = error.details;
    }

    // Registrar el error si es necesario
    if (error.shouldReport && error.severity !== 'low') {
      logError(error, error.severity);
    }

    return res.status(error.statusCode).json(response);
  } else if (error instanceof ZodError) {
    // Errores de validación Zod
    logError(error, 'low');
    
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Error de validación en los datos enviados',
      details: process.env.NODE_ENV === 'development' ? error.format() : undefined
    });
  } else if (error instanceof Error) {
    // Errores genéricos de JavaScript
    const isServerError = !(error.name === 'SyntaxError' || error.name === 'TypeError');
    
    // Registrar errores del servidor
    if (isServerError) {
      logError(error, 'high');
    } else {
      logError(error, 'low');
    }

    return res.status(isServerError ? 500 : 400).json({
      error: isServerError ? 'INTERNAL_SERVER_ERROR' : error.name,
      message: isServerError
        ? 'Error interno del servidor'
        : process.env.NODE_ENV === 'development' ? error.message : 'Error en la solicitud'
    });
  } else {
    // Fallback para errores desconocidos
    logError(
      new Error(`Unknown error: ${JSON.stringify(error)}`), 
      'critical'
    );

    return res.status(500).json({
      error: 'UNKNOWN_ERROR',
      message: 'Error desconocido'
    });
  }
}

// Middleware para API routes
export function withErrorHandler(
  handler: (req: any, res: NextApiResponse) => Promise<any>
) {
  return async (req: any, res: NextApiResponse) => {
    try {
      return await handler(req, res);
    } catch (error) {
      handleApiError(error, res);
    }
  };
} 