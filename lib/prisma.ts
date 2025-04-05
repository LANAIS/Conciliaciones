import { PrismaClient } from '@prisma/client';

// Definir tipos para las variables globales
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Crear una instancia única de PrismaClient para toda la aplicación
let prisma: PrismaClient;

// Evitar múltiples instancias de Prisma Client en desarrollo
// https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // En desarrollo, usar variable global para evitar múltiples instancias
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma; 