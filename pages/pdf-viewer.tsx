/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import withAuth from '../components/auth/withAuth';
import dynamic from 'next/dynamic';

// Importamos jsPDF y autoTable de manera dinámica en el useEffect para asegurar que estén en el cliente
// No usamos importaciones directas aquí

interface PDFViewerProps {}

const PDFViewer: React.FC<PDFViewerProps> = () => {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  // Cargar los scripts de jsPDF y autoTable manualmente
  useEffect(() => {
    const loadScripts = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Cargar jsPDF primero
          const jsPDFScript = document.createElement('script');
          jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          jsPDFScript.async = true;
          
          // Crear una promesa para esperar a que se cargue jsPDF
          const jsPDFLoaded = new Promise<void>((resolve) => {
            jsPDFScript.onload = () => resolve();
          });
          
          document.head.appendChild(jsPDFScript);
          await jsPDFLoaded;
          
          // Solo después de que jsPDF se haya cargado, cargar autoTable
          const autoTableScript = document.createElement('script');
          autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
          autoTableScript.async = true;
          
          // Crear una promesa para esperar a que se cargue autoTable
          const autoTableLoaded = new Promise<void>((resolve) => {
            autoTableScript.onload = () => resolve();
          });
          
          document.head.appendChild(autoTableScript);
          await autoTableLoaded;
          
          // Ambos scripts están cargados
          setScriptsLoaded(true);
          console.log('Scripts de PDF cargados correctamente');
        } catch (err) {
          console.error('Error al cargar los scripts de PDF:', err);
          setError('Error al cargar las bibliotecas necesarias para generar el PDF');
        }
      }
    };
    
    loadScripts();
  }, []);

  // Cargar los datos para el PDF
  useEffect(() => {
    if (id) {
      fetchPDFData();
    }
  }, [id]);

  const fetchPDFData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/liquidations/export?id=${id}&format=pdf`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener datos para el PDF');
      }

      setPdfData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos para el PDF');
      console.error('Error al cargar datos para el PDF:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generar el PDF en el cliente
  const generatePDF = async () => {
    if (!pdfData || !scriptsLoaded) {
      if (!scriptsLoaded) {
        setError('Las bibliotecas necesarias para generar el PDF no están cargadas aún. Por favor, espere unos segundos e intente nuevamente.');
      }
      return;
    }

    try {
      setGeneratingPDF(true);

      // Verificar que jsPDF esté disponible globalmente
      if (typeof window !== 'undefined' && window.jspdf) {
        // Usar jsPDF desde el objeto global
        const { jsPDF } = window.jspdf;
        
        console.log('jsPDF disponible:', !!jsPDF);
        
        // Crear nueva instancia de jsPDF
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        console.log('doc creado:', !!doc);
        console.log('autoTable disponible:', !!doc.autoTable);
        
        // Verificar que autoTable esté disponible en el documento
        if (typeof doc.autoTable !== 'function') {
          // Si autoTable no está disponible como método del documento, intentamos aplicarlo manualmente
          if (window.jspdf_autotable) {
            console.log('Aplicando autoTable manualmente');
            window.jspdf_autotable.default(doc);
          } else {
            throw new Error('El plugin autoTable no está disponible. Intente recargar la página.');
          }
        }

        // Añadir título
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle de Liquidación', 105, 20, { align: 'center' });

        // Añadir fecha y hora de generación
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleString('es-AR')}`, 195, 10, { align: 'right' });

        // Añadir información general
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Información General', 14, 35);

        // Crear tabla para la información general
        doc.autoTable({
          startY: 40,
          head: [['Campo', 'Valor']],
          body: [
            ['ID de Liquidación', pdfData.liquidacion.id],
            ['Organización', pdfData.liquidacion.organizacion],
            ['Botón de Pago', pdfData.liquidacion.boton],
            ['Fecha de Liquidación', pdfData.liquidacion.fecha],
            ['Estado', pdfData.liquidacion.estado],
            ['CBU', pdfData.detalles.cbu],
            ['CUIT', pdfData.detalles.cuit]
          ],
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66] }
        });

        // Añadir sección de montos
        const y1 = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Montos', 14, y1);

        // Crear tabla para los montos
        doc.autoTable({
          startY: y1 + 5,
          head: [['Concepto', 'Importe']],
          body: [
            ['Recaudación', `$${pdfData.detalles.recaudacion}`],
            ['Comisión', `$${pdfData.detalles.comision}`],
            ['IVA', `$${pdfData.detalles.iva}`],
            ['Retención', `$${pdfData.detalles.retencion}`],
            ['Neto Liquidación', `$${pdfData.detalles.netoLiquidacion}`]
          ],
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66] }
        });

        // Añadir sección de transacciones
        const y2 = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Transacciones Asociadas', 14, y2);

        // Preparar datos para la tabla de transacciones
        const transactionsTableData = pdfData.transacciones.map((tx: any) => [
          tx.id,
          tx.fecha,
          `$${tx.monto}`,
          tx.estado,
          tx.metodo,
          tx.cuotas
        ]);

        // Crear tabla para las transacciones
        if (transactionsTableData.length > 0) {
          doc.autoTable({
            startY: y2 + 5,
            head: [['ID', 'Fecha', 'Monto', 'Estado', 'Método', 'Cuotas']],
            body: transactionsTableData,
            theme: 'striped',
            headStyles: { fillColor: [66, 66, 66] }
          });
        } else {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.text('No hay transacciones asociadas a esta liquidación.', 14, y2 + 10);
        }

        // Añadir pie de página
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text(
            'Este documento es una representación digital de la liquidación y no constituye un comprobante fiscal.',
            105,
            285,
            { align: 'center' }
          );
          doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
        }

        // Guardar el PDF
        doc.save(`liquidacion_${pdfData.liquidacion.id}.pdf`);
      } else {
        throw new Error('La librería jsPDF no está disponible. Intente recargar la página.');
      }
    } catch (err) {
      console.error('Error al generar el PDF:', err);
      alert(`Error al generar el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      setError(`Error al generar el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Volver a la página de liquidaciones
  const handleBack = () => {
    router.push('/liquidations');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Generador de PDF - Liquidación</title>
        <link rel="icon" href="/favicon.ico" />
        {/* No incluimos los scripts aquí, los cargamos dinámicamente en useEffect */}
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Generador de PDF - Liquidación</h1>
          <button
            onClick={handleBack}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Volver a Liquidaciones
          </button>
        </div>

        {!scriptsLoaded && (
          <div className="bg-blue-900 p-4 rounded mb-6">
            <p className="text-white">Cargando bibliotecas para generar PDF...</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="ml-3">Cargando datos para PDF...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900 p-4 rounded mb-6">
            <p className="text-white">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Recargar página
            </button>
          </div>
        )}

        {!loading && pdfData && (
          <div>
            <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-center">Vista Previa de Datos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2 text-indigo-300">Información General</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium text-gray-300">ID:</span> {pdfData.liquidacion.id}</p>
                    <p><span className="font-medium text-gray-300">Fecha:</span> {pdfData.liquidacion.fecha}</p>
                    <p><span className="font-medium text-gray-300">Estado:</span> {pdfData.liquidacion.estado}</p>
                    <p><span className="font-medium text-gray-300">Organización:</span> {pdfData.liquidacion.organizacion}</p>
                    <p><span className="font-medium text-gray-300">Botón de Pago:</span> {pdfData.liquidacion.boton}</p>
                  </div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2 text-indigo-300">Detalles</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium text-gray-300">CBU:</span> {pdfData.detalles.cbu}</p>
                    <p><span className="font-medium text-gray-300">CUIT:</span> {pdfData.detalles.cuit}</p>
                    <p><span className="font-medium text-gray-300">Recaudación:</span> ${pdfData.detalles.recaudacion}</p>
                    <p><span className="font-medium text-gray-300">Comisión:</span> ${pdfData.detalles.comision}</p>
                    <p><span className="font-medium text-gray-300">Neto Liquidación:</span> ${pdfData.detalles.netoLiquidacion}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold mb-2 text-indigo-300">Transacciones ({pdfData.transacciones.length})</h3>
                {pdfData.transacciones.length > 0 ? (
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
                        {pdfData.transacciones.map((tx: any, index: number) => (
                          <tr key={index} className="border-t border-gray-600">
                            <td className="p-2">{tx.id}</td>
                            <td className="p-2">{tx.fecha}</td>
                            <td className="p-2">${tx.monto}</td>
                            <td className="p-2">{tx.estado}</td>
                            <td className="p-2">{tx.metodo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400">No hay transacciones asociadas a esta liquidación.</p>
                )}
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={generatePDF}
                  disabled={generatingPDF || !scriptsLoaded}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generatingPDF ? (
                    <>
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                      Generando PDF...
                    </>
                  ) : !scriptsLoaded ? (
                    'Esperando bibliotecas...'
                  ) : (
                    'Generar y Descargar PDF'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Declaraciones de tipos globales para jsPDF y autoTable
declare global {
  interface Window {
    jspdf: {
      jsPDF: any;
    };
    jspdf_autotable: {
      default: (doc: any) => void;
    };
  }
}

export default withAuth(PDFViewer); 