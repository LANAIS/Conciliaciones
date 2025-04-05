/* eslint-disable react-hooks/exhaustive-deps */
import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession, getSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { 
  MonetizationOn, 
  AccountBalance, 
  Paid, 
  PendingActions, 
  CalendarToday,
  ShowChart,
  TrendingUp,
  Assessment
} from '@mui/icons-material';
import withAuth from '../components/auth/withAuth';
import { PrismaClient } from '@prisma/client';
import { TRANSACTION_STATUSES } from '../utils/transactionUtils';

interface Organization {
  id: string;
  name: string;
}

interface PaymentButton {
  id: string;
  name: string;
}

interface PaymentMethodData {
  name: string;
  value: number;
}

interface PendingLiquidationData {
  name: string;
  amount: number;
}

interface DashboardProps {
  summary: {
    totalTransactions: number;
    completedTransactions: number;
    pendingTransactions: number;
    totalAmount: number;
    pendingAmount: number;
    liquidatedAmount: number;
    nextPaymentDate: string | null;
    nextPaymentAmount: number | null;
  };
  transactionsData: any[];
  liquidationsData: any[];
  organizations: Organization[];
  userOrganizations: string[];
  paymentMethodData?: PaymentMethodData[];
  pendingLiquidationsData?: PendingLiquidationData[];
}

const Home: NextPage<DashboardProps> = ({ summary, transactionsData, liquidationsData, organizations, userOrganizations }) => {
  // Estado para almacenar la organización y botón de pago seleccionados
  // Inicializar con la primera organización del usuario si existe
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([]);
  const [selectedButtonId, setSelectedButtonId] = useState<string>('');
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  
  // Estado para mostrar datos del dashboard
  const [dashboardData, setDashboardData] = useState<{
    summary: DashboardProps['summary'];
    transactionsData: any[];
    liquidationsData: any[];
    paymentMethodData?: PaymentMethodData[];
    pendingLiquidationsData?: PendingLiquidationData[];
  }>({
    summary,
    transactionsData,
    liquidationsData,
    paymentMethodData: [],
    pendingLiquidationsData: []
  });

  // Filtrar organizaciones a las que el usuario tiene acceso
  const userOrgs = organizations.filter(org => userOrganizations.includes(org.id));

  // Seleccionar automáticamente la primera organización al cargar
  useEffect(() => {
    if (userOrgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(userOrgs[0].id);
    }
  }, [userOrgs, selectedOrgId]);

  // Cargar botones de pago cuando se selecciona una organización
  useEffect(() => {
    if (selectedOrgId) {
      setIsDataLoading(true);
      fetchPaymentButtons(selectedOrgId);
    } else {
      setPaymentButtons([]);
      setSelectedButtonId('');
      
      // Restaurar los datos originales si se deselecciona la organización
      setDashboardData({
        summary,
        transactionsData,
        liquidationsData,
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
    }
  }, [selectedOrgId, summary, transactionsData, liquidationsData]);

  // Seleccionar automáticamente el primer botón de pago
  useEffect(() => {
    if (paymentButtons.length > 0 && !selectedButtonId) {
      setSelectedButtonId(paymentButtons[0].id);
    }
    setIsDataLoading(false);
  }, [paymentButtons, selectedButtonId]);

  // Cargar datos del dashboard cuando se selecciona un botón de pago
  useEffect(() => {
    if (selectedOrgId && selectedButtonId) {
      setIsDataLoading(true);
      fetchDashboardData(selectedOrgId, selectedButtonId);
    } else if (!selectedButtonId && selectedOrgId) {
      // Si se deselecciona el botón pero hay una organización seleccionada,
      // restauramos los datos originales
      setDashboardData({
        summary,
        transactionsData,
        liquidationsData,
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
      setIsDataLoading(false);
    }
  }, [selectedOrgId, selectedButtonId, summary, transactionsData, liquidationsData]);

  // Función para obtener los botones de pago de una organización
  const fetchPaymentButtons = async (orgId: string) => {
    try {
      const response = await fetch(`/api/payment-buttons?organizationId=${orgId}`);
      if (!response.ok) throw new Error('Error al cargar los botones de pago');
      const data = await response.json();
      setPaymentButtons(data);
      // No resetear el botón seleccionado aquí, lo manejamos en el useEffect
    } catch (error) {
      console.error('Error al cargar botones de pago:', error);
      setIsDataLoading(false);
    }
  };

  // Función para obtener los datos del dashboard según organización y botón
  const fetchDashboardData = async (orgId: string, buttonId: string) => {
    try {
      const response = await fetch(`/api/dashboard?organizationId=${orgId}&paymentButtonId=${buttonId}`);
      if (!response.ok) throw new Error('Error al cargar datos del dashboard');
      const data = await response.json();
      console.log('Datos recibidos del dashboard:', data);
      
      // Asegurarse de que todos los campos esperados estén presentes
      setDashboardData({
        summary: data.summary || summary,
        transactionsData: data.transactionsData || [],
        liquidationsData: data.liquidationsData || [],
        paymentMethodData: data.paymentMethodData || [],
        pendingLiquidationsData: data.pendingLiquidationsData || []
      });
      
      setIsDataLoading(false);
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
      // En caso de error, mantener los datos originales
      setDashboardData({
        summary,
        transactionsData,
        liquidationsData,
        paymentMethodData: [],
        pendingLiquidationsData: []
      });
      setIsDataLoading(false);
    }
  };

  // Efecto para mostrar cambios en dashboardData cuando se actualiza
  useEffect(() => {
    console.log('Dashboard data actualizado:', dashboardData);
  }, [dashboardData]);

  // Verificar si hay datos para mostrar
  const hasData = dashboardData.transactionsData.length > 0 || dashboardData.liquidationsData.length > 0;

  // Preparar datos para los gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a480ff', '#ff80ab', '#80d8ff'];
  
  // Formatear los datos de transacciones para el gráfico de área
  const formattedTransactionData = dashboardData.transactionsData.map(item => ({
    name: new Date(item.date).toLocaleDateString('es-AR'),
    amount: item.amount
  }));
  
  // Datos para el gráfico circular de métodos de pago
  const paymentMethodData = hasData && dashboardData.paymentMethodData && dashboardData.paymentMethodData.length > 0 
    ? dashboardData.paymentMethodData 
    : [];
  
  // Datos para el gráfico de liquidaciones pendientes por semana
  const pendingLiquidationsData = hasData && dashboardData.pendingLiquidationsData && dashboardData.pendingLiquidationsData.length > 0
    ? dashboardData.pendingLiquidationsData
    : [];

  // Extraer datos del resumen para las tarjetas
  const { 
    totalTransactions, 
    completedTransactions, 
    pendingTransactions, 
    totalAmount, 
    pendingAmount, 
    liquidatedAmount,
    nextPaymentDate,
    nextPaymentAmount 
  } = dashboardData.summary;

  // Mensaje a mostrar cuando no hay selección
  const showFilterMessage = !selectedOrgId || !selectedButtonId;
  
  // Verificar si el usuario tiene botones de pago
  const hasPaymentButtons = paymentButtons.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Head>
        <title>Dashboard - Clic de Pago</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex-grow p-4 sm:p-6 lg:p-8 text-white">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-300">Bienvenido a su panel de control de Clic de Pago</p>
        </div>

        {/* Filtros de organización y botón de pago */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-gray-300 mb-2">
              Organización
            </label>
            <select
              id="organization"
              className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2.5 w-full"
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedButtonId('');
              }}
            >
              <option value="">Seleccionar organización</option>
              {userOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="paymentButton" className="block text-sm font-medium text-gray-300 mb-2">
              Botón de pago
            </label>
            <select
              id="paymentButton"
              className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2.5 w-full"
              value={selectedButtonId}
              onChange={(e) => setSelectedButtonId(e.target.value)}
              disabled={!selectedOrgId || isDataLoading}
            >
              <option value="">Seleccionar botón de pago</option>
              {paymentButtons.map((button) => (
                <option key={button.id} value={button.id}>
                  {button.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mensaje cuando no hay organizaciones o botones de pago */}
        {userOrgs.length === 0 && (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-300 mb-2">¡Bienvenido a Clic de Pago!</h2>
            <p className="text-white mb-4">
              Para comenzar, necesitas crear una organización. Una vez creada, podrás configurar botones de pago y ver tus transacciones aquí.
            </p>
            <Link href="/organizations" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Crear organización
            </Link>
          </div>
        )}

        {/* Mensaje cuando hay organización pero no hay botones de pago */}
        {userOrgs.length > 0 && selectedOrgId && paymentButtons.length === 0 && (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-300 mb-2">No hay botones de pago</h2>
            <p className="text-white mb-4">
              Esta organización aún no tiene botones de pago configurados. Crea un botón de pago para comenzar a recibir transacciones.
            </p>
            <Link href={`/organizations?action=addPaymentButton&orgId=${selectedOrgId}`} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Crear botón de pago
            </Link>
          </div>
        )}

        {/* Mensaje cuando hay botones pero no hay datos */}
        {selectedOrgId && selectedButtonId && !hasData && !isDataLoading && (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-300 mb-2">No hay transacciones</h2>
            <p className="text-white mb-4">
              Este botón de pago aún no tiene transacciones registradas. Una vez que comiences a recibir pagos, podrás ver las estadísticas aquí.
            </p>
          </div>
        )}

        {/* Mostrar indicador de carga cuando se están cargando datos */}
        {isDataLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Contenido del dashboard */}
        {!isDataLoading && showFilterMessage && (
          <div className="text-center py-12 text-gray-400">
            Selecciona una organización y un botón de pago para ver los datos del dashboard
          </div>
        )}

        {/* Mostrar el dashboard cuando hay datos y no está cargando */}
        {!isDataLoading && !showFilterMessage && (
          <div>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-4 relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.2)" 
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="relative z-10">
                  <h2 className="text-gray-400 text-sm font-medium flex items-center">
                    <Assessment className="mr-1 text-indigo-400" /> Total de transacciones
                  </h2>
                  <p className="text-2xl font-bold mt-2">{totalTransactions.toLocaleString('es-AR')}</p>
                </div>
                <div className="absolute right-1 top-1 opacity-10">
                  <MonetizationOn style={{ fontSize: 48 }} />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              </motion.div>
              
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-4 relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.2)" 
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="relative z-10">
                  <h2 className="text-gray-400 text-sm font-medium flex items-center">
                    <AccountBalance className="mr-1 text-blue-400" /> Monto total
                  </h2>
                  <p className="text-2xl font-bold mt-2">${totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="absolute right-1 top-1 opacity-10">
                  <AccountBalance style={{ fontSize: 48 }} />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
              </motion.div>
              
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-4 relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.2)" 
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <div className="relative z-10">
                  <h2 className="text-gray-400 text-sm font-medium flex items-center">
                    <Paid className="mr-1 text-green-400" /> Monto liquidado
                  </h2>
                  <p className="text-2xl font-bold mt-2 text-green-500">${liquidatedAmount.toLocaleString('es-AR')}</p>
                </div>
                <div className="absolute right-1 top-1 opacity-10">
                  <Paid style={{ fontSize: 48 }} />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
              </motion.div>
              
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-4 relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.2)" 
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
              >
                <div className="relative z-10">
                  <h2 className="text-gray-400 text-sm font-medium flex items-center">
                    <PendingActions className="mr-1 text-yellow-400" /> Monto pendiente
                  </h2>
                  <p className="text-2xl font-bold mt-2 text-yellow-500">${pendingAmount.toLocaleString('es-AR')}</p>
                </div>
                <div className="absolute right-1 top-1 opacity-10">
                  <PendingActions style={{ fontSize: 48 }} />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-amber-500"></div>
              </motion.div>
            </div>

            {/* Próxima liquidación con efecto */}
            <motion.div 
              className="bg-gray-800 rounded-lg shadow p-6 mb-8 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              whileHover={{ 
                boxShadow: "0 8px 20px rgba(99, 102, 241, 0.15)" 
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <CalendarToday className="mr-2 text-indigo-400" /> Próxima liquidación
                </h2>
                <motion.div
                  className="w-2 h-2 rounded-full bg-green-500"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.5, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
              <div className="flex flex-col md:flex-row justify-between">
                <div>
                  <p className="text-gray-400">Fecha estimada</p>
                  <p className="text-lg font-semibold">
                    {nextPaymentDate 
                      ? new Date(nextPaymentDate).toLocaleDateString('es-AR') 
                      : 'No disponible'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Monto estimado</p>
                  <p className="text-lg font-semibold text-green-500">
                    ${nextPaymentAmount 
                      ? nextPaymentAmount.toLocaleString('es-AR') 
                      : '0'}
                  </p>
                </div>
                <div className="mt-4 md:mt-0">
                  <motion.button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded flex items-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <TrendingUp className="mr-1" />
                    Ver detalles
                  </motion.button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                <CalendarToday style={{ fontSize: 128 }} />
              </div>
            </motion.div>

            {/* Sección de gráficos */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              {/* Gráfico de transacciones */}
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <ShowChart className="mr-2 text-blue-400" />
                  Transacciones por día
                </h3>
                <div className="h-80">
                  {formattedTransactionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={formattedTransactionData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                          labelStyle={{ color: 'white' }}
                          formatter={(value: any) => [`$${value.toLocaleString('es-AR')}`, 'Monto']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#8884d8" 
                          fillOpacity={1} 
                          fill="url(#colorAmount)" 
                          name="Monto"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="mt-2">No hay transacciones para mostrar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico circular de métodos de pago */}
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Paid className="mr-2 text-green-400" />
                  Distribución de medios de pago
                </h3>
                <div className="h-80">
                  {paymentMethodData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {paymentMethodData.map((entry: PaymentMethodData, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                          formatter={(value: any) => [`${value}%`, 'Porcentaje']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="mt-2">No hay datos de transacciones para mostrar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Liquidaciones pendientes por semana */}
            <motion.div 
              className="bg-gray-800 rounded-lg shadow p-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <PendingActions className="mr-2 text-yellow-400" />
                Liquidaciones pendientes por semana
              </h3>
              <div className="h-80">
                {pendingLiquidationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={pendingLiquidationsData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                        formatter={(value: any) => [`$${value.toLocaleString('es-AR')}`, 'Monto']}
                      />
                      <Legend />
                      <Bar dataKey="amount" name="Monto pendiente" fill="#FFBB28" radius={[4, 4, 0, 0]}>
                        {pendingLiquidationsData.map((entry: PendingLiquidationData, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`rgba(255, 187, 40, ${0.5 + (index * 0.1)})`} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="mt-2">No hay liquidaciones pendientes para mostrar</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Accesos rápidos */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-6 hover:bg-gray-700 cursor-pointer transition relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.15)" 
                }}
              >
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <Assessment className="mr-2 text-indigo-400" />
                    Conciliaciones
                  </h3>
                  <p className="text-gray-400">Gestiona y visualiza el estado de las conciliaciones de pagos</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <Assessment style={{ fontSize: 72 }} />
                </div>
              </motion.div>
              
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-6 hover:bg-gray-700 cursor-pointer transition relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.15)" 
                }}
              >
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <MonetizationOn className="mr-2 text-green-400" />
                    Transacciones
                  </h3>
                  <p className="text-gray-400">Consulta todas las transacciones y su estado actual</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <MonetizationOn style={{ fontSize: 72 }} />
                </div>
              </motion.div>
              
              <motion.div 
                className="bg-gray-800 rounded-lg shadow p-6 hover:bg-gray-700 cursor-pointer transition relative overflow-hidden"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.15)" 
                }}
              >
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <TrendingUp className="mr-2 text-blue-400" />
                    Reportes
                  </h3>
                  <p className="text-gray-400">Genera reportes y exporta la información en Excel o PDF</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <TrendingUp style={{ fontSize: 72 }} />
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const prisma = new PrismaClient();
  const session = await getSession(context);
  
  // Si no hay sesión, redirigir al login
  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }
  
  try {
    // Obtener todas las organizaciones
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      }
    });
    
    // Obtener las organizaciones a las que pertenece el usuario
    const userMemberships = await prisma.membership.findMany({
      where: {
        userId: session?.user?.id as string,
      },
      select: {
        organizationId: true,
      }
    });
    
    const userOrganizations = userMemberships.map(m => m.organizationId);
    
    // Si el usuario no tiene organizaciones, mostrar dashboard vacío
    if (userOrganizations.length === 0) {
      return {
        props: {
          summary: {
            totalTransactions: 0,
            completedTransactions: 0,
            pendingTransactions: 0,
            totalAmount: 0,
            pendingAmount: 0,
            liquidatedAmount: 0,
            nextPaymentDate: null,
            nextPaymentAmount: null
          },
          transactionsData: [],
          liquidationsData: [],
          organizations,
          userOrganizations: []
        }
      };
    }
    
    // Obtener los botones de pago asociados a las organizaciones del usuario
    const userPaymentButtons = await prisma.paymentButton.findMany({
      where: {
        organizationId: {
          in: userOrganizations
        }
      },
      select: {
        id: true
      }
    });
    
    const userButtonIds = userPaymentButtons.map(button => button.id);
    
    // Si el usuario no tiene botones de pago, mostrar dashboard vacío
    if (userButtonIds.length === 0) {
      return {
        props: {
          summary: {
            totalTransactions: 0,
            completedTransactions: 0,
            pendingTransactions: 0,
            totalAmount: 0,
            pendingAmount: 0,
            liquidatedAmount: 0,
            nextPaymentDate: null,
            nextPaymentAmount: null
          },
          transactionsData: [],
          liquidationsData: [],
          organizations,
          userOrganizations
        }
      };
    }
    
    // Obtener solo las transacciones asociadas a los botones de pago del usuario
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentButtonId: {
          in: userButtonIds
        }
      }
    });
    
    // Obtener solo las liquidaciones asociadas a los botones de pago del usuario
    const liquidations = await prisma.liquidation.findMany({
      where: {
        paymentButtonId: {
          in: userButtonIds
        }
      }
    });
    
    // Calcular estadísticas para el resumen
    const totalTransactions = transactions.length;
    const completedTransactions = transactions.filter(tx => tx.status === TRANSACTION_STATUSES.REALIZADA).length;
    const pendingTransactions = transactions.filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE).length;
    
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const pendingAmount = transactions
      .filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const liquidatedAmount = transactions
      .filter(tx => tx.liquidationId !== null)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    // Encontrar la próxima fecha de pago (transacción pendiente más cercana)
    const pendingTransactionsWithDates = transactions
      .filter(tx => tx.status === TRANSACTION_STATUSES.PENDIENTE && tx.expectedPayDate !== null)
      .sort((a, b) => {
        if (!a.expectedPayDate || !b.expectedPayDate) return 0;
        return a.expectedPayDate.getTime() - b.expectedPayDate.getTime();
      });
    
    const nextPaymentTransaction = pendingTransactionsWithDates[0];
    
    // Preparar datos para los gráficos
    // 1. Agrupar transacciones por día para el gráfico de área
    const last30days = new Date();
    last30days.setDate(last30days.getDate() - 30);
    
    const transactionsByDay = transactions
      .filter(tx => tx.date > last30days)
      .reduce((acc: Record<string, number>, tx) => {
        const dateStr = tx.date.toISOString().split('T')[0];
        acc[dateStr] = (acc[dateStr] || 0) + tx.amount;
        return acc;
      }, {});
    
    const transactionsData = Object.keys(transactionsByDay).map(date => ({
      date,
      amount: transactionsByDay[date]
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    // 2. Agrupar liquidaciones por estado para el gráfico de pie
    const liquidationsByStatus = liquidations.reduce((acc: Record<string, number>, liq) => {
      acc[liq.status] = (acc[liq.status] || 0) + 1;
      return acc;
    }, {});
    
    const liquidationsData = Object.keys(liquidationsByStatus).map(status => ({
      status,
      value: liquidationsByStatus[status]
    }));
    
    // Preparar el objeto de resumen
    const dashboardSummary = {
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      totalAmount,
      pendingAmount,
      liquidatedAmount,
      nextPaymentDate: nextPaymentTransaction?.expectedPayDate?.toISOString() || null,
      nextPaymentAmount: nextPaymentTransaction?.amount || null
    };
    
    return {
      props: {
        summary: dashboardSummary,
        transactionsData,
        liquidationsData,
        organizations,
        userOrganizations
      }
    };
  } catch (error) {
    console.error('Error al obtener datos para el dashboard:', error);
    return {
      props: {
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          totalAmount: 0,
          pendingAmount: 0,
          liquidatedAmount: 0,
          nextPaymentDate: null,
          nextPaymentAmount: null
        },
        transactionsData: [],
        liquidationsData: [],
        organizations: [],
        userOrganizations: []
      }
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Home);