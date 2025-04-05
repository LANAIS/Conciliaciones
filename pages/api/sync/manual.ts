import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar que sea una solicitud POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar la autenticación del usuario
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Obtener los parámetros de la solicitud
    const { organizationId, paymentButtonId } = req.body;

    // Llamar a la API de sincronización
    const syncResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/cron/sync-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'manual',
        organizationId,
        paymentButtonId,
      }),
    });

    const syncResult = await syncResponse.json();

    if (!syncResponse.ok) {
      return res.status(syncResponse.status).json(syncResult);
    }

    return res.status(200).json(syncResult);
  } catch (error) {
    console.error('Error al iniciar sincronización manual:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al iniciar la sincronización manual',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 