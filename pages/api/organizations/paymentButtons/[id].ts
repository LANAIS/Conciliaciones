import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticación
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Obtener ID del botón de pago de la URL
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de botón de pago no válido' });
  }

  try {
    // GET: Obtener un botón de pago específico
    if (req.method === 'GET') {
      const paymentButton = await prisma.paymentButton.findUnique({
        where: { id },
        include: {
          transactions: {
            select: {
              transactionId: true,
            },
          },
          organization: true,
        },
      });

      if (!paymentButton) {
        return res.status(404).json({ error: 'Botón de pago no encontrado' });
      }

      // Transformar los datos para que sean serializables (JSON)
      const serializedPaymentButton = {
        id: paymentButton.id,
        name: paymentButton.name,
        apiKey: paymentButton.apiKey,
        organizationId: paymentButton.organizationId,
        transactions: paymentButton.transactions.length,
      };

      return res.status(200).json(serializedPaymentButton);
    }
    
    // PUT: Actualizar un botón de pago
    if (req.method === 'PUT') {
      const { name, apiKey, secretKey } = req.body;
      
      // Validar datos requeridos
      if (!name || !apiKey || !secretKey) {
        return res.status(400).json({ 
          error: 'Todos los campos son requeridos: name, apiKey, secretKey'
        });
      }

      const updatedPaymentButton = await prisma.paymentButton.update({
        where: { id },
        data: { 
          name,
          apiKey,
          secretKey,
        },
      });
      
      return res.status(200).json(updatedPaymentButton);
    }
    
    // DELETE: Eliminar un botón de pago
    if (req.method === 'DELETE') {
      // Eliminar el botón de pago (y sus transacciones si hay cascada)
      await prisma.paymentButton.delete({
        where: { id },
      });
      
      return res.status(204).end();
    }
    
    // Método no permitido
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en API de botón de pago:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await prisma.$disconnect();
  }
} 