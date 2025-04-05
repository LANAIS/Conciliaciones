/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, FileText, Download } from 'react-feather';

interface HistoryRecord {
  id: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  organization: {
    name: string;
  };
  paymentButton: {
    name: string;
  };
  recordsAffected: number;
  totalAmount: number;
  status: string;
  startDate: string;
  endDate: string;
}

interface PaginationMeta {
  total: number;
  pages: number;
  currentPage: number;
  limit: number;
}

interface ReconciliationHistoryProps {
  organizationId?: string;
  paymentButtonId?: string;
}

const ReconciliationHistory: React.FC<ReconciliationHistoryProps> = ({
  organizationId,
  paymentButtonId
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    pages: 0,
    currentPage: 1,
    limit: 10
  });
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      // Construir URL con parámetros
      let url = `/api/reconciliations/history?page=${page}&limit=${pagination.limit}`;
      
      if (organizationId) {
        url += `&organizationId=${organizationId}`;
      }
      
      if (paymentButtonId) {
        url += `&paymentButtonId=${paymentButtonId}`;
      }
      
      if (dateRange.startDate && dateRange.endDate) {
        url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al cargar historial');
      }
      
      const data = await response.json();
      setHistory(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      alert('No se pudo cargar el historial de conciliaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [organizationId, paymentButtonId]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.pages) {
      fetchHistory(newPage);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'COMPLETED': { color: 'bg-green-100 text-green-800', text: 'Completado' },
      'FAILED': { color: 'bg-red-100 text-red-800', text: 'Fallido' },
      'PARTIAL': { color: 'bg-yellow-100 text-yellow-800', text: 'Parcial' }
    };
    
    const statusInfo = statusMap[status] || { color: 'bg-gray-100 text-gray-800', text: status };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
      <h2 className="text-lg font-semibold mb-4 text-white">Historial de Conciliaciones</h2>
      
      {/* Filtros de fecha */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Fecha Inicio
          </label>
          <input
            type="date"
            className="w-full border border-gray-600 bg-gray-700 rounded-md px-3 py-2 text-white"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Fecha Fin
          </label>
          <input
            type="date"
            className="w-full border border-gray-600 bg-gray-700 rounded-md px-3 py-2 text-white"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
          />
        </div>
        <div className="self-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => fetchHistory(1)}
          >
            Filtrar
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No se encontraron registros de conciliaciones
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Organización
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Botón de pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Registros afectados
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Monto total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {record.user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {record.organization.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {record.paymentButton.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {record.recordsAffected}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {formatCurrency(record.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      <button 
                        className="text-blue-400 hover:text-blue-300 mr-3"
                        title="Ver detalles"
                      >
                        <FileText size={18} />
                      </button>
                      <button 
                        className="text-green-400 hover:text-green-300"
                        title="Exportar"
                      >
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Paginación */}
          <div className="flex items-center justify-between mt-6 text-gray-300">
            <div className="text-sm">
              Mostrando <span className="font-medium">{(pagination.currentPage - 1) * pagination.limit + 1}</span> a{' '}
              <span className="font-medium">
                {Math.min(pagination.currentPage * pagination.limit, pagination.total)}
              </span>{' '}
              de <span className="font-medium">{pagination.total}</span> resultados
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className={`px-3 py-1 rounded ${
                  pagination.currentPage === 1
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 text-blue-400 hover:bg-gray-600 border border-gray-600'
                }`}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.pages}
                className={`px-3 py-1 rounded ${
                  pagination.currentPage === pagination.pages
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 text-blue-400 hover:bg-gray-600 border border-gray-600'
                }`}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReconciliationHistory; 