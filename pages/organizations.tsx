/* eslint-disable react-hooks/exhaustive-deps */
import type { GetServerSideProps } from 'next';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import withAuth from '../components/auth/withAuth';
import { PrismaClient } from '@prisma/client';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';

interface PaymentButton {
  id: string;
  name: string;
  apiKey?: string;
  guid?: string;
  transactions: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  paymentButtons: PaymentButton[];
  users: User[];
}

interface OrganizationsProps {
  initialOrganizations: Organization[];
  userRoles: {
    isSuperAdmin: boolean;
    isAdminOfOrgs: string[];
  };
}

const Organizations: NextPage<OrganizationsProps> = ({ initialOrganizations, userRoles }) => {
  const router = useRouter();
  // Estado para manejar carga y errores
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Nuevo estado para la verificación de credenciales
  const [verifyingCredentials, setVerifyingCredentials] = useState(false);
  const [credentialsVerified, setCredentialsVerified] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | Record<string, any> | null>(null);
  const [comercioInfo, setComercioInfo] = useState<any>(null);
  const [simulatedMode, setSimulatedMode] = useState(false);

  // Estado para la búsqueda de usuarios
  const [searchingUser, setSearchingUser] = useState(false);
  const [userFound, setUserFound] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [foundUserEmail, setFoundUserEmail] = useState('');

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'organization' | 'paymentButton' | 'user'>('organization');
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);

  // Estado para las organizaciones (inicializado con los datos de la base de datos)
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);

  // Estado para los datos del formulario
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    secretKey: '',
    guid: '',
    frase: '',
    userName: '',
    userEmail: '',
    userRole: 'Visualizador'
  });

  // Detectar parámetros de URL para abrir automáticamente el modal
  useEffect(() => {
    const { action, orgId } = router.query;
    
    if (action === 'addPaymentButton' && orgId && typeof orgId === 'string') {
      // Verificar que la organización existe y el usuario tiene permisos
      const orgExists = organizations.some(org => org.id === orgId);
      
      if (orgExists && canManageOrganization(orgId)) {
        openModal('paymentButton', orgId);
      } else {
        showMessage('No tienes permisos para añadir botones de pago a esta organización', true);
      }
    }
  }, [router.query]);

  // Función para verificar si el usuario puede administrar una organización
  const canManageOrganization = (orgId: string) => {
    return userRoles.isSuperAdmin || userRoles.isAdminOfOrgs.includes(orgId);
  };

  // Función para mostrar mensajes
  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess(null);
    } else {
      setSuccess(message);
      setError(null);
    }
    // Limpiar mensaje después de 5 segundos
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  // Actualizar la lista de organizaciones
  const refreshOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/organizations', {
        credentials: 'include', // Incluir cookies para la autenticación
      });
      if (!response.ok) {
        throw new Error('Error al obtener las organizaciones');
      }
      const data = await response.json();
      setOrganizations(data);
    } catch (err) {
      console.error('Error al actualizar organizaciones:', err);
      showMessage('Error al actualizar la lista de organizaciones. Por favor, recargue la página.', true);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para buscar un usuario por email
  const searchUserByEmail = async (email: string) => {
    if (!email) return;
    
    try {
      setSearchingUser(true);
      setUserFound(false);
      setUserNotFound(false);
      
      const response = await fetch(`/api/users/search?email=${encodeURIComponent(email)}`, {
        credentials: 'include', // Incluir cookies para la autenticación
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUserName(userData.name);
        setFoundUserEmail(userData.email);
        setUserFound(true);
        setUserNotFound(false);
        
        // Actualizar el formData con el nombre del usuario
        setFormData({
          ...formData,
          userName: userData.name,
          userEmail: userData.email
        });
        
        showMessage(`Usuario encontrado: ${userData.name}`, false);
      } else {
        setUserName('');
        setUserFound(false);
        setUserNotFound(true);
        
        // Intentar obtener el mensaje de error
        try {
          const errorData = await response.json();
          showMessage(errorData.error || 'Usuario no encontrado en el sistema', true);
        } catch (e) {
          showMessage('Usuario no encontrado en el sistema', true);
        }
      }
    } catch (err) {
      console.error('Error al buscar usuario:', err);
      setUserName('');
      setUserFound(false);
      setUserNotFound(true);
      showMessage(`Error al buscar usuario: ${err instanceof Error ? err.message : 'Error desconocido'}`, true);
    } finally {
      setSearchingUser(false);
    }
  };

  // Maneja cambios en el input de email
  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setUserEmail(email);
    
    // Si el email cambia, resetear el estado de búsqueda
    if (email !== formData.userEmail) {
      setUserFound(false);
      setUserNotFound(false);
    }
    
    setFormData({
      ...formData,
      userEmail: email
    });
    
    // Si el email tiene un formato válido, buscar el usuario
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await searchUserByEmail(email);
    } else {
      setUserFound(false);
      setUserNotFound(false);
    }
  };

  // Maneja el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      let response;
      
      // Crear organización
      if (modalType === 'organization') {
        const data = { name: formData.name };
        console.log('Frontend: Enviando datos para crear organización:', data);
        
        response = await fetch('/api/organizations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include' // Incluir cookies en la solicitud
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('Frontend: Error al crear organización:', responseData);
          throw new Error(responseData.error || 'Error al crear la organización');
        }
        
        console.log('Frontend: Organización creada con éxito:', responseData);
        showMessage('Organización creada con éxito');
      }
      
      // Crear botón de pago
      if (modalType === 'paymentButton' && selectedOrganization) {
        // Eliminar la verificación de credenciales
        const data = {
          name: formData.name,
          guid: formData.guid,
          frase: formData.frase,
          organizationId: selectedOrganization
        };
        
        console.log('Frontend: Enviando datos para crear botón de pago:', {
          ...data,
          frase: '[OCULTO]'
        });
        
        response = await fetch('/api/organizations/paymentButtons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include' // Incluir cookies en la solicitud
        });
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (error) {
          console.error('Frontend: Error al analizar respuesta:', error);
          responseData = { error: 'Error al analizar la respuesta del servidor' };
        }
        
        if (!response.ok) {
          console.error('Frontend: Error al crear botón de pago:', responseData);
          throw new Error(responseData.error || 'Error al crear el botón de pago');
        }
        
        console.log('Frontend: Botón de pago creado con éxito:', responseData);
        showMessage('Botón de pago creado con éxito');
      }
      
      // Añadir usuario a organización
      if (modalType === 'user' && selectedOrganization) {
        // Verificar que el usuario existe antes de continuar
        if (!userFound) {
          throw new Error('El usuario no existe en el sistema. No se pueden asignar permisos.');
        }
        
        const data = {
          name: userName, // Usar el nombre obtenido de la búsqueda
          email: foundUserEmail, // Usar el email exacto encontrado, no el del formulario
          roleName: formData.userRole,
          organizationId: selectedOrganization
        };
        
        console.log('Frontend: Enviando datos para asignar permisos:', data);
        
        response = await fetch('/api/organizations/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include' // Incluir cookies en la solicitud
        });
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (error) {
          console.error('Frontend: Error al analizar respuesta:', error);
          responseData = { error: 'Error al analizar la respuesta del servidor' };
        }
        
        if (!response.ok) {
          console.error('Frontend: Error al añadir usuario:', responseData);
          
          // Manejar mensajes de error específicos
          if (responseData.error && responseData.error.includes('No autorizado')) {
            throw new Error('Error de autenticación. Por favor, vuelva a iniciar sesión.');
          } else if (responseData.error && responseData.error.includes('no existe')) {
            throw new Error('El usuario no existe en el sistema. No se pueden asignar permisos.');
          } else if (responseData.error && responseData.error.includes('ya tiene un administrador')) {
            throw new Error(`Esta organización ya tiene un administrador${responseData.currentAdmin ? ` (${responseData.currentAdmin})` : ''}. Solo un Super Admin puede cambiarlo.`);
          } else if (responseData.error && responseData.error.includes('Solo un Super Admin puede modificar')) {
            throw new Error('Solo un Super Admin puede modificar el rol de un Administrador existente.');
          } else {
            throw new Error(responseData.error || 'Error al añadir el usuario');
          }
        }
        
        console.log('Frontend: Usuario añadido con éxito:', responseData);
        showMessage('Usuario añadido con éxito');
        
        // Cerrar modal y actualizar organizaciones
        setIsModalOpen(false);
        await refreshOrganizations();
        
      }
      
      // Cerrar modal después de enviar
      setIsModalOpen(false);
      
      // Actualizar la lista de organizaciones
      await refreshOrganizations();
      
    } catch (err) {
      console.error('Frontend: Error al enviar el formulario:', err);
      showMessage(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar una organización
  const handleDeleteOrganization = async (orgId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta organización?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        credentials: 'include' // Incluir cookies en la solicitud
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar la organización');
      }
      
      showMessage('Organización eliminada con éxito');
      
      // Actualizar la lista de organizaciones
      await refreshOrganizations();
    } catch (err) {
      console.error('Error al eliminar la organización:', err);
      showMessage(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar un botón de pago
  const handleDeletePaymentButton = async (btnId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este botón de pago?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/organizations/paymentButtons/${btnId}`, {
        method: 'DELETE',
        credentials: 'include' // Incluir cookies en la solicitud
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar el botón de pago');
      }
      
      showMessage('Botón de pago eliminado con éxito');
      
      // Actualizar la lista de organizaciones
      await refreshOrganizations();
    } catch (err) {
      console.error('Error al eliminar el botón de pago:', err);
      showMessage(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar un usuario de la organización
  const handleDeleteUser = async (userId: string, organizationId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este usuario de la organización?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/organizations/users/${userId}?organizationId=${organizationId}`, {
        method: 'DELETE',
        credentials: 'include' // Incluir cookies en la solicitud
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar el usuario de la organización');
      }
      
      showMessage('Usuario eliminado de la organización con éxito');
      
      // Actualizar la lista de organizaciones
      await refreshOrganizations();
    } catch (err) {
      console.error('Error al eliminar el usuario:', err);
      showMessage(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para verificar las credenciales de la API de Clic de Pagos
  const verifyCredentials = async () => {
    try {
      setVerifyingCredentials(true);
      setCredentialsError(null);
      setComercioInfo(null);
      setSimulatedMode(false);
      
      // Validación de campos
      if (!formData.guid || !formData.frase) {
        setCredentialsError('Ambos campos GUID y Frase son requeridos');
        return false;
      }
      
      console.log('Iniciando verificación de credenciales...');
      
      const response = await fetch('/api/clic-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guid: formData.guid,
          frase: formData.frase
        }),
        credentials: 'include' // Incluir cookies en la solicitud
      });
      
      console.log('Respuesta recibida del servidor');
      
      if (!response.ok) {
        console.error('Error en la respuesta HTTP:', response.status, response.statusText);
        setCredentialsVerified(false);
        setCredentialsError(`Error del servidor: ${response.status} ${response.statusText}`);
        showMessage(`Error del servidor: ${response.status} ${response.statusText}`, true);
        return false;
      }
      
      const data = await response.json();
      console.log('Datos de verificación procesados');
      
      // Verificar si estamos en modo simulado
      if (data.simulatedMode) {
        setSimulatedMode(true);
      }
      
      if (data.success) {
        setCredentialsVerified(true);
        setCredentialsError(null);
        
        // Si hay información del comercio, guardarla
        if (data.comercio) {
          setComercioInfo(data.comercio);
          showMessage(`Credenciales verificadas correctamente para ${data.comercio.nombre || 'el comercio'}${data.simulatedMode ? ' (MODO SIMULADO)' : ''}`, false);
        } else if (data.sessionData && data.sessionData.message) {
          setComercioInfo({ message: data.sessionData.message });
          showMessage(`Credenciales verificadas: ${data.sessionData.message}${data.simulatedMode ? ' (MODO SIMULADO)' : ''}`, false);
        } else {
          showMessage(`Credenciales verificadas correctamente${data.simulatedMode ? ' (MODO SIMULADO)' : ''}`, false);
        }
        
        return true;
      } else {
        setCredentialsVerified(false);
        
        // Manejar el objeto de detalles
        if (data.details) {
          if (typeof data.details === 'string') {
            setCredentialsError(`${data.error}: ${data.details}`);
          } else if (typeof data.details === 'object') {
            // Guardar el objeto completo de detalles
            const errorObj = {
              message: `${data.error}: ${data.details.message || ''}`,
              suggestions: data.details.suggestions || [],
              technicalDetails: data.details.technicalDetails || {}
            };
            setCredentialsError(errorObj);
            
            // Mostrar un mensaje conciso
            const displayMessage = data.details.message || data.error || 'Error al verificar las credenciales';
            showMessage(displayMessage, true);
          } else {
            setCredentialsError(data.error || 'Error al verificar las credenciales');
          }
        } else {
          setCredentialsError(data.error || 'Error al verificar las credenciales');
        }
        
        showMessage(data.error || 'Error al verificar las credenciales', true);
        return false;
      }
    } catch (err: any) {
      console.error('Error en la verificación de credenciales:', err);
      setCredentialsVerified(false);
      
      let errorMessage = 'Error al conectar con el servicio de verificación';
      
      // Intentar proporcionar un mensaje más específico
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      
      setCredentialsError(errorMessage);
      showMessage(errorMessage, true);
      return false;
    } finally {
      setVerifyingCredentials(false);
    }
  };

  // Función para abrir el modal
  const openModal = (type: 'organization' | 'paymentButton' | 'user', orgId: string | null = null) => {
    setIsModalOpen(true);
    setModalType(type);
    setSelectedOrganization(orgId);
    
    // Resetear estados
    setError(null);
    setSuccess(null);
    setCredentialsVerified(false);
    setCredentialsError(null);
    setComercioInfo(null);
    setUserFound(false);
    setUserNotFound(false);
    setUserEmail('');
    setUserName('');
    setFoundUserEmail('');
    
    // Resetear el formulario
    setFormData({
      name: '',
      apiKey: '',
      secretKey: '',
      guid: '',
      frase: '',
      userName: '',
      userEmail: '',
      userRole: 'Visualizador'
    });
  };

  // Maneja cambios en los campos del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div>
      <Head>
        <title>CLIC Conciliaciones - Organizaciones</title>
        <meta name="description" content="Gestión de organizaciones en CLIC Conciliaciones" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Organizaciones</h1>
          {userRoles.isSuperAdmin && (
            <button 
              onClick={() => openModal('organization')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded">
              Nueva organización
            </button>
          )}
        </div>

        {/* Mensaje de éxito o error */}
        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{success}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Indicador de carga */}
        {isLoading && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* Información del comercio si está disponible */}
        {credentialsVerified && (
          <div className={`mb-4 ${simulatedMode ? 'bg-yellow-900 border-yellow-700' : 'bg-green-900 border-green-700'} p-3 rounded border`}>
            {simulatedMode && (
              <div className="mb-2 text-yellow-300 font-medium text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                MODO SIMULADO - No conectado al servidor real
              </div>
            )}
            <h4 className={`font-medium ${simulatedMode ? 'text-yellow-300' : 'text-green-300'} mb-1`}>
              {simulatedMode ? 'Credenciales Simuladas:' : 'Información del Comercio Verificada:'}
            </h4>
            <dl className="grid grid-cols-2 gap-1 text-xs">
              {comercioInfo && comercioInfo.nombre && (
                <>
                  <dt className={simulatedMode ? 'text-yellow-400' : 'text-green-400'}>Nombre:</dt>
                  <dd className="text-white">{comercioInfo.nombre}</dd>
                </>
              )}
              {comercioInfo && comercioInfo.razonSocial && (
                <>
                  <dt className={simulatedMode ? 'text-yellow-400' : 'text-green-400'}>Razón Social:</dt>
                  <dd className="text-white">{comercioInfo.razonSocial}</dd>
                </>
              )}
              {comercioInfo && comercioInfo.cuit && (
                <>
                  <dt className={simulatedMode ? 'text-yellow-400' : 'text-green-400'}>CUIT:</dt>
                  <dd className="text-white">{comercioInfo.cuit}</dd>
                </>
              )}
              {comercioInfo && comercioInfo.message && (
                <>
                  <dt className={simulatedMode ? 'text-yellow-400' : 'text-green-400'}>Estado:</dt>
                  <dd className="text-white">{comercioInfo.message}</dd>
                </>
              )}
            </dl>
            {simulatedMode && (
              <p className="mt-2 text-yellow-200 text-xs italic">
                Las credenciales han sido verificadas en modo simulado para desarrollo. Estas credenciales no han sido validadas con el servidor real de Click de Pago.
              </p>
            )}
          </div>
        )}

        {/* Error detallado con sugerencias */}
        {credentialsError && (
          <div className="mb-4 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded text-sm">
            <div className="font-medium mb-2">
              {typeof credentialsError === 'string' 
                ? credentialsError 
                : (credentialsError as any).message || 'Error al verificar credenciales'}
            </div>
            
            {/* Si hay recomendaciones en el error, mostrarlas */}
            {typeof credentialsError === 'object' && (credentialsError as any).recommendations && (
              <div className="mt-2">
                <h5 className="font-medium text-red-300 mb-1">Importante:</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {((credentialsError as any).recommendations || []).map((recommendation: string, index: number) => (
                    <li key={index}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Si hay sugerencias en el error, mostrarlas */}
            {typeof credentialsError === 'object' && (credentialsError as any).suggestions && (
              <div className="mt-2">
                <h5 className="font-medium text-red-300 mb-1">Sugerencias:</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {((credentialsError as any).suggestions || []).map((suggestion: string, index: number) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Si hay mensaje sobre problemas de conexión, mostrar sugerencias */}
            {typeof credentialsError === 'string' && credentialsError.includes('Error de conexión') && (
              <div className="mt-2">
                <h5 className="font-medium text-red-300 mb-1">Sugerencias:</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>Verifique que tiene acceso a internet sin restricciones</li>
                  <li>Consulte con su administrador de red si hay restricciones para conexiones salientes</li>
                  <li>Verifique si Click de Pago requiere agregar su IP a una lista de permitidos</li>
                  <li>Intente desde una red diferente (por ejemplo, usando datos móviles)</li>
                </ul>
              </div>
            )}
            
            {/* Si hay mensaje sobre diferencias entre Postman y el servidor */}
            {(typeof credentialsError === 'string' && credentialsError.includes('No se pudo conectar')) || 
             (typeof credentialsError === 'object' && (credentialsError as any).code === 'ECONNREFUSED') && (
              <div className="mt-2 p-2 bg-blue-900 rounded">
                <h5 className="font-medium text-blue-300 mb-1">¿Funciona en Postman pero no aquí?</h5>
                <p className="text-xs mb-2">
                  Es probable que la API de Click de Pago requiera una configuración especial o esté restringida a ciertas IPs.
                </p>
                <ul className="list-disc pl-5 text-xs space-y-1 text-blue-100">
                  <li>Contacte a Click de Pago para agregar su IP a la lista blanca</li>
                  <li>Exporte su solicitud de Postman y compártala con el equipo de desarrollo</li>
                  <li>Es posible que necesite un servidor proxy intermedio</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Lista de organizaciones */}
        <div className="space-y-6">
          {organizations.map((org) => (
            <div key={org.id} className="bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{org.name}</h2>
                  <div className="flex space-x-2">
                    {canManageOrganization(org.id) && (
                      <>
                        <button 
                          onClick={() => openModal('paymentButton', org.id)}
                          className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 text-sm rounded">
                          Añadir botón de pago
                        </button>
                        <button 
                          onClick={() => openModal('user', org.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 text-sm rounded">
                          Asignar permisos
                        </button>
                      </>
                    )}
                    {userRoles.isSuperAdmin && (
                      <button 
                        onClick={() => handleDeleteOrganization(org.id)}
                        className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 text-sm rounded">
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de pago */}
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-medium mb-4">Botones de pago</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nombre</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">API Key</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Transacciones</th>
                        {canManageOrganization(org.id) && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 bg-gray-800">
                      {org.paymentButtons.length > 0 ? (
                        org.paymentButtons.map((btn) => (
                          <tr key={btn.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{btn.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              <span className="px-2 py-1 bg-gray-700 rounded text-xs">{btn.apiKey}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{btn.transactions}</td>
                            {canManageOrganization(org.id) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <button className="text-red-400 hover:text-red-300" onClick={() => handleDeletePaymentButton(btn.id)}>Eliminar</button>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={canManageOrganization(org.id) ? 4 : 3} className="px-6 py-4 text-center text-sm text-gray-400">
                            No hay botones de pago para esta organización
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Usuarios - solo visible para administradores */}
              {canManageOrganization(org.id) && (
                <div className="p-6">
                  <h3 className="text-lg font-medium mb-4">Usuarios</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-700">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nombre</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rol</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700 bg-gray-800">
                        {org.users.length > 0 ? (
                          org.users.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{user.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  user.role === 'Super Admin' ? 'bg-purple-900 text-purple-300' :
                                  user.role === 'Administrador' ? 'bg-red-900 text-red-300' :
                                  user.role === 'Contador' ? 'bg-green-900 text-green-300' :
                                  user.role === 'Tesorero' ? 'bg-blue-900 text-blue-300' :
                                  'bg-gray-700 text-gray-300'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {(userRoles.isSuperAdmin || 
                                 (userRoles.isAdminOfOrgs.includes(org.id) && user.role !== 'Super Admin')) && (
                                  <button className="text-red-400 hover:text-red-300" onClick={() => handleDeleteUser(user.id, org.id)}>Eliminar</button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-400">
                              No hay usuarios para esta organización
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}

          {organizations.length === 0 && !isLoading && (
            <div className="bg-gray-800 rounded-lg shadow p-6 text-center">
              <p className="text-gray-400">No hay organizaciones disponibles</p>
              <button 
                onClick={() => openModal('organization')}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded">
                Crear organización
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de formularios - solo mostrar si el usuario tiene permisos */}
      {isModalOpen && (
        (modalType === 'organization' && userRoles.isSuperAdmin) ||
        ((modalType === 'paymentButton' || modalType === 'user') && selectedOrganization && canManageOrganization(selectedOrganization))
      ) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold">
                {modalType === 'organization' ? 'Nueva organización' : 
                 modalType === 'paymentButton' ? 'Nuevo botón de pago' :
                 'Asignar permisos a usuario'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {/* Formulario de organización */}
              {modalType === 'organization' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nombre de la organización</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                  />
                </div>
              )}

              {/* Formulario de botón de pago */}
              {modalType === 'paymentButton' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Nombre del botón de pago</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                    />
                  </div>
                  
                  <div className="mb-4 bg-gray-900 p-3 rounded border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      Para integrar con Clic de Pagos necesitas las credenciales que aparecen en tu panel de comercio:
                    </p>
                    <ul className="text-xs text-gray-500 list-disc pl-5 mb-2">
                      <li>GUID: identificador único de tu comercio</li>
                      <li>Frase: clave secreta para autenticar las solicitudes</li>
                    </ul>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">GUID</label>
                    <input
                      type="text"
                      name="guid"
                      value={formData.guid}
                      onChange={handleInputChange}
                      required
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                      placeholder="9399ca98-e4ce-43fb-a4d6-5d652bd131cf"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Frase</label>
                    <input
                      type="password"
                      name="frase"
                      value={formData.frase}
                      onChange={handleInputChange}
                      required
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                      placeholder="fc5CqR+gjb8PV2x+p+9Uf3PrJIx4UZUhxZAhTgcG0+s="
                    />
                  </div>
                  
                  <div className="mb-4 bg-blue-900/30 p-3 rounded border border-blue-800">
                    <p className="text-sm text-blue-300 mb-2">
                      <strong>Nota:</strong> Las credenciales se guardarán directamente en la base de datos.
                    </p>
                    <p className="text-xs text-blue-400">
                      Asegúrate de que los datos sean correctos. Podrás probar la conexión más adelante.
                    </p>
                  </div>
                </>
              )}

              {/* Formulario de usuario */}
              {modalType === 'user' && (
                <>
                  <div className="mb-4 bg-indigo-900 p-3 rounded border border-indigo-700">
                    <p className="text-sm text-indigo-300 mb-2 font-medium">
                      Asignar permisos a un usuario existente
                    </p>
                    <p className="text-xs text-indigo-400">
                      Solo se pueden asignar permisos a usuarios que ya existen en el sistema. 
                      Si el usuario no existe, debe registrarse primero.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Email del usuario</label>
                    <div className="relative flex">
                      <input
                        type="email"
                        name="userEmail"
                        value={formData.userEmail}
                        onChange={handleEmailChange}
                        required
                        className={`w-full p-2 bg-gray-700 rounded-l border ${
                          userFound ? 'border-green-500' : 
                          userNotFound ? 'border-red-500' : 
                          'border-gray-600'
                        } text-white pr-10`}
                        placeholder="usuario@ejemplo.com"
                      />
                      <button
                        type="button"
                        onClick={() => searchUserByEmail(formData.userEmail)}
                        disabled={!formData.userEmail || searchingUser}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-r border border-indigo-700"
                      >
                        {searchingUser ? "Buscando..." : "Buscar"}
                      </button>
                      {searchingUser && (
                        <div className="absolute right-20 top-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                      {userFound && !searchingUser && (
                        <div className="absolute right-20 top-2 text-green-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {userNotFound && !searchingUser && (
                        <div className="absolute right-20 top-2 text-red-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ingrese el email del usuario para asignarle permisos. El sistema verificará automáticamente si el usuario existe.
                    </p>
                  </div>

                  {userFound && (
                    <div className="mb-4 bg-green-900 bg-opacity-20 p-3 rounded border border-green-700">
                      <p className="text-sm text-green-400">
                        <span className="font-medium">Usuario encontrado:</span> {userName}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Rol</label>
                    <select
                      name="userRole"
                      value={formData.userRole}
                      onChange={handleInputChange}
                      className={`w-full p-2 bg-gray-700 rounded border border-gray-600 text-white ${!userFound ? 'opacity-50' : ''}`}
                      disabled={!userFound}
                    >
                      {userRoles.isSuperAdmin && (
                        <option value="Super Admin">Super Admin</option>
                      )}
                      <option value="Administrador">Administrador</option>
                      <option value="Contador">Contador</option>
                      <option value="Tesorero">Tesorero</option>
                      <option value="Visualizador">Visualizador</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {userRoles.isSuperAdmin 
                        ? "Como Super Admin, puedes asignar cualquier rol, incluyendo cambiar al Administrador de la organización."
                        : "Cada organización solo puede tener un Administrador. Solo un Super Admin puede cambiar al Administrador."}
                    </p>
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const prisma = new PrismaClient();
  const session = await getSession(context);
  
  // Mapeo de nombres de roles para mostrarlos correctamente
  const roleNameMapping: Record<string, string> = {
    'superadmin': 'Super Admin',
    'admin': 'Administrador',
    'operator': 'Operador',
    'viewer': 'Visualizador'
  };

  // Función para convertir nombres de roles al formato esperado
  const mapRoleName = (roleName: string): string => {
    return roleNameMapping[roleName.toLowerCase()] || roleName;
  };
  
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
            organization: true
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

    // Verificar si el usuario es Super Admin en alguna organización
    const isSuperAdmin = user.memberships.some(
      membership => mapRoleName(membership.role.name) === 'Super Admin'
    );

    // Obtener las organizaciones donde el usuario es administrador
    const adminOrgIds = user.memberships
      .filter(membership => mapRoleName(membership.role.name) === 'Administrador')
      .map(membership => membership.organization.id);

    // Obtener las organizaciones que el usuario puede ver (todas si es Super Admin, solo las suyas en caso contrario)
    let organizations;
    if (isSuperAdmin) {
      organizations = await prisma.organization.findMany({
        include: {
          paymentButtons: {
            include: {
              transactions: {
                select: {
                  transactionId: true,
                },
              },
            },
          },
          memberships: {
            include: {
              user: true,
              role: true,
            },
          },
        },
      });
    } else {
      const orgIds = user.memberships.map(membership => membership.organization.id);
      organizations = await prisma.organization.findMany({
        where: {
          id: {
            in: orgIds
          }
        },
        include: {
          paymentButtons: {
            include: {
              transactions: {
                select: {
                  transactionId: true,
                },
              },
            },
          },
          memberships: {
            include: {
              user: true,
              role: true,
            },
          },
        },
      });
    }

    // Transformar los datos para que sean serializables (JSON)
    const serializedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      paymentButtons: org.paymentButtons.map(btn => ({
        id: btn.id,
        name: btn.name,
        apiKey: btn.apiKey,
        transactions: btn.transactions.length,
      })),
      users: org.memberships.map(mem => ({
        id: mem.user.id,
        name: mem.user.name,
        email: mem.user.email,
        role: mapRoleName(mem.role.name),
      })),
    }));

    return {
      props: {
        initialOrganizations: serializedOrganizations,
        userRoles: {
          isSuperAdmin,
          isAdminOfOrgs: adminOrgIds,
        }
      },
    };
  } catch (error) {
    console.error('Error al obtener organizaciones:', error);
    return {
      props: {
        initialOrganizations: [],
        userRoles: {
          isSuperAdmin: false,
          isAdminOfOrgs: []
        }
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

export default withAuth(Organizations); 