/* eslint-disable react-hooks/exhaustive-deps */
import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import withAuth from '../components/auth/withAuth';
import { PrismaClient, Transaction } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClickPagoTransaccion, ClickPagoLiquidacion, PaymentMethodStats, TransactionStatusStats } from '../types/clickPagoTypes';
import { CalendarToday, ArrowBack, ArrowForward, Close, CreditCard, WarningAmber, CheckCircle } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getLiquidationId, 
  getTransactionStatus, 
  isPendingTransaction, 
  isTransactionOverdue, 
  isCompletedTransaction,
  getTransactionStatusTextColor,
  getTransactionAmount,
  getTransactionId,
  getPaymentMethod
} from '../utils/transactionUtils';

// Interfaces
interface Organization {
  id: string;
  name: string;
}

interface PaymentButton {
  id: string;
  name: string;
}

interface CalendarDayData {
  date: Date;
  transactionsCount: number;
  realizedTransactionsCount: number;
  realizedTransactionsAmount: number;
  liquidationsAmount: number;
  isCurrentMonth: boolean;
  transactions: ClickPagoTransaccion[];
  liquidations: ClickPagoLiquidacion[];
  txStats: TransactionStatusStats;
}

interface CalendarProps {
  organizations: Organization[];
  userOrganizations: string[];
}

const Calendar: NextPage<CalendarProps> = ({ organizations, userOrganizations }) => {
  // Estado para organización y botón de pago
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([]);
  const [selectedButtonId, setSelectedButtonId] = useState<string>('');
  
  // Estado para calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDayData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ClickPagoTransaccion[]>([]);
  const [liquidations, setLiquidations] = useState<ClickPagoLiquidacion[]>([]);
  
  // Estado para el modal de detalles
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // Filtrar organizaciones a las que el usuario tiene acceso
  const userOrgs = organizations.filter(org => userOrganizations.includes(org.id));
  
  // Seleccionar automáticamente la primera organización al cargar
  useEffect(() => {
    if (userOrgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(userOrgs[0].id);
    }
  }, [userOrgs]);
  
  // Cargar botones de pago cuando se selecciona una organización
  useEffect(() => {
    if (selectedOrgId) {
      fetchPaymentButtons(selectedOrgId);
    } else {
      setPaymentButtons([]);
      setSelectedButtonId('');
    }
  }, [selectedOrgId]);
  
  // Cargar datos cuando cambian la organización, botón o mes
  useEffect(() => {
    if (selectedOrgId && selectedButtonId) {
      fetchCalendarData();
    }
  }, [selectedOrgId, selectedButtonId, currentDate]);
  
  // Informar cuando cambian los datos
  useEffect(() => {
    console.log("Datos actualizados:", {
      transacciones: transactions.length,
      liquidaciones: liquidations.length
    });
    
    // Siempre construir el calendario cuando cambian los datos
    if (transactions.length > 0 || liquidations.length > 0) {
      console.log("Construyendo calendario con datos reales");
    } else {
      console.log("No hay datos disponibles para mostrar en el calendario");
    }
    
    buildCalendarDays();
  }, [transactions, liquidations]);
  
  // Calcular estadísticas de transacciones según su estado
  const transactionStats = useMemo(() => {
    // Filtrar por mes actual
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);
    
    // Si no hay transacciones, retornar estadísticas vacías
    if (transactions.length === 0) {
      console.log('No hay transacciones para calcular estadísticas');
      return {
        pending: { count: 0, amount: 0, transactions: [] },
        overdue: { count: 0, amount: 0, transactions: [] },
        completed: { count: 0, amount: 0, transactions: [] }
      };
    }
    
    console.log(`Calculando estadísticas para ${transactions.length} transacciones`);
    
    const monthTransactions = transactions.filter(tx => {
      try {
        // Verificar si tenemos la fecha en el formato esperado o en date
        const txDate = tx.fechaTransaccion 
          ? parseISO(tx.fechaTransaccion) 
          : tx.date 
            ? parseISO(tx.date) 
            : null;
        
        if (!txDate) {
          console.error('Fecha no válida en transacción:', tx);
          return false;
        }
        
        return txDate >= currentMonthStart && txDate <= currentMonthEnd;
      } catch (error) {
        console.error('Error al analizar fecha de transacción:', tx, error);
        return false;
      }
    });
    
    console.log(`Transacciones del mes actual: ${monthTransactions.length}`);
    
    // Transacciones pendientes (realizadas pero sin liquidar)
    const pendingTransactions = monthTransactions.filter(tx => {
      // Considerar tanto el formato de la API externa como el formato interno
      const status = tx.estado || tx.status;
      const liquidationId = tx.idLiquidacion || tx.liquidationId;
      
      // Una transacción está pendiente si:
      // 1. Está en estado REALIZADO
      // 2. NO tiene asignada una liquidación
      return status === 'REALIZADA' && !liquidationId;
    });

    // Transacciones vencidas (deberían estar liquidadas pero no lo están)
    const overdueTransactions = monthTransactions.filter(tx => {
      // Considerar tanto el formato de la API externa como el formato interno
      const status = tx.estado || tx.status;
      const liquidationId = tx.idLiquidacion || tx.liquidationId;
      
      // Si ya está liquidada o no está REALIZADA, no está vencida
      if (status !== 'REALIZADA' || liquidationId) return false;
      
      const currentDate = new Date();
      // Usar la fecha apropiada según el formato de los datos
      const expectedPayDateStr = tx.fechaAcreditacionEstimada || tx.estimatedPaymentDate;
      const expectedPayDate = expectedPayDateStr ? parseISO(expectedPayDateStr) : null;
      
      // Si hay fecha estimada de acreditación y ya pasó
      return expectedPayDate && isAfter(currentDate, expectedPayDate);
    });

    // Transacciones acreditadas (realizadas y ya liquidadas)
    const completedTransactions = monthTransactions.filter(tx => {
      // Considerar tanto el formato de la API externa como el formato interno
      const status = tx.estado || tx.status;
      const liquidationId = tx.idLiquidacion || tx.liquidationId;
      
      // Una transacción está acreditada si:
      // 1. Está en estado REALIZADO
      // 2. Tiene asignada una liquidación
      return status === 'REALIZADA' && !!liquidationId;
    });

    // Calcular montos totales (considerando diferentes formatos de datos)
    const pendingAmount = pendingTransactions.reduce((sum, tx) => 
      sum + (typeof tx.monto === 'number' ? tx.monto : 
             typeof tx.amount === 'number' ? tx.amount : 0), 0);
            
    const overdueAmount = overdueTransactions.reduce((sum, tx) => 
      sum + (typeof tx.monto === 'number' ? tx.monto : 
             typeof tx.amount === 'number' ? tx.amount : 0), 0);
             
    const completedAmount = completedTransactions.reduce((sum, tx) => 
      sum + (typeof tx.monto === 'number' ? tx.monto : 
             typeof tx.amount === 'number' ? tx.amount : 0), 0);

    console.log(`Estadísticas calculadas: 
      Pendientes: ${pendingTransactions.length} ($ ${pendingAmount})
      Vencidas: ${overdueTransactions.length} ($ ${overdueAmount})
      Acreditadas: ${completedTransactions.length} ($ ${completedAmount})
    `);

    return {
      pending: {
        count: pendingTransactions.length,
        amount: pendingAmount,
        transactions: pendingTransactions
      },
      overdue: {
        count: overdueTransactions.length,
        amount: overdueAmount,
        transactions: overdueTransactions
      },
      completed: {
        count: completedTransactions.length,
        amount: completedAmount,
        transactions: completedTransactions
      }
    };
  }, [transactions, currentDate]);
  
  // Función para obtener los botones de pago de una organización
  const fetchPaymentButtons = async (orgId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/payment-buttons?organizationId=${orgId}`);
      if (!response.ok) throw new Error('Error al cargar los botones de pago');
      const data = await response.json();
      setPaymentButtons(data);
      
      // Seleccionar automáticamente el primer botón
      if (data.length > 0) {
        setSelectedButtonId(data[0].id);
      }
    } catch (error) {
      console.error("Error al cargar botones de pago:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para obtener los datos del calendario (transacciones y liquidaciones)
  const fetchCalendarData = async () => {
    try {
      setIsLoading(true);
      
      // Calcular el primer y último día del mes
      const firstDay = startOfMonth(currentDate);
      const lastDay = endOfMonth(currentDate);
      
      console.log(`Consultando datos del calendario para el periodo: ${format(firstDay, 'yyyy-MM-dd')} al ${format(lastDay, 'yyyy-MM-dd')}`);
      console.log(`Organización: ${selectedOrgId}, Botón: ${selectedButtonId}`);
      
      // Construir la URL con URLSearchParams para mayor limpieza
      const transactionsParams = new URLSearchParams({
        organizationId: selectedOrgId,
        paymentButtonId: selectedButtonId,
        startDate: format(firstDay, 'yyyy-MM-dd'),
        endDate: format(lastDay, 'yyyy-MM-dd')
      });
      
      // Obtener transacciones
      const transactionsResponse = await fetch(`/api/transactions?${transactionsParams}`);
      
      if (!transactionsResponse.ok) {
        const errorData = await transactionsResponse.json();
        console.error('Error en la respuesta de transacciones:', errorData);
        throw new Error(`Error al cargar transacciones: ${errorData.error || transactionsResponse.statusText}`);
      }
      
      const transactionsData = await transactionsResponse.json();
      console.log(`Se recibieron ${transactionsData.length} transacciones`);
      if (transactionsData.length > 0) {
        console.log('Ejemplo de transacción:', transactionsData[0]);
      }
      
      setTransactions(transactionsData);
      
      // Construir la URL para liquidaciones con URLSearchParams
      const liquidationsParams = new URLSearchParams({
        organizationId: selectedOrgId,
        paymentButtonId: selectedButtonId,
        startDate: format(firstDay, 'yyyy-MM-dd'),
        endDate: format(lastDay, 'yyyy-MM-dd')
      });
      
      // Obtener liquidaciones - usamos / al final para asegurar que apunte a index.ts
      const liquidationsResponse = await fetch(`/api/liquidations/?${liquidationsParams.toString()}`);
      
      if (!liquidationsResponse.ok) {
        const errorData = await liquidationsResponse.json();
        console.error('Error en la respuesta de liquidaciones:', errorData);
        throw new Error(`Error al cargar liquidaciones: ${errorData.error || liquidationsResponse.statusText}`);
      }
      
      const liquidationsData = await liquidationsResponse.json();
      console.log(`Se recibieron ${liquidationsData.length} liquidaciones`);
      if (liquidationsData.length > 0) {
        console.log('Ejemplo de liquidación:', liquidationsData[0]);
      }
      
      setLiquidations(liquidationsData);
      
    } catch (error) {
      console.error("Error al cargar datos del calendario:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Construir los datos del calendario
  const buildCalendarDays = () => {
    console.log('Construyendo datos del calendario...');
    
    // Obtener todos los días del mes, incluso si no hay datos
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    
    console.log(`Preparando calendario para ${format(firstDayOfMonth, 'MMMM yyyy', { locale: es })}`);
    
    // Obtener todos los días del mes
    const daysInMonth = eachDayOfInterval({
      start: firstDayOfMonth,
      end: lastDayOfMonth
    });
    
    console.log(`El mes tiene ${daysInMonth.length} días`);
    
    // Crear datos para cada día
    const calendarData: CalendarDayData[] = daysInMonth.map(day => {
      try {
        // Filtrar transacciones del día
        const dayTransactions = transactions.filter(tx => {
          try {
            // Verificar si tenemos la fecha en el formato esperado o en date
            const txDate = tx.fechaTransaccion 
              ? parseISO(tx.fechaTransaccion) 
              : tx.date 
                ? parseISO(tx.date) 
                : null;
            
            if (!txDate) {
              console.error('Fecha no válida en transacción:', tx);
              return false;
            }
            
            return isSameDay(txDate, day);
          } catch (error) {
            console.error('Error al analizar fecha en transacción:', tx, error);
            return false;
          }
        });
        
        // Filtrar transacciones en estado REALIZADA
        const realizedTransactions = dayTransactions.filter(tx => {
          const status = getTransactionStatus(tx);
          return status === 'REALIZADA';
        });

        // Calcular transacciones pendientes y completadas
        const completedTransactions = dayTransactions.filter(tx => isCompletedTransaction(tx));
        const pendingTransactions = dayTransactions.filter(tx => isPendingTransaction(tx));

        // Calcular montos
        const allAmount = dayTransactions.reduce((sum, tx) => 
          sum + (typeof tx.monto === 'number' ? tx.monto : 
                typeof tx.amount === 'number' ? tx.amount : 0), 0);

        const completedAmount = completedTransactions.reduce((sum, tx) => 
          sum + (typeof tx.monto === 'number' ? tx.monto : 
                typeof tx.amount === 'number' ? tx.amount : 0), 0);

        const pendingAmount = pendingTransactions.reduce((sum, tx) => 
          sum + (typeof tx.monto === 'number' ? tx.monto : 
                typeof tx.amount === 'number' ? tx.amount : 0), 0);

        // Calcular estadísticas por método de pago
        const paymentMethods: Record<string, PaymentMethodStats> = {};
        
        dayTransactions.forEach(tx => {
          const method = tx.medioPago || 'Desconocido';
          const amount = typeof tx.monto === 'number' ? tx.monto : 
                        typeof tx.amount === 'number' ? tx.amount : 0;
          
          if (!paymentMethods[method]) {
            paymentMethods[method] = {
              count: 0,
              amount: 0,
              name: method
            };
          }
          
          paymentMethods[method].count++;
          paymentMethods[method].amount += amount;
        });
        
        // Filtrar liquidaciones del día
        const dayLiquidations = liquidations.filter(liq => {
          try {
            // Verificar si tenemos la fecha en el formato esperado o en date
            const liqDate = liq.FechaLiquidacion 
              ? parseISO(liq.FechaLiquidacion) 
              : liq.date 
                ? parseISO(liq.date) 
                : null;
            
            if (!liqDate) {
              console.error('Fecha no válida en liquidación:', liq);
              return false;
            }
            
            return isSameDay(liqDate, day);
          } catch (error) {
            console.error('Error al analizar fecha en liquidación:', liq, error);
            return false;
          }
        });
        
        // Calcular totales
        const transactionsCount = dayTransactions.length;
        const realizedTransactionsCount = realizedTransactions.length;
        // Manejar montos de transacciones que pueden estar en diferentes propiedades
        const realizedTransactionsAmount = realizedTransactions.reduce((sum, tx) => 
          sum + (typeof tx.monto === 'number' ? tx.monto : 
                typeof tx.amount === 'number' ? tx.amount : 0), 0);
        
        // Manejar montos de liquidaciones que pueden estar en diferentes propiedades
        const liquidationsAmount = dayLiquidations.reduce((sum, liq) => {
          const amount = liq.NetoLiquidacion 
            ? parseFloat(liq.NetoLiquidacion) 
            : typeof liq.amount === 'number' 
              ? liq.amount 
              : 0;
          return sum + amount;
        }, 0);
        
        return {
          date: day,
          transactionsCount,
          realizedTransactionsCount,
          realizedTransactionsAmount,
          liquidationsAmount,
          isCurrentMonth: true,
          transactions: dayTransactions,
          liquidations: dayLiquidations,
          txStats: {
            all: dayTransactions.length,
            allAmount,
            pending: pendingTransactions.length,
            pendingAmount,
            completed: completedTransactions.length,
            completedAmount,
            byPaymentMethod: Object.values(paymentMethods)
          }
        };
      } catch (error) {
        console.error(`Error al procesar día ${format(day, 'yyyy-MM-dd')}:`, error);
        // En caso de error, devolver un día sin datos
        return {
          date: day,
          transactionsCount: 0,
          realizedTransactionsCount: 0,
          realizedTransactionsAmount: 0,
          liquidationsAmount: 0,
          isCurrentMonth: true,
          transactions: [],
          liquidations: [],
          txStats: {
            all: 0,
            allAmount: 0,
            pending: 0,
            pendingAmount: 0,
            completed: 0,
            completedAmount: 0,
            byPaymentMethod: []
          }
        };
      }
    });
    
    console.log(`Calendario construido: ${calendarData.length} días procesados`);
    
    // Contar días con actividad
    const daysWithTx = calendarData.filter(d => d.realizedTransactionsCount > 0).length;
    const daysWithLiq = calendarData.filter(d => d.liquidationsAmount > 0).length;
    
    console.log(`Días con cobros: ${daysWithTx}, Días con acreditaciones: ${daysWithLiq}`);
    
    setCalendarDays(calendarData);
  };
  
  // Función para cambiar al mes anterior
  const goToPreviousMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };
  
  // Función para cambiar al mes siguiente
  const goToNextMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };
  
  // Función para mostrar los detalles de un día
  const showDayDetails = (day: CalendarDayData) => {
    setSelectedDay(day);
    setShowModal(true);
  };
  
  // Función para cerrar el modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedDay(null);
  };
  
  // Obtener los nombres de los días de la semana
  const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  // Función para determinar el color de fondo de cada día en el calendario
  const getDayColor = (day: CalendarDayData) => {
    const baseClass = 'transition-all duration-300 ';
    
    // Si no está en el mes actual, fondo más oscuro
    if (!day.isCurrentMonth) {
      return baseClass + 'bg-gray-900 text-gray-500';
    }
    
    // Si hay transacciones y liquidaciones, gradiente único
    if (day.realizedTransactionsAmount > 0 && day.liquidationsAmount > 0) {
      return baseClass + 'bg-gradient-to-br from-green-900 to-indigo-900';
    }
    
    // Si solo hay transacciones
    if (day.realizedTransactionsAmount > 0) {
      return baseClass + 'bg-green-900 bg-opacity-70';
    }
    
    // Si solo hay liquidaciones
    if (day.liquidationsAmount > 0) {
      return baseClass + 'bg-indigo-900 bg-opacity-70';
    }
    
    // Sin actividad
    return baseClass + 'bg-gray-800';
  };
  
  // Agregar mensaje cuando no hay datos
  const NoDataMessage = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CalendarToday className="text-gray-400 text-6xl mb-4" />
      <h3 className="text-xl font-semibold text-gray-300 mb-2">No hay datos para mostrar</h3>
      <p className="text-gray-400 mb-4">
        No se encontraron transacciones ni liquidaciones para este período.
      </p>
      <p className="text-gray-400">
        Intenta seleccionar otro mes o verificar que existan datos para el botón de pago seleccionado.
      </p>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>CLIC Conciliaciones - Calendario</title>
        <meta name="description" content="Calendario de transacciones y liquidaciones" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <CalendarToday className="mr-2 text-indigo-400" /> 
            Calendario de Transacciones y Liquidaciones
          </h1>
        </div>
        
        {/* Filtros */}
        <div className="bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Organización</label>
              <select
                value={selectedOrgId}
                onChange={(e) => {
                  setSelectedOrgId(e.target.value);
                  setSelectedButtonId(''); // Resetear el botón de pago al cambiar la organización
                }}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={isLoading}
              >
                <option value="">Seleccione una organización</option>
                {userOrgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Botón de pago</label>
              <select
                value={selectedButtonId}
                onChange={(e) => setSelectedButtonId(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={!selectedOrgId || isLoading}
              >
                <option value="">Seleccione un botón de pago</option>
                {paymentButtons.map(btn => (
                  <option key={btn.id} value={btn.id}>{btn.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Indicador de carga */}
        {isLoading && (
          <div className="col-span-1 md:col-span-3 flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
            <span className="text-gray-300">Cargando datos...</span>
          </div>
        )}
        
        {/* Sin datos seleccionados */}
        {!selectedOrgId || !selectedButtonId ? (
          <div className="col-span-1 md:col-span-3 bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-gray-400">
              Selecciona una organización y un botón de pago para ver los datos
            </p>
          </div>
        ) : transactions.length === 0 && liquidations.length === 0 && !isLoading ? (
          <div className="col-span-1 md:col-span-3 bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-gray-400">
              No se encontraron datos para el período seleccionado
            </p>
          </div>
        ) : null}
        
        {/* Tarjetas de resumen */}
        {selectedOrgId && selectedButtonId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Tarjeta de Transacciones Pendientes */}
            <div className="bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center mb-2">
                    <CreditCard className="mr-2 text-yellow-500" />
                    PENDIENTES
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Cobros en estado REALIZADO que aún no han sido incluidos en una liquidación
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between py-1 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Cantidad de transacciones:</span>
                  <span className="font-medium">{transactionStats.pending.count}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-400">Monto total:</span>
                  <span className="font-medium text-yellow-400">
                    ${transactionStats.pending.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta de Transacciones Vencidas */}
            <div className="bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center mb-2">
                    <WarningAmber className="mr-2 text-red-500" />
                    VENCIDAS
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Cobros que ya deberían haberse acreditado según la fecha estimada, pero aún no se han liquidado
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between py-1 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Cantidad de transacciones:</span>
                  <span className="font-medium">{transactionStats.overdue.count}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-400">Monto total:</span>
                  <span className="font-medium text-red-400">
                    ${transactionStats.overdue.amount.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta de Transacciones Acreditadas */}
            <div className="bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center mb-2">
                    <CheckCircle className="mr-2 text-green-500" />
                    ACREDITADAS
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Cobros que ya fueron incluidos en una liquidación y acreditados en la cuenta bancaria
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between py-1 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Cantidad de transacciones:</span>
                  <span className="font-medium">{transactionStats.completed.count}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-400">Monto total:</span>
                  <span className="font-medium text-green-400">
                    ${transactionStats.completed.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Controles de navegación del calendario */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex space-x-2">
            <button 
              onClick={goToPreviousMonth}
              className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full"
              disabled={isLoading}
            >
              <ArrowBack />
            </button>
            <button
              onClick={goToNextMonth}
              className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full"
              disabled={isLoading}
            >
              <ArrowForward />
            </button>
          </div>
        </div>
        
        {/* Leyenda */}
        <div className="flex flex-wrap items-center space-x-2 space-y-2 md:space-y-0 mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center mr-4">
            <div className="w-4 h-4 bg-blue-700 bg-opacity-70 rounded mr-2"></div>
            <span className="text-sm text-blue-200">Día con transacciones</span>
          </div>
          <div className="flex items-center mr-4">
            <div className="w-4 h-4 bg-yellow-800 bg-opacity-70 rounded mr-2 border-l-2 border-yellow-500"></div>
            <span className="text-sm text-yellow-200">Cobros pendientes de acreditar</span>
          </div>
          <div className="flex items-center mr-4">
            <div className="w-4 h-4 bg-emerald-800 bg-opacity-70 rounded mr-2 border-l-2 border-emerald-500"></div>
            <span className="text-sm text-emerald-200">Cobros ya acreditados</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-800 bg-opacity-70 rounded mr-2 border-l-2 border-green-500"></div>
            <span className="text-sm text-green-200">Liquidaciones recibidas</span>
          </div>
        </div>
        
        {/* Calendario */}
        <div className="bg-gray-800 rounded-lg shadow overflow-hidden mt-4">
          {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 gap-px bg-gray-700">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
              <div key={i} className="bg-gray-800 p-2 text-center text-sm font-semibold text-gray-300">
                {day}
              </div>
            ))}
          </div>
          
          {/* Grid de días */}
          {calendarDays.length > 0 ? (
            <div className="grid grid-cols-7 gap-px bg-gray-700">
              {calendarDays.map((day, index) => (
                <div 
                  key={index}
                  className={`bg-gray-800 p-2 min-h-[100px] ${day.date.getMonth() !== currentDate.getMonth() ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-700 transition-colors`}
                  onClick={() => showDayDetails(day)}
                >
                  {/* Número del día y mes */}
                  <div className="flex justify-between items-start">
                    <span className={`inline-flex justify-center items-center w-6 h-6 text-xs rounded-full ${day.txStats.all > 0 ? 'bg-blue-700 text-white' : 'text-gray-300'}`}>
                      {format(day.date, 'd')}
                    </span>
                    {day.txStats.all > 0 && (
                      <span className="text-xs font-medium text-blue-300">
                        {day.txStats.all} tx
                      </span>
                    )}
                  </div>
                  
                  {/* Mostrar información de transacciones y liquidaciones */}
                  <div className="mt-2 space-y-1">
                    {/* Transacciones pendientes - En amarillo */}
                    {day.txStats.pending > 0 && (
                      <div className="p-1 rounded bg-yellow-800 bg-opacity-40 border-l-2 border-yellow-500">
                        <div className="flex justify-between text-xs text-yellow-200">
                          <span>Pendiente:</span>
                          <span className="font-medium">{day.txStats.pending} tx</span>
                        </div>
                        <div className="flex justify-between text-xs text-yellow-200">
                          <span>Monto:</span>
                          <span className="font-semibold">${day.txStats.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Transacciones acreditadas - En verde */}
                    {day.txStats.completed > 0 && (
                      <div className="p-1 rounded bg-emerald-800 bg-opacity-40 border-l-2 border-emerald-500">
                        <div className="flex justify-between text-xs text-emerald-200">
                          <span>Acreditado:</span>
                          <span className="font-medium">{day.txStats.completed} tx</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-200">
                          <span>Monto:</span>
                          <span className="font-semibold">${day.txStats.completedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Liquidaciones recibidas este día - En verde más oscuro */}
                    {day.liquidationsAmount > 0 && (
                      <div className="p-1 rounded bg-green-800 bg-opacity-40 border-l-2 border-green-500">
                        <div className="flex justify-between text-xs text-green-200">
                          <span>Liquidación:</span>
                          <span className="font-semibold">${day.liquidationsAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800">
              <NoDataMessage />
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de detalles del día */}
      <AnimatePresence>
        {showModal && selectedDay && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div 
              className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Cabecera */}
              <div className="flex items-center justify-between bg-gray-800 p-4 rounded-t-lg sticky top-0 z-10">
                <h3 className="text-xl font-semibold">
                  Detalles del {format(selectedDay.date, "d 'de' MMMM 'de' yyyy", { locale: es })}
                </h3>
                <button 
                  onClick={closeModal}
                  className="p-1 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <Close />
                </button>
              </div>
              
              <div className="p-4">
                {/* Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400 mb-1 text-sm">Total Transacciones</div>
                    <div className="text-xl font-semibold text-blue-400">{selectedDay.txStats.all}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400 mb-1 text-sm">Monto Pendiente</div>
                    <div className="text-xl font-semibold text-yellow-400">
                      ${selectedDay.txStats.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400 mb-1 text-sm">Monto Acreditado</div>
                    <div className="text-xl font-semibold text-emerald-400">
                      ${selectedDay.txStats.completedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                
                {/* Resumen detallado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Estado de Transacciones */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-3">Estado de Transacciones</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
                          <span>Total:</span>
                        </div>
                        <div className="flex">
                          <span className="mr-2">{selectedDay.txStats.all} tx</span>
                          <span className="font-medium">${selectedDay.txStats.allAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                          <span>Pendientes:</span>
                        </div>
                        <div className="flex">
                          <span className="mr-2">{selectedDay.txStats.pending} tx</span>
                          <span className="font-medium text-yellow-400">${selectedDay.txStats.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                          <span>Acreditadas:</span>
                        </div>
                        <div className="flex">
                          <span className="mr-2">{selectedDay.txStats.completed} tx</span>
                          <span className="font-medium text-emerald-400">${selectedDay.txStats.completedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Liquidaciones recibidas */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-3">Liquidaciones Recibidas</h4>
                    {selectedDay.liquidations.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDay.liquidations.map((liq, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b border-gray-700 pb-2">
                            <span className="text-sm">
                              {liq.IdLiquidacion || liq.liquidationId || `Liquidación ${idx + 1}`}
                            </span>
                            <span className="font-medium text-green-400">
                              ${parseFloat(liq.NetoLiquidacion || liq.amount?.toString() || '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center italic">No se recibieron liquidaciones en esta fecha</p>
                    )}
                  </div>
                </div>
                
                {/* Detalle por Método de Pago */}
                {selectedDay.txStats.byPaymentMethod.length > 0 && (
                  <div className="bg-gray-800 p-4 rounded-lg mb-6">
                    <h4 className="text-lg font-medium mb-3">Detalle por Método de Pago</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedDay.txStats.byPaymentMethod.map((method, idx) => (
                        <div key={idx} className="bg-gray-700 p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{method.name}</span>
                            <span className="px-2 py-1 bg-gray-600 rounded text-xs">
                              {method.count} tx
                            </span>
                          </div>
                          <div className="text-right text-yellow-400 font-semibold">
                            ${method.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sección de Transacciones Detalladas */}
                {selectedDay.transactions.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium mb-3">Detalle de Transacciones ({selectedDay.transactions.length})</h4>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-gray-800 rounded-lg">
                        <thead>
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Método</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Monto</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Liquidación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {selectedDay.transactions.map((tx, idx) => {
                            // Usar funciones utilitarias para todos los campos
                            const txId = getTransactionId(tx);
                            const method = getPaymentMethod(tx);
                            const amount = getTransactionAmount(tx);
                            const status = getTransactionStatus(tx);
                            const liquidationId = getLiquidationId(tx);
                            
                            // Determinar color del estado usando la utilidad
                            const statusColor = getTransactionStatusTextColor(status, liquidationId);
                            
                            return (
                              <tr key={idx} className="bg-gray-800 hover:bg-gray-700">
                                <td className="py-2 px-4 text-sm">{txId}</td>
                                <td className="py-2 px-4 text-sm">{method}</td>
                                <td className="py-2 px-4 text-sm font-medium">${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td className={`py-2 px-4 text-sm font-medium ${statusColor}`}>{status}</td>
                                <td className="py-2 px-4 text-sm text-green-400">{liquidationId || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  
  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }
  
  const prisma = new PrismaClient();
  
  try {
    // Obtener todas las organizaciones
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    
    // Obtener todas las membresías del usuario para sus organizaciones
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id as string,
      },
      select: {
        organizationId: true,
      },
    });
    
    // Extraer los IDs de organización
    const userOrganizations = memberships.map(membership => membership.organizationId);
    
    return {
      props: {
        organizations,
        userOrganizations,
      },
    };
  } catch (error) {
    console.error("Error al obtener datos para la página de calendario:", error);
    return {
      props: {
        organizations: [],
        userOrganizations: [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Calendar); 