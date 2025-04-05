import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'react-feather';

interface TransactionDifference {
  transactionId: string;
  localData: any;
  apiData: any;
  differences: {
    field: string;
    localValue: any;
    apiValue: any;
  }[];
  status: 'PENDING' | 'MATCHED' | 'LOCAL_ONLY' | 'API_ONLY';
}

interface DifferencesViewProps {
  differences: TransactionDifference[];
  onUpdateSelected: (selectedIds: string[]) => void;
}

const DifferencesView: React.FC<DifferencesViewProps> = ({
  differences,
  onUpdateSelected
}) => {
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [selectedTransactions, setSelectedTransactions] = useState<{ [key: string]: boolean }>({});
  const [sortField, setSortField] = useState<string>('transactionId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Cambiar expansión de una fila
  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Seleccionar/deseleccionar una transacción
  const toggleTransaction = (id: string) => {
    const newSelected = { ...selectedTransactions, [id]: !selectedTransactions[id] };
    setSelectedTransactions(newSelected);
    
    // Llamar al callback con los IDs seleccionados
    const selectedIds = Object.entries(newSelected)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
    
    onUpdateSelected(selectedIds);
  };
  
  // Seleccionar/deseleccionar todas las transacciones
  const toggleSelectAll = () => {
    const areAllSelected = differences.every(diff => selectedTransactions[diff.transactionId]);
    
    const newSelected: { [key: string]: boolean } = {};
    differences.forEach(diff => {
      newSelected[diff.transactionId] = !areAllSelected;
    });
    
    setSelectedTransactions(newSelected);
    
    // Llamar al callback con los IDs seleccionados
    const selectedIds = !areAllSelected ? differences.map(diff => diff.transactionId) : [];
    onUpdateSelected(selectedIds);
  };
  
  // Cambiar ordenación
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Obtener icono de ordenación
  const getSortIcon = (field: string) => {
    if (field !== sortField) return null;
    
    return sortDirection === 'asc' ? (
      <ChevronUp size={16} />
    ) : (
      <ChevronDown size={16} />
    );
  };
  
  // Formatear valor para mostrar en tabla
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    
    if (typeof value === 'number') {
      // Formatear como moneda si parece ser un monto
      if (value > 100 || value % 1 !== 0) {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN'
        }).format(value);
      }
    }
    
    return String(value);
  };
  
  // Ordenar diferencias
  const sortedDifferences = [...differences].sort((a, b) => {
    let aValue = sortField === 'transactionId' ? a.transactionId : 
                 sortField === 'status' ? a.status : 
                 a.differences.length;
    
    let bValue = sortField === 'transactionId' ? b.transactionId : 
                 sortField === 'status' ? b.status : 
                 b.differences.length;
                 
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    } else {
      if (sortDirection === 'asc') {
        return Number(aValue) - Number(bValue);
      } else {
        return Number(bValue) - Number(aValue);
      }
    }
  });
  
  // Filtrar por estado
  const filteredDifferences = filterStatus 
    ? sortedDifferences.filter(diff => diff.status === filterStatus)
    : sortedDifferences;
  
  // Calcular estadísticas de diferencias
  const stats = {
    total: differences.length,
    pending: differences.filter(d => d.status === 'PENDING').length,
    matched: differences.filter(d => d.status === 'MATCHED').length,
    localOnly: differences.filter(d => d.status === 'LOCAL_ONLY').length,
    apiOnly: differences.filter(d => d.status === 'API_ONLY').length
  };
  
  // Traducir estado a español
  const getStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'Pendiente',
      'MATCHED': 'Conciliado',
      'LOCAL_ONLY': 'Solo Local',
      'API_ONLY': 'Solo API'
    };
    
    return statusMap[status] || status;
  };
  
  // Obtener color de badge para el estado
  const getStatusBadgeClass = (status: string): string => {
    const statusColorMap: { [key: string]: string } = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'MATCHED': 'bg-green-100 text-green-800',
      'LOCAL_ONLY': 'bg-purple-100 text-purple-800',
      'API_ONLY': 'bg-blue-100 text-blue-800'
    };
    
    return statusColorMap[status] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
      <h2 className="text-lg font-semibold mb-4 text-white">Vista Detallada de Diferencias</h2>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
        <div className="bg-yellow-900 bg-opacity-30 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-yellow-400">{stats.pending}</div>
          <div className="text-xs text-gray-400">Pendientes</div>
        </div>
        <div className="bg-green-900 bg-opacity-30 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-green-400">{stats.matched}</div>
          <div className="text-xs text-gray-400">Conciliados</div>
        </div>
        <div className="bg-purple-900 bg-opacity-30 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-purple-400">{stats.localOnly}</div>
          <div className="text-xs text-gray-400">Solo Local</div>
        </div>
        <div className="bg-blue-900 bg-opacity-30 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-blue-400">{stats.apiOnly}</div>
          <div className="text-xs text-gray-400">Solo API</div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Filtrar por estado</label>
          <select
            className="border border-gray-600 bg-gray-700 rounded-md px-3 py-2 text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="MATCHED">Conciliados</option>
            <option value="LOCAL_ONLY">Solo Local</option>
            <option value="API_ONLY">Solo API</option>
          </select>
        </div>
        
        {/* Botones de acción */}
        <div className="ml-auto flex items-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => {
              const selectedIds = Object.entries(selectedTransactions)
                .filter(([_, selected]) => selected)
                .map(([id]) => id);
                
              if (selectedIds.length === 0) {
                alert('Seleccione al menos una transacción para actualizar');
                return;
              }
              
              // Esta acción debería integrarse con el componente padre
              // que manejaría la actualización real de las transacciones
              onUpdateSelected(selectedIds);
            }}
          >
            Actualizar Seleccionados
          </button>
        </div>
      </div>
      
      {/* Tabla de diferencias */}
      {filteredDifferences.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          No se encontraron diferencias con los criterios seleccionados
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={differences.length > 0 && differences.every(diff => selectedTransactions[diff.transactionId])}
                    onChange={toggleSelectAll}
                    className="rounded bg-gray-700 border-gray-500"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('transactionId')}
                >
                  <div className="flex items-center">
                    ID Transacción
                    {getSortIcon('transactionId')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('differences')}
                >
                  <div className="flex items-center">
                    Diferencias
                    {getSortIcon('differences')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Estado
                    {getSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredDifferences.map((diff) => (
                <React.Fragment key={diff.transactionId}>
                  <tr className="hover:bg-gray-750">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={!!selectedTransactions[diff.transactionId]}
                        onChange={() => toggleTransaction(diff.transactionId)}
                        className="rounded bg-gray-700 border-gray-500"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-200">
                      {diff.transactionId}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-200">
                      {diff.differences.length}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(diff.status)}`}>
                        {getStatusText(diff.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-200">
                      <button
                        className="text-blue-400 hover:text-blue-300"
                        onClick={() => toggleRowExpanded(diff.transactionId)}
                      >
                        {expandedRows[diff.transactionId] ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Fila expandida con detalles */}
                  {expandedRows[diff.transactionId] && (
                    <tr className="bg-gray-750">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-800 p-3 rounded border border-gray-700">
                            <h4 className="font-medium text-sm mb-2 text-blue-400">Datos Locales</h4>
                            <pre className="text-xs whitespace-pre-wrap text-gray-300">
                              {JSON.stringify(diff.localData, null, 2)}
                            </pre>
                          </div>
                          <div className="bg-gray-800 p-3 rounded border border-gray-700">
                            <h4 className="font-medium text-sm mb-2 text-green-400">Datos API</h4>
                            <pre className="text-xs whitespace-pre-wrap text-gray-300">
                              {JSON.stringify(diff.apiData, null, 2)}
                            </pre>
                          </div>
                        </div>
                        
                        {diff.differences.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-medium text-sm mb-2 text-gray-300">Diferencias Específicas</h4>
                            <table className="min-w-full divide-y divide-gray-700">
                              <thead className="bg-gray-700">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300">Campo</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300">Valor Local</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300">Valor API</th>
                                </tr>
                              </thead>
                              <tbody className="bg-gray-750 divide-y divide-gray-700">
                                {diff.differences.map((difference, index) => (
                                  <tr key={index} className="hover:bg-gray-700">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-300">
                                      {difference.field}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-blue-400">
                                      {formatValue(difference.localValue)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-green-400">
                                      {formatValue(difference.apiValue)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DifferencesView; 