import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { add } from 'date-fns';

// Extender PrismaClient para manejar los modelos que faltan
interface ExtendedPrismaClient extends PrismaClient {
  permission: any;
  scheduledReconciliation: any;
}

const prisma = new PrismaClient() as unknown as ExtendedPrismaClient;

// Función para generar fechas aleatorias dentro de un rango
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Función para generar montos aleatorios
function randomAmount(min: number, max: number, decimals: number = 2) {
  const rand = min + Math.random() * (max - min);
  return Number(rand.toFixed(decimals));
}

// Función para generar ID aleatorio con prefijo
function generateId(prefix: string, length: number = 8) {
  return `${prefix}-${Math.random().toString(36).substring(2, 2 + length)}`;
}

// Función para seleccionar un elemento aleatorio de un array
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Función para verificar si una fecha es día hábil (ni sábado ni domingo)
function esHabil(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia !== 0 && dia !== 6; // 0 es domingo, 6 es sábado
}

// Función para obtener siguiente día hábil
function siguienteDiaHabil(fecha: Date): Date {
  const resultado = new Date(fecha);
  do {
    resultado.setDate(resultado.getDate() + 1);
  } while (!esHabil(resultado));
  return resultado;
}

// Función para sumar días hábiles
function sumarDiasHabiles(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  while (dias > 0) {
    resultado.setDate(resultado.getDate() + 1);
    if (esHabil(resultado)) {
      dias--;
    }
  }
  return resultado;
}

// Lista de permisos disponibles en la aplicación
const PERMISSIONS = [
  // Permisos para organizaciones
  { name: 'organization:create', description: 'Crear organizaciones' },
  { name: 'organization:view', description: 'Ver organizaciones' },
  { name: 'organization:edit', description: 'Editar organizaciones' },
  { name: 'organization:delete', description: 'Eliminar organizaciones' },
  
  // Permisos para botones de pago
  { name: 'paymentButton:create', description: 'Crear botones de pago' },
  { name: 'paymentButton:view', description: 'Ver botones de pago' },
  { name: 'paymentButton:edit', description: 'Editar botones de pago' },
  { name: 'paymentButton:delete', description: 'Eliminar botones de pago' },
  
  // Permisos para transacciones
  { name: 'transaction:view', description: 'Ver transacciones' },
  { name: 'transaction:export', description: 'Exportar transacciones' },
  
  // Permisos para liquidaciones
  { name: 'liquidation:view', description: 'Ver liquidaciones' },
  
  // Permisos para conciliaciones
  { name: 'reconciliation:run', description: 'Ejecutar conciliaciones' },
  { name: 'reconciliation:view', description: 'Ver historial de conciliaciones' },
  { name: 'reconciliation:schedule', description: 'Programar conciliaciones' },
  { name: 'reconciliation:manage', description: 'Gestionar conciliaciones programadas' },
  
  // Permisos para usuarios
  { name: 'user:create', description: 'Crear usuarios' },
  { name: 'user:view', description: 'Ver usuarios' },
  { name: 'user:edit', description: 'Editar usuarios' },
  { name: 'user:delete', description: 'Eliminar usuarios' },
  
  // Permisos para roles
  { name: 'role:manage', description: 'Gestionar roles y permisos' },
];

// Definición de roles predefinidos
const ROLES = [
  {
    name: 'superadmin',
    description: 'Acceso completo a todas las funcionalidades',
    permissions: PERMISSIONS.map(p => p.name),
  },
  {
    name: 'admin',
    description: 'Administrador de organizaciones',
    permissions: [
      'organization:view', 'organization:edit',
      'paymentButton:create', 'paymentButton:view', 'paymentButton:edit', 'paymentButton:delete',
      'transaction:view', 'transaction:export',
      'liquidation:view',
      'reconciliation:run', 'reconciliation:view', 'reconciliation:schedule', 'reconciliation:manage',
      'user:view', 'user:edit'
    ],
  },
  {
    name: 'operator',
    description: 'Operador de conciliaciones',
    permissions: [
      'paymentButton:view',
      'transaction:view', 'transaction:export',
      'liquidation:view',
      'reconciliation:run', 'reconciliation:view'
    ],
  },
  {
    name: 'viewer',
    description: 'Solo lectura',
    permissions: [
      'organization:view',
      'paymentButton:view',
      'transaction:view',
      'liquidation:view',
      'reconciliation:view'
    ],
  },
];

async function main() {
  try {
    console.log('🌱 Iniciando seed...');
    
    // Crear permisos
    console.log('Creando permisos...');
    for (const permission of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { name: permission.name },
        update: { 
          name: permission.name,
          description: permission.description 
        },
        create: { 
          name: permission.name,
          description: permission.description 
        },
      });
    }
    console.log(`✅ Creados ${PERMISSIONS.length} permisos`);
    
    // Obtener todos los permisos creados
    const dbPermissions = await prisma.permission.findMany();
    const permissionsByName: Record<string, string> = {};
    
    dbPermissions.forEach((p: { name: string; id: string }) => {
      permissionsByName[p.name] = p.id;
    });
    
    // Crear roles
    console.log('Creando roles...');
    for (const role of ROLES) {
      // Obtener IDs de permisos para este rol
      const permissionIds = role.permissions
        .map(name => permissionsByName[name])
        .filter(Boolean);
      
      await prisma.role.upsert({
        where: { name: role.name },
        update: {
          permissions: {
            set: permissionIds.map(id => ({ id })),
          },
        },
        create: {
          name: role.name,
          permissions: {
            connect: permissionIds.map(id => ({ id })),
          },
        },
      });
    }
    console.log(`✅ Creados ${ROLES.length} roles`);
      
    // Obtener los roles desde la base de datos para usar sus IDs
    const dbRoles = await prisma.role.findMany();

    // ---- USUARIOS ----
    // Crear 10 usuarios además de los predeterminados

    // Usuarios predeterminados
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: { password: await bcrypt.hash('admin123', 10) },
      create: {
        name: 'Admin Usuario',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10),
      },
    });

    // Crear/actualizar el superadmin con las credenciales específicas
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@example.com' },
      update: { 
        name: 'Super Administrador',
        password: await bcrypt.hash('superadmin123', 10) 
      },
      create: {
        name: 'Super Administrador',
        email: 'superadmin@example.com',
        password: await bcrypt.hash('superadmin123', 10),
      },
    });

    // Usuarios adicionales
    const userNames = [
      { name: 'María López', email: 'maria@example.com', role: 'Contador' },
      { name: 'Carlos Gómez', email: 'carlos@example.com', role: 'Tesorero' },
      { name: 'Ana Rodríguez', email: 'ana@example.com', role: 'Visualizador' },
      { name: 'Pedro Sánchez', email: 'pedro@example.com', role: 'Administrador' },
      { name: 'Laura Martínez', email: 'laura@example.com', role: 'Contador' },
      { name: 'Javier García', email: 'javier@example.com', role: 'Tesorero' },
      { name: 'Sofia Pérez', email: 'sofia@example.com', role: 'Visualizador' },
      { name: 'Miguel Torres', email: 'miguel@example.com', role: 'Administrador' },
      { name: 'Valentina Ruiz', email: 'valentina@example.com', role: 'Contador' },
      { name: 'Diego Castro', email: 'diego@example.com', role: 'Tesorero' },
      { name: 'Camila Vargas', email: 'camila@example.com', role: 'Visualizador' },
      { name: 'Eduardo Morales', email: 'eduardo@example.com', role: 'Administrador' }
    ];

    const users = await Promise.all(
      userNames.map(async ({ name, email, role }) => {
        const userPassword = 'password123';
        const hashedPassword = await bcrypt.hash(userPassword, 10);
        
        return prisma.user.upsert({
          where: { email },
          update: { password: hashedPassword },
          create: {
            name,
            email,
            password: hashedPassword,
          },
        });
      })
    );

    console.log(`✅ Creados ${users.length + 2} usuarios`);

    // ---- ORGANIZACIONES ----
    // Crear organizaciones de municipios de Misiones

    const organizationNames = [
      'Municipalidad de Posadas',
      'Municipalidad de Eldorado',
      'Municipalidad de Oberá',
      'Municipalidad de Puerto Iguazú',
      'Municipalidad de Apóstoles',
      'Municipalidad de Jardín América',
      'Municipalidad de Leandro N. Alem',
      'Municipalidad de Montecarlo',
      'Municipalidad de San Vicente',
      'Municipalidad de Garupá',
      'Municipalidad de Puerto Rico',
      'Municipalidad de San Pedro',
      'Municipalidad de Aristóbulo del Valle',
      'Municipalidad de Campo Viera'
    ];

    const organizations = await Promise.all(
      organizationNames.map((name, index) => 
        prisma.organization.upsert({
          where: { id: `org-${index + 1}` },
          update: { name },
          create: {
            id: `org-${index + 1}`,
            name,
          },
        })
      )
    );

    console.log(`✅ Creadas ${organizations.length} organizaciones`);

    // ---- MEMBRESÍAS ----
    // Asignar usuarios a organizaciones con diferentes roles
    
    // Eliminar todas las membresías existentes para empezar de cero
    await prisma.membership.deleteMany({});
    
    // Encontrar el rol de superadmin
    const superadminRole = dbRoles.find(role => role.name === 'superadmin');
    if (!superadminRole) {
      throw new Error('Rol de superadmin no encontrado');
    }

    // Super Admin tiene acceso a TODAS las organizaciones
    console.log('Asignando membresías al superadmin...');
    const superAdminMemberships = await Promise.all(
      organizations.map(org => 
        prisma.membership.create({
          data: {
            userId: superAdmin.id,
            organizationId: org.id,
            roleId: superadminRole.id, // Aseguramos que tenga el rol correcto
          },
        })
      )
    );
    console.log(`✅ Superadmin tiene acceso a ${organizations.length} organizaciones`);

    // Admin tiene acceso a las primeras 4 organizaciones
    const adminMemberships = await Promise.all(
      organizations.slice(0, 4).map(org => 
        prisma.membership.upsert({
          where: {
            userId_organizationId: {
              userId: adminUser.id,
              organizationId: org.id,
            },
          },
          update: { roleId: dbRoles[1].id },
          create: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: dbRoles[1].id,
          },
        })
      )
    );

    // Distribuir usuarios entre organizaciones con roles aleatorios
    const userMemberships = [];
    for (const user of users) {
      // Asignar cada usuario a 1-3 organizaciones aleatorias
      const numOrgs = 1 + Math.floor(Math.random() * 3);
      const userOrgs = [...organizations].sort(() => 0.5 - Math.random()).slice(0, numOrgs);
      
      for (const org of userOrgs) {
        // Asignar un rol aleatorio (excepto Super Admin)
        const roleIndex = 1 + Math.floor(Math.random() * (dbRoles.length - 1));
        
        const membership = await prisma.membership.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          update: { roleId: dbRoles[roleIndex].id },
          create: {
            userId: user.id,
            organizationId: org.id,
            roleId: dbRoles[roleIndex].id,
          },
        });
        
        userMemberships.push(membership);
      }
    }

    console.log(`✅ Creadas ${superAdminMemberships.length + adminMemberships.length + userMemberships.length} membresías`);

    // ---- BOTONES DE PAGO ----
    // Crear botones de pago específicos para cada organización

    const buttonTypes = [
      { suffix: 'Tasas Municipales', purpose: 'Pago de tasas municipales' },
      { suffix: 'IPA', purpose: 'Impuesto a la propiedad automotor' },
      { suffix: 'SEM', purpose: 'Sistema de estacionamiento medido' },
      { suffix: 'Boleteria Digital', purpose: 'Compra de entradas para eventos municipales' },
      { suffix: 'Servicios', purpose: 'Pago de servicios municipales' },
      { suffix: 'Habilitaciones Comerciales', purpose: 'Gestión de habilitaciones comerciales' }
    ];

    const paymentButtons = [];

    for (const org of organizations) {
      // Cada organización tiene entre 1 y 5 botones (aleatorio)
      const numButtons = 1 + Math.floor(Math.random() * 5);
      // Mezclamos y seleccionamos botones aleatorios
      const shuffledButtons = [...buttonTypes].sort(() => 0.5 - Math.random());
      const orgButtons = shuffledButtons.slice(0, numButtons);
      
      for (let i = 0; i < orgButtons.length; i++) {
        const buttonType = orgButtons[i];
        const buttonId = `btn-${org.id}-${i + 1}`;
        const buttonName = `Boton ${buttonType.suffix}`;
        
        const button = await prisma.paymentButton.upsert({
          where: { id: buttonId },
          update: {
            name: buttonName,
            apiKey: `api_${org.id}_${buttonType.suffix.toLowerCase().replace(/\s+/g, '_')}_${i}`,
            secretKey: `secret_${org.id}_${buttonType.suffix.toLowerCase().replace(/\s+/g, '_')}_${i}`,
          },
          create: {
            id: buttonId,
            name: buttonName,
            apiKey: `api_${org.id}_${buttonType.suffix.toLowerCase().replace(/\s+/g, '_')}_${i}`,
            secretKey: `secret_${org.id}_${buttonType.suffix.toLowerCase().replace(/\s+/g, '_')}_${i}`,
            organizationId: org.id,
          },
        });
        
        paymentButtons.push(button);
      }
    }
    
    console.log(`✅ Creados ${paymentButtons.length} botones de pago`);

    // ---- USUARIOS POR BOTÓN ----
    // Asegurar que cada botón tenga varios usuarios con diferentes roles
    // y cada organización tenga solo un administrador

    console.log('Configurando usuarios por botón...');

    // Asignar un solo admin a cada organización
    for (const org of organizations) {
      // Para cada organización, elegimos un usuario que será admin (excepto superAdmin)
      const availableUsers = users.slice(); // Copia para no modificar el original
      
      // Seleccionamos un usuario aleatorio para ser admin
      const adminIndex = Math.floor(Math.random() * availableUsers.length);
      const adminUser = availableUsers[adminIndex];
      
      // Verificar si ya existe esta membresía
      const existingAdminMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: adminUser.id,
            organizationId: org.id
          }
        }
      });
      
      // Solo crear si no existe
      if (!existingAdminMembership) {
        // Creamos la membresía con rol de admin
        await prisma.membership.create({
          data: {
            userId: adminUser.id,
            organizationId: org.id,
            roleId: dbRoles[1].id, // Rol admin
          }
        });
      }
      
      availableUsers.splice(adminIndex, 1); // Quitamos este usuario para los otros roles
      
      // Para cada botón en esta organización, asignamos varios usuarios con diferentes roles
      const orgButtons = paymentButtons.filter(btn => btn.organizationId === org.id);
      
      for (const button of orgButtons) {
        // Asignamos entre 2 y 4 usuarios por botón (excepto el admin que ya asignamos)
        const usersPerButton = 2 + Math.floor(Math.random() * 3);
        const buttonUsers = [];
        
        for (let i = 0; i < usersPerButton && availableUsers.length > 0; i++) {
          // Seleccionar usuario aleatorio disponible
          const userIndex = Math.floor(Math.random() * availableUsers.length);
          const user = availableUsers[userIndex];
          buttonUsers.push(user);
          availableUsers.splice(userIndex, 1); // Removemos para que no se asigne más de una vez a esta organización
          
          // Asignar rol operator o viewer (los roles 2 y 3)
          const roleIndex = 2 + Math.floor(Math.random() * 2);
          
          // Verificar si ya existe esta membresía
          const existingMembership = await prisma.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: org.id
              }
            }
          });
          
          // Solo crear si no existe
          if (!existingMembership) {
            await prisma.membership.create({
              data: {
                userId: user.id,
                organizationId: org.id,
                roleId: dbRoles[roleIndex].id,
              }
            });
          }
        }
      }
    }

    console.log('✅ Membresías configuradas correctamente');

    // ---- LIQUIDACIONES Y TRANSACCIONES ----
    // Recrear liquidaciones y transacciones con reglas específicas

    // Primero, eliminamos liquidaciones y transacciones existentes
    await prisma.transaction.deleteMany({});
    await prisma.liquidation.deleteMany({});

    // Definimos el rango de fechas para transacciones
    const startDate = new Date('2024-10-01');
    const endDate = new Date('2025-03-10');

    // El único estado válido para liquidaciones es PROCESADO
    const liquidationStatus = 'PROCESADO';
    const paymentMethods = ['CRÉDITO', 'DÉBITO', 'QR'];

    // Estados de transacciones según la documentación
    const transactionStatuses = {
      CREADA: 'CREADA',                       // 1 - Transacción creada (no procesada)
      EN_PAGO: 'EN_PAGO',                     // 2 - Transacción en pago
      REALIZADA: 'REALIZADA',                 // 3 - Transacción procesada con éxito
      RECHAZADA: 'RECHAZADA',                 // 4 - Transacción rechazada
      ERROR_VALIDACION_HASH_TOKEN: 'ERROR_VALIDACION_HASH_TOKEN', // 5 - Error en validación de firma al crear
      ERROR_VALIDACION_HASH_PAGO: 'ERROR_VALIDACION_HASH_PAGO',   // 6 - Error en validación de firma al pagar
      EXPIRADA: 'EXPIRADA',                   // 7 - Transacción expirada
      CANCELADA: 'CANCELADA',                 // 8 - Transacción cancelada por el usuario
      DEVUELTA: 'DEVUELTA',                   // 9 - Transacción devuelta
      PENDIENTE: 'PENDIENTE',                 // 10 - DEBIN creado, esperando aprobación
      VENCIDA: 'VENCIDA'                      // 11 - Transacción vencida porque expiró el DEBIN
    };

    // Crear transacciones y luego sus liquidaciones correspondientes
    const transactions = [];
    let transactionCount = 1;
    let liquidationCount = 1;

    for (const button of paymentButtons) {
      // Para cada botón, crear entre 15 y 30 transacciones
      const numTransactions = 15 + Math.floor(Math.random() * 16);
      
      for (let i = 0; i < numTransactions; i++) {
        const transactionId = `TX${String(transactionCount).padStart(8, '0')}`;
        
        // Distribuir los estados de las transacciones con diferentes probabilidades
        const statusRandom = Math.random();
        let status;
        
        if (statusRandom < 0.75) {
          // Mayoritariamente REALIZADA (liquidable)
          status = transactionStatuses.REALIZADA;
        } else if (statusRandom < 0.85) {
          // Algunas CREADA
          status = transactionStatuses.CREADA;
        } else if (statusRandom < 0.90) {
          // Algunas EN_PAGO
          status = transactionStatuses.EN_PAGO;
        } else if (statusRandom < 0.94) {
          // Pocas RECHAZADA
          status = transactionStatuses.RECHAZADA;
        } else if (statusRandom < 0.96) {
          // Muy pocas PENDIENTE
          status = transactionStatuses.PENDIENTE;
        } else {
          // Distribuir el resto de estados con poca frecuencia
          const remainingStatuses = [
            transactionStatuses.ERROR_VALIDACION_HASH_TOKEN,
            transactionStatuses.ERROR_VALIDACION_HASH_PAGO,
            transactionStatuses.EXPIRADA,
            transactionStatuses.CANCELADA,
            transactionStatuses.DEVUELTA,
            transactionStatuses.VENCIDA
          ];
          status = randomItem(remainingStatuses);
        }
        
        const paymentMethod = randomItem(paymentMethods);
        const date = randomDate(startDate, endDate);
        const amount = randomAmount(100, 10000);
        const quotas = paymentMethod === 'CRÉDITO' ? randomItem([1, 3, 6, 12]) : 1;
        
        // Calcular fecha esperada de acreditación según medio de pago
        // solo para transacciones que pueden liquidarse
        let expectedPayDate = null;
        
        if (status === transactionStatuses.REALIZADA) {
          if (paymentMethod === 'CRÉDITO') {
            // 18 días hábiles después para crédito
            expectedPayDate = sumarDiasHabiles(date, 18);
          } else {
            // Siguiente día hábil para débito y QR
            expectedPayDate = siguienteDiaHabil(date);
          }
        }
        
        // Determinar si esta transacción estará liquidada
        // Solo las REALIZADAS pueden liquidarse
        const shouldBeLiquidated = status === transactionStatuses.REALIZADA && Math.random() < 0.7;
        
        // Guardar la transacción
        const transaction = await prisma.transaction.create({
          data: {
            transactionId,
            amount,
            currency: 'ARS',
            status,
            paymentMethod,
            quotas,
            date,
            expectedPayDate,
            paymentButtonId: button.id,
            // No asignamos liquidation aún
          }
        });
        
        transactions.push({
          ...transaction,
          shouldBeLiquidated,
          paymentMethod // Guardamos el método para agrupar después
        });
        
        transactionCount++;
      }
    }

    console.log(`✅ Creadas ${transactions.length} transacciones`);

    // Agrupar transacciones por botón y método de pago para crear liquidaciones
    console.log('Creando liquidaciones...');

    // Mapeo para agrupar transacciones
    const buttonMethodTransactions: Record<string, Record<string, any[]>> = {};

    // Clasificar transacciones que deben liquidarse
    transactions
      .filter(tx => tx.shouldBeLiquidated)
      .forEach(tx => {
        if (!buttonMethodTransactions[tx.paymentButtonId]) {
          buttonMethodTransactions[tx.paymentButtonId] = {};
        }
        
        if (!buttonMethodTransactions[tx.paymentButtonId][tx.paymentMethod]) {
          buttonMethodTransactions[tx.paymentButtonId][tx.paymentMethod] = [];
        }
        
        buttonMethodTransactions[tx.paymentButtonId][tx.paymentMethod].push(tx);
      });

    // Crear liquidaciones para cada grupo
    const liquidations = [];

    for (const [buttonId, methodGroups] of Object.entries(buttonMethodTransactions)) {
      for (const [method, txs] of Object.entries(methodGroups)) {
        // Agrupar por fecha esperada de pago para hacer liquidaciones por fecha
        const byExpectedDate: Record<string, any[]> = {};
        
        txs.forEach(tx => {
          if (!tx.expectedPayDate) return;
          
          const dateKey = tx.expectedPayDate.toISOString().split('T')[0];
          if (!byExpectedDate[dateKey]) {
            byExpectedDate[dateKey] = [];
          }
          byExpectedDate[dateKey].push(tx);
        });
        
        // Para cada grupo de fecha, crear una liquidación
        for (const [dateKey, dateTxs] of Object.entries(byExpectedDate)) {
          let liquidationDate = new Date(dateKey);
          
          // Verificar que la fecha de liquidación sea día hábil
          if (!esHabil(liquidationDate)) {
            liquidationDate = siguienteDiaHabil(liquidationDate);
          }
          
          // Calcular monto total de la liquidación
          const totalAmount = dateTxs.reduce((sum, tx) => sum + tx.amount, 0);
          
          // Crear la liquidación
          const liquidationId = `LIQ${String(liquidationCount).padStart(6, '0')}`;
          const status = liquidationStatus;
          
          const liquidation = await prisma.liquidation.create({
            data: {
              liquidationId,
              amount: totalAmount,
              currency: 'ARS',
              date: liquidationDate,
              status,
              paymentButtonId: buttonId,
            }
          });
          
          // Actualizar las transacciones para que apunten a esta liquidación
          await Promise.all(
            dateTxs.map(tx => 
              prisma.transaction.update({
                where: { id: tx.id },
                data: { liquidationId: liquidation.id }
              })
            )
          );
          
          liquidations.push(liquidation);
          liquidationCount++;
        }
      }
    }

    // Crear algunas liquidaciones pendientes para transacciones recientes
    // Buscamos transacciones REALIZADAS que no están liquidadas
    const pendingTxs = await prisma.transaction.findMany({
      where: {
        status: 'REALIZADA',
        liquidationId: null,
      }
    });

    // Agrupar por botón y método de pago
    const pendingGroups: Record<string, Record<string, any[]>> = {};

    pendingTxs.forEach(tx => {
      if (!pendingGroups[tx.paymentButtonId]) {
        pendingGroups[tx.paymentButtonId] = {};
      }
      
      if (!pendingGroups[tx.paymentButtonId][tx.paymentMethod]) {
        pendingGroups[tx.paymentButtonId][tx.paymentMethod] = [];
      }
      
      pendingGroups[tx.paymentButtonId][tx.paymentMethod].push(tx);
    });

    // Crear liquidaciones pendientes
    for (const [buttonId, methodGroups] of Object.entries(pendingGroups)) {
      for (const [method, txs] of Object.entries(methodGroups)) {
        if (txs.length === 0) continue;
        
        // Crear una liquidación (siempre PROCESADO, no existen liquidaciones PENDIENTES)
        const liquidationId = `LIQ${String(liquidationCount).padStart(6, '0')}`;
        const totalAmount = txs.reduce((sum, tx) => sum + tx.amount, 0);
        
        // La fecha debe ser día hábil
        let liquidationDate = new Date();
        if (!esHabil(liquidationDate)) {
          liquidationDate = siguienteDiaHabil(liquidationDate);
        }
        
        const liquidation = await prisma.liquidation.create({
          data: {
            liquidationId,
            amount: totalAmount,
            currency: 'ARS',
            date: liquidationDate,
            status: liquidationStatus, // Siempre PROCESADO
            paymentButtonId: buttonId,
          }
        });
        
        liquidations.push(liquidation);
        liquidationCount++;
      }
    }

    console.log(`✅ Creadas ${liquidations.length} liquidaciones`);

    // ---- CONCILIACIONES PROGRAMADAS ----
    // Verificar si ya hay conciliaciones programadas
    console.log('Verificando conciliaciones programadas...');
    try {
      await prisma.scheduledReconciliation.deleteMany({});
      
      console.log('Creando conciliaciones programadas...');
      
      // Crear conciliaciones programadas con diferentes estados para cada botón
      for (const button of paymentButtons) {
        // Obtener la organización y un usuario con membresía
        const org = organizations.find(o => o.id === button.organizationId);
        
        if (!org) continue;
        
        // Buscar un usuario con membresía en esta organización (preferentemente admin)
        const membership = await prisma.membership.findFirst({
          where: { 
            organizationId: org.id,
            role: {
              name: 'admin'
            }
          },
          select: { userId: true }
        });
        
        if (!membership) continue;
        
        // Estados para las conciliaciones
        const reconciliationStatuses = ['SUCCESS', 'FAILED', 'PARTIAL'];
        
        // Crear una conciliación programada
        await prisma.scheduledReconciliation.create({
          data: {
            id: `sched-${button.id}`,
            name: `Conciliación Automática - ${button.name}`,
            description: `Conciliación automática para ${org.name} usando el botón ${button.name}`,
            organizationId: org.id,
            paymentButtonId: button.id,
            createdById: membership.userId,
            frequency: randomItem(['DAILY', 'WEEKLY', 'MONTHLY']),
            dayOfWeek: Math.floor(Math.random() * 5) + 1, // 1-5 (Lun-Vie)
            dayOfMonth: Math.floor(Math.random() * 28) + 1, // 1-28
            hour: Math.floor(Math.random() * 24), // 0-23
            minute: randomItem([0, 15, 30, 45]), // 0, 15, 30, 45
            daysToInclude: randomItem([7, 14, 30]),
            notifyEmail: Math.random() > 0.3,
            notifyEmails: Math.random() > 0.5 ? 'notificaciones@example.com' : null,
            isActive: Math.random() > 0.2,
            nextRun: add(new Date(), { days: Math.floor(Math.random() * 7) + 1 }),
            lastRun: Math.random() > 0.5 ? add(new Date(), { days: -Math.floor(Math.random() * 30) }) : null,
            executionCount: Math.floor(Math.random() * 20),
            lastExecutionStatus: randomItem(reconciliationStatuses),
            lastErrorMessage: Math.random() > 0.7 ? 'Error de conexión con la API' : null
          }
        });
      }
      
      console.log('✅ Conciliaciones programadas creadas correctamente');
    } catch (error) {
      console.error('Error al crear conciliaciones programadas:', error);
    }

    // Crear registros de historial de conciliaciones
    console.log('Verificando historial de conciliaciones...');
    let historyCount = 0;
    try {
      historyCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "ReconciliationHistory"`.then((result: any) => Number(result[0].count));
    } catch (error) {
      console.log('Error al contar historial de conciliaciones:', error);
      historyCount = 0;
    }
    
    if (historyCount > 0) {
      console.log('Ya existen registros en el historial de conciliaciones, saltando creación');
    } else {
      console.log('Creando registros de historial de conciliaciones...');
      
      // Buscar usuarios, organizaciones y botones si no existen
      let adminUser = await prisma.user.findFirst({
        where: { email: 'admin@example.com' }
      });
      
      let superAdmin = await prisma.user.findFirst({
        where: { email: 'superadmin@example.com' }
      });
      
      // Obtener las organizaciones
      const organizations = await prisma.organization.findMany({
        take: 3,
        orderBy: { createdAt: 'asc' }
      });
      
      // Obtener botones de pago
      const paymentButtons = await prisma.paymentButton.findMany({
        take: 5,
        orderBy: { createdAt: 'asc' }
      });

      if (organizations.length === 0 || paymentButtons.length === 0 || !adminUser || !superAdmin) {
        console.log('Faltan datos necesarios para crear historial de conciliaciones');
        return;
      }
      
      // Crear 20 registros aleatorios en el historial de conciliaciones
      const statuses = ["COMPLETED", "FAILED", "PARTIAL"];
      
      for (let i = 0; i < 20; i++) {
        // Elegir organización, botón y usuario aleatorios
        const org = organizations[Math.floor(Math.random() * organizations.length)];
        
        // Obtener botones de la organización
        const orgButtons = paymentButtons.filter(button => button.organizationId === org.id);
        if (orgButtons.length === 0) continue;
        
        const button = orgButtons[Math.floor(Math.random() * orgButtons.length)];
        const user = Math.random() > 0.5 ? adminUser : superAdmin;
        
        // Generar fechas aleatorias (dentro de los últimos 3 meses)
        const endDate = randomDate(
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          new Date()
        );
        
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 14) - 1);
        
        // Generar estado aleatorio
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // Generar datos aleatorios para recordsAffected y totalAmount
        const recordsAffected = Math.floor(Math.random() * 200) + 10;
        const totalAmount = randomAmount(10000, 5000000, 2);
        
        // Generar descripción según el estado
        let description = '';
        if (status === 'COMPLETED') {
          description = 'Conciliación completada correctamente';
        } else if (status === 'FAILED') {
          description = 'Error en la conciliación: no se pudieron procesar los datos';
        } else {
          description = 'Conciliación parcial: algunos registros no pudieron ser procesados';
        }
        
        // Crear el registro de conciliación
        try {
          await prisma.$executeRaw`
            INSERT INTO "ReconciliationHistory" (
              id, "createdAt", "userId", "organizationId", "paymentButtonId",
              "startDate", "endDate", "recordsAffected", "totalAmount",
              "description", "status"
            ) VALUES (
              ${generateId('hist')}, ${new Date(endDate)}, ${user!.id}, ${org.id}, ${button.id},
              ${new Date(startDate)}, ${new Date(endDate)}, ${recordsAffected}, ${totalAmount},
              ${description}, ${status}
            )
          `;
        } catch (error) {
          console.error(`Error al crear registro de historial ${i}:`, error);
        }
      }
      
      console.log('Registros de historial de conciliaciones creados');
    }

    console.log('✅ Seed completado con éxito');
  } catch (error) {
    console.error('Error durante el seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 