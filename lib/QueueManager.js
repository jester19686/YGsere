const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const OptimizedImageProcessor = require('./OptimizedImageProcessor');

class QueueManager {
  constructor(metricsCollector = null, errorHandler = null) {
    this.metricsCollector = metricsCollector;
    this.errorHandler = errorHandler;
    
    // Оптимизированная конфигурация Redis
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      
      // Connection Pool Settings
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      retryDelayOnTryAgain: 100,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      connectTimeout: 10000,
      lazyConnect: true,
      
      // Connection Pool
      family: 4, // 4 (IPv4) or 6 (IPv6)
      keepAlive: true,
      keepAliveInitialDelay: 0,
      
      // Performance Optimizations
      enableAutoPipelining: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      
      // Memory optimization
      db: 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'tg_queue:',
      
      // Retry strategy
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      
      // Connection events
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    };

    // Создание соединения с Redis
    this.connection = new IORedis(this.redisConfig);
    this.setupRedisEventHandlers();
    
    // Инициализация очередей с оптимизированными настройками
    this.queues = {
      textGeneration: new Queue('text-generation', { 
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: parseInt(process.env.QUEUE_CLEANUP_COMPLETED || '25'),
          removeOnFail: parseInt(process.env.QUEUE_CLEANUP_FAILED || '50'),
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          // Оптимизация для текстовых задач
          priority: 1,
          jobId: null, // Автогенерация ID
        }
      }),
      
      imageProcessing: new Queue('image-processing', { 
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: parseInt(process.env.QUEUE_CLEANUP_COMPLETED || '15'),
          removeOnFail: parseInt(process.env.QUEUE_CLEANUP_FAILED || '30'),
          delay: 0,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          // Изображения требуют больше ресурсов
          priority: 2,
          timeout: 120000, // 2 минуты максимум
        }
      }),
      
      notification: new Queue('notification', { 
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: parseInt(process.env.QUEUE_CLEANUP_COMPLETED || '50'),
          removeOnFail: parseInt(process.env.QUEUE_CLEANUP_FAILED || '100'),
          delay: 0,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          // Уведомления - высокий приоритет
          priority: 0,
          timeout: 10000, // 10 секунд максимум
        }
      })
    };

    // Воркеры будут созданы отдельно
    this.workers = {};
    
    // Инициализация оптимизированного процессора изображений
    this.imageProcessor = new OptimizedImageProcessor({
      maxWorkers: parseInt(process.env.IMAGE_WORKER_THREADS || '2'),
      maxConcurrentTasks: parseInt(process.env.IMAGE_WORKER_CONCURRENCY || '3'),
      taskTimeout: parseInt(process.env.IMAGE_PROCESSING_TIMEOUT || '120000'),
      enableMetrics: true,
      logLevel: process.env.LOG_LEVEL || 'info'
    });
    
    // Обработчики событий
    this.setupEventHandlers();
    
    console.log('QueueManager инициализирован с OptimizedImageProcessor');
  }

  /**
   * Настройка обработчиков событий Redis
   */
  setupRedisEventHandlers() {
    this.connection.on('connect', () => {
      console.log('🔌 Redis подключен');
      this.updateRedisMetrics('connected');
    });

    this.connection.on('ready', () => {
      console.log('✅ Redis готов к работе');
      this.updateRedisMetrics('ready');
    });

    this.connection.on('error', (err) => {
      console.error('❌ Ошибка Redis:', err.message);
      this.updateRedisMetrics('error');
      if (this.errorHandler) {
        this.errorHandler.recordError('redis_connection', 'redis');
      }
    });

    this.connection.on('close', () => {
      console.log('🔌 Redis соединение закрыто');
      this.updateRedisMetrics('disconnected');
    });

    this.connection.on('reconnecting', (time) => {
      console.log(`🔄 Redis переподключение через ${time}ms`);
      this.updateRedisMetrics('reconnecting');
    });

    this.connection.on('end', () => {
      console.log('🔚 Redis соединение завершено');
    });
  }

  /**
   * Обновление метрик Redis
   */
  updateRedisMetrics(status) {
    if (this.metricsCollector) {
      this.metricsCollector.updateRedisMetrics(status);
    }
  }

  /**
   * Настройка обработчиков событий для очередей с метриками
   */
  setupEventHandlers() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      const startTimes = new Map(); // Для отслеживания времени выполнения

      queue.on('waiting', (job) => {
        console.log(`⏳ [${name}] Задача ${job.id} ожидает обработки`);
        if (this.metricsCollector) {
          this.metricsCollector.updateQueueMetrics(name, { waiting: 1 });
        }
      });

      queue.on('active', (job) => {
        console.log(`🚀 [${name}] Задача ${job.id} начата`);
        startTimes.set(job.id, Date.now());
        if (this.metricsCollector) {
          this.metricsCollector.updateQueueMetrics(name, { active: 1 });
        }
      });

      queue.on('completed', (job, result) => {
        const startTime = startTimes.get(job.id);
        const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
        startTimes.delete(job.id);
        
        console.log(`✅ [${name}] Задача ${job.id} завершена за ${duration.toFixed(2)}s`);
        
        if (this.metricsCollector) {
          this.metricsCollector.recordJobExecution(name, job.name, duration, 'completed');
          this.metricsCollector.updateQueueMetrics(name, { completed: 1 });
        }
      });

      queue.on('failed', (job, err) => {
        const startTime = startTimes.get(job.id);
        const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
        startTimes.delete(job.id);
        
        console.error(`❌ [${name}] Задача ${job.id} провалена за ${duration.toFixed(2)}s:`, err.message);
        
        if (this.metricsCollector) {
          this.metricsCollector.recordJobExecution(name, job.name, duration, 'failed');
          this.metricsCollector.updateQueueMetrics(name, { failed: 1 });
        }
        
        if (this.errorHandler) {
          this.errorHandler.recordError('queue_job_failed', 'queue');
        }
      });

      queue.on('error', (err) => {
        console.error(`💥 [${name}] Ошибка очереди:`, err.message);
        if (this.errorHandler) {
          this.errorHandler.recordError('queue_error', 'queue');
        }
      });

      queue.on('stalled', (job) => {
        console.warn(`⚠️ [${name}] Задача ${job.id} зависла`);
        if (this.metricsCollector) {
          this.metricsCollector.recordError('job_stalled', 'queue');
        }
      });
    });
  }

  /**
   * Добавить задачу генерации текста
   */
  async addTextGenerationJob(data) {
    try {
      const job = await this.queues.textGeneration.add('generate-text', data, {
        priority: data.priority || 0,
        delay: data.delay || 0,
      });
      
      console.log(`Добавлена задача генерации текста: ${job.id}`);
      return job;
    } catch (error) {
      console.error('Ошибка добавления задачи генерации текста:', error);
      throw error;
    }
  }

  /**
   * Добавить задачу обработки изображения
   */
  async addImageProcessingJob(data) {
    try {
      // Используем OptimizedImageProcessor для неблокирующей обработки
      const job = await this.queues.imageProcessing.add('process-image', {
        ...data,
        useOptimizedProcessor: true,
        processingStartTime: Date.now()
      }, {
        priority: data.priority || 0,
        delay: data.delay || 0,
      });
      
      console.log(`📸 Добавлена задача обработки изображения: ${job.id} (используется OptimizedImageProcessor)`);
      return job;
    } catch (error) {
      console.error('❌ Ошибка добавления задачи обработки изображения:', error);
      
      if (this.errorHandler) {
        this.errorHandler.recordError('add_image_job_failed', 'queue_manager');
      }
      
      throw error;
    }
  }

  /**
   * Обработка изображения с помощью OptimizedImageProcessor
   */
  async processImageOptimized(imageData, processingOptions = {}) {
    try {
      console.log(`🚀 Начинаю оптимизированную обработку изображения: ${imageData.file_id || imageData.url}`);
      
      // Инициализируем процессор если не инициализирован
      if (!this.imageProcessor.isInitialized) {
        await this.imageProcessor.initialize();
      }
      
      // Определяем тип обработки по опциям
      let result;
      if (processingOptions.processingType === 'quick') {
        result = await this.imageProcessor.quickAnalyze(imageData);
      } else if (processingOptions.processingType === 'ocr') {
        result = await this.imageProcessor.processWithOCR(imageData);
      } else if (processingOptions.processingType === 'ai') {
        result = await this.imageProcessor.aiAnalyze(imageData);
      } else {
        // Полная обработка по умолчанию
        result = await this.imageProcessor.fullProcess(imageData);
      }
      
      console.log(`✅ Оптимизированная обработка изображения завершена за ${result.processingTime?.total || 'N/A'}ms`);
      
      // Обновляем метрики
      if (this.metricsCollector) {
        this.metricsCollector.recordImageProcessing(result.processingTime?.total || 0, true);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Ошибка оптимизированной обработки изображения:`, error.message);
      
      if (this.errorHandler) {
        this.errorHandler.recordError('optimized_image_processing_failed', 'image_processor');
      }
      
      if (this.metricsCollector) {
        this.metricsCollector.recordImageProcessing(0, false);
      }
      
      throw error;
    }
  }

  /**
   * Добавить задачу уведомления
   */
  async addNotificationJob(data) {
    try {
      const job = await this.queues.notification.add('send-notification', data, {
        priority: data.priority || 0,
        delay: data.delay || 0,
      });
      
      console.log(`Добавлена задача уведомления: ${job.id}`);
      return job;
    } catch (error) {
      console.error('Ошибка добавления задачи уведомления:', error);
      throw error;
    }
  }

  /**
   * Получить расширенную статистику очередей
   */
  async getQueueStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(), 
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);
        
        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length,
          // Дополнительные метрики
          isPaused: await queue.isPaused(),
          jobCounts: await queue.getJobCounts(),
        };
        
        // Обновляем метрики если есть коллектор
        if (this.metricsCollector) {
          this.metricsCollector.updateQueueMetrics(name, stats[name]);
        }
        
      } catch (error) {
        console.error(`Ошибка получения статистики для очереди ${name}:`, error);
        stats[name] = { 
          error: error.message,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          total: 0
        };
        
        if (this.errorHandler) {
          this.errorHandler.recordError('queue_stats_error', 'queue');
        }
      }
    }
    
    return stats;
  }

  /**
   * Health check для всей системы очередей
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: {
        status: this.connection.status,
        connected: this.connection.status === 'ready'
      },
      queues: {},
      overall: true
    };

    // Проверка Redis
    try {
      await this.connection.ping();
      health.redis.ping = 'ok';
    } catch (error) {
      health.redis.ping = 'failed';
      health.redis.error = error.message;
      health.overall = false;
    }

    // Проверка очередей
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const stats = await queue.getJobCounts();
        health.queues[name] = {
          status: 'healthy',
          isPaused: await queue.isPaused(),
          jobCounts: stats
        };
      } catch (error) {
        health.queues[name] = {
          status: 'unhealthy',
          error: error.message
        };
        health.overall = false;
      }
    }

    // Проверка OptimizedImageProcessor
    try {
      const imageProcessorHealth = await this.imageProcessor.healthCheck();
      health.imageProcessor = imageProcessorHealth;
      
      if (imageProcessorHealth.status !== 'healthy') {
        health.overall = false;
      }
    } catch (error) {
      health.imageProcessor = {
        status: 'error',
        error: error.message
      };
      health.overall = false;
    }

    health.status = health.overall ? 'healthy' : 'unhealthy';
    return health;
  }

  /**
   * Приостановить очередь
   */
  async pauseQueue(queueName) {
    if (this.queues[queueName]) {
      await this.queues[queueName].pause();
      console.log(`Очередь ${queueName} приостановлена`);
    }
  }

  /**
   * Возобновить очередь
   */
  async resumeQueue(queueName) {
    if (this.queues[queueName]) {
      await this.queues[queueName].resume();
      console.log(`Очередь ${queueName} возобновлена`);
    }
  }

  /**
   * Очистить очередь
   */
  async clearQueue(queueName, state = 'completed') {
    if (this.queues[queueName]) {
      await this.queues[queueName].clean(0, 1000, state);
      console.log(`Очередь ${queueName} очищена (состояние: ${state})`);
    }
  }

  /**
   * Получить очередь по имени
   */
  getQueue(queueName) {
    return this.queues[queueName];
  }

  /**
   * Получить все очереди
   */
  getAllQueues() {
    return this.queues;
  }

  /**
   * Получить метрики OptimizedImageProcessor
   */
  async getImageProcessorMetrics() {
    try {
      const metrics = this.imageProcessor.getMetrics();
      const workerStats = await this.imageProcessor.getWorkerStats();
      
      return {
        ...metrics,
        workerStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Ошибка получения метрик imageProcessor:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Graceful shutdown всех очередей и соединений
   */
  async shutdown() {
    console.log('🛑 Начинаю graceful shutdown QueueManager...');
    
    try {
      // 1. Приостанавливаем принятие новых задач
      console.log('⏸️ Приостановка очередей...');
      for (const [name, queue] of Object.entries(this.queues)) {
        try {
          await queue.pause();
          console.log(`⏸️ Очередь ${name} приостановлена`);
        } catch (error) {
          console.error(`❌ Ошибка приостановки очереди ${name}:`, error);
        }
      }
      
      // 2. Ждем завершения активных задач (максимум 30 секунд)
      console.log('⏳ Ожидание завершения активных задач...');
      const shutdownTimeout = 30000; // 30 секунд
      const startTime = Date.now();
      
      while (Date.now() - startTime < shutdownTimeout) {
        const stats = await this.getQueueStats();
        const hasActiveTasks = Object.values(stats).some(stat => stat.active > 0);
        
        if (!hasActiveTasks) {
          console.log('✅ Все активные задачи завершены');
          break;
        }
        
        const activeTasks = Object.values(stats).reduce((sum, stat) => sum + stat.active, 0);
        console.log(`⏳ Ожидание завершения ${activeTasks} активных задач...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 3. Закрытие OptimizedImageProcessor
      console.log('🖼️ Закрытие OptimizedImageProcessor...');
      try {
        await this.imageProcessor.shutdown();
        console.log('✅ OptimizedImageProcessor закрыт');
      } catch (error) {
        console.error('❌ Ошибка закрытия OptimizedImageProcessor:', error);
      }

      // 4. Закрытие всех воркеров
      console.log('🔧 Закрытие воркеров...');
      for (const [name, worker] of Object.entries(this.workers)) {
        try {
          await worker.close();
          console.log(`✅ Воркер ${name} закрыт`);
        } catch (error) {
          console.error(`❌ Ошибка закрытия воркера ${name}:`, error);
        }
      }

      // 5. Закрытие очередей
      console.log('📋 Закрытие очередей...');
      for (const [name, queue] of Object.entries(this.queues)) {
        try {
          await queue.close();
          console.log(`✅ Очередь ${name} закрыта`);
        } catch (error) {
          console.error(`❌ Ошибка закрытия очереди ${name}:`, error);
        }
      }

      // 6. Закрытие соединения с Redis
      console.log('🔌 Закрытие Redis соединения...');
      try {
        if (this.connection.status !== 'end') {
          await this.connection.quit();
          console.log('✅ Redis соединение закрыто корректно');
        }
      } catch (error) {
        console.error('❌ Ошибка закрытия Redis:', error);
        // Принудительное отключение
        try {
          this.connection.disconnect();
          console.log('⚡ Redis принудительно отключен');
        } catch (disconnectError) {
          console.error('❌ Ошибка принудительного отключения:', disconnectError);
        }
      }
      
      console.log('✅ QueueManager завершен корректно');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка при graceful shutdown:', error);
      
      if (this.errorHandler) {
        this.errorHandler.recordError('shutdown_error', 'queue_manager');
      }
      
      return false;
    }
  }

  /**
   * Алиас для обратной совместимости
   */
  async close() {
    return await this.shutdown();
  }
}

module.exports = QueueManager;
