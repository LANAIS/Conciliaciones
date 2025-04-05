import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../auth/[...nextauth]';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API: Procesando solicitud para crear un botón de pago');
  
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación usando getServerSession en lugar de getSession
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      console.log('API: Error de autenticación - Sin sesión');
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Obtener el email del usuario de la sesión
    const userEmail = session.user?.email;
    if (!userEmail) {
      console.log('API: Error de autenticación - Sin email de usuario');
      return res.status(401).json({ error: 'No se pudo identificar al usuario' });
    }

    // Log del cuerpo de la solicitud para debugging
    console.log('API: Datos recibidos para crear botón de pago:', JSON.stringify(req.body));
    
    const { name, guid, frase, apiKey, secretKey, organizationId } = req.body;
    
    // Usar los nuevos nombres de parámetros (guid/frase) o los antiguos (apiKey/secretKey) si no están disponibles los nuevos
    const effectiveGuid = guid || apiKey;
    const effectiveFrase = frase || secretKey;
    
    // Validar datos requeridos
    if (!name || !effectiveGuid || !effectiveFrase || !organizationId) {
      console.log('API: Faltan campos requeridos:', { 
        name, 
        guid: effectiveGuid ? '[PRESENTE]' : '[AUSENTE]', 
        frase: effectiveFrase ? '[PRESENTE]' : '[AUSENTE]', 
        organizationId 
      });
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos: name, guid (o apiKey), frase (o secretKey), organizationId',
        received: { 
          name, 
          hasGuid: !!effectiveGuid, 
          hasFrase: !!effectiveFrase, 
          organizationId 
        }
      });
    }
    
    // Verificar que la organización existe
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      console.log(`API: Organización no encontrada con ID: ${organizationId}`);
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Verificar permisos del usuario
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
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
      console.log(`API: Usuario no encontrado con email: ${userEmail}`);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si el usuario es Super Admin o tiene una membresía en esta organización
    const isSuperAdmin = user.memberships.some(
      membership => membership.role.name === 'Super Admin'
    );

    const isAdmin = user.memberships.some(
      membership => 
        membership.organization.id === organizationId && 
        membership.role.name === 'Administrador'
    );

    if (!isSuperAdmin && !isAdmin) {
      console.log(`API: Usuario ${userEmail} no tiene permisos para crear botones de pago en esta organización`);
      return res.status(403).json({ error: 'No tiene permisos para crear botones de pago en esta organización' });
    }
    
    console.log(`API: Creando botón de pago para organización: ${organizationId}`);
    
    // Crear nuevo botón de pago
    const newPaymentButton = await prisma.paymentButton.create({
      data: {
        name,
        apiKey: effectiveGuid,    // Guardar guid en el campo apiKey
        secretKey: effectiveFrase, // Guardar frase en el campo secretKey
        organizationId // Forma directa de conectar, alternativa a organization: { connect: { id: organizationId } }
      },
    });
    
    console.log(`API: Botón de pago creado con ID: ${newPaymentButton.id}`);
    return res.status(201).json(newPaymentButton);
  } catch (error) {
    console.error('Error en API de botones de pago:', error);
    return res.status(500).json({
      error: 'Error del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    await prisma.$disconnect();
  }
} 