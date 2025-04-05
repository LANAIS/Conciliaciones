import React from 'react';

interface ProcessIndicatorProps {
  /** Valor actual del progreso (entre 0 y 100) */
  value: number;
  /** Texto descriptivo del proceso */
  label?: string;
  /** Mostrar o no el porcentaje de progreso */
  showPercentage?: boolean;
  /** Tamaño del indicador ('sm' | 'md' | 'lg') */
  size?: 'sm' | 'md' | 'lg';
  /** Mostrar datos procesados (ej: "50 de 100 registros") */
  processedItems?: {
    current: number;
    total: number;
    label: string;
  };
  /** Tiempo estimado restante (en segundos) */
  estimatedTimeRemaining?: number;
  /** Estilo del indicador */
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Mostrar o no un mensaje de cancelación */
  showCancel?: boolean;
  /** Función para cancelar el proceso */
  onCancel?: () => void;
}

const ProcessIndicator: React.FC<ProcessIndicatorProps> = ({
  value,
  label,
  showPercentage = true,
  size = 'md',
  processedItems,
  estimatedTimeRemaining,
  variant = 'primary',
  showCancel = false,
  onCancel
}) => {
  // Asegurar que el valor esté entre 0 y 100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Mapear variante a colores
  const variantColors = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    danger: 'bg-red-600',
    info: 'bg-cyan-500'
  };
  
  // Mapear tamaño a altura de la barra
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6'
  };
  
  // Formatear tiempo restante
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)} segundos`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)} minutos`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    }
  };
  
  return (
    <div className="w-full">
      {/* Información superior */}
      {(label || showPercentage || processedItems) && (
        <div className="flex justify-between mb-1">
          {label && (
            <div className="text-sm font-medium text-gray-700">{label}</div>
          )}
          
          <div className="flex gap-4">
            {processedItems && (
              <span className="text-sm text-gray-600">
                {processedItems.current} de {processedItems.total} {processedItems.label}
              </span>
            )}
            
            {showPercentage && (
              <span className="text-sm font-semibold text-gray-700">
                {Math.round(clampedValue)}%
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Barra de progreso */}
      <div className={`w-full ${sizeClasses[size]} bg-gray-200 rounded-full overflow-hidden`}>
        <div 
          className={`${variantColors[variant]} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-in-out`} 
          style={{ width: `${clampedValue}%` }}
        ></div>
      </div>
      
      {/* Información inferior */}
      <div className="mt-1 flex justify-between items-center">
        {estimatedTimeRemaining !== undefined && (
          <div className="text-xs text-gray-500">
            Tiempo restante: {formatTimeRemaining(estimatedTimeRemaining)}
          </div>
        )}
        
        {showCancel && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Cancelar proceso
          </button>
        )}
      </div>
      
      {/* Indicador de actividad para valores muy bajos */}
      {clampedValue < 1 && (
        <div className="flex justify-center mt-2">
          <div className="animate-pulse text-xs text-gray-500">
            Iniciando proceso...
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessIndicator; 