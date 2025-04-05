import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import withAuth from '../components/auth/withAuth';
import { PrismaClient, Transaction, Organization, PaymentButton } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  getTransactionStatus, 
  getLiquidationId, 
  getTransactionStatusBadgeClass,
  TRANSACTION_STATUSES
} from '../utils/transactionUtils';

interface TransactionsProps {
  initialTransactions: any[]; // Usamos any para simplificar la serialización
  userOrganizations: {
    id: string;
    name: string;
    paymentButtons: {
      id: string;
      name: string;
    }[];
  }[];
}

const Transactions: NextPage<TransactionsProps> = ({ initialTransactions, userOrganizations }) => {
  // Estado para la búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [selectedButton, setSelectedButton] = useState('');
  const [availableButtons, setAvailableButtons] = useState<{id: string, name: string}[]>([]);

  // Estado para las transacciones (inicializado con los datos de la base de datos)
  const [transactions, setTransactions] = useState(initialTransactions);
  
  // Estado para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Efecto para filtrar botones cuando cambia la organización seleccionada
  useEffect(() => {
    if (selectedOrganization) {
      const org = userOrganizations.find(org => org.id === selectedOrganization);
      if (org) {
        setAvailableButtons(org.paymentButtons);
      } else {
        setAvailableButtons([]);
      }
      setSelectedButton('');
    } else {
      // Si no hay organización seleccionada, mostrar todos los botones de todas las organizaciones
      const allButtons = userOrganizations.flatMap(org => org.paymentButtons);
      setAvailableButtons(allButtons);
      setSelectedButton('');
    }
  }, [selectedOrganization, userOrganizations]);

  // Filtrar transacciones según los criterios
  const filteredTransactions = transactions.filter(tx => {
    // Filtro de búsqueda
    const searchMatch = tx.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       tx.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de estado
    const statusMatch = filterStatus === 'all' || tx.status === filterStatus;
    
    // Filtro de fecha (si se especifica rango)
    let dateMatch = true;
    if (dateRange.startDate && dateRange.endDate) {
      const txDate = new Date(tx.date);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999); // Incluir todo el día final
      
      dateMatch = txDate >= startDate && txDate <= endDate;
    }
    
    // Filtro de organización
    const organizationMatch = selectedOrganization === '' || tx.organizationId === selectedOrganization;
    
    // Filtro de botón
    const buttonMatch = selectedButton === '' || tx.paymentButtonId === selectedButton;
    
    return searchMatch && statusMatch && dateMatch && organizationMatch && buttonMatch;
  });
  
  // Actualizar el número total de páginas cuando cambian los resultados filtrados
  useEffect(() => {
    setTotalPages(Math.ceil(filteredTransactions.length / itemsPerPage));
    // Si la página actual es mayor que el total de páginas, ir a la última página
    if (currentPage > Math.ceil(filteredTransactions.length / itemsPerPage)) {
      setCurrentPage(Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage)));
    }
  }, [filteredTransactions, itemsPerPage, currentPage]);
  
  // Obtener solo las transacciones para la página actual
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Cambiar de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Cambiar el número de items por página
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Resetear a la primera página
  };

  // Función para manejar exportaciones
  const handleExport = (format: 'excel' | 'pdf') => {
    alert(`Exportando transacciones en formato ${format}`);
  };

  return (
    <div>
      <Head>
        <title>CLIC Conciliaciones - Transacciones</title>
        <meta name="description" content="Gestión de transacciones en CLIC Conciliaciones" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Transacciones</h1>
          
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Organización</label>
              <select
                value={selectedOrganization}
                onChange={(e) => setSelectedOrganization(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="">Todas las organizaciones</option>
                {userOrganizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Botón de Pago</label>
              <select
                value={selectedButton}
                onChange={(e) => setSelectedButton(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                disabled={availableButtons.length === 0}
              >
                <option value="">Todos los botones</option>
                {availableButtons.map(button => (
                  <option key={button.id} value={button.id}>{button.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              >
                <option value="all">Todos</option>
                <option value={TRANSACTION_STATUSES.REALIZADA}>Realizada</option>
                <option value={TRANSACTION_STATUSES.CREADA}>Creada</option>
                <option value={TRANSACTION_STATUSES.EN_PAGO}>En pago</option>
                <option value={TRANSACTION_STATUSES.PENDIENTE}>Pendiente</option>
                <option value={TRANSACTION_STATUSES.RECHAZADA}>Rechazada</option>
                <option value={TRANSACTION_STATUSES.EXPIRADA}>Expirada</option>
                <option value={TRANSACTION_STATUSES.CANCELADA}>Cancelada</option>
                <option value={TRANSACTION_STATUSES.DEVUELTA}>Devuelta</option>
                <option value={TRANSACTION_STATUSES.VENCIDA}>Vencida</option>
                <option value={TRANSACTION_STATUSES.ERROR_VALIDACION_HASH_TOKEN}>Error validación token</option>
                <option value={TRANSACTION_STATUSES.ERROR_VALIDACION_HASH_PAGO}>Error validación pago</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, medio de pago..."
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Fecha desde</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
              />
            </div>
          </div>
        </div>

        {/* Tabla de transacciones */}
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Monto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Método de pago</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cuotas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Organización</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Botón</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha de pago estimada</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Liquidación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800">
              {paginatedTransactions.map((tx) => (
                <tr key={tx.transactionId} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{tx.transactionId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(tx.date).toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${tx.amount.toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${getTransactionStatusBadgeClass(tx.status, tx.liquidationId)}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tx.paymentMethod}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tx.quotas}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tx.organization}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tx.paymentButton}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {tx.expectedPayDate ? new Date(tx.expectedPayDate).toLocaleDateString('es-AR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {tx.liquidationId || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Sin resultados */}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-4 text-gray-400">
            No se encontraron transacciones que coincidan con los criterios de búsqueda.
          </div>
        )}
        
        {/* Paginación */}
        {filteredTransactions.length > 0 && (
          <div className="mt-6 flex flex-col md:flex-row justify-between items-center bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center mb-4 md:mb-0">
              <span className="text-sm text-gray-400 mr-2">Mostrar</span>
              <select 
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="mr-2 bg-gray-700 border border-gray-600 text-white rounded p-2"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-400">por página</span>
            </div>
            
            <div className="flex flex-wrap justify-center">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-md ${
                    currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  &laquo;
                </button>
                
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-md ${
                    currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  &lt;
                </button>
                
                {/* Páginas - Lógica para mostrar páginas adyacentes */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Mostrar páginas adyacentes a la actual
                  let pageToShow: number;
                  if (totalPages <= 5) {
                    // Si hay 5 o menos páginas, mostrar todas
                    pageToShow = i + 1;
                  } else if (currentPage <= 3) {
                    // Si estamos en las primeras 3 páginas
                    pageToShow = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // Si estamos en las últimas 3 páginas
                    pageToShow = totalPages - 4 + i;
                  } else {
                    // En el medio, mostrar 2 páginas antes y 2 después
                    pageToShow = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageToShow}
                      onClick={() => handlePageChange(pageToShow)}
                      className={`px-3 py-2 rounded-md ${
                        currentPage === pageToShow
                          ? 'bg-indigo-600 text-white'
                          : 'text-white hover:bg-gray-700'
                      }`}
                    >
                      {pageToShow}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-md ${
                    currentPage === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  &gt;
                </button>
                
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-md ${
                    currentPage === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  &raquo;
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-400 mt-4 md:mt-0">
              Mostrando <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</span> de <span className="font-medium">{filteredTransactions.length}</span> registros
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const prisma = new PrismaClient();
  const session = await getSession(context);
  
  if (!session || !session.user?.email) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }
  
  try {
    const userEmail = session.user.email;
    
    // Obtener el usuario con sus membresías y roles
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        memberships: {
          include: {
            role: true,
            organization: {
              include: {
                paymentButtons: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return {
        redirect: {
          destination: '/auth/login',
          permanent: false,
        },
      };
    }

    // Verificar si el usuario es Super Admin
    const isSuperAdmin = user.memberships.some(
      membership => membership.role.name === 'Super Admin'
    );
    
    // Obtener las organizaciones y botones de pago a los que el usuario tiene acceso
    let userOrganizations: {
      id: string;
      name: string;
      paymentButtons: { id: string; name: string }[];
    }[] = [];
    
    // Si es Super Admin, puede ver todas las organizaciones
    if (isSuperAdmin) {
      const allOrganizations = await prisma.organization.findMany({
        include: {
          paymentButtons: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      userOrganizations = allOrganizations.map(org => ({
        id: org.id,
        name: org.name,
        paymentButtons: org.paymentButtons.map(button => ({
          id: button.id,
          name: button.name
        }))
      }));
    } else {
      // Solo puede ver las organizaciones a las que pertenece
      userOrganizations = user.memberships.map(membership => ({
        id: membership.organization.id,
        name: membership.organization.name,
        paymentButtons: membership.organization.paymentButtons.map(button => ({
          id: button.id,
          name: button.name
        }))
      }));
    }
    
    // Obtener las IDs de todas las organizaciones a las que tiene acceso
    const orgIds = userOrganizations.map(org => org.id);
    
    // Obtener todas las transacciones de las organizaciones a las que tiene acceso
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentButton: {
          organizationId: {
            in: orgIds
          }
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
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Transformar los datos para que sean serializables (JSON)
    const serializedTransactions = transactions.map(tx => ({
      id: tx.transactionId,
      transactionId: tx.transactionId,
      date: tx.date.toISOString(),
      amount: tx.amount,
      status: tx.status,
      paymentMethod: tx.paymentMethod,
      quotas: tx.quotas,
      expectedPayDate: tx.expectedPayDate ? tx.expectedPayDate.toISOString() : null,
      liquidated: !!tx.liquidationId,
      liquidationId: tx.liquidationId,
      organization: tx.paymentButton.organization.name,
      organizationId: tx.paymentButton.organization.id,
      paymentButton: tx.paymentButton.name,
      paymentButtonId: tx.paymentButton.id
    }));

    return {
      props: {
        initialTransactions: serializedTransactions,
        userOrganizations: userOrganizations,
      },
    };
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    return {
      props: {
        initialTransactions: [],
        userOrganizations: [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Transactions); 