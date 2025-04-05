import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

// Esquema de validación mejorado con requisitos de seguridad más estrictos
const registerSchema = z.object({
  name: z.string()
    .min(3, { message: 'El nombre debe tener al menos 3 caracteres' })
    .max(100, { message: 'El nombre no puede exceder 100 caracteres' })
    .trim(),
  email: z.string()
    .email({ message: 'Email inválido' })
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
    .max(100, { message: 'La contraseña no puede exceder 100 caracteres' })
    .regex(/[A-Z]/, { message: 'La contraseña debe contener al menos una letra mayúscula' })
    .regex(/[a-z]/, { message: 'La contraseña debe contener al menos una letra minúscula' })
    .regex(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
    .regex(/[^A-Za-z0-9]/, { message: 'La contraseña debe contener al menos un carácter especial' }),
  organizationName: z.string().optional()
});

// Función para obtener la IP del cliente
function getClientIp(req: NextApiRequest): string {
  // Intentar obtener la IP real detrás de proxies
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0];
  }
  // Obtener la IP directa de la conexión
  return req.socket.remoteAddress || 'unknown-ip';
}

// Implementación básica de limitación de tasa
const limiter = {
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por ventana
  handler: (_req: NextApiRequest, res: NextApiResponse) => {
    return res.status(429).json({
      message: 'Demasiadas solicitudes. Por favor, intenta nuevamente más tarde.'
    });
  }
};

// Almacén simple en memoria para limitar solicitudes
const ipRequests = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(req: NextApiRequest): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = limiter.windowMs;
  
  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const requests = ipRequests.get(ip)!;
  
  if (now > requests.resetTime) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (requests.count >= limiter.max) {
    return false;
  }
  
  requests.count++;
  ipRequests.set(ip, requests);
  return true;
}

// Limpiar periódicamente las entradas expiradas para evitar fugas de memoria
setInterval(() => {
  const now = Date.now();
  const ips = Array.from(ipRequests.keys());
  ips.forEach(ip => {
    const data = ipRequests.get(ip);
    if (data && now > data.resetTime) {
      ipRequests.delete(ip);
    }
  });
}, 60000); // Cada minuto

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Comprobar limitación de tasa
  if (!checkRateLimit(req)) {
    return limiter.handler(req, res);
  }

  try {
    // Validar los datos de entrada
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Datos de registro inválidos',
        errors: validationResult.error.errors 
      });
    }

    const { name, email, password, organizationName } = validationResult.data;

    // Añadir un pequeño retraso para dificultar timing attacks
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    // Hash de la contraseña con un factor de costo mayor para mayor seguridad
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear el usuario, la organización y la membresía en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear el usuario
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword
        }
      });

      // Asegurar que existan los roles necesarios
      const roleNames = ['Administrador', 'Contador', 'Tesorero', 'Visualizador'];
      const existingRoles = await tx.role.findMany({
        where: {
          name: {
            in: roleNames
          }
        }
      });

      const existingRoleNames = existingRoles.map(r => r.name);
      const missingRoles = roleNames.filter(name => !existingRoleNames.includes(name));

      // Crear roles que no existan
      if (missingRoles.length > 0) {
        await tx.role.createMany({
          data: missingRoles.map(name => ({ name })),
          skipDuplicates: true
        });
      }

      // Obtener todos los roles (incluyendo los recién creados)
      const allRoles = await tx.role.findMany();
      const adminRole = allRoles.find(r => r.name === 'Administrador');
      const viewerRole = allRoles.find(r => r.name === 'Visualizador');

      if (!adminRole || !viewerRole) {
        throw new Error('No se pudieron encontrar los roles necesarios');
      }

      // Si se proporciona un nombre de organización, crear la organización
      let organization;
      if (organizationName) {
        organization = await tx.organization.create({
          data: {
            name: organizationName
          }
        });

        // Asignar al usuario como administrador de la organización
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            roleId: adminRole.id
          }
        });
      }

      return { user, organization };
    });

    // Extraer el usuario de los resultados y eliminar la contraseña
    const { user, organization } = result;
    const { password: _, ...userWithoutPassword } = user;
    
    // Añadir cabeceras de seguridad
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    
    res.status(201).json({ 
      message: 'Usuario registrado correctamente', 
      user: userWithoutPassword,
      organization: organization || null
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      message: 'Error al registrar el usuario', 
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 