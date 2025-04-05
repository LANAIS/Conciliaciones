// Solo importamos cron cuando estamos en el servidor
// Usamos require dinámico para evitar que se incluya en el bundle del cliente
let cron: any = null;
if (typeof window === 'undefined') {
  try {
    // Importación dinámica solo en el servidor
    cron = require('node-cron');
  } catch (error) {
    console.error('Error importing node-cron:', error);
  }
}

import axios from 'axios';

// Configuración de tareas CRON
interface CronTask {
  name: string;
  schedule: string;
  url: string;
  enabled: boolean;
}

// Definición de las tareas programadas
export const cronTasks: CronTask[] = [
  {
    name: 'syncTransactions',
    // Ejecutar cada 3 horas todos los días (0 */3 * * *)
    schedule: '0 */3 * * *',
    url: '/api/cron/sync-data',
    enabled: true
  },
  {
    name: 'reconcileTransactions',
    // Ejecutar dos veces al día: a las 10:00 AM y 10:00 PM (0 10,22 * * *)
    schedule: '0 10,22 * * *',
    url: '/api/sync/reconcile',
    enabled: true
  },
  {
    name: 'dailyReport',
    // Ejecutar todos los días a las 7:00 AM (0 7 * * *)
    schedule: '0 7 * * *',
    url: '/api/cron/generate-daily-report',
    enabled: true
  },
  {
    name: 'weeklyReport',
    // Ejecutar todos los lunes a las 8:00 AM (0 8 * * 1)
    schedule: '0 8 * * 1',
    url: '/api/cron/generate-weekly-report',
    enabled: true
  }
];

// Función para iniciar todas las tareas CRON
export function startCronJobs(baseUrl: string) {
  // Verificar que estamos en el servidor y que cron está disponible
  if (typeof window !== 'undefined' || !cron) {
    console.warn('CRON jobs can only be started on the server side');
    return;
  }

  cronTasks.forEach(task => {
    if (task.enabled) {
      cron.schedule(task.schedule, async () => {
        try {
          console.log(`Ejecutando tarea CRON: ${task.name}`);
          
          // Parámetros específicos según la tarea
          let params = { source: 'cron', taskName: task.name };
          
          // Para la tarea de reconciliación, necesitamos obtener todas las organizaciones
          if (task.name === 'reconcileTransactions') {
            try {
              // Obtener todas las organizaciones para reconciliar sus transacciones
              const prisma = (await import('@prisma/client')).PrismaClient;
              const db = new prisma();
              const organizations = await db.organization.findMany();
              
              // Para cada organización, ejecutar la reconciliación
              for (const org of organizations) {
                try {
                  await axios.post(`${baseUrl}${task.url}`, { 
                    ...params, 
                    organizationId: org.id 
                  });
                  console.log(`Reconciliación completada para organización: ${org.name}`);
                } catch (error) {
                  console.error(`Error en reconciliación para organización ${org.name}:`, error);
                }
              }
              
              await db.$disconnect();
              return; // Evitamos ejecutar la llamada genérica al final
            } catch (error) {
              console.error('Error al obtener organizaciones para reconciliación:', error);
            }
          }
          
          // Para tareas regulares, llamada estándar
          const response = await axios.post(`${baseUrl}${task.url}`, params);
          console.log(`Tarea ${task.name} completada:`, response.data);
        } catch (error) {
          console.error(`Error en tarea ${task.name}:`, error);
        }
      });
      console.log(`Tarea CRON programada: ${task.name} (${task.schedule})`);
    }
  });
}

// No iniciamos CRON automáticamente aquí, lo haremos desde _app.tsx
export default cronTasks; 