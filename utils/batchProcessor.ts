/**
 * Utilidad para procesamiento por lotes (batching) de grandes volúmenes de datos.
 * Implementa la capacidad de procesar arrays de datos en lotes, con progreso y la capacidad de cancelar.
 */

type ProgressCallback = (progress: {
  totalItems: number;
  processedItems: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  batchResults?: any[];
}) => void;

interface BatchProcessorOptions<T, R> {
  /** Tamaño del lote */
  batchSize: number;
  /** Función para procesar cada lote de datos */
  processBatchFn: (items: T[], batchIndex: number) => Promise<R[]>;
  /** Función de callback para actualizar el progreso */
  onProgress?: ProgressCallback;
  /** Tiempo de pausa entre lotes (ms) para evitar bloquear la UI */
  pauseBetweenBatches?: number;
  /** Habilitar estimación de tiempo restante */
  enableTimeEstimation?: boolean;
}

class BatchProcessor<T, R> {
  private isCancelled: boolean = false;
  private processingPromise: Promise<R[]> | null = null;
  private startTime: number = 0;
  private processingTimes: number[] = [];
  
  /**
   * Crea una nueva instancia del procesador por lotes
   * @param options Opciones de configuración
   */
  constructor(private options: BatchProcessorOptions<T, R>) {
    this.options.pauseBetweenBatches ??= 0;
    this.options.enableTimeEstimation ??= true;
  }
  
  /**
   * Procesa un array de datos por lotes
   * @param items Array de elementos a procesar
   * @returns Promise con los resultados combinados
   */
  async processItems(items: T[]): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }
    
    const { batchSize, onProgress, pauseBetweenBatches } = this.options;
    
    // Reiniciar el estado
    this.isCancelled = false;
    this.startTime = Date.now();
    this.processingTimes = [];
    
    // Calcular número de lotes
    const totalBatches = Math.ceil(items.length / batchSize);
    
    // Array para almacenar resultados
    const results: R[] = [];
    
    // Procesar lotes
    this.processingPromise = (async () => {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Verificar si se ha cancelado el proceso
        if (this.isCancelled) {
          return results;
        }
        
        // Obtener elementos del lote actual
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, items.length);
        const batchItems = items.slice(start, end);
        
        // Registrar tiempo de inicio del lote
        const batchStartTime = Date.now();
        
        // Procesar el lote
        const batchResults = await this.options.processBatchFn(batchItems, batchIndex);
        
        // Añadir resultados
        results.push(...batchResults);
        
        // Calcular tiempo de procesamiento del lote
        const batchProcessingTime = Date.now() - batchStartTime;
        this.processingTimes.push(batchProcessingTime);
        
        // Calcular progreso
        const processedItems = end;
        const totalItems = items.length;
        const percentComplete = (processedItems / totalItems) * 100;
        
        // Estimar tiempo restante
        const estimatedTimeRemaining = this.estimateTimeRemaining(
          totalBatches, 
          batchIndex + 1, 
          totalItems, 
          processedItems
        );
        
        // Llamar al callback de progreso si existe
        if (onProgress) {
          onProgress({
            totalItems,
            processedItems,
            currentBatch: batchIndex + 1,
            totalBatches,
            percentComplete,
            estimatedTimeRemaining,
            batchResults
          });
        }
        
        // Pausa entre lotes para evitar bloquear la UI
        if (pauseBetweenBatches && pauseBetweenBatches > 0 && batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
        }
      }
      
      return results;
    })();
    
    return this.processingPromise;
  }
  
  /**
   * Cancela el procesamiento por lotes en curso
   */
  cancel(): void {
    this.isCancelled = true;
  }
  
  /**
   * Estima el tiempo restante para completar el procesamiento
   */
  private estimateTimeRemaining(
    totalBatches: number, 
    completedBatches: number,
    totalItems: number,
    processedItems: number
  ): number | undefined {
    if (!this.options.enableTimeEstimation || completedBatches < 2) {
      return undefined;
    }
    
    // Calcular tiempo promedio por lote basado en lotes procesados
    const avgBatchTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    
    // Estimar tiempo restante basado en lotes pendientes
    const remainingBatches = totalBatches - completedBatches;
    const estimatedRemainingTime = (avgBatchTime * remainingBatches) / 1000;
    
    return estimatedRemainingTime;
  }
  
  /**
   * Verifica si el procesamiento ha sido cancelado
   */
  isCancelledStatus(): boolean {
    return this.isCancelled;
  }
}

/**
 * Función auxiliar para crear un procesador por lotes con opciones
 * @param options Opciones de configuración
 * @returns Nueva instancia de BatchProcessor
 */
export function createBatchProcessor<T, R>(options: BatchProcessorOptions<T, R>): BatchProcessor<T, R> {
  return new BatchProcessor<T, R>(options);
}

export default BatchProcessor; 