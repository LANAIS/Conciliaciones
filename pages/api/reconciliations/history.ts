import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';

// Mapeo de nombres de roles para mostrarlos correctamente
const roleNameMapping: Record<string, string> = {
  'superadmin': 'Super Admin',
  'admin': 'Administrador',
  'operator': 'Operador',
  'viewer': 'Visualizador'
};

// Función para convertir nombres de roles al formato esperado
const mapRoleName = (roleName: string): string => {
  return roleNameMapping[roleName.toLowerCase()] || roleName;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const prisma = new PrismaClient();

  try {
    // Obtener usuario actual
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { 
        memberships: {
          include: {
            role: true,
            organization: true
          }
        }
      }
    });

    if (!user) {
      return res.status(403).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar si es admin o superadmin basado en el rol
    const isSuperAdmin = user.memberships.some(
      membership => mapRoleName(membership.role.name) === 'Super Admin'
    );
    
    const isAdmin = user.memberships.some(
      membership => mapRoleName(membership.role.name) === 'Administrador'
    );
    
    // Si no es admin o superadmin, denegar acceso
    if (!isAdmin && !isSuperAdmin) {
      return res.status(403).json({ 
        error: 'No tiene permisos para esta operación'
      });
    }

    // Obtener organizaciones a las que pertenece el usuario
    const userOrganizationIds = user.memberships.map(m => m.organization.id);

    // Extraer parámetros de consulta
    const { 
      organizationId, 
      paymentButtonId, 
      startDate, 
      endDate,
      limit = '10', 
      page = '1'
    } = req.query;

    // Convertir a números
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    
    // Validar parámetros de paginación
    if (isNaN(pageNumber) || isNaN(limitNumber) || pageNumber < 1 || limitNumber < 1) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' });
    }
    
    // Calcular offset
    const offset = (pageNumber - 1) * limitNumber;
    
    // Construir la consulta base
    const whereClause: any = {};
    
    // Filtrar por organización si está en la lista del usuario
    if (organizationId && typeof organizationId === 'string') {
      if (!isSuperAdmin && !userOrganizationIds.includes(organizationId)) {
        return res.status(403).json({ error: 'No tiene acceso a esta organización' });
      }
      whereClause.organizationId = organizationId;
    } else if (!isSuperAdmin) {
      // Si no es superadmin, solo mostrar organizaciones a las que tiene acceso
      whereClause.organizationId = {
        in: userOrganizationIds
      };
    }
    
    // Filtrar por botón de pago
    if (paymentButtonId && typeof paymentButtonId === 'string') {
      whereClause.paymentButtonId = paymentButtonId;
    }
    
    // Filtrar por fecha
    if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
      try {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
          whereClause.createdAt = {
            gte: startDateObj,
            lte: endDateObj
          };
        }
      } catch (error) {
        console.error('Error al parsear fechas:', error);
      }
    }
    
    // Obtener el total de registros
    const totalRecords = await prisma.reconciliationHistory.count({
      where: whereClause
    });
    
    // Calcular total de páginas
    const totalPages = Math.ceil(totalRecords / limitNumber);
    
    // Obtener los registros paginados con relaciones
    const records = await prisma.reconciliationHistory.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            name: true
          }
        },
        paymentButton: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limitNumber
    });
    
    // Formatear los registros para la respuesta
    const formattedRecords = records.map(record => ({
      id: record.id,
      createdAt: record.createdAt.toISOString(),
      user: record.user,
      organization: record.organization,
      paymentButton: record.paymentButton,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      recordsAffected: record.recordsAffected,
      totalAmount: record.totalAmount.toNumber(),
      description: record.description,
      status: record.status
    }));
    
    // Devolver los datos paginados
    return res.status(200).json({
      data: formattedRecords,
      pagination: {
        total: totalRecords,
        pages: totalPages,
        currentPage: pageNumber,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de conciliaciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 