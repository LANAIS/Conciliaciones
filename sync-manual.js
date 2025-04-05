// Script para ejecutar la sincronización manualmente
const axios = require('axios');

async function syncData() {
  try {
    console.log('Iniciando sincronización de datos...');
    
    const response = await axios.post('http://localhost:3000/api/cron/sync-data', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Resultado de la sincronización:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error al sincronizar:', error.message);
    if (error.response) {
      console.error('Datos de respuesta:', error.response.data);
    }
  }
}

syncData(); 