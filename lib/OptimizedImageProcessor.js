/**
 * 🚀 ОПТИМИЗИРОВАННЫЙ ПРОЦЕССОР ИЗОБРАЖЕНИЙ
 * 
 * Управляет пулом worker threads для неблокирующей обработки изображений
 * с ограничением concurrency и продвинутым management
 */

const { spawn, Pool, Worker, Thread } = require('threads');
const pLimit = require('p-limit');
const path = require('path');

class OptimizedImageProcessor {
  constructor(options = {}) {
    this.config = {
      // Пул воркеров
      maxWorkers: options.maxWorkers || 2, // Консервативное значение для стабильности
      maxConcurrentTasks: options.maxConcurrentTasks || 3, // Ограничение одновременных задач
      
      // Таймауты
      taskTimeout: options.taskTimeout || 120000, // 2 минуты
      workerIdleTimeout: options.workerIdleTimeout || 300000, // 5 минут
      
      // Retry логика
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      
      // Мониторинг
      enableMetrics: options.enableMetrics !== false,
      logLevel: options.logLevel || 'info'
    };

    // Состояние процессора
    this.isInitialized = false;
    this.workerPool = null;
    this.concurrencyLimiter = pLimit(this.config.maxConcurrentTasks);
    
    // Метрики
    this.metrics = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      activeWorkers: 0,
      queuedTasks: 0,
      lastError: null,
      processingTimes: []
    };
    
    // Активные задачи для отслеживания
    this.activeTasks = new Map();
    
    console.log(`🖼️ OptimizedImageProcessor initialized with ${this.config.maxWorkers} workers`);
  }

  /**
   * Инициализация пула воркеров
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ OptimizedImageProcessor already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing worker pool...');
      
      // Путь к worker файлу
      const workerPath = path.join(__dirname, 'ImageProcessingWorker.js');
      
      // Создание пула воркеров
      this.workerPool = Pool(
        () => spawn(new Worker(workerPath)),
        this.config.maxWorkers
      );

      // Настройка обработки ошибок воркеров
      this.setupWorkerErrorHandling();
      
      this.isInitialized = true;
      console.log(`✅ Worker pool initialized with ${this.config.maxWorkers} workers`);
      
    } catch (error) {
      console.error('❌ Failed to initialize worker pool:', error.message);
      throw new Error(`Worker pool initialization failed: ${error.message}`);
    }
  }

  /**
   * Настройка обработки ошибок воркеров
   */
  setupWorkerErrorHandling() {
    // Для threads.js пул автоматически обрабатывает ошибки воркеров
    // Мы добавляем дополнительное логирование через метрики
  }

  /**
   * Основной метод обработки изображения
   */
  async processImage(imageData, processingOptions = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const taskId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`🔄 Starting image processing task ${taskId}`);
    
    // Добавляем задачу в активные
    this.activeTasks.set(taskId, {
      startTime,
      imageData: imageData.file_id || imageData.url,
      options: processingOptions
    });

    try {
      // Используем concurrency limiter для предотвращения перегрузки
      const result = await this.concurrencyLimiter(async () => {
        return await this.executeWithRetry(taskId, imageData, processingOptions);
      });

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      
      console.log(`✅ Image processing task ${taskId} completed in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime, error);
      
      console.error(`❌ Image processing task ${taskId} failed after ${processingTime}ms:`, error.message);
      throw error;
      
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Выполнение задачи с retry логикой
   */
  async executeWithRetry(taskId, imageData, processingOptions, attempt = 1) {
    try {
      // Подготовка данных для worker thread
      const workerImageData = await this.prepareImageDataForWorker(imageData);
      
      // Выполнение в worker pool с таймаутом
      const result = await Promise.race([
        this.workerPool.queue(async (worker) => {
          this.metrics.activeWorkers++;
          try {
            return await worker.processImage(workerImageData, processingOptions);
          } finally {
            this.metrics.activeWorkers--;
          }
        }),
        this.createTimeoutPromise(taskId)
      ]);

      return {
        ...result,
        taskId,
        attempt,
        processingMetadata: {
          workerProcessed: true,
          concurrentTasks: this.activeTasks.size,
          totalProcessed: this.metrics.totalProcessed
        }
      };
      
    } catch (error) {
      if (attempt < this.config.maxRetries && this.isRetryableError(error)) {
        console.log(`🔄 Retrying task ${taskId}, attempt ${attempt + 1}/${this.config.maxRetries}`);
        await this.delay(this.config.retryDelay * attempt);
        return await this.executeWithRetry(taskId, imageData, processingOptions, attempt + 1);
      }
      
      throw new Error(`Task ${taskId} failed after ${attempt} attempts: ${error.message}`);
    }
  }

  /**
   * Подготовка данных изображения для worker thread
   */
  async prepareImageDataForWorker(imageData) {
    // Если это Telegram file_id, получаем URL через Bot API
    if (imageData.file_id && !imageData.file_url) {
      // Здесь должна быть логика получения file URL через Bot API
      // Для примера используем мок
      console.log(`📡 Getting file URL for ${imageData.file_id}`);
      
      // В реальном коде здесь будет вызов Bot API
      // const fileUrl = await this.telegramBot.getFileUrl(imageData.file_id);
      
      return {
        ...imageData,
        file_url: `https://api.telegram.org/file/bot<TOKEN>/${imageData.file_path || 'mock_path'}`
      };
    }
    
    return imageData;
  }

  /**
   * Создание promise с таймаутом
   */
  createTimeoutPromise(taskId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${this.config.taskTimeout}ms`));
      }, this.config.taskTimeout);
    });
  }

  /**
   * Проверка, можно ли повторить задачу при ошибке
   */
  isRetryableError(error) {
    const retryableErrors = [
      'timeout',
      'network',
      'temporary',
      'ECONNRESET',
      'ENOTFOUND',
      'Worker terminated'
    ];
    
    return retryableErrors.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Обновление метрик
   */
  updateMetrics(success, processingTime, error = null) {
    if (success) {
      this.metrics.totalProcessed++;
    } else {
      this.metrics.totalFailed++;
      this.metrics.lastError = {
        message: error.message,
        time: new Date().toISOString()
      };
    }
    
    // Обновление среднего времени обработки
    this.metrics.processingTimes.push(processingTime);
    
    // Сохраняем только последние 100 измерений
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift();
    }
    
    this.metrics.averageProcessingTime = 
      this.metrics.processingTimes.reduce((a, b) => a + b, 0) / 
      this.metrics.processingTimes.length;
    
    this.metrics.queuedTasks = this.activeTasks.size;
  }

  /**
   * Быстрая обработка изображения с минимальными опциями
   */
  async quickAnalyze(imageData) {
    return await this.processImage(imageData, {
      includeAnalysis: true,
      includeOptimization: false,
      includeThumbnail: false,
      includeTextExtraction: false,
      includeObjectDetection: false
    });
  }

  /**
   * Полная обработка изображения
   */
  async fullProcess(imageData) {
    return await this.processImage(imageData, {
      includeAnalysis: true,
      includeOptimization: true,
      includeThumbnail: true,
      includeTextExtraction: false,
      includeObjectDetection: false
    });
  }

  /**
   * Обработка с извлечением текста
   */
  async processWithOCR(imageData) {
    return await this.processImage(imageData, {
      includeAnalysis: true,
      includeOptimization: false,
      includeThumbnail: true,
      includeTextExtraction: true,
      includeObjectDetection: false
    });
  }

  /**
   * AI анализ изображения
   */
  async aiAnalyze(imageData) {
    return await this.processImage(imageData, {
      includeAnalysis: true,
      includeOptimization: false,
      includeThumbnail: true,
      includeTextExtraction: false,
      includeObjectDetection: true
    });
  }

  /**
   * Получение текущих метрик
   */
  getMetrics() {
    return {
      ...this.metrics,
      config: this.config,
      isInitialized: this.isInitialized,
      activeTasks: Array.from(this.activeTasks.entries()).map(([id, task]) => ({
        id,
        duration: Date.now() - task.startTime,
        imageData: task.imageData
      }))
    };
  }

  /**
   * Получение статуса воркеров
   */
  async getWorkerStats() {
    if (!this.isInitialized || !this.workerPool) {
      return { error: 'Worker pool not initialized' };
    }

    try {
      // Получаем статистику от всех воркеров
      const workerStatsPromises = [];
      
      for (let i = 0; i < this.config.maxWorkers; i++) {
        workerStatsPromises.push(
          this.workerPool.queue(async (worker) => {
            try {
              return await worker.getWorkerStats();
            } catch (error) {
              return { error: error.message };
            }
          })
        );
      }

      const workerStats = await Promise.allSettled(workerStatsPromises);
      
      return {
        totalWorkers: this.config.maxWorkers,
        activeWorkers: this.metrics.activeWorkers,
        workerDetails: workerStats.map((result, index) => ({
          workerId: index,
          status: result.status,
          stats: result.status === 'fulfilled' ? result.value : { error: result.reason.message }
        }))
      };
      
    } catch (error) {
      return { error: `Failed to get worker stats: ${error.message}` };
    }
  }

  /**
   * Проверка здоровья системы
   */
  async healthCheck() {
    const health = {
      status: 'unknown',
      details: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Проверка инициализации
      health.details.initialized = this.isInitialized;
      
      // Проверка воркер пула
      health.details.workerPool = !!this.workerPool;
      
      // Проверка метрик
      health.details.metrics = {
        totalProcessed: this.metrics.totalProcessed,
        totalFailed: this.metrics.totalFailed,
        activeTasks: this.activeTasks.size,
        averageProcessingTime: Math.round(this.metrics.averageProcessingTime)
      };
      
      // Тест обработки (если система готова)
      if (this.isInitialized && this.activeTasks.size < this.config.maxConcurrentTasks) {
        health.details.testProcessing = 'available';
      } else {
        health.details.testProcessing = 'busy';
      }
      
      // Определение общего статуса
      if (this.isInitialized && this.workerPool) {
        if (this.metrics.totalFailed > this.metrics.totalProcessed * 0.5) {
          health.status = 'degraded';
        } else {
          health.status = 'healthy';
        }
      } else {
        health.status = 'unhealthy';
      }
      
    } catch (error) {
      health.status = 'error';
      health.details.error = error.message;
    }

    return health;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down OptimizedImageProcessor...');
    
    try {
      // Ждем завершения активных задач
      if (this.activeTasks.size > 0) {
        console.log(`⏳ Waiting for ${this.activeTasks.size} active tasks to complete...`);
        
        const maxWaitTime = 30000; // 30 секунд
        const startTime = Date.now();
        
        while (this.activeTasks.size > 0 && (Date.now() - startTime) < maxWaitTime) {
          await this.delay(1000);
        }
        
        if (this.activeTasks.size > 0) {
          console.log(`⚠️ Force terminating ${this.activeTasks.size} remaining tasks`);
        }
      }
      
      // Закрываем пул воркеров
      if (this.workerPool) {
        await this.workerPool.terminate();
        console.log('✅ Worker pool terminated');
      }
      
      this.isInitialized = false;
      this.workerPool = null;
      
      console.log('✅ OptimizedImageProcessor shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      throw error;
    }
  }

  /**
   * Вспомогательный метод задержки
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OptimizedImageProcessor;
