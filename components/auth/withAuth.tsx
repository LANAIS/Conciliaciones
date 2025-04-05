import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { NextComponentType, NextPageContext } from 'next';
import { ReactElement } from 'react';

// Componente de carga
const Loading = (): ReactElement => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};

// HOC para proteger rutas
export const withAuth = (Component: NextComponentType<NextPageContext, any, any>) => {
  const Auth = (props: any): ReactElement => {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Si todavía está cargando, mostrar el componente de carga
    if (status === 'loading') {
      return <Loading />;
    }

    // Si no hay sesión, redirigir al login
    if (status === 'unauthenticated') {
      router.push({
        pathname: '/auth/login',
        query: { returnUrl: router.asPath }
      });
      return <Loading />;
    }

    // Si hay sesión, renderizar el componente original
    return <Component {...props} session={session} />;
  };

  // Copiar las propiedades getInitialProps y displayName
  if (Component.getInitialProps) {
    Auth.getInitialProps = Component.getInitialProps;
  }

  Auth.displayName = `withAuth(${Component.displayName || Component.name || 'Component'})`;

  return Auth;
};

export default withAuth; 