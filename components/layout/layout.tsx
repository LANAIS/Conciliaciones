import React, { ReactNode } from 'react';
import NavbarNew from '../navbar/NavbarNew';
import SidebarNew from '../sidebar/SidebarNew';
import { useTheme } from 'next-themes';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    // Forzar tema oscuro siempre
    setTheme('dark');
  }, [setTheme]);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <SidebarNew />
      <div className="flex flex-col flex-1 overflow-hidden">
        <NavbarNew />
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
