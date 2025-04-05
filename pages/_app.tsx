import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import Layout from '../components/layout/layout';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Extender AppProps para incluir session
interface CustomAppProps extends AppProps {
  pageProps: {
    session?: any;
    [key: string]: any;
  };
}

// No importamos directamente startCronJobs para evitar que se incluya en el bundle del cliente
// import { startCronJobs } from './api/cron/config';

function MyApp({ Component, pageProps }: CustomAppProps) {
   const router = useRouter();
   
   // Determinar si la página actual es una página de autenticación
   const isAuthPage = router.pathname.startsWith('/auth/');
   
   // Iniciar tareas CRON en producción
   useEffect(() => {
      // Este código solo se ejecutará en el servidor durante la construcción (SSR)
      // y nunca en el cliente
      const initCronJobs = async () => {
         if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
            try {
               // Importación dinámica para que solo se cargue en el servidor
               const { startCronJobs } = await import('./api/cron/config');
               const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
               startCronJobs(baseUrl);
               console.log('CRON jobs initialized in production');
            } catch (error) {
               console.error('Failed to initialize CRON jobs:', error);
            }
         }
      };

      // No necesitamos ejecutar esto en el cliente
      if (typeof window === 'undefined') {
         initCronJobs();
      }
   }, []);

   return (
      <SessionProvider session={pageProps.session}>
         <ThemeProvider defaultTheme="dark" attribute="class">
            {isAuthPage ? (
               // Si es una página de autenticación, no aplicar el Layout
               <Component {...pageProps} />
            ) : (
               // Para las demás páginas, aplicar el Layout
               <Layout>
                  <Component {...pageProps} />
               </Layout>
            )}
         </ThemeProvider>
      </SessionProvider>
   );
}

export default MyApp;
