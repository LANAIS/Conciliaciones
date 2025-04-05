import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { IncomingMessage } from 'http';
import { serialize, parse } from 'cookie';

const CSRF_TOKEN_COOKIE = 'X-CSRF-Token';
const CSRF_HEADER = 'x-csrf-token';
const MAX_AGE = 60 * 60; // 1 hora

// Genera un token CSRF único y seguro
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Establece el token CSRF en una cookie
export function setCSRFCookie(res: NextApiResponse, token: string): void {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: MAX_AGE,
    path: '/',
  };
  
  res.setHeader('Set-Cookie', serialize(CSRF_TOKEN_COOKIE, token, cookieOptions));
}

// Obtiene el token CSRF de la cookie
export function getCSRFTokenFromCookie(req: NextApiRequest | IncomingMessage): string | null {
  const cookies = parse(req.headers.cookie || '');
  return cookies[CSRF_TOKEN_COOKIE] || null;
}

// Obtiene el token CSRF del encabezado
export function getCSRFTokenFromHeader(req: NextApiRequest): string | null {
  return (req.headers[CSRF_HEADER] as string) || null;
}

// Middleware para verificar el token CSRF
export function csrfProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Solo verificar en métodos no seguros (POST, PUT, DELETE)
    const nonSafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (nonSafeMethods.includes(req.method || '')) {
      const cookieToken = getCSRFTokenFromCookie(req);
      const headerToken = getCSRFTokenFromHeader(req);
      
      // Si no hay tokens o no coinciden, rechazar la solicitud
      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
          error: 'Token CSRF inválido. Posible ataque CSRF detectado.'
        });
      }
    }
    
    // Si es una solicitud GET, establecer un nuevo token CSRF
    if (req.method === 'GET') {
      const token = generateCSRFToken();
      setCSRFCookie(res, token);
    }
    
    // Continuar con el controlador si la verificación CSRF pasa
    return handler(req, res);
  };
}

// Función para agregar el token CSRF a todas las solicitudes del cliente
export function getCSRFTokenScript(): string {
  return `
    (function() {
      // Obtener el token CSRF de las cookies
      function getCSRFToken() {
        const value = "; " + document.cookie;
        const parts = value.split("; ${CSRF_TOKEN_COOKIE}=");
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      }
      
      // Agregar el token CSRF a todas las solicitudes fetch
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (!options.headers) {
          options.headers = {};
        }
        
        const token = getCSRFToken();
        if (token) {
          options.headers = {
            ...options.headers,
            '${CSRF_HEADER}': token
          };
        }
        
        return originalFetch(url, options);
      };
      
      // Agregar el token CSRF a todas las solicitudes XMLHttpRequest
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(...args) {
        const token = getCSRFToken();
        const method = args[0];
        
        const nonSafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        if (token && nonSafeMethods.includes(method.toUpperCase())) {
          this.addEventListener('readystatechange', function() {
            if (this.readyState === 1) {
              this.setRequestHeader('${CSRF_HEADER}', token);
            }
          });
        }
        
        return originalXHROpen.apply(this, args);
      };
    })();
  `;
} 