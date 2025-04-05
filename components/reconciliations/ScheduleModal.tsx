/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { AlertCircle, Info } from 'react-feather';

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

interface ScheduledReconciliation {
  id?: string;
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
}

// Props para el modal
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ScheduledReconciliation) => void;
  initialData: ScheduledReconciliation | null;
  organizationId: string;
  organizations: Organization[];
  paymentButtons: PaymentButton[];
}

// Componente principal
const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  organizationId,
  organizations,
  paymentButtons,
}) => {
  // Estados
  const [formData, setFormData] = useState<ScheduledReconciliation>({
    name: '',
    description: '',
    organizationId: organizationId,
    paymentButtonId: '',
    frequency: 'DAILY',
    dayOfWeek: 1,
    dayOfMonth: 1,
    hour: 0,
    minute: 0,
    daysToInclude: 7,
    isActive: true,
    notifyEmail: false,
    notifyEmails: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTab, setCurrentTab] = useState<'general' | 'schedule' | 'notifications'>('general');
  const [submitting, setSubmitting] = useState(false);
  const [filteredButtons, setFilteredButtons] = useState<PaymentButton[]>([]);
  
  // Cargar datos iniciales
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        // Si hay campos opcionales que son undefined, establecer valores por defecto
        dayOfWeek: initialData.dayOfWeek ?? 1,
        dayOfMonth: initialData.dayOfMonth ?? 1,
        description: initialData.description ?? '',
        notifyEmails: initialData.notifyEmails ?? '',
      });
    } else {
      // Reiniciar el formulario para creación
      setFormData({
        name: '',
        description: '',
        organizationId: organizationId,
        paymentButtonId: '',
        frequency: 'DAILY',
        dayOfWeek: 1,
        dayOfMonth: 1,
        hour: 0,
        minute: 0,
        daysToInclude: 7,
        isActive: true,
        notifyEmail: false,
        notifyEmails: '',
      });
    }
  }, [initialData, organizationId]);
  
  // Filtrar botones de pago basados en la organización seleccionada
  useEffect(() => {
    if (formData.organizationId) {
      console.log('Organización seleccionada:', formData.organizationId);
      console.log('Botones disponibles:', paymentButtons);
      
      // Corregir el filtro para usar la propiedad organizationId del botón
      const filtered = paymentButtons.filter(btn => btn.organizationId === formData.organizationId);
      console.log('Botones filtrados:', filtered);
      
      setFilteredButtons(filtered);
      
      // Si no hay botón seleccionado o el botón seleccionado no pertenece a esta organización,
      // seleccionar el primer botón o limpiar la selección
      if (!formData.paymentButtonId || !filtered.some(btn => btn.id === formData.paymentButtonId)) {
        setFormData(prev => ({
          ...prev,
          paymentButtonId: filtered.length > 0 ? filtered[0].id : '',
        }));
      }
    } else {
      setFilteredButtons([]);
    }
  }, [formData.organizationId, paymentButtons]);
  
  // Manejadores de cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'hour' || name === 'minute' || name === 'dayOfWeek' || name === 'dayOfMonth' || name === 'daysToInclude') {
      // Convertir a número
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Limpiar error al cambiar
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validaciones generales
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.organizationId) {
      newErrors.organizationId = 'Debe seleccionar una organización';
    }
    
    if (!formData.paymentButtonId) {
      newErrors.paymentButtonId = 'Debe seleccionar un botón de pago';
    }
    
    // Validaciones de programación
    if (formData.frequency === 'WEEKLY' && (formData.dayOfWeek === null || formData.dayOfWeek === undefined || formData.dayOfWeek < 0 || formData.dayOfWeek > 6)) {
      newErrors.dayOfWeek = 'Debe seleccionar un día de la semana válido (0-6)';
    }
    
    if (formData.frequency === 'MONTHLY' && (formData.dayOfMonth === null || formData.dayOfMonth === undefined || formData.dayOfMonth < 1 || formData.dayOfMonth > 31)) {
      newErrors.dayOfMonth = 'Debe seleccionar un día del mes válido (1-31)';
    }
    
    if (formData.hour < 0 || formData.hour > 23) {
      newErrors.hour = 'Debe ingresar una hora válida (0-23)';
    }
    
    if (formData.minute < 0 || formData.minute > 59) {
      newErrors.minute = 'Debe ingresar minutos válidos (0-59)';
    }
    
    if (formData.daysToInclude < 1 || formData.daysToInclude > 365) {
      newErrors.daysToInclude = 'Debe ingresar un valor entre 1 y 365';
    }
    
    // Validaciones de notificaciones
    if (formData.notifyEmail && !formData.notifyEmails) {
      newErrors.notifyEmails = 'Debe ingresar al menos un correo electrónico';
    }
    
    if (formData.notifyEmail && formData.notifyEmails) {
      const emails = formData.notifyEmails.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          newErrors.notifyEmails = 'Uno o más correos electrónicos son inválidos';
          break;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Cambiar a la primera pestaña con error
      const tabWithError = 
        Object.keys(errors).some(field => ['name', 'organizationId', 'paymentButtonId', 'description'].includes(field))
          ? 'general'
          : Object.keys(errors).some(field => ['frequency', 'dayOfWeek', 'dayOfMonth', 'hour', 'minute', 'daysToInclude'].includes(field))
            ? 'schedule'
            : Object.keys(errors).some(field => ['notifyEmail', 'notifyEmails'].includes(field))
              ? 'notifications'
              : currentTab;
      
      setCurrentTab(tabWithError as any);
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Preparar los datos según la frecuencia
      const dataToSave = { ...formData };
      
      // Asegurarse de que los campos numéricos sean números
      dataToSave.hour = Number(dataToSave.hour);
      dataToSave.minute = Number(dataToSave.minute);
      dataToSave.daysToInclude = Number(dataToSave.daysToInclude);
      
      if (dataToSave.frequency === 'WEEKLY') {
        dataToSave.dayOfWeek = Number(dataToSave.dayOfWeek);
        dataToSave.dayOfMonth = null;
      } else if (dataToSave.frequency === 'MONTHLY') {
        dataToSave.dayOfMonth = Number(dataToSave.dayOfMonth);
        dataToSave.dayOfWeek = null;
      } else {
        // Para frecuencia DAILY
        dataToSave.dayOfWeek = null;
        dataToSave.dayOfMonth = null;
      }
      
      // Si no se activan las notificaciones, limpiar los emails
      if (!dataToSave.notifyEmail) {
        dataToSave.notifyEmails = '';
      }
      
      console.log('Enviando datos para guardar:', dataToSave);
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Renderizar si no está abierto
  if (!isOpen) return null;
  
  // Renderizado del modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">
            {initialData ? 'Editar' : 'Crear'} Conciliación Programada
          </h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            {/* Tabs */}
            <div className="border-b border-gray-700 mb-4">
              <div className="flex -mb-px">
                <button
                  type="button"
                  className={`px-4 py-2 mr-2 font-medium ${currentTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                  onClick={() => setCurrentTab('general')}
                >
                  Información General
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 mr-2 font-medium ${currentTab === 'schedule' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                  onClick={() => setCurrentTab('schedule')}
                >
                  Programación
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 font-medium ${currentTab === 'notifications' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                  onClick={() => setCurrentTab('notifications')}
                >
                  Notificaciones
                </button>
              </div>
            </div>
            
            {/* Tab de Información General */}
            {currentTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Nombre <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    className={`w-full bg-gray-700 border ${errors.name ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nombre de la conciliación"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" /> {errors.name}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Descripción</label>
                  <textarea
                    name="description"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Descripción (opcional)"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Organización <span className="text-red-500">*</span></label>
                  <select
                    name="organizationId"
                    className={`w-full bg-gray-700 border ${errors.organizationId ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                    value={formData.organizationId}
                    onChange={handleChange}
                    disabled={!!initialData}
                  >
                    <option value="">Seleccionar organización</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  {errors.organizationId && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" /> {errors.organizationId}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Botón de pago <span className="text-red-500">*</span></label>
                  <select
                    name="paymentButtonId"
                    className={`w-full bg-gray-700 border ${errors.paymentButtonId ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                    value={formData.paymentButtonId}
                    onChange={handleChange}
                    disabled={!formData.organizationId || filteredButtons.length === 0}
                  >
                    <option value="">Seleccionar botón de pago</option>
                    {filteredButtons.map(btn => (
                      <option key={btn.id} value={btn.id}>{btn.name}</option>
                    ))}
                  </select>
                  {errors.paymentButtonId && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" /> {errors.paymentButtonId}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 mr-2"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                  <label htmlFor="isActive" className="text-gray-300">
                    Conciliación activa
                  </label>
                </div>
              </div>
            )}
            
            {/* Tab de Programación */}
            {currentTab === 'schedule' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Frecuencia <span className="text-red-500">*</span></label>
                  <select
                    name="frequency"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                    value={formData.frequency}
                    onChange={handleChange}
                  >
                    <option value="DAILY">Diaria</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>
                
                {formData.frequency === 'WEEKLY' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Día de la semana <span className="text-red-500">*</span></label>
                    <select
                      name="dayOfWeek"
                      className={`w-full bg-gray-700 border ${errors.dayOfWeek ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.dayOfWeek ?? 1}
                      onChange={handleChange}
                    >
                      <option value={0}>Domingo</option>
                      <option value={1}>Lunes</option>
                      <option value={2}>Martes</option>
                      <option value={3}>Miércoles</option>
                      <option value={4}>Jueves</option>
                      <option value={5}>Viernes</option>
                      <option value={6}>Sábado</option>
                    </select>
                    {errors.dayOfWeek && (
                      <p className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> {errors.dayOfWeek}
                      </p>
                    )}
                  </div>
                )}
                
                {formData.frequency === 'MONTHLY' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Día del mes <span className="text-red-500">*</span></label>
                    <select
                      name="dayOfMonth"
                      className={`w-full bg-gray-700 border ${errors.dayOfMonth ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.dayOfMonth ?? 1}
                      onChange={handleChange}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    {errors.dayOfMonth && (
                      <p className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> {errors.dayOfMonth}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Hora <span className="text-red-500">*</span></label>
                    <select
                      name="hour"
                      className={`w-full bg-gray-700 border ${errors.hour ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.hour}
                      onChange={handleChange}
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                        <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    {errors.hour && (
                      <p className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> {errors.hour}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Minuto <span className="text-red-500">*</span></label>
                    <select
                      name="minute"
                      className={`w-full bg-gray-700 border ${errors.minute ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.minute}
                      onChange={handleChange}
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                        <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    {errors.minute && (
                      <p className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> {errors.minute}
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Días a incluir <span className="text-red-500">*</span></label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      name="daysToInclude"
                      className={`w-24 bg-gray-700 border ${errors.daysToInclude ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.daysToInclude}
                      onChange={handleChange}
                      min={1}
                      max={365}
                    />
                    <span className="ml-2 text-gray-300">días</span>
                  </div>
                  {errors.daysToInclude && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" /> {errors.daysToInclude}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 flex items-center">
                    <Info size={12} className="mr-1" /> Este es el número de días previos que se incluirán en cada conciliación.
                  </p>
                </div>
              </div>
            )}
            
            {/* Tab de Notificaciones */}
            {currentTab === 'notifications' && (
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="notifyEmail"
                    name="notifyEmail"
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 mr-2"
                    checked={formData.notifyEmail}
                    onChange={handleChange}
                  />
                  <label htmlFor="notifyEmail" className="text-gray-300">
                    Enviar notificaciones por correo electrónico
                  </label>
                </div>
                
                {formData.notifyEmail && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Correos electrónicos <span className="text-red-500">*</span></label>
                    <textarea
                      name="notifyEmails"
                      className={`w-full bg-gray-700 border ${errors.notifyEmails ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 text-white`}
                      value={formData.notifyEmails}
                      onChange={handleChange}
                      placeholder="ejemplo@dominio.com, otro@dominio.com"
                      rows={3}
                    />
                    {errors.notifyEmails ? (
                      <p className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> {errors.notifyEmails}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Separe múltiples correos electrónicos con comas.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-5 border-t border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal; 