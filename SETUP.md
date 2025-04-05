# Configuración de CLIC Conciliaciones

## Requisitos previos

- Node.js 14.x o superior
- PostgreSQL 12.x o superior
- Acceso a la API de Click de Pago (API Keys y Secret Keys)

## 1. Configuración de PostgreSQL

### Opción 1: Instalación local de PostgreSQL

1. Descargar e instalar [PostgreSQL](https://www.postgresql.org/download/) según tu sistema operativo.
2. Durante la instalación, establece una contraseña para el usuario `postgres`.
3. Crear una base de datos llamada `clic_conciliaciones`:

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE clic_conciliaciones;

# Salir
\q
```

### Opción 2: PostgreSQL con Docker

Si tienes Docker instalado, puedes ejecutar PostgreSQL en un contenedor:

```bash
docker run --name postgres-clic -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=clic_conciliaciones -p 5432:5432 -d postgres:14
```

### Opción 3: Servicio de PostgreSQL en la nube

Puedes utilizar servicios como:

- [ElephantSQL](https://www.elephantsql.com/) (tiene plan gratuito)
- [Supabase](https://supabase.com/) (tiene plan gratuito)
- [Amazon RDS](https://aws.amazon.com/rds/postgresql/)
- [Azure Database for PostgreSQL](https://azure.microsoft.com/en-us/services/postgresql/)

## 2. Configuración de Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clic_conciliaciones?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="supersecretkey123456_change_this_in_production"

# Configuración de CRON
ENABLE_CRON_JOBS=true

# Configuración de API de Click de Pago
CLIC_API_URL="https://api.clickdepago.com/v1"
CLIC_API_KEY="tu_api_key_aqui"
CLIC_API_SECRET="tu_api_secret_aqui"
CLIC_API_TIMEOUT=30000
```

Reemplaza los valores según tu configuración:

- `DATABASE_URL`: URL de conexión a tu base de datos PostgreSQL
- `NEXTAUTH_SECRET`: Clave secreta para NextAuth (genera una clave fuerte en producción)
- `CLIC_API_KEY` y `CLIC_API_SECRET`: Credenciales proporcionadas por Click de Pago

## 3. Inicialización de la Base de Datos

Para inicializar la base de datos con las tablas necesarias y datos de ejemplo:

```bash
# Generar el cliente de Prisma
npm run prisma:generate

# Ejecutar las migraciones
npm run prisma:migrate

# Cargar datos de ejemplo
npm run prisma:seed

# O ejecutar todo junto
npm run db:init
```

Esto creará:
- Roles predefinidos (Administrador, Contador, Tesorero, Visualizador)
- Un usuario administrador (email: admin@example.com, password: admin123)
- Una organización de ejemplo
- Un botón de pago de ejemplo

## 4. Configuración de Click de Pago

Para integrar con la API de Click de Pago, necesitas:

1. Registrarte como comercio en [Click de Pago](https://clickdepago.com)
2. Solicitar tus credenciales de API en el panel de desarrolladores
3. Generar una API Key y una Secret Key para cada botón de pago
4. Configurar las variables de entorno correspondientes

### Documentación de la API

Consulta la documentación oficial de Click de Pago para entender los endpoints disponibles y cómo utilizarlos. La documentación se encuentra en el archivo PDF proporcionado: `BM30647 - Click de Pago - Manual - API Pública.pdf`.

## 5. Ejecución del Proyecto

```bash
# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## 6. Acceso a la Aplicación

Utiliza las siguientes credenciales para acceder a la aplicación:

- **Email**: admin@example.com
- **Contraseña**: admin123

## 7. Configuración de Tareas Programadas (CRON)

La aplicación utiliza tareas CRON para sincronizar datos periódicamente. Estas tareas están configuradas en el archivo `pages/api/cron/config.ts`.

En entornos de producción, se recomienda configurar un servicio externo de tareas programadas como:

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [AWS Lambda Scheduled Events](https://docs.aws.amazon.com/lambda/latest/dg/with-scheduled-events.html)
- [Google Cloud Scheduler](https://cloud.google.com/scheduler)

## Problemas Comunes

### Error de Conexión a PostgreSQL

Si encuentras errores como "Authentication failed against database server", verifica:

1. Que PostgreSQL esté en ejecución
2. Que las credenciales en `DATABASE_URL` sean correctas
3. Que la base de datos `clic_conciliaciones` exista

### Error de Sincronización con Click de Pago

Si encuentras errores al sincronizar con la API de Click de Pago:

1. Verifica que las credenciales `CLIC_API_KEY` y `CLIC_API_SECRET` sean correctas
2. Asegúrate de que la URL base `CLIC_API_URL` sea la correcta según el ambiente (producción o pruebas)
3. Revisa los logs para ver el mensaje de error específico 