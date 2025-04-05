import { z } from 'zod';

// Validaciones comunes reutilizables
export const idSchema = z.string().uuid({ message: 'ID inválido, debe ser un UUID válido' });

export const emailSchema = z.string()
  .email({ message: 'Email inválido' })
  .toLowerCase()
  .trim()
  .min(5, { message: 'Email demasiado corto' })
  .max(254, { message: 'Email demasiado largo' })
  .refine(
    email => {
      // Verificar dominio y formato básico
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    },
    { message: 'Formato de email inválido' }
  );

export const passwordSchema = z.string()
  .min(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  .max(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  .regex(/[A-Z]/, { message: 'La contraseña debe contener al menos una letra mayúscula' })
  .regex(/[a-z]/, { message: 'La contraseña debe contener al menos una letra minúscula' })
  .regex(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  .regex(/[^A-Za-z0-9]/, { message: 'La contraseña debe contener al menos un carácter especial' });

export const nameSchema = z.string()
  .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  .max(100, { message: 'El nombre no puede exceder 100 caracteres' })
  .trim()
  .refine(
    name => /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'-]+$/.test(name),
    { message: 'El nombre contiene caracteres no permitidos' }
  );

export const descriptionSchema = z.string()
  .max(1000, { message: 'La descripción no puede exceder 1000 caracteres' })
  .trim()
  .transform(text => {
    // Sanitizar para prevenir XSS
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  });

export const dateSchema = z.string()
  .refine(
    dateStr => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    },
    { message: 'Formato de fecha inválido' }
  );

export const positiveNumberSchema = z.number()
  .positive({ message: 'Debe ser un número positivo' })
  .safe({ message: 'El número es demasiado grande' });

export const urlSchema = z.string()
  .url({ message: 'URL inválida' })
  .max(2048, { message: 'URL demasiado larga' })
  .refine(
    url => {
      try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
      } catch {
        return false;
      }
    },
    { message: 'La URL debe usar el protocolo HTTP o HTTPS' }
  );

export const phoneSchema = z.string()
  .regex(
    /^\+?[0-9]{8,15}$/,
    { message: 'Número de teléfono inválido (debe tener entre 8-15 dígitos, puede incluir + al inicio)' }
  );

// Función para sanitizar y prevenir inyección SQL
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/'/g, "''") // Escapar comillas simples
    .replace(/\\/g, '\\\\') // Escapar backslashes
    .replace(/\0/g, '\\0') // Escapar null bytes
    .trim();
}

// Sanitizar objetos completos
export function sanitizeObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = { ...obj };
  
  Object.keys(result).forEach(key => {
    const value = result[key];
    
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    }
  });
  
  return result as T;
}

// Validador de esquemas con sanitización automática
export function validateAndSanitize<T>(schema: z.ZodType<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: z.ZodError<T> 
} {
  try {
    // Primero sanitizamos si es un objeto
    const sanitizedData = typeof data === 'object' && data !== null 
      ? sanitizeObject(data as Record<string, any>)
      : data;
      
    // Luego validamos con el esquema
    const result = schema.safeParse(sanitizedData);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, errors: result.error };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
} 