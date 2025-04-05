import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { 
  Search,
  Notifications,
  Help,
  Settings,
  AccountCircle,
  Brightness4,
  Brightness7,
  ArrowDropDown
} from '@mui/icons-material';

const Navbar = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Notificaciones de ejemplo
  const notifications = [
    {
      id: 1,
      title: 'Nueva transacción',
      message: 'Se ha registrado una nueva transacción por $45,000',
      time: '2 min',
      read: false
    },
    {
      id: 2,
      title: 'Liquidación completada',
      message: 'La liquidación #LIQ123456 ha sido procesada',
      time: '1 hora',
      read: false
    },
    {
      id: 3,
      title: 'Recordatorio',
      message: 'Tienes 5 conciliaciones pendientes por revisar',
      time: '3 horas',
      read: true
    }
  ];

  // Obtener el nombre del usuario o su email
  const getUserDisplayName = () => {
    if (!session || !session.user) return 'Usuario';
    return session.user.name || session.user.email || 'Usuario';
  };

  // Manejar la búsqueda
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log(`Buscando: ${searchQuery}`);
      // Aquí iría la lógica para buscar
    }
  };

  // Alternar el tema
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Aquí iría la lógica para cambiar el tema
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
  };

  return (
    <motion.nav 
      className="bg-gray-800 border-b border-gray-700 px-4 py-2"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        {/* Logo y título en mobile */}
        <div className="flex md:hidden items-center">
          <motion.div 
            className="text-xl font-semibold flex items-center"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              C
            </div>
            <span className="ml-2 text-white">CLIC</span>
          </motion.div>
        </div>

        {/* Búsqueda */}
        <div className="flex-1 max-w-xl mx-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" />
            <button type="submit" className="hidden">Buscar</button>
          </form>
        </div>

        {/* Menu derecho */}
        <div className="flex items-center space-x-3">
          {/* Ícono de notificaciones */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none"
            >
              <Notifications />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            {/* Dropdown de notificaciones */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-medium text-white">Notificaciones</h3>
                  <button className="text-sm text-indigo-400 hover:text-indigo-300">Marcar todas como leídas</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${notification.read ? '' : 'bg-gray-700/30'}`}
                    >
                      <div className="flex justify-between">
                        <h4 className="font-medium text-white">{notification.title}</h4>
                        <span className="text-xs text-gray-400">{notification.time}</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2 text-center border-t border-gray-700">
                  <button className="text-sm text-indigo-400 hover:text-indigo-300">Ver todas</button>
                </div>
              </div>
            )}
          </div>

          {/* Botón de cambio de tema */}
          <button 
            onClick={toggleTheme}
            className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none"
          >
            {isDarkMode ? <Brightness7 /> : <Brightness4 />}
          </button>

          {/* Botón de ayuda */}
          <button className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none">
            <Help />
          </button>

          {/* Configuración - solo visible en pantallas medianas y grandes */}
          <button className="hidden md:block text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none">
            <Settings />
          </button>

          {/* Perfil de usuario */}
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center text-gray-300 hover:text-white p-1 rounded-full hover:bg-gray-700 focus:outline-none"
            >
              <AccountCircle className="mr-1" />
              <span className="mr-1 hidden md:inline">{getUserDisplayName()}</span>
              <ArrowDropDown />
            </button>
            
            {/* Dropdown de usuario */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                {session && session.user && (
                  <div className="p-3 border-b border-gray-700">
                    <p className="text-white font-medium truncate">{session.user.name}</p>
                    <p className="text-sm text-gray-400 truncate">{session.user.email}</p>
                  </div>
                )}
                <div className="py-1">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                    Mi perfil
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                    Configuración
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 border-t border-gray-700"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
