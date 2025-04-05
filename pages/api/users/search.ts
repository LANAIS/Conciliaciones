import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API: Procesando solicitud para buscar usuario por email');
  
  // Verificar método HTTP
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación usando getServerSession en lugar de getSession
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      console.log('API: Error de autenticación - Sin sesión');
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Obtener el email del usuario buscado
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      console.log('API: Falta parámetro de email o no es válido');
      return res.status(400).json({ error: 'Se requiere un email válido' });
    }

    // Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    if (!user) {
      console.log(`API: Usuario no encontrado con email: ${email}`);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    console.log(`API: Usuario encontrado: ${user.name} (ID: ${user.id})`);
    return res.status(200).json(user);
    
  } catch (error) {
    console.error('Error en API de búsqueda de usuarios:', error);
    return res.status(500).json({
      error: 'Error del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    await prisma.$disconnect();
  }
} 