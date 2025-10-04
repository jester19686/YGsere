const client = require('prom-client');

/**
 * Централизованная система сбора метрик для мониторинга
 */
class MetricsCollector {
  constructor() {
    // Создаем custom registry для изоляции метрик
    this.register = new client.Registry();
    
    // Устанавливаем custom labels для всех метрик
    this.defaultLabels = {
      app: 'telegram-queue-system',
      version: process.env.npm_package_version || '1.0.0',
      instance: process.env.NODE_APP_INSTANCE || 'main',
    };
    
    this.register.setDefaultLabels(this.defaultLabels);
    
    // Инициализируем метрики
    this.initializeMetrics();
    
    // Собираем default Node.js метрики
    client.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'telegram_bot_',
    });
    
    console.log('📊 MetricsCollector инициализирован');
  }

  /**
   * Инициализация всех кастомных метрик
   */
  initializeMetrics() {
    // === МЕТРИКИ ОЧЕРЕДЕЙ ===
    
    // Количество задач в очередях
    this.queueJobsTotal = new client.Gauge({
      name: 'queue_jobs_total',
      help: 'Total number of jobs in queues by status',
      labelNames: ['queue_name', 'status'], // waiting, active, completed, failed
      registers: [this.register],
    });

    // Время выполнения задач
    this.jobExecutionTime = new client.Histogram({
      name: 'job_execution_duration_seconds',
      help: 'Job execution time in seconds',
      labelNames: ['queue_name', 'job_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // секунды
      registers: [this.register],
    });

    // Счетчик обработанных задач
    this.jobsProcessedTotal = new client.Counter({
      name: 'jobs_processed_total',
      help: 'Total number of jobs processed',
      labelNames: ['queue_name', 'status'], // completed, failed
      registers: [this.register],
    });

    // Активные воркеры
    this.activeWorkers = new client.Gauge({
      name: 'active_workers_total',
      help: 'Number of active workers by queue',
      labelNames: ['queue_name'],
      registers: [this.register],
    });

    // === МЕТРИКИ TELEGRAM БОТА ===
    
    // Входящие сообщения
    this.telegramMessagesTotal = new client.Counter({
      name: 'telegram_messages_total',
      help: 'Total telegram messages received',
      labelNames: ['message_type'], // text, image, command
      registers: [this.register],
    });

    // Время ответа бота
    this.botResponseTime = new client.Histogram({
      name: 'bot_response_duration_seconds',
      help: 'Bot response time in seconds',
      labelNames: ['message_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Активные пользователи
    this.activeUsers = new client.Gauge({
      name: 'telegram_active_users',
      help: 'Number of active users in last 5 minutes',
      registers: [this.register],
      collect() {
        // Это будет обновляться динамически
        const activeUserCount = this.userActivityTracker?.getActiveUserCount() || 0;
        this.set(activeUserCount);
      }
    });

    // === МЕТРИКИ REDIS ===
    
    // Redis соединения
    this.redisConnections = new client.Gauge({
      name: 'redis_connections_total',
      help: 'Number of Redis connections',
      labelNames: ['status'], // connected, connecting, reconnecting, error
      registers: [this.register],
    });

    // Redis операции
    this.redisOperations = new client.Counter({
      name: 'redis_operations_total',
      help: 'Total Redis operations',
      labelNames: ['operation', 'status'], // get/set/del, success/error
      registers: [this.register],
    });

    // === СИСТЕМНЫЕ МЕТРИКИ ===
    
    // HTTP запросы к monitoring API
    this.httpRequests = new client.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // Время обработки HTTP запросов
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    // Errors counter
    this.errorsTotal = new client.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'component'], // validation/network/database, bot/queue/api
      registers: [this.register],
    });
  }

  /**
   * Обновление метрик очередей
   */
  updateQueueMetrics(queueName, stats) {
    const { waiting = 0, active = 0, completed = 0, failed = 0 } = stats;
    
    this.queueJobsTotal.set({ queue_name: queueName, status: 'waiting' }, waiting);
    this.queueJobsTotal.set({ queue_name: queueName, status: 'active' }, active);
    this.queueJobsTotal.set({ queue_name: queueName, status: 'completed' }, completed);
    this.queueJobsTotal.set({ queue_name: queueName, status: 'failed' }, failed);
  }

  /**
   * Регистрация выполнения задачи
   */
  recordJobExecution(queueName, jobType, durationSeconds, status) {
    this.jobExecutionTime.observe(
      { queue_name: queueName, job_type: jobType }, 
      durationSeconds
    );
    
    this.jobsProcessedTotal.inc({
      queue_name: queueName,
      status: status // 'completed' или 'failed'
    });
  }

  /**
   * Обновление количества активных воркеров
   */
  updateActiveWorkers(queueName, count) {
    this.activeWorkers.set({ queue_name: queueName }, count);
  }

  /**
   * Регистрация входящего сообщения Telegram
   */
  recordTelegramMessage(messageType) {
    this.telegramMessagesTotal.inc({ message_type: messageType });
  }

  /**
   * Регистрация времени ответа бота
   */
  recordBotResponse(messageType, durationSeconds) {
    this.botResponseTime.observe({ message_type: messageType }, durationSeconds);
  }

  /**
   * Обновление метрик Redis
   */
  updateRedisMetrics(connectionStatus, operationType, operationStatus) {
    if (connectionStatus) {
      this.redisConnections.set({ status: connectionStatus }, 1);
    }
    
    if (operationType && operationStatus) {
      this.redisOperations.inc({ 
        operation: operationType, 
        status: operationStatus 
      });
    }
  }

  /**
   * Регистрация HTTP запроса
   */
  recordHttpRequest(method, route, statusCode, durationSeconds) {
    this.httpRequests.inc({
      method: method.toUpperCase(),
      route: route,
      status_code: statusCode.toString()
    });
    
    if (durationSeconds !== undefined) {
      this.httpRequestDuration.observe({
        method: method.toUpperCase(),
        route: route
      }, durationSeconds);
    }
  }

  /**
   * Регистрация ошибки
   */
  recordError(errorType, component) {
    this.errorsTotal.inc({
      error_type: errorType,
      component: component
    });
  }

  /**
   * Middleware для автоматического сбора HTTP метрик
   */
  createHttpMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Перехватываем завершение ответа
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const route = this.normalizeRoute(req.route?.path || req.path || 'unknown');
        
        this.recordHttpRequest(
          req.method,
          route,
          res.statusCode,
          duration
        );
      });
      
      next();
    };
  }

  /**
   * Нормализация route для метрик (убираем ID и другие переменные части)
   */
  normalizeRoute(path) {
    return path
      .replace(/\/\d+/g, '/:id')           // /123 -> /:id
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // UUID -> :uuid
      .replace(/\/[a-f0-9]{24}/g, '/:objectid'); // MongoDB ObjectId -> :objectid
  }

  /**
   * Получение всех метрик в формате Prometheus
   */
  async getMetrics() {
    return await this.register.metrics();
  }

  /**
   * Получение метрик в JSON формате
   */
  async getMetricsJSON() {
    return await this.register.getMetricsAsJSON();
  }

  /**
   * Очистка всех метрик
   */
  clear() {
    this.register.clear();
  }

  /**
   * Graceful shutdown - очистка ресурсов
   */
  async shutdown() {
    console.log('📊 Завершение работы MetricsCollector...');
    this.clear();
  }
}

module.exports = MetricsCollector;
