import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
  Dashboard,
  Business,
  CompareArrows,
  Payments,
  AccountBalance,
  BarChart,
  Settings,
  Menu,
  ChevronLeft,
  Person,
  CalendarToday
} from '@mui/icons-material';

const SidebarNew = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  // Función para verificar si la ruta actual coincide con el enlace
  const isActive = (path: string) => {
    return router.pathname === path;
  };

  // Función para obtener el nombre o email del usuario
  const getUserDisplayName = () => {
    if (status === "loading") return "Cargando...";
    if (status !== "authenticated" || !session?.user) return "";
    
    return session.user.name || session.user.email || "";
  };

  // Función para obtener las iniciales del usuario para el avatar
  const getUserInitials = () => {
    if (status !== "authenticated" || !session?.user?.name) return "?";
    
    try {
      const name = session.user.name;
      const nameParts = name.split(' ');
      
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      
      return name[0].toUpperCase();
    } catch (error) {
      return "?";
    }
  };

  // Función para obtener el email del usuario
  const getUserEmail = () => {
    if (status !== "authenticated" || !session?.user?.email) return "";
    return session.user.email;
  };

  // Opciones de navegación con iconos
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Dashboard /> },
    { name: 'Organizaciones', path: '/organizations', icon: <Business /> },
    { name: 'Conciliaciones', path: '/reconciliations', icon: <CompareArrows /> },
    { name: 'Calendario', path: '/calendar', icon: <CalendarToday /> },
    { name: 'Transacciones', path: '/transactions', icon: <Payments /> },
    { name: 'Liquidaciones', path: '/liquidations', icon: <AccountBalance /> },
    { name: 'Reportes', path: '/reports', icon: <BarChart /> },
    { name: 'Configuración', path: '/settings', icon: <Settings /> },
  ];

  // Animación para el sidebar
  const sidebarVariants = {
    expanded: { width: '16rem' },
    collapsed: { width: '5rem' }
  };

  // Animación para el texto del item
  const textVariants = {
    expanded: { opacity: 1, display: 'block' },
    collapsed: { opacity: 0, display: 'none' }
  };

  // Animación para el logo
  const logoVariants = {
    expanded: { fontSize: '1.5rem' },
    collapsed: { fontSize: '1rem' }
  };

  return (
    <motion.aside 
      className={`bg-gray-800 border-r border-gray-700 h-screen sticky top-0 transition-all duration-300 overflow-hidden flex flex-col`}
      initial="expanded"
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <motion.div 
          className="flex items-center space-x-2"
          variants={logoVariants}
        >
          <motion.div 
            className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
          >
            C
          </motion.div>
          <motion.h2 
            className="text-xl font-bold text-white whitespace-nowrap"
            variants={textVariants}
          >
            CLIC
          </motion.h2>
        </motion.div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
        >
          {collapsed ? <Menu /> : <ChevronLeft />}
        </button>
      </div>

      {/* Perfil de usuario */}
      <div className="p-4 border-b border-gray-700">
        <motion.div 
          className="flex items-center space-x-3"
          variants={textVariants}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
            status === "authenticated" 
              ? "bg-gradient-to-r from-indigo-500 to-purple-500" 
              : "bg-gray-600"
          }`}>
            {getUserInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{getUserDisplayName()}</p>
            <p className="text-xs text-gray-400 truncate">{getUserEmail()}</p>
          </div>
        </motion.div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link 
                href={item.path}
              >
                <div className={`flex items-center px-2 py-2 rounded-lg transition-colors ${
                  isActive(item.path) 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}>
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <motion.span 
                    className="ml-3 truncate"
                    variants={textVariants}
                  >
                    {item.name}
                  </motion.span>
                  {isActive(item.path) && collapsed && (
                    <div className="absolute right-0 w-1 h-8 bg-indigo-400 rounded-l-full"></div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie del sidebar - versión */}
      <div className="p-4 border-t border-gray-700">
        <motion.div 
          className="text-xs text-gray-500"
          variants={textVariants}
        >
          <p>CLIC Conciliaciones v1.0</p>
          <p className="mt-1">&copy; 2025 CLIC</p>
        </motion.div>
      </div>
    </motion.aside>
  );
};

export default SidebarNew; 