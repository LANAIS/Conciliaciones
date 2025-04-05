/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Flex,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Select,
  FormControl,
  FormLabel,
  Badge,
  IconButton,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  Tag,
  Divider,
  Heading,
  useColorModeValue
} from '@chakra-ui/react';
import { Calendar, Plus, Edit2, Trash2, Play, RefreshCw } from 'react-feather';
import ScheduleModal from './ScheduleModal';

// Interfaces básicas
interface Organization {
  id: string;
  name: string;
}

interface PaymentButton {
  id: string;
  name: string;
  organizationId: string;
}

// Interface for scheduled reconciliation data
interface ScheduledReconciliation {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  paymentButtonId: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour: number;
  minute: number;
  daysToInclude: number;
  isActive: boolean;
  notifyEmail: boolean;
  notifyEmails?: string;
  lastRun?: string | null;
  nextRun: string;
  organization: {
    name: string;
  };
  paymentButton: {
    name: string;
  };
  executionCount?: number;
  lastExecutionStatus?: string;
  lastErrorMessage?: string;
}

// Props interface
interface ScheduledReconciliationsProps {
  organizationId?: string;
}

// Component implementation
const ScheduledReconciliations: React.FC<ScheduledReconciliationsProps> = ({ organizationId: initialOrgId }) => {
  // Estados
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId || '');
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([]);
  const [selectedButtonId, setSelectedButtonId] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduledReconciliation[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<ScheduledReconciliation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledReconciliation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Modales y referencias
  const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModalBase } = useDisclosure();
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isRunAlertOpen, setIsRunAlertOpen] = useState(false);
  const cancelRef = useRef(null);
  const toast = useToast();
  
  // Colores
  const bgColor = useColorModeValue('white', 'gray.800');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Cargar organizaciones al inicio
  useEffect(() => {
    fetchOrganizations();
  }, []);
  
  // Cargar botones de pago cuando cambia la organización seleccionada
  useEffect(() => {
    if (selectedOrgId) {
      fetchPaymentButtons(selectedOrgId);
      fetchSchedules();
    }
  }, [selectedOrgId]);
  
  // Filtrar schedules cuando cambian los datos
  useEffect(() => {
    filterSchedules();
  }, [schedules, selectedButtonId]);
  
  // Función para cargar organizaciones
  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/organizations', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar organizaciones');
      
      const data = await response.json();
      setOrganizations(data);
      
      // Si hay un ID de organización inicial o no hay organización seleccionada, seleccionar la primera
      if ((initialOrgId || !selectedOrgId) && data.length > 0) {
        setSelectedOrgId(initialOrgId || data[0].id);
      }
      
    } catch (error) {
      console.error('Error al cargar organizaciones:', error);
      setError('No se pudieron cargar las organizaciones');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para cargar botones de pago
  const fetchPaymentButtons = async (orgId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payment-buttons?organizationId=${orgId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar botones de pago');
      
      const data = await response.json();
      console.log('Botones de pago cargados:', data);
      setPaymentButtons(data);
      
      // Resetear el botón seleccionado
      setSelectedButtonId('');
      
    } catch (error) {
      console.error('Error al cargar botones de pago:', error);
      setError('No se pudieron cargar los botones de pago');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para cargar conciliaciones programadas
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/scheduled-reconciliations';
      if (selectedOrgId) {
        url += `?organizationId=${selectedOrgId}`;
      }
      
      // Añadir un timestamp para evitar caché
      const timestamp = new Date().getTime();
      url += url.includes('?') ? `&_=${timestamp}` : `?_=${timestamp}`;
      
      console.log('Cargando conciliaciones programadas desde:', url);
      
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store' // Evitar caché
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar conciliaciones programadas');
      }
      
      const data = await response.json();
      console.log('Conciliaciones programadas cargadas:', data);
      setSchedules(data);
      
    } catch (error) {
      console.error('Error al cargar conciliaciones programadas:', error);
      setError('No se pudieron cargar las conciliaciones programadas');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para filtrar conciliaciones programadas
  const filterSchedules = () => {
    if (!selectedButtonId) {
      setFilteredSchedules(schedules);
      return;
    }
    
    const filtered = schedules.filter(schedule => schedule.paymentButtonId === selectedButtonId);
    setFilteredSchedules(filtered);
  };
  
  // Función para abrir el modal de creación
  const handleAddNew = () => {
    setSelectedSchedule(null);
    openModal();
  };
  
  // Función para abrir el modal de edición
  const handleEdit = (schedule: ScheduledReconciliation) => {
    setSelectedSchedule(schedule);
    openModal();
  };
  
  // Función para abrir el diálogo de confirmación de eliminación
  const handleDeleteClick = (schedule: ScheduledReconciliation) => {
    setSelectedSchedule(schedule);
    setIsDeleteAlertOpen(true);
  };
  
  // Función para eliminar una conciliación programada
  const handleDelete = async () => {
    if (!selectedSchedule) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/scheduled-reconciliations?id=${selectedSchedule.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Error al eliminar la conciliación programada');
      
      // Actualizar la lista
      setSchedules(schedules.filter(s => s.id !== selectedSchedule.id));
      
      toast({
        title: 'Eliminada',
        description: 'La conciliación programada ha sido eliminada',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Error al eliminar conciliación programada:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la conciliación programada',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
    }
  };
  
  // Función para abrir el diálogo de confirmación de ejecución
  const handleRunClick = (schedule: ScheduledReconciliation) => {
    setSelectedSchedule(schedule);
    setIsRunAlertOpen(true);
  };
  
  // Función para ejecutar una conciliación programada manualmente
  const handleRun = async () => {
    if (!selectedSchedule) return;
    
    try {
      setIsRunning(true);
      const response = await fetch(`/api/scheduled-reconciliations/run?id=${selectedSchedule.id}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al ejecutar la conciliación');
      }
      
      // Actualizar la lista
      fetchSchedules();
      
      toast({
        title: 'Ejecutada',
        description: 'La conciliación ha sido ejecutada manualmente',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
    } catch (error: any) {
      console.error('Error al ejecutar conciliación:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo ejecutar la conciliación',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRunning(false);
      setIsRunAlertOpen(false);
    }
  };
  
  // Función para guardar una conciliación (crear o actualizar)
  const handleSave = async (data: any) => {
    try {
      const method = selectedSchedule ? 'PUT' : 'POST';
      const body = selectedSchedule 
        ? { ...data, id: selectedSchedule.id }
        : data;
      
      console.log('Guardando conciliación programada:', body);
      
      const response = await fetch('/api/scheduled-reconciliations', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error al ${selectedSchedule ? 'actualizar' : 'crear'} la conciliación`);
      }
      
      const savedData = await response.json();
      console.log('Conciliación guardada correctamente:', savedData);
      
      // Volver a cargar las conciliaciones después de un breve retraso para asegurar que la BD se actualice
      setTimeout(() => {
        fetchSchedules();
      }, 500);
      
      toast({
        title: selectedSchedule ? 'Actualizada' : 'Creada',
        description: `La conciliación ha sido ${selectedSchedule ? 'actualizada' : 'creada'} correctamente`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      closeModal();
    } catch (error: any) {
      console.error('Error al guardar conciliación:', error);
      toast({
        title: 'Error',
        description: error.message || `No se pudo ${selectedSchedule ? 'actualizar' : 'crear'} la conciliación`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Función para formatear la frecuencia
  const formatFrequency = (schedule: ScheduledReconciliation) => {
    const { frequency, hour, minute, dayOfWeek, dayOfMonth } = schedule;
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    switch (frequency) {
      case 'DAILY':
        return `Diaria a las ${time}`;
      case 'WEEKLY': {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const day = dayOfWeek !== null && dayOfWeek !== undefined ? days[dayOfWeek] : 'Desconocido';
        return `Semanal (${day}) a las ${time}`;
      }
      case 'MONTHLY':
        return `Mensual (día ${dayOfMonth}) a las ${time}`;
      default:
        return 'Desconocida';
    }
  };
  
  // Función para formatear el estado
  const getStatusBadge = (status?: string) => {
    if (!status) return <span className="px-2 py-1 text-xs rounded-full bg-gray-600 text-gray-300">Pendiente</span>;
    
    switch (status) {
      case 'SUCCESS':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-800 text-green-200">Exitosa</span>;
      case 'FAILED':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-800 text-red-200">Fallida</span>;
      case 'PARTIAL':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-800 text-yellow-200">Parcial</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-600 text-gray-300">Pendiente</span>;
    }
  };
  
  // Función para formatear la fecha
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'Fecha inválida' : date.toLocaleString('es-ES');
  };
  
  // Función para cerrar el modal y limpiar el estado
  const closeModal = () => {
    closeModalBase();
    // Limpiar el estado seleccionado después de un breve retraso
    // para evitar problemas de renderizado
    setTimeout(() => {
      setSelectedSchedule(null);
    }, 100);
  };
  
  // Renderizado del componente
  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Calendar className="mr-2 text-blue-400" size={18} />
          Conciliaciones Programadas
        </h2>
        {selectedOrgId && (
          <button 
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            onClick={handleAddNew}
          >
            <Plus className="mr-1" size={16} />
            Nueva
          </button>
        )}
      </div>
      
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="w-full md:w-64">
          <label className="block text-gray-400 text-sm mb-1">Organización</label>
          <select 
            className="w-full border border-gray-600 bg-gray-700 rounded-md px-3 py-2 text-white"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            disabled={loading}
          >
            <option value="">Seleccionar organización</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
        
        <div className="w-full md:w-64">
          <label className="block text-gray-400 text-sm mb-1">Botón de pago</label>
          <select 
            className="w-full border border-gray-600 bg-gray-700 rounded-md px-3 py-2 text-white"
            value={selectedButtonId}
            onChange={(e) => setSelectedButtonId(e.target.value)}
            disabled={loading || !selectedOrgId || paymentButtons.length === 0}
          >
            <option value="">Todos los botones</option>
            {paymentButtons.map(btn => (
              <option key={btn.id} value={btn.id}>{btn.name}</option>
            ))}
          </select>
        </div>
        
        {selectedOrgId && (
          <div className="flex items-end">
            <button 
              className="flex items-center text-blue-400 hover:text-blue-300 border border-blue-600 rounded px-3 py-2"
              onClick={fetchSchedules}
              disabled={loading}
            >
              <RefreshCw className={`mr-1 ${loading ? 'animate-spin' : ''}`} size={16} />
              Actualizar
            </button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900 text-red-200 rounded-md p-4 mb-4">
          {error}
        </div>
      ) : (
        <>
          {!selectedOrgId ? (
            <div className="text-center py-8 text-gray-400 bg-gray-800 rounded-md">
              Seleccione una organización para ver sus conciliaciones programadas
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-800 rounded-md">
              <p>No hay conciliaciones programadas para {selectedButtonId ? 'este botón de pago' : 'esta organización'}</p>
              <button 
                className="mt-4 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center"
                onClick={handleAddNew}
              >
                <Plus className="mr-1" size={16} />
                Crear nueva conciliación
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Botón
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Frecuencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Próxima ejecución
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Última ejecución
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredSchedules.map(schedule => (
                    <tr key={schedule.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-200 font-medium">
                          {schedule.name}
                          {!schedule.isActive && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded-full">
                              Inactiva
                            </span>
                          )}
                        </div>
                        {schedule.description && (
                          <div className="text-xs text-gray-400">{schedule.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        <span className="px-2 py-1 text-xs bg-blue-900 text-blue-300 rounded-full">
                          {schedule.paymentButton.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {formatFrequency(schedule)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {formatDate(schedule.nextRun)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {formatDate(schedule.lastRun)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(schedule.lastExecutionStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        <button 
                          className="text-green-400 hover:text-green-300 mr-3"
                          onClick={() => handleRunClick(schedule)}
                          disabled={!schedule.isActive || isRunning}
                          title="Ejecutar ahora"
                        >
                          <Play size={18} />
                        </button>
                        <button 
                          className="text-blue-400 hover:text-blue-300 mr-3"
                          onClick={() => handleEdit(schedule)}
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteClick(schedule)}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal para crear/editar conciliación */}
      {isModalOpen && (
        <ScheduleModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSave}
          initialData={selectedSchedule}
          organizationId={selectedOrgId}
          organizations={organizations}
          paymentButtons={paymentButtons}
        />
      )}
      
      {/* Diálogo de confirmación para eliminar */}
      {isDeleteAlertOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Eliminar conciliación programada</h3>
            <p>¿Está seguro de que desea eliminar la conciliación &quot;{selectedSchedule?.name}&quot;?</p>
            <p className="text-red-400 text-sm mt-2">Esta acción no se puede deshacer.</p>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => setIsDeleteAlertOpen(false)}
                ref={cancelRef}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Diálogo de confirmación para ejecutar */}
      {isRunAlertOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Ejecutar conciliación ahora</h3>
            <p>¿Está seguro de que desea ejecutar la conciliación &quot;{selectedSchedule?.name}&quot; ahora?</p>
            {selectedSchedule && (
              <p className="text-gray-400 text-sm mt-2">
                Se procesarán los últimos {selectedSchedule.daysToInclude} días.
              </p>
            )}
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => setIsRunAlertOpen(false)}
                ref={cancelRef}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                onClick={handleRun}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ejecutando...
                  </>
                ) : (
                  'Ejecutar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReconciliations; 