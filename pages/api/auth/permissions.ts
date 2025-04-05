import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';

// Definición simplificada para el usuario
interface UserWithMemberships {
  id: string;
  name: string;
  email: string;
  memberships: {
    id: string;
    userId: string;
    organizationId: string;
    organization: {
      id: string;
      name: string;
    };
  }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir peticiones GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await getSession({ req });
  
  // Verificar autenticación
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const prisma = new PrismaClient();

  try {
    // Obtener información del usuario y sus membresías
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Determinación de roles basada en el email o nombre
    // Por convención, si tiene "admin" o "superadmin" en el email o nombre
    const emailLower = user.email.toLowerCase();
    const nameLower = user.name.toLowerCase();
    
    const isAdmin = 
      emailLower.includes('admin') || 
      nameLower.includes('admin') || 
      nameLower.includes('administrador');
      
    const isSuperAdmin = 
      emailLower.includes('superadmin') || 
      nameLower.includes('super admin') || 
      nameLower.includes('superadministrador');
    
    // Obtener organizaciones a las que tiene acceso
    const organizations = user.memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name
    }));

    // Devolver información de permisos
    return res.status(200).json({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      isAdmin,
      isSuperAdmin,
      // Un superadmin tiene implícitamente acceso a todas las organizaciones
      organizations: organizations.map(org => org.id),
      organizationsData: organizations,
    });
  } catch (error) {
    console.error('Error al verificar permisos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
} 