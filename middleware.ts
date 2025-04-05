import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Clonar la respuesta actual
  const response = NextResponse.next();

  // Cabeceras de seguridad básicas
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Aplicar el middleware solo a las rutas necesarias, excluyendo la autenticación
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|api/auth/).*)',
  ],
}; 