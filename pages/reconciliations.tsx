/* eslint-disable react-hooks/exhaustive-deps */
import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import withAuth from '../components/auth/withAuth';
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import ReconciliationHistory from '../components/reconciliations/ReconciliationHistory';
import ScheduledReconciliations from '../components/reconciliations/ScheduledReconciliations';
import DifferencesView from '../components/reconciliations/DifferencesView';
import ProcessIndicator from '../components/reconciliations/ProcessIndicator';
import BatchProcessor from '../utils/batchProcessor';

interface Organization {
  id: string;
  name: string;
}

interface PaymentButton {
  id: string;
  name: string;
  organizationId: string;
}

interface ReconciliationSummary {
  totalTransactions: number;
  totalAmount: number;
  matchedTransactions: number;
  matchedAmount: number;
  pendingTransactions: number;
  pendingAmount: number;
  nextExpectedLiquidation: string | null;
  nextExpectedAmount: number | null;
}

interface ReconciliationsProps {
  organizations: Organization[];
  paymentButtons: PaymentButton[];
  initialSummary: ReconciliationSummary;
  userOrganizations: string[];
  initialReconciliations: any[]; // Datos de conciliaciones iniciales
}

const Reconciliations: NextPage<ReconciliationsProps> = ({ 
  organizations, 
  paymentButtons, 
  initialSummary,
  userOrganizations,
  initialReconciliations
}) => {
  // Estado para la búsqueda y filtros
  const [organizationId, setOrganizationId] = useState('');
  const [paymentButtonId, setPaymentButtonId] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [differences, setDifferences] = useState<any>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Estado para el resumen de conciliación (inicializado con datos de la base de datos)
  const [reconciliationSummary, setReconciliationSummary] = useState(initialSummary);
  const [reconciliations, setReconciliations] = useState(initialReconciliations);

  // Filtrar organizaciones a las que el usuario tiene acceso
  const userOrgs = organizations.filter(org => userOrganizations.includes(org.id));

  // Seleccionar automáticamente la primera organización al cargar
  useEffect(() => {
    if (userOrgs.length > 0 && !organizationId) {
      setOrganizationId(userOrgs[0].id);
    }
  }, [userOrgs]);

  // Filtrar botones de pago según la organización seleccionada
  const filteredPaymentButtons = paymentButtons.filter(
    btn => btn.organizationId === organizationId
  );

  // Seleccionar automáticamente el primer botón de pago
  useEffect(() => {
    if (filteredPaymentButtons.length > 0 && !paymentButtonId) {
      setPaymentButtonId(filteredPaymentButtons[0].id);
    }
  }, [filteredPaymentButtons]);

  // Validar el rango de fechas
  useEffect(() => {
    setDateError('');
    if (dateRange.startDate && dateRange.endDate) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setDateError('Fechas inválidas');
        return;
      }
      
      if (start > end) {
        setDateError('La fecha de inicio debe ser anterior a la fecha final');
        return;
      }
      
      // Calcular diferencia en días
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) {
        setDateError('El rango de fechas no puede superar los 30 días');
      }
    }
  }, [dateRange.startDate, dateRange.endDate]);

  // Estado para componentes de nuevas funcionalidades
  const [activeTab, setActiveTab] = useState<'conciliation' | 'history' | 'scheduled' | 'differences'>('conciliation');
  const [processingInBatches, setProcessingInBatches] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    value: 0,
    processedItems: { current: 0, total: 0, label: 'registros' },
    estimatedTimeRemaining: 0
  });
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  
  // Referencia al procesador por lotes
  const batchProcessorRef = useRef<BatchProcessor<any, any> | null>(null);

  // Función para ejecutar la conciliación con actualización
  const handleReconciliation = async () => {
    if (!organizationId || !paymentButtonId || !dateRange.startDate || !dateRange.endDate) {
      alert('Seleccione organización, botón de pago y rango de fechas');
      return;
    }
    
    if (dateError) {
      alert(dateError);
      return;
    }
    
    const confirmed = window.confirm('Esta acción actualizará los datos de la base de datos con la información de la API externa. ¿Desea continuar?');
    if (!confirmed) return;
    
    setIsLoading(true);
    setSyncSuccess(false);
    
    try {
      // Llamada a la API con parámetros y flag de actualización a true
      const response = await fetch(
        `/api/sync/reconciliations?organizationId=${organizationId}&paymentButtonId=${paymentButtonId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&update=true`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al sincronizar datos');
      }
      
      const data = await response.json();
      
      // Actualizar el estado con la respuesta
      setReconciliationSummary(data.summary);
      setReconciliations(data.reconciliations || []);
      setDifferences(data.differences);
      setSyncSuccess(true);
      
      alert('Conciliación completada con éxito. Se han actualizado los datos locales.');
    } catch (error) {
      console.error('Error al ejecutar conciliación:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para sincronizar datos con la API de Clic
  const handleSyncData = async () => {
    if (!organizationId || !paymentButtonId || !dateRange.startDate || !dateRange.endDate) {
      alert('Seleccione organización, botón de pago y rango de fechas');
      return;
    }
    
    if (dateError) {
      alert(dateError);
      return;
    }
    
    setIsSyncing(true);
    setIsLoading(true);
    setSyncSuccess(false);
    
    try {
      // Llamada a la API con parámetros
      const response = await fetch(
        `/api/sync/reconciliations?organizationId=${organizationId}&paymentButtonId=${paymentButtonId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al sincronizar datos');
      }
      
      const data = await response.json();
      
      // Actualizar el estado con la respuesta
      setReconciliationSummary(data.summary);
      setReconciliations(data.reconciliations || []);
      setDifferences(data.differences);
      setSyncSuccess(true);
      
      alert('Datos sincronizados correctamente');
    } catch (error) {
      console.error('Error al sincronizar datos:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  // Función para ejecutar la conciliación optimizada con procesamiento por lotes
  const handleBatchReconciliation = async () => {
    if (!organizationId || !paymentButtonId || !dateRange.startDate || !dateRange.endDate) {
      alert('Seleccione organización, botón de pago y rango de fechas');
      return;
    }
    
    if (dateError) {
      alert(dateError);
      return;
    }
    
    const confirmed = window.confirm('Esta acción actualizará los datos de la base de datos con la información de la API externa usando procesamiento por lotes. ¿Desea continuar?');
    if (!confirmed) return;
    
    setProcessingInBatches(true);
    setIsLoading(true);
    setSyncSuccess(false);
    
    try {
      // Primero obtener los IDs de transacciones a procesar
      const response = await fetch(
        `/api/sync/reconciliations/prepare?organizationId=${organizationId}&paymentButtonId=${paymentButtonId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al preparar la conciliación');
      }
      
      const prepareData = await response.json();
      const transactionIds = prepareData.transactionIds || [];
      
      if (transactionIds.length === 0) {
        alert('No hay transacciones para conciliar en el período seleccionado');
        setProcessingInBatches(false);
        setIsLoading(false);
        return;
      }
      
      // Crear procesador por lotes
      const batchSize = 50; // Procesar 50 transacciones a la vez
      const processor = new BatchProcessor<string, any>({
        batchSize,
        processBatchFn: async (batchItems, batchIndex) => {
          // Llamar a la API con el lote actual de IDs
          const batchResponse = await fetch(`/api/sync/reconciliations/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              organizationId,
              paymentButtonId,
              transactionIds: batchItems,
              update: true
            })
          });
          
          if (!batchResponse.ok) {
            const errorData = await batchResponse.json();
            throw new Error(errorData.error || `Error en lote ${batchIndex + 1}`);
          }
          
          return await batchResponse.json();
        },
        onProgress: (progress) => {
          setProcessingProgress({
            value: progress.percentComplete,
            processedItems: {
              current: progress.processedItems,
              total: progress.totalItems,
              label: 'transacciones'
            },
            estimatedTimeRemaining: progress.estimatedTimeRemaining || 0
          });
        },
        pauseBetweenBatches: 100 // 100ms entre lotes para permitir actualizar la UI
      });
      
      // Guardar referencia para cancelación
      batchProcessorRef.current = processor;
      
      // Iniciar procesamiento
      const results = await processor.processItems(transactionIds);
      
      // Procesar resultados finales
      const summary = {
        totalTransactions: transactionIds.length,
        matchedTransactions: results.filter(r => r.status === 'MATCHED').length,
        totalAmount: results.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        matchedAmount: results.filter(r => r.status === 'MATCHED')
          .reduce((sum, r) => sum + Number(r.amount || 0), 0),
        pendingTransactions: results.filter(r => r.status === 'PENDING').length,
        pendingAmount: results.filter(r => r.status === 'PENDING')
          .reduce((sum, r) => sum + Number(r.amount || 0), 0),
        nextExpectedLiquidation: null,
        nextExpectedAmount: null
      };
      
      // Actualizar el estado
      setReconciliationSummary(summary);
      setReconciliations(results);
      fetchData(); // Recargar datos actualizados
      setSyncSuccess(true);
      
      alert('Conciliación completada con éxito. Se han actualizado los datos locales.');
    } catch (error) {
      console.error('Error al ejecutar conciliación por lotes:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setProcessingInBatches(false);
      setIsLoading(false);
      batchProcessorRef.current = null;
    }
  };
  
  // Función para cancelar el procesamiento por lotes
  const handleCancelProcessing = () => {
    if (batchProcessorRef.current) {
      batchProcessorRef.current.cancel();
      alert('El proceso de conciliación será cancelado después de terminar el lote actual');
    }
  };
  
  // Manejar actualización de transacciones seleccionadas (para vista de diferencias)
  const handleUpdateSelectedTransactions = (transactionIds: string[]) => {
    setSelectedTransactionIds(transactionIds);
  };
  
  // Función para actualizar solo las transacciones seleccionadas
  const handleUpdateSelected = async () => {
    if (selectedTransactionIds.length === 0) {
      alert('Seleccione al menos una transacción para actualizar');
      return;
    }
    
    const confirmed = window.confirm(`¿Está seguro de actualizar ${selectedTransactionIds.length} transacciones seleccionadas?`);
    if (!confirmed) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/sync/reconciliations/selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionIds: selectedTransactionIds,
          update: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar transacciones seleccionadas');
      }
      
      const result = await response.json();
      alert(`Se han actualizado ${result.updatedCount} transacciones correctamente`);
      
      // Recargar datos
      fetchData();
      setSelectedTransactionIds([]);
    } catch (error) {
      console.error('Error al actualizar transacciones seleccionadas:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para exportar datos
  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!organizationId || !paymentButtonId) {
      alert('Seleccione una organización y botón de pago para exportar datos');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Crear URL con los parámetros de consulta
      const url = `/api/reports/export?format=${format}&organizationId=${organizationId}&paymentButtonId=${paymentButtonId}`;
      
      // Iniciar descarga del archivo
      window.open(url, '_blank');
      
    } catch (error) {
      console.error(`Error al exportar a ${format}:`, error);
      alert(`Error al exportar a ${format}. Por favor, inténtelo más tarde.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para recargar datos después de operaciones
  const fetchData = async () => {
    if (!organizationId || !paymentButtonId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/sync/reconciliations?organizationId=${organizationId}&paymentButtonId=${paymentButtonId}&startDate=${dateRange.startDate || ''}&endDate=${dateRange.endDate || ''}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar datos');
      }
      
      const data = await response.json();
      setReconciliationSummary(data.summary);
      setReconciliations(data.reconciliations || []);
      if (data.differences) setDifferences(data.differences);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sistema de Conciliaciones</title>
        <meta name="description" content="Sistema de conciliación de pagos" />
      </Head>
      
      <div className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen text-white">
        <h1 className="text-2xl font-semibold mb-6 text-white">Sistema de Conciliaciones</h1>
        
        {/* Pestañas de navegación */}
        <div className="border-b border-gray-700 mb-6">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  activeTab === 'conciliation'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent hover:border-gray-600 text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('conciliation')}
              >
                Conciliación
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent hover:border-gray-600 text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('history')}
              >
                Historial
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  activeTab === 'scheduled'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent hover:border-gray-600 text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('scheduled')}
              >
                Programadas
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  activeTab === 'differences'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent hover:border-gray-600 text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('differences')}
              >
                Diferencias
              </button>
            </li>
          </ul>
        </div>
        
        {/* Contenido principal según la pestaña activa */}
        {activeTab === 'conciliation' && (
          <div>
            {/* El contenido existente de conciliación va aquí */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Organización</label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full p-2 bg-gray-800 rounded border border-gray-700 text-white"
                  disabled={isLoading}
                >
                  <option value="">Seleccione una organización</option>
                  {userOrgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Botón de pago</label>
                <select
                  value={paymentButtonId}
                  onChange={(e) => setPaymentButtonId(e.target.value)}
                  className="w-full p-2 bg-gray-800 rounded border border-gray-700 text-white"
                  disabled={!organizationId || isLoading}
                >
                  <option value="">Seleccione un botón de pago</option>
                  {filteredPaymentButtons.map(btn => (
                    <option key={btn.id} value={btn.id}>{btn.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha desde</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  className={`w-full p-2 bg-gray-800 rounded border ${dateError ? 'border-red-500' : 'border-gray-700'} text-white`}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha hasta</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                  className={`w-full p-2 bg-gray-800 rounded border ${dateError ? 'border-red-500' : 'border-gray-700'} text-white`}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={handleSyncData}
                disabled={isLoading}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar con API'}
              </button>
              
              <button
                onClick={handleReconciliation}
                disabled={isLoading}
                className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading && !processingInBatches ? 'Procesando...' : 'Ejecutar Conciliación'}
              </button>
              
              <button
                onClick={handleBatchReconciliation}
                disabled={isLoading}
                className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {processingInBatches ? 'Procesando en lotes...' : 'Conciliación en Lotes'}
              </button>
              
              <div className="ml-auto">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={isLoading || !organizationId || !paymentButtonId}
                  className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mr-2 ${
                    isLoading || !organizationId || !paymentButtonId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Exportar Excel
                </button>
                
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={isLoading || !organizationId || !paymentButtonId}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                    isLoading || !organizationId || !paymentButtonId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Exportar PDF
                </button>
              </div>
            </div>
            
            {/* Indicador de progreso para procesamiento por lotes */}
            {processingInBatches && (
              <div className="mb-6">
                <ProcessIndicator
                  value={processingProgress.value}
                  label="Procesando transacciones en lotes"
                  processedItems={processingProgress.processedItems}
                  estimatedTimeRemaining={processingProgress.estimatedTimeRemaining}
                  showCancel={true}
                  onCancel={handleCancelProcessing}
                  variant="primary"
                  size="md"
                />
              </div>
            )}
            
            {/* El resto de contenido existente de la conciliación */}
            {/* ... existing summary and table ... */}
          </div>
        )}
        
        {/* Pestañas con nuevas funcionalidades */}
        {activeTab === 'history' && (
          <ReconciliationHistory 
            organizationId={organizationId || undefined}
            paymentButtonId={paymentButtonId || undefined}
          />
        )}
        
        {activeTab === 'scheduled' && (
          <ScheduledReconciliations
            organizationId={organizationId || undefined}
          />
        )}
        
        {activeTab === 'differences' && differences && (
          <DifferencesView
            differences={differences.map((diff: any) => ({
              transactionId: diff.id,
              localData: diff.localData,
              apiData: diff.apiData,
              differences: diff.fields.map((field: string) => ({
                field: field,
                localValue: diff.localData[field],
                apiValue: diff.apiData[field]
              })),
              status: diff.status
            }))}
            onUpdateSelected={handleUpdateSelectedTransactions}
          />
        )}
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const prisma = new PrismaClient();
  const session = await getSession(context);
  
  try {
    // Verificar sesión
    if (!session) {
      return {
        redirect: {
          destination: '/auth/signin',
          permanent: false,
        },
      };
    }

    // Obtener las membresías del usuario para determinar a qué organizaciones tiene acceso
    const userMemberships = await prisma.membership.findMany({
      where: {
        userId: session.user?.id as string,
      },
      select: {
        organizationId: true,
      }
    });
    
    const userOrganizationIds = userMemberships.map(m => m.organizationId);

    // Obtener solo las organizaciones a las que el usuario tiene acceso
    const organizations = await prisma.organization.findMany({
      where: {
        id: {
          in: userOrganizationIds
        }
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Obtener los botones de pago asociados a las organizaciones del usuario
    const paymentButtons = await prisma.paymentButton.findMany({
      where: {
        organizationId: {
          in: userOrganizationIds
        }
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
    });

    // Si el usuario no tiene acceso a ninguna organización, no hay datos que mostrar
    if (organizations.length === 0) {
      return {
        props: {
          organizations: [],
          paymentButtons: [],
          initialSummary: {
            totalTransactions: 0,
            totalAmount: 0,
            matchedTransactions: 0,
            matchedAmount: 0,
            pendingTransactions: 0,
            pendingAmount: 0,
            nextExpectedLiquidation: null,
            nextExpectedAmount: null,
          },
          userOrganizations: [],
          initialReconciliations: [],
        },
      };
    }

    // Obtener estadísticas para el resumen de conciliación
    // Si hay una organización seleccionada, filtrar por ella
    const firstOrgId = organizations[0]?.id;
    const firstButtonId = paymentButtons.filter(btn => btn.organizationId === firstOrgId)[0]?.id;

    let transactions: any[] = [];
    let liquidations: any[] = [];
    let reconciliationsData: any[] = [];

    if (firstOrgId && firstButtonId) {
      // Buscar transacciones para el primer botón de pago del usuario
      transactions = await prisma.transaction.findMany({
        where: {
          paymentButtonId: firstButtonId
        }
      });

      // Buscar liquidaciones para el primer botón de pago del usuario
      liquidations = await prisma.liquidation.findMany({
        where: {
          paymentButtonId: firstButtonId
        }
      });

      // Obtener datos de conciliaciones reales para el botón seleccionado
      // Combinamos transacciones y liquidaciones para crear un dataset de conciliaciones
      
      // Primero, transacciones conciliadas (las que tienen liquidation)
      const reconciledTransactions = await prisma.transaction.findMany({
        where: {
          paymentButtonId: firstButtonId,
          liquidationId: { not: null }
        },
        include: {
          liquidation: true,
          paymentButton: {
            select: {
              name: true
            }
          }
        }
      });
      
      // Formateamos los datos para la tabla de conciliaciones
      reconciliationsData = [
        ...reconciledTransactions.map(tx => ({
          id: tx.id,
          transactionId: tx.transactionId,
          date: tx.date.toISOString(),
          amount: tx.amount,
          status: 'CONCILIADO',
          paymentButtonId: tx.paymentButtonId,
          paymentButtonName: tx.paymentButton.name,
          liquidationId: tx.liquidationId,
          liquidationDate: tx.liquidation?.date ? tx.liquidation.date.toISOString() : null
        })),
        // Agregamos también transacciones pendientes
        ...(await prisma.transaction.findMany({
          where: {
            paymentButtonId: firstButtonId,
            liquidationId: null
          },
          include: {
            paymentButton: {
              select: {
                name: true
              }
            }
          }
        })).map(tx => ({
          id: tx.id,
          transactionId: tx.transactionId,
          date: tx.date.toISOString(),
          amount: tx.amount,
          status: 'PENDIENTE',
          paymentButtonId: tx.paymentButtonId,
          paymentButtonName: tx.paymentButton.name,
          liquidationId: null,
          liquidationDate: null
        }))
      ];
      
      // Ordenamos por fecha, las más recientes primero
      reconciliationsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Limitamos a 20 registros para no sobrecargar la página
      reconciliationsData = reconciliationsData.slice(0, 20);
    }
    
    // Calcular estadísticas
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const liquidatedTransactions = transactions.filter(tx => tx.liquidationId !== null);
    const matchedTransactions = liquidatedTransactions.length;
    const matchedAmount = liquidatedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const pendingTransactions = totalTransactions - matchedTransactions;
    const pendingAmount = totalAmount - matchedAmount;
    
    // Buscar la próxima liquidación pendiente
    const nextLiquidation = liquidations
      .filter(liq => liq.status === 'PENDIENTE')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    
    // Asegurarse de que las fechas se serialicen correctamente
    const safeReconciliationsData = JSON.parse(JSON.stringify(reconciliationsData));

    const reconciliationSummary = {
      totalTransactions,
      totalAmount,
      matchedTransactions,
      matchedAmount,
      pendingTransactions,
      pendingAmount,
      nextExpectedLiquidation: nextLiquidation ? nextLiquidation.date.toISOString() : null,
      nextExpectedAmount: nextLiquidation ? nextLiquidation.amount : null,
    };

    return {
      props: {
        organizations: organizations,
        paymentButtons: paymentButtons,
        initialSummary: reconciliationSummary,
        userOrganizations: userOrganizationIds,
        initialReconciliations: safeReconciliationsData,
      },
    };
  } catch (error) {
    console.error('Error al obtener datos de conciliación:', error);
    return {
      props: {
        organizations: [],
        paymentButtons: [],
        initialSummary: {
          totalTransactions: 0,
          totalAmount: 0,
          matchedTransactions: 0,
          matchedAmount: 0,
          pendingTransactions: 0,
          pendingAmount: 0,
          nextExpectedLiquidation: null,
          nextExpectedAmount: null,
        },
        userOrganizations: [],
        initialReconciliations: [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Reconciliations); 