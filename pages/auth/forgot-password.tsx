import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Esquema de validación
const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Email inválido' })
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Configurar el formulario con React Hook Form
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  // Manejar el envío del formulario
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Aquí se implementaría la lógica para enviar el correo de recuperación
      // Por ahora, simulamos un proceso exitoso después de 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(`Se ha enviado un correo a ${data.email} con instrucciones para recuperar tu contraseña.`);
      
      // Opcional: redirigir al usuario después de un tiempo
      setTimeout(() => {
        router.push('/auth/login');
      }, 5000);
    } catch (error) {
      setError('Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.');
      console.error('Error al solicitar recuperación de contraseña:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <Head>
        <title>Recuperar Contraseña | Sistema de Conciliación Clic</title>
      </Head>

      {/* Panel izquierdo con logo */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 opacity-90"></div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 animate-fade-in">
          <div className="mb-8">
            <Image 
              src="/dark.png" 
              alt="Logo Sistema Clic" 
              width={280} 
              height={120} 
              className="animate-float"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white text-center mb-4">
            Sistema de Conciliación Clic
          </h1>
          <p className="text-xl text-white/80 text-center max-w-md mx-auto">
            Plataforma integral para la gestión y conciliación de transacciones
          </p>
        </div>
        
        {/* Formas decorativas animadas */}
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-blue-500/20 animate-blob"></div>
        <div className="absolute top-1/4 -right-16 w-72 h-72 rounded-full bg-purple-500/20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/3 left-1/4 w-56 h-56 rounded-full bg-indigo-500/20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Panel derecho con formulario */}
      <div className={`w-full lg:w-1/2 flex items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="w-full max-w-md p-8 sm:p-12 animate-slide-up">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-extrabold mb-2">Recuperar contraseña</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Ingresa tu correo para recibir instrucciones
              </p>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-700'}`}
              aria-label="Cambiar tema"
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>

          {/* Mensaje de éxito */}
          {success && (
            <div className="mb-6 rounded-lg bg-green-100 p-4 text-green-800 animate-fade-in">
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 animate-fade-in">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <div className="mt-1 relative">
                <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`pl-10 appearance-none block w-full px-3 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm ${
                    errors.email 
                      ? 'border-red-300 bg-red-50' 
                      : darkMode 
                        ? 'border-gray-600 bg-gray-700 text-white' 
                        : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="correo@ejemplo.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 animate-shake">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Botón de envío */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 transform hover:translate-y-[-2px] hover:shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </span>
                ) : 'Enviar instrucciones'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Link href="/auth/login">
                <a className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200">
                  ← Volver a inicio de sesión
                </a>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 