/* eslint-disable react-hooks/exhaustive-deps */
import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import withAuth from '../components/auth/withAuth';
import { PrismaClient } from '@prisma/client';
import LiquidationDetailModal from '../components/liquidations/LiquidationDetailModal';
import { getSession } from 'next-auth/react';

// Interfaces
interface Organization {
  id: string;
  name: string;
}

interface PaymentButton {
  id: string;
  name: string;
  transactions: number;
}

interface LiquidationsProps {
  initialLiquidations: any[]; // Usamos any para simplificar la serialización
  organizations: Organization[];
  userOrganizations: string[];
}

const Liquidations: NextPage<LiquidationsProps> = ({ 
  initialLiquidations, 
  organizations, 
  userOrganizations 
}) => {
  // Estado para la búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Estado para organización y botón de pago
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([]);
  const [selectedButtonId, setSelectedButtonId] = useState<string>('');
  
  // Estado para mostrar carga
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Estado para las liquidaciones
  const [liquidations, setLiquidations] = useState(initialLiquidations);
  
  // Estado para el modal de detalles
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLiquidationId, setSelectedLiquidationId] = useState<string | null>(null);

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
      // Limpiar las liquidaciones actuales para evitar mostrar datos incorrectos
      setLiquidations([]);
      setSelectedButtonId('');
      fetchPaymentButtons(selectedOrgId);
    } else {
      setPaymentButtons([]);
      setSelectedButtonId('');
    }
  }, [selectedOrgId]);

  // Cargar liquidaciones cuando cambian los filtros
  useEffect(() => {
    if (selectedOrgId) {
      fetchLiquidations();
    }
  }, [selectedOrgId, selectedButtonId, dateRange.startDate, dateRange.endDate, filterStatus]);

  // Filtrar liquidaciones según los criterios
  const filteredLiquidations = liquidations.filter(liq => {
    // Filtrar por término de búsqueda (en ID, organización o botón de pago)
    const searchMatch = searchTerm === '' || 
      liq.liquidationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      liq.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      liq.paymentButton.toLowerCase().includes(searchTerm.toLowerCase());
    
    return searchMatch;
  });

  // Función para obtener los botones de pago de una organización
  const fetchPaymentButtons = async (orgId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/payment-buttons?organizationId=${orgId}`);
      if (!response.ok) {
        console.error('Error al cargar los botones de pago:', response.statusText);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      
      setPaymentButtons(data);
      
      // Seleccionar automáticamente el primer botón
      if (data.length > 0) {
        setSelectedButtonId(data[0].id);
      } else {
        setSelectedButtonId('');
        setLiquidations([]); // Limpiar liquidaciones si no hay botones
        setIsLoading(false); // Asegurarnos de quitar el estado de carga
      }
    } catch (error) {
      console.error('Error al cargar botones de pago:', error);
      setIsLoading(false);
      // Mostrar mensaje de error al usuario
      alert('Error al cargar botones de pago. Por favor intente nuevamente.');
    }
  };

  // Función para obtener liquidaciones filtradas
  const fetchLiquidations = async () => {
    try {
      setIsLoading(true);
      
      // Construir la URL con los parámetros - Ahora usamos la ruta correcta sin duplicación
      let url = `/api/liquidations/`;
      
      // Añadir parámetros como query string
      const params = new URLSearchParams();
      
      // Siempre incluir la organización seleccionada
      if (selectedOrgId) {
        params.append('organizationId', selectedOrgId);
      }
      
      // Incluir botón de pago si está seleccionado
      if (selectedButtonId) {
        params.append('paymentButtonId', selectedButtonId);
      }
      
      // Incluir filtros de fecha si ambos están definidos
      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }
      
      // Incluir filtro de estado si no es 'all'
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      
      // Añadir los parámetros a la URL
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('Consultando liquidaciones:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al cargar liquidaciones:', errorData);
        throw new Error(errorData.error || 'Error al cargar liquidaciones');
      }
      
      const data = await response.json();
      console.log('Liquidaciones recibidas:', data.length);
      
      // Si no hay datos, mostrar mensaje
      if (data.length === 0) {
        console.log('No se encontraron liquidaciones');
      }
      
      setLiquidations(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error al cargar liquidaciones:', error);
      setIsLoading(false);
      // Mostrar mensaje de error al usuario
      alert('Error al cargar las liquidaciones. Por favor intente nuevamente.');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    alert(`Exportando en formato ${format}`);
    // La implementación real de la exportación se haría aquí
  };

  const handleViewDetails = (liquidationId: string) => {
    setSelectedLiquidationId(liquidationId);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDateRange({
      startDate: '',
      endDate: ''
    });
    setFilterStatus('all');
    
    if (userOrgs.length > 0) {
      setSelectedOrgId(userOrgs[0].id);
    }
  };

  return (
    <div>
      <Head>
        <title>CLIC Conciliaciones - Liquidaciones</title>
        <meta name="description" content="Gestión de liquidaciones en CLIC Conciliaciones" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Liquidaciones</h1>
          
          <div className="flex space-x-2">
            <button 
              onClick={() => handleExport('excel')}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
              Exportar Excel
            </button>
            <button 
              onClick={() => handleExport('pdf')}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded">
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Organización */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Organización</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={isLoading}
              >
                <option value="">Todas las organizaciones</option>
                {userOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Botón de pago */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Botón de Pago</label>
              <select
                value={selectedButtonId}
                onChange={(e) => setSelectedButtonId(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={!selectedOrgId || paymentButtons.length === 0 || isLoading}
              >
                <option value="">Todos los botones</option>
                {paymentButtons.map((button) => (
                  <option key={button.id} value={button.id}>
                    {button.name} ({button.transactions} transacciones)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Estado */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="all">Todos</option>
                <option value="PROCESADO">Procesado</option>
                <option value="PENDIENTE">Pendiente</option>
              </select>
            </div>
            
            {/* Búsqueda */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID de liquidación..."
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
            
            {/* Fecha desde */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Fecha desde</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
            
            {/* Fecha hasta */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
          </div>
          
          {/* Botón de reseteo de filtros */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleResetFilters}
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Indicador de carga */}
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
            <span className="text-gray-300">Cargando datos...</span>
          </div>
        )}

        {/* Tabla de liquidaciones */}
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Monto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Organización</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Botón de pago</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Transacciones</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800">
              {filteredLiquidations.map((liq) => (
                <tr key={liq.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{liq.liquidationId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(liq.date).toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${liq.amount.toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{liq.organization}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{liq.paymentButton}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{liq.transactionCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${liq.status === 'PROCESADO' ? 'bg-green-100 text-green-800' : 
                       'bg-yellow-100 text-yellow-800'}`}>
                      {liq.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <button 
                      onClick={() => handleViewDetails(liq.id)}
                      className="text-indigo-400 hover:text-indigo-300 focus:outline-none focus:underline"
                    >
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Sin resultados */}
        {!isLoading && filteredLiquidations.length === 0 && (
          <div className="text-center py-4 text-gray-400">
            No se encontraron liquidaciones que coincidan con los criterios de búsqueda.
          </div>
        )}
      </div>

      {/* Modal de detalles de liquidación */}
      <LiquidationDetailModal 
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        liquidationId={selectedLiquidationId}
      />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const prisma = new PrismaClient();
  const session = await getSession(context);
  
  if (!session || !session.user || !session.user.id) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }
  
  try {
    // Obtener organizaciones a las que el usuario tiene acceso
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id as string
      },
      select: {
        organizationId: true
      }
    });

    const userOrganizationIds = memberships.map(m => m.organizationId);
    
    // Obtener todas las organizaciones (para el selector) PERO SOLO LAS QUE EL USUARIO TIENE ACCESO
    const organizations = await prisma.organization.findMany({
      where: {
        id: {
          in: userOrganizationIds
        }
      },
      select: {
        id: true,
        name: true
      }
    });
    
    // Obtener botones de la primera organización (si hay alguna)
    let initialLiquidations: any[] = [];
    
    if (userOrganizationIds.length > 0) {
      // Obtener botones de la primera organización
      const buttons = await prisma.paymentButton.findMany({
        where: {
          organizationId: userOrganizationIds[0]
        },
        select: {
          id: true
        }
      });
      
      if (buttons.length > 0) {
        const buttonIds = buttons.map(b => b.id);
        
        // Obtener liquidaciones iniciales
        const liquidations = await prisma.liquidation.findMany({
          where: {
            paymentButtonId: {
              in: buttonIds
            }
          },
          include: {
            paymentButton: {
              select: {
                id: true,
                name: true,
                organization: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            transactions: {
              select: {
                transactionId: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          },
          take: 20
        });
        
        // Transformar los datos para que sean serializables (JSON)
        initialLiquidations = liquidations.map(liq => ({
          id: liq.id,
          liquidationId: liq.liquidationId,
          date: liq.date.toISOString(),
          amount: liq.amount,
          status: liq.status,
          currency: liq.currency,
          transactionCount: liq.transactions.length,
          organizationId: liq.paymentButton.organization.id,
          organization: liq.paymentButton.organization.name,
          paymentButtonId: liq.paymentButton.id,
          paymentButton: liq.paymentButton.name
        }));
      }
    }

    return {
      props: {
        initialLiquidations,
        organizations,
        userOrganizations: userOrganizationIds,
      },
    };
  } catch (error) {
    console.error('Error al obtener datos iniciales:', error);
    return {
      props: {
        initialLiquidations: [],
        organizations: [],
        userOrganizations: [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Liquidations); 