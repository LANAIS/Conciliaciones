# CLIC Conciliaciones

Aplicación de conciliación de pagos para la plataforma CLIC. Permite gestionar, conciliar y reportar pagos procesados a través de la API de CLIC.

## Características principales

- **Sincronización automática**: Conexión con la API de CLIC para obtener transacciones y liquidaciones periódicamente.
- **Conciliación inteligente**: Matchea automáticamente las transacciones con sus correspondientes liquidaciones.
- **Gestión multi-organización**: Soporte para múltiples organizaciones y botones de pago.
- **Reportes detallados**: Exportación de reportes en Excel y PDF.
- **Control de acceso**: Diferentes roles por usuario y organización.
- **Tema oscuro**: Interfaz moderna con tema oscuro por defecto.
- **Autenticación segura**: Sistema completo de autenticación y registro.

## Requisitos previos

- Node.js 14.x o superior
- PostgreSQL 12.x o superior
- Acceso a la API de CLIC (API Keys y Secret Keys)

## Instalación

1. Clonar el repositorio:
   ```
   git clone https://github.com/tu-usuario/clic-conciliaciones.git
   cd clic-conciliaciones
   ```

2. Instalar dependencias:
   ```
   npm install
   ```

3. Configurar variables de entorno:
   - Crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:
   ```
   DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/clic_conciliaciones"
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=tu_secret_muy_seguro
   ENABLE_CRON_JOBS=true
   CLIC_API_URL="https://api.clic.com/v1"
   CLIC_API_TIMEOUT=30000
   ```

4. Configurar la base de datos:
   ```
   npx prisma migrate dev --name init
   ```

5. Iniciar el servidor de desarrollo:
   ```
   npm run dev
   ```

## Estructura del proyecto

- `/pages`: Páginas de la aplicación y endpoints de API.
  - `/api`: Endpoints de la API.
    - `/auth`: Endpoints de autenticación.
    - `/cron`: Servicios de sincronización programados.
    - `/reports`: Endpoints para la generación de reportes.
  - `/auth`: Páginas de autenticación y registro.
- `/components`: Componentes reutilizables.
  - `/auth`: Componentes relacionados con la autenticación.
  - `/layout`: Componentes de diseño principal.
  - `/navbar`: Componente de barra de navegación.
  - `/sidebar`: Componente de barra lateral.
- `/lib`: Funciones y servicios.
  - `/services`: Servicios para reportes y otras funcionalidades.
- `/prisma`: Esquema de la base de datos y migraciones.
- `/public`: Archivos estáticos.
- `/styles`: Estilos globales y configuración de TailwindCSS.

## Configuración de tareas CRON

La aplicación utiliza tareas programadas para sincronizar datos periódicamente. Estas tareas están configuradas en el archivo `pages/api/cron/config.ts`.

Las tareas CRON incluyen:
- **syncTransactions**: Sincronización de transacciones cada 3 horas.
- **dailyReport**: Generación de reportes diarios a las 7:00 AM.
- **weeklyReport**: Generación de reportes semanales cada lunes a las 8:00 AM.

En entornos de producción, se recomienda utilizar un servicio de tareas programadas como Vercel Cron Jobs, AWS Lambda Scheduled Events o similar.

## Generación de reportes

La aplicación puede generar reportes en formato Excel y PDF para:
- Transacciones
- Liquidaciones
- Conciliaciones

Para generar un reporte, se utilizan los siguientes endpoints:
- `POST /api/reports/transactions`: Genera un reporte de transacciones.
- `POST /api/reports/liquidations`: Genera un reporte de liquidaciones.
- `POST /api/reports/reconciliations`: Genera un reporte de conciliaciones.

## Modelos de datos principales

- **User**: Usuarios del sistema.
- **Organization**: Organizaciones que utilizan el sistema.
- **Role**: Roles disponibles (Administrador, Contador, Tesorero, Visualizador).
- **Membership**: Relación entre usuarios, organizaciones y roles.
- **PaymentButton**: Botones de pago registrados (con sus API Keys).
- **Transaction**: Transacciones obtenidas de la API de CLIC.
- **Liquidation**: Liquidaciones obtenidas de la API de CLIC.
- **SyncLog**: Registro de las sincronizaciones realizadas.

## Autenticación y autorización

La aplicación utiliza NextAuth.js para la autenticación:
- **Registro de usuarios**: Los usuarios pueden registrarse con email y contraseña.
- **Inicio de sesión**: Autenticación segura con sesiones.
- **Protección de rutas**: Todas las páginas, excepto las de autenticación, están protegidas.
- **Roles y permisos**: Los usuarios pueden tener diferentes roles en cada organización.

## Flujo de conciliación

1. **Sincronización de datos**: Obtención regular de transacciones y liquidaciones desde la API de CLIC.
2. **Cálculo de fechas estimadas**: Determinación de cuándo se acreditará cada transacción según el método de pago.
3. **Matching**: Asociación de transacciones con sus liquidaciones correspondientes.
4. **Reporte**: Generación de informes sobre el estado de las conciliaciones.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## Contacto

Para cualquier consulta o soporte, por favor contactar a [leandroismaelanais@gmail.com](mailto:leandroismaelanais@gmail.com).

```
├── components
│   ├── accounts            # Accounts components
│   ├── charts              # Charts components
│   ├── breadcrumb          # component
|   ├── home                # Home components
|   ├── layout              # Layout components
|   ├── navbar              # Navbar components
|   ├── sidebar             # Sidebar components
|   ├── table               # Table components
|   ├── styles              # Some reusable components
|   ├── icons               # Icons
|   ├── hooks               #  Hooks
├── pages                   # Documentation files 
│   ├──  _app.tsx           # Entry point for the app
│   ├──  index.tsx          # Home page
│   ├── accounts.tsx        # Accounts Page
│   ├── more...             # Soon
└──

```
## For Run

Install dependencies

    
```bash
npm install
```

Start the server

    
        
```bash
npm run dev
```

Now you can visit https://localhost:3000 in your browser.
