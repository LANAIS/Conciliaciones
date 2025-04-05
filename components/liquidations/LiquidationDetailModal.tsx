import { useState, useEffect } from 'react';

// Interfaces
interface DetailedInfo {
  liquidacionId: string;
  cbu: string;
  cuit: string;
  CantidadTX: number;
  CantidadTXRechazos: number;
  Comision: string;
  DREI: number;
  FechaLiquidacion: string;
  FechaNegocio: string;
  FechaProceso: string;
  IVA: string;
  ImporteRechazos: string;
  IncDecr: string;
  NetoLiquidacion: string;
  NombreSubente: string;
  NumeroSubente: string;
  Recaudacion: string;
  Retencion: string;
  Sellado: string;
  Tipo: string;
  TipoRechazo: string;
  IdLiquidacion: string;
  CodigoProvincia: number;
  PercepcionIIBB: string;
  PercepcionIVA: string;
  RetencionGanancias: string;
  RetencionIVA: string;
  MontoPromocion: string;
  RET_T30_IIBB: string;
  RET_T30_IIGG: string;
  RET_T30_IVA: string;
}

interface Transaction {
  id: string;
  transactionId: string;
  amount: number;
  date: string;
  status: string;
  paymentMethod: string;
  quotas: number;
  currency: string;
}

interface LiquidationWithDetails {
  id: string;
  liquidationId: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  transactions: Transaction[];
  paymentButton: {
    name: string;
    organization: {
      name: string;
    }
  }
}

interface LiquidationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidationId: string | null;
}

const LiquidationDetailModal: React.FC<LiquidationDetailModalProps> = ({
  isOpen,
  onClose,
  liquidationId
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liquidation, setLiquidation] = useState<LiquidationWithDetails | null>(null);
  const [detailedInfo, setDetailedInfo] = useState<DetailedInfo | null>(null);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  
  // Cargar los detalles cuando el modal se abre y hay un ID de liquidación
  useEffect(() => {
    if (isOpen && liquidationId) {
      fetchLiquidationDetails(liquidationId);
    } else {
      // Limpiar el estado cuando el modal se cierra
      setLiquidation(null);
      setDetailedInfo(null);
      setError(null);
    }
  }, [isOpen, liquidationId]);
  
  const fetchLiquidationDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/liquidations/${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener detalles de la liquidación');
      }
      
      setLiquidation(data.liquidation);
      setDetailedInfo(data.detailedInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los detalles');
      console.error('Error al cargar los detalles de la liquidación:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Formatear fecha para visualización
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR');
  };
  
  // Función para exportar la liquidación
  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!liquidationId) return;
    
    setExportLoading(true);
    
    try {
      if (format === 'excel') {
        // Para Excel, descargamos directamente
        window.open(`/api/liquidations/export?id=${liquidationId}&format=${format}`, '_blank');
      } else if (format === 'pdf') {
        // Para PDF, redirigimos a la página de visualización
        window.open(`/pdf-viewer?id=${liquidationId}`, '_blank');
      }
    } catch (err) {
      console.error(`Error al exportar liquidación a ${format}:`, err);
      alert(`Error al exportar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Si no está abierto, no renderizamos nada (IMPORTANTE: mover después de los hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-gray-800 p-6 rounded-lg w-full max-w-4xl mx-auto mt-20 text-white overflow-auto max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Detalles de la Liquidación</h2>
          <button onClick={onClose} className="text-white">&times;</button>
        </div>
        
        {loading && <p className="text-center py-4">Cargando...</p>}
        
        {error && (
          <div className="bg-red-900 p-4 rounded mb-4 text-white">
            <p>{error}</p>
          </div>
        )}
        
        {!loading && !error && liquidation && detailedInfo && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Información General</h3>
              <p>ID: {detailedInfo.liquidacionId}</p>
              <p>Monto Neto: ${detailedInfo.NetoLiquidacion}</p>
              <p>Fecha: {formatDate(detailedInfo.FechaLiquidacion)}</p>
              <p>Estado: {liquidation.status}</p>
              <p>Organización: {liquidation.paymentButton.organization.name}</p>
              <p>Botón de Pago: {liquidation.paymentButton.name}</p>
              <p>CBU: {detailedInfo.cbu}</p>
              <p>CUIT: {detailedInfo.cuit}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Montos</h3>
              <p>Recaudación: ${detailedInfo.Recaudacion}</p>
              <p>Comisión: ${detailedInfo.Comision}</p>
              <p>IVA: ${detailedInfo.IVA}</p>
              <p>Retención: ${detailedInfo.Retencion}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Transacciones Asociadas</h3>
              {liquidation.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left p-2">ID</th>
                        <th className="text-left p-2">Fecha</th>
                        <th className="text-left p-2">Monto</th>
                        <th className="text-left p-2">Estado</th>
                        <th className="text-left p-2">Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liquidation.transactions.map((tx) => (
                        <tr key={tx.id} className="border-t border-gray-700">
                          <td className="p-2">{tx.transactionId}</td>
                          <td className="p-2">{formatDate(tx.date)}</td>
                          <td className="p-2">${tx.amount.toLocaleString('es-AR')}</td>
                          <td className="p-2">{tx.status}</td>
                          <td className="p-2">{tx.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No hay transacciones asociadas a esta liquidación.</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              {/* Botones de exportación */}
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center disabled:opacity-50"
                onClick={() => handleExport('excel')}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : null}
                Exportar Excel
              </button>
              
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center disabled:opacity-50"
                onClick={() => handleExport('pdf')}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : null}
                Exportar PDF
              </button>
              
              {/* Botón para cerrar */}
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiquidationDetailModal; 