import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import prisma from '../../../lib/prisma';
import { format, addDays, addWeeks, addMonths, setHours, setMinutes } from 'date-fns';
import { PrismaClient, Prisma } from '@prisma/client';
import { authOptions } from '../../api/auth/[...nextauth]';

// Extender el tipo de PrismaClient para incluir los modelos faltantes
// Esto es un workaround para el problema de TypeScript con los modelos
// que no se reconocen correctamente en tiempo de compilación
interface ExtendedPrismaClient extends PrismaClient {
  scheduledReconciliation: any;
}

// Convertir el cliente existente 
const extendedPrisma = prisma as unknown as ExtendedPrismaClient;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación básica usando getServerSession
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Obtener info del usuario para verificar permisos
    const userEmail = session.user?.email as string;
    
    // Verificar si es admin o superadmin por email o nombre
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          select: {
            organizationId: true
          }
        }
      }
    });

    if (!user) {
      return res.status(403).json({ error: 'Usuario no encontrado' });
    }

    // Revisar si es admin o superadmin por email o nombre
    const emailLower = user.email.toLowerCase();
    const nameLower = user.name.toLowerCase();
    
    const isAdmin = 
      emailLower.includes('admin') || 
      nameLower.includes('admin') || 
      nameLower.includes('administrador');
    
    const isSuperAdmin = 
      emailLower.includes('superadmin') || 
      nameLower.includes('super') || 
      nameLower.includes('superadmin');
    
    // Si no es admin o superadmin, denegar acceso
    if (!isAdmin && !isSuperAdmin) {
      return res.status(403).json({ 
        error: 'No tiene permisos para esta operación',
        detail: 'Solo administradores pueden gestionar conciliaciones programadas'
      });
    }

    // Obtener organizaciones a las que tiene acceso el usuario
    const userOrganizationIds = user.memberships.map((m: { organizationId: string }) => m.organizationId);

    // Manejar distintos métodos HTTP
    switch (req.method) {
      case 'GET':
        return await handleGetScheduledReconciliations(req, res, user.id, userOrganizationIds, isSuperAdmin);
      case 'POST':
        return await handleCreateScheduledReconciliation(req, res, user.id, userOrganizationIds, isSuperAdmin);
      case 'PUT':
        return await handleUpdateScheduledReconciliation(req, res, user.id, userOrganizationIds, isSuperAdmin);
      case 'DELETE':
        return await handleDeleteScheduledReconciliation(req, res, user.id, userOrganizationIds, isSuperAdmin);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error: any) {
    console.error('Error en API de conciliaciones programadas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message || String(error)
    });
  }
}

// Listar conciliaciones programadas con verificación de permisos
async function handleGetScheduledReconciliations(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  userOrganizationIds: string[],
  isSuperAdmin: boolean
) {
  try {
    const { organizationId } = req.query;
    
    // Construir condiciones de búsqueda
    const where: any = {};
    
    // Filtrar por organización si se especifica
    if (organizationId) {
      if (!isSuperAdmin && !userOrganizationIds.includes(organizationId as string)) {
        return res.status(403).json({ 
          error: 'No tiene acceso a esta organización' 
        });
      }
      where.organizationId = organizationId as string;
    } else if (!isSuperAdmin) {
      // Si no es superadmin, limitar a sus organizaciones
      where.organizationId = { in: userOrganizationIds };
    }
    
    console.log('Buscando reconciliaciones programadas...');
    
    // Buscar conciliaciones programadas
    try {
      const scheduledReconciliations = await extendedPrisma.scheduledReconciliation.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          paymentButton: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`Encontradas ${scheduledReconciliations.length} reconciliaciones`);
      return res.status(200).json(scheduledReconciliations);
    } catch (dbError: any) {
      console.error('Error de base de datos al listar conciliaciones:', dbError);
      return res.status(500).json({ 
        error: 'Error al consultar la base de datos',
        detail: dbError.message || String(dbError)
      });
    }
  } catch (error: any) {
    console.error('Error al buscar conciliaciones programadas:', error);
    return res.status(500).json({ 
      error: 'Error al buscar conciliaciones programadas',
      message: error.message || String(error)
    });
  }
}

// Crear conciliación programada con verificación de permisos
async function handleCreateScheduledReconciliation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  userOrganizationIds: string[],
  isSuperAdmin: boolean
) {
  try {
    const data = req.body;
    
    const {
      name,
      description,
      organizationId,
      paymentButtonId,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      daysToInclude,
      notifyEmail,
      notifyEmails,
      isActive
    } = data;
    
    // Validar datos requeridos
    if (!name || !organizationId || !paymentButtonId || !frequency) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    
    // Verificar acceso a la organización (excepto para superadmin)
    if (!isSuperAdmin && !userOrganizationIds.includes(organizationId)) {
      return res.status(403).json({ 
        error: 'No tiene permisos para esta organización',
        detail: 'Solo puede programar conciliaciones para organizaciones a las que tiene acceso'
      });
    }
    
    // Verificar que el botón pertenece a la organización
    const button = await prisma.paymentButton.findFirst({
      where: { 
        id: paymentButtonId,
        organizationId: organizationId
      }
    });
    
    if (!button) {
      return res.status(400).json({ 
        error: 'Botón de pago inválido',
        detail: 'El botón de pago no existe o no pertenece a la organización seleccionada'
      });
    }
    
    // Validaciones específicas según frecuencia
    if (frequency === 'WEEKLY' && (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6)) {
      return res.status(400).json({ error: 'Para frecuencia semanal, especifique un día válido (0-6)' });
    }
    
    if (frequency === 'MONTHLY' && (dayOfMonth === undefined || dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31)) {
      return res.status(400).json({ error: 'Para frecuencia mensual, especifique un día válido (1-31)' });
    }
    
    // Calcular próxima ejecución
    const nextRun = calculateNextRun(frequency, dayOfWeek, dayOfMonth, hour || 0, minute || 0);
    
    console.log('Creando conciliación programada con datos:', {
      name,
      description,
      organizationId,
      paymentButtonId,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      daysToInclude,
      notifyEmail,
      notifyEmails,
      isActive,
      nextRun
    });
    
    try {
      // Crear el registro en la base de datos
      const newSchedule = await extendedPrisma.scheduledReconciliation.create({
        data: {
          name,
          description,
          organizationId,
          paymentButtonId,
          createdById: userId,
          frequency,
          dayOfWeek,
          dayOfMonth,
          hour: hour || 0,
          minute: minute || 0,
          daysToInclude: daysToInclude || 7,
          notifyEmail: notifyEmail !== undefined ? notifyEmail : true,
          notifyEmails,
          isActive: isActive !== undefined ? isActive : true,
          nextRun
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          paymentButton: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      console.log('Conciliación programada creada:', newSchedule);
      return res.status(201).json(newSchedule);
    } catch (dbError: any) {
      console.error('Error de base de datos al crear conciliación:', dbError);
      return res.status(500).json({ 
        error: 'Error al crear la conciliación programada',
        detail: dbError.message || String(dbError)
      });
    }
  } catch (error: any) {
    console.error('Error general al crear conciliación:', error);
    return res.status(500).json({ 
      error: 'Error al crear conciliación programada',
      detail: error.message || String(error)
    });
  }
}

// Actualizar conciliación programada con verificación de permisos
async function handleUpdateScheduledReconciliation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  userOrganizationIds: string[],
  isSuperAdmin: boolean
) {
  try {
    const { id, ...updateData } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Se requiere el ID de la conciliación programada' });
    }
    
    // Buscar conciliación existente
    let existingSchedule;
    try {
      existingSchedule = await extendedPrisma.scheduledReconciliation.findUnique({
        where: { id },
        include: {
          organization: true
        }
      });
    } catch (findError) {
      console.error('Error al buscar conciliación:', findError);
      return res.status(404).json({ 
        error: 'Conciliación programada no encontrada',
        detail: String(findError)
      });
    }
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Conciliación programada no encontrada' });
    }
    
    // Verificar permisos para la organización
    if (!isSuperAdmin && !userOrganizationIds.includes(existingSchedule.organizationId)) {
      return res.status(403).json({ 
        error: 'No tiene permisos para esta conciliación',
        detail: 'Solo puede modificar conciliaciones de organizaciones a las que tiene acceso'
      });
    }
    
    // Si se cambia la organización, verificar permisos
    if (updateData.organizationId && updateData.organizationId !== existingSchedule.organizationId) {
      if (!isSuperAdmin && !userOrganizationIds.includes(updateData.organizationId)) {
        return res.status(403).json({ 
          error: 'No tiene permisos para la organización destino',
          detail: 'No puede mover la conciliación a una organización a la que no tiene acceso'
        });
      }
    }
    
    // Si se cambia el botón, verificar que pertenece a la organización
    if (updateData.paymentButtonId) {
      const targetOrgId = updateData.organizationId || existingSchedule.organizationId;
      
      const button = await prisma.paymentButton.findFirst({
        where: { 
          id: updateData.paymentButtonId,
          organizationId: targetOrgId
        }
      });
      
      if (!button) {
        return res.status(400).json({ 
          error: 'Botón de pago inválido',
          detail: 'El botón de pago no existe o no pertenece a la organización seleccionada'
        });
      }
    }
    
    // Validaciones específicas según frecuencia
    const frequency = updateData.frequency || existingSchedule.frequency;
    
    if (frequency === 'WEEKLY') {
      const dayOfWeek = updateData.dayOfWeek !== undefined ? updateData.dayOfWeek : existingSchedule.dayOfWeek;
      if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ error: 'Para frecuencia semanal, especifique un día válido (0-6)' });
      }
      // Si es semanal, asegurarse de que dayOfMonth sea null
      updateData.dayOfMonth = null;
    }
    
    if (frequency === 'MONTHLY') {
      const dayOfMonth = updateData.dayOfMonth !== undefined ? updateData.dayOfMonth : existingSchedule.dayOfMonth;
      if (dayOfMonth === undefined || dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) {
        return res.status(400).json({ error: 'Para frecuencia mensual, especifique un día válido (1-31)' });
      }
      // Si es mensual, asegurarse de que dayOfWeek sea null
      updateData.dayOfWeek = null;
    }
    
    if (frequency === 'DAILY') {
      // Si es diario, asegurarse de que ambos sean null
      updateData.dayOfWeek = null;
      updateData.dayOfMonth = null;
    }
    
    // Asegurarse de que los campos numéricos sean números
    if (updateData.hour !== undefined) updateData.hour = Number(updateData.hour);
    if (updateData.minute !== undefined) updateData.minute = Number(updateData.minute);
    if (updateData.daysToInclude !== undefined) updateData.daysToInclude = Number(updateData.daysToInclude);
    if (updateData.dayOfWeek !== undefined && updateData.dayOfWeek !== null) updateData.dayOfWeek = Number(updateData.dayOfWeek);
    if (updateData.dayOfMonth !== undefined && updateData.dayOfMonth !== null) updateData.dayOfMonth = Number(updateData.dayOfMonth);
    
    // Calcular próxima ejecución si es necesario
    if (
      updateData.frequency !== undefined || 
      updateData.dayOfWeek !== undefined || 
      updateData.dayOfMonth !== undefined || 
      updateData.hour !== undefined || 
      updateData.minute !== undefined
    ) {
      const calculatedNextRun = calculateNextRun(
        frequency,
        updateData.dayOfWeek !== undefined ? updateData.dayOfWeek : existingSchedule.dayOfWeek,
        updateData.dayOfMonth !== undefined ? updateData.dayOfMonth : existingSchedule.dayOfMonth,
        updateData.hour !== undefined ? updateData.hour : existingSchedule.hour,
        updateData.minute !== undefined ? updateData.minute : existingSchedule.minute
      );
      
      updateData.nextRun = calculatedNextRun;
    }
    
    console.log('Actualizando conciliación programada con ID:', id);
    console.log('Datos de actualización:', updateData);
    
    // Actualizar registro
    try {
      const updatedSchedule = await extendedPrisma.scheduledReconciliation.update({
        where: { id },
        data: updateData,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          paymentButton: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      console.log('Conciliación actualizada correctamente:', updatedSchedule);
      return res.status(200).json(updatedSchedule);
    } catch (updateError) {
      console.error('Error al actualizar conciliación:', updateError);
      return res.status(500).json({ 
        error: 'Error al actualizar la conciliación programada',
        detail: String(updateError)
      });
    }
  } catch (error) {
    console.error('Error general al actualizar conciliación:', error);
    return res.status(500).json({ 
      error: 'Error al actualizar conciliación programada',
      detail: String(error)
    });
  }
}

// Eliminar conciliación programada con verificación de permisos
async function handleDeleteScheduledReconciliation(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  userOrganizationIds: string[],
  isSuperAdmin: boolean
) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Se requiere el ID de la conciliación programada' });
    }
    
    // Buscar conciliación existente
    let existingSchedule;
    try {
      existingSchedule = await extendedPrisma.scheduledReconciliation.findUnique({
        where: { id: id as string }
      });
    } catch (findError) {
      console.error('Error al buscar conciliación:', findError);
      return res.status(404).json({ 
        error: 'Conciliación programada no encontrada',
        detail: String(findError)
      });
    }
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Conciliación programada no encontrada' });
    }
    
    // Verificar permisos para la organización
    if (!isSuperAdmin && !userOrganizationIds.includes(existingSchedule.organizationId)) {
      return res.status(403).json({ 
        error: 'No tiene permisos para esta conciliación',
        detail: 'Solo puede eliminar conciliaciones de organizaciones a las que tiene acceso'
      });
    }
    
    // Eliminar registro
    try {
      await extendedPrisma.scheduledReconciliation.delete({
        where: { id: id as string }
      });
      
      return res.status(200).json({ success: true, message: 'Conciliación programada eliminada con éxito' });
    } catch (deleteError) {
      console.error('Error al eliminar conciliación:', deleteError);
      return res.status(500).json({ 
        error: 'Error al eliminar la conciliación programada',
        detail: String(deleteError)
      });
    }
  } catch (error) {
    console.error('Error general al eliminar conciliación:', error);
    return res.status(500).json({ 
      error: 'Error al eliminar conciliación programada',
      detail: String(error)
    });
  }
}

// Función auxiliar para calcular la próxima ejecución
function calculateNextRun(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  minute: number
): Date {
  let nextRun = new Date();
  
  // Configurar hora y minuto
  nextRun = setHours(nextRun, hour);
  nextRun = setMinutes(nextRun, minute);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  
  // Si la hora ya pasó hoy, comenzar desde mañana
  if (nextRun <= new Date()) {
    nextRun = addDays(nextRun, 1);
  }
  
  switch (frequency) {
    case 'DAILY':
      // Ya tenemos la fecha correcta
      break;
      
    case 'WEEKLY':
      if (dayOfWeek !== null) {
        const currentDayOfWeek = nextRun.getDay();
        if (dayOfWeek !== currentDayOfWeek) {
          // Calcular días que faltan hasta el día deseado
          const daysToAdd = (dayOfWeek + 7 - currentDayOfWeek) % 7;
          nextRun = addDays(nextRun, daysToAdd);
        }
      }
      break;
      
    case 'MONTHLY':
      if (dayOfMonth !== null) {
        const currentDate = nextRun.getDate();
        if (dayOfMonth < currentDate) {
          // El día ya pasó este mes, ir al próximo mes
          nextRun = addMonths(nextRun, 1);
        }
        
        // Establecer el día del mes
        nextRun.setDate(dayOfMonth);
        
        // Verificar que el día es válido (para meses con menos días)
        if (nextRun.getDate() !== dayOfMonth) {
          // Si no es válido, ajustar al último día del mes anterior
          nextRun = addDays(nextRun, -nextRun.getDate());
        }
      }
      break;
  }
  
  return nextRun;
} 