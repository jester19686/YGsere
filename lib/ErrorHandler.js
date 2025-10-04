/**
 * Централизованная система обработки ошибок по Node.js Best Practices
 */

/**
 * Класс для операционных ошибок (ожидаемые ошибки)
 */
class AppError extends Error {
  constructor(message, isOperational = true, httpCode = 500, description = null) {
    super(message);
    
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    this.httpCode = httpCode;
    this.description = description;
    this.timestamp = new Date().toISOString();
    
    // Сохраняем правильный stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Специализированные классы ошибок
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, true, 400, 'Validation failed');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, true, 404, 'Resource not found');
  }
}

class TimeoutError extends AppError {
  constructor(operation, timeout) {
    super(`${operation} timed out after ${timeout}ms`, true, 408, 'Operation timeout');
    this.operation = operation;
    this.timeout = timeout;
  }
}

class RateLimitError extends AppError {
  constructor(limit, window) {
    super(`Rate limit exceeded: ${limit} requests per ${window}ms`, true, 429, 'Rate limit exceeded');
    this.limit = limit;
    this.window = window;
  }
}

class RedisConnectionError extends AppError {
  constructor(message) {
    super(`Redis connection error: ${message}`, true, 503, 'Service temporarily unavailable');
  }
}

class QueueError extends AppError {
  constructor(queueName, operation, originalError) {
    super(`Queue ${queueName} ${operation} failed: ${originalError.message}`, true, 500, 'Queue operation failed');
    this.queueName = queueName;
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Основной обработчик ошибок
 */
class ErrorHandler {
  constructor(metricsCollector = null, notificationService = null) {
    this.metricsCollector = metricsCollector;
    this.notificationService = notificationService;
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Настройка глобальных обработчиков
    this.setupGlobalHandlers();
    
    console.log('🛡️ ErrorHandler инициализирован');
  }

  /**
   * Настройка глобальных обработчиков процесса
   */
  setupGlobalHandlers() {
    // Обработка uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      this.handleError(error, null, true);
      
      if (!this.isTrustedError(error)) {
        console.error('🚨 Untrusted error detected, shutting down...');
        process.exit(1);
      }
    });

    // Обработка unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
      
      // Конвертируем в Error если это не Error
      const error = reason instanceof Error ? reason : new Error(reason);
      this.handleError(error, null, true);
      
      if (!this.isTrustedError(error)) {
        console.error('🚨 Untrusted promise rejection, shutting down...');
        process.exit(1);
      }
    });

    // Graceful shutdown при SIGTERM/SIGINT
    process.on('SIGTERM', () => {
      console.log('📡 SIGTERM received, starting graceful shutdown...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('📡 SIGINT received, starting graceful shutdown...');
      this.shutdown();
    });
  }

  /**
   * Основной метод обработки ошибок
   */
  async handleError(error, responseStream = null, isCritical = false) {
    try {
      // 1. Логирование ошибки
      await this.logError(error, isCritical);
      
      // 2. Сбор метрик
      await this.recordErrorMetrics(error);
      
      // 3. Уведомления при критических ошибках
      if (isCritical || this.isCriticalError(error)) {
        await this.sendCriticalAlert(error);
      }
      
      // 4. Отправка ответа если есть response stream
      if (responseStream && !responseStream.headersSent) {
        await this.sendErrorResponse(error, responseStream);
      }
      
      // 5. Определение дальнейших действий
      return this.isTrustedError(error);
      
    } catch (handlingError) {
      console.error('💥 Error in error handler:', handlingError);
      // Fallback - базовое логирование
      console.error('Original error:', error);
    }
  }

  /**
   * Детальное логирование ошибок
   */
  async logError(error, isCritical = false) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      level: isCritical ? 'CRITICAL' : 'ERROR',
      message: error.message,
      name: error.name,
      stack: this.isDevelopment ? error.stack : undefined,
      isOperational: error.isOperational || false,
      httpCode: error.httpCode || 500,
      description: error.description || null,
      // Дополнительные поля для специализированных ошибок
      queueName: error.queueName || null,
      operation: error.operation || null,
      userId: error.userId || null,
      requestId: error.requestId || null,
      // Системная информация
      memory: process.memoryUsage(),
      pid: process.pid,
      uptime: process.uptime(),
    };

    // Цветное логирование в development
    if (this.isDevelopment) {
      console.error('\n🔴 ===== ERROR DETAILS =====');
      console.error(`⏰ Time: ${errorInfo.timestamp}`);
      console.error(`📛 Level: ${errorInfo.level}`);
      console.error(`📝 Message: ${errorInfo.message}`);
      console.error(`🏷️ Name: ${errorInfo.name}`);
      console.error(`🔧 Operational: ${errorInfo.isOperational}`);
      console.error(`🌐 HTTP Code: ${errorInfo.httpCode}`);
      if (errorInfo.description) {
        console.error(`📋 Description: ${errorInfo.description}`);
      }
      if (errorInfo.stack) {
        console.error(`📚 Stack:\n${errorInfo.stack}`);
      }
      console.error('============================\n');
    } else {
      // Structured logging для production
      console.error(JSON.stringify(errorInfo));
    }

    // TODO: Отправка в внешние logging сервисы (ELK, Winston, etc.)
    // await this.sendToExternalLogger(errorInfo);
  }

  /**
   * Запись метрик ошибок
   */
  async recordErrorMetrics(error) {
    if (!this.metricsCollector) return;

    try {
      const errorType = this.classifyError(error);
      const component = this.identifyComponent(error);
      
      this.metricsCollector.recordError(errorType, component);
    } catch (metricsError) {
      console.error('Error recording metrics:', metricsError);
    }
  }

  /**
   * Классификация типа ошибки для метрик
   */
  classifyError(error) {
    if (error instanceof ValidationError) return 'validation';
    if (error instanceof NotFoundError) return 'not_found';
    if (error instanceof TimeoutError) return 'timeout';
    if (error instanceof RateLimitError) return 'rate_limit';
    if (error instanceof RedisConnectionError) return 'redis_connection';
    if (error instanceof QueueError) return 'queue_operation';
    if (error.code === 'ECONNREFUSED') return 'connection_refused';
    if (error.code === 'ENOTFOUND') return 'dns_resolution';
    if (error.name === 'SyntaxError') return 'syntax';
    if (error.name === 'TypeError') return 'type';
    if (error.name === 'ReferenceError') return 'reference';
    return 'unknown';
  }

  /**
   * Определение компонента где произошла ошибка
   */
  identifyComponent(error) {
    if (error.queueName) return 'queue';
    if (error.stack?.includes('Redis') || error instanceof RedisConnectionError) return 'redis';
    if (error.stack?.includes('telegram') || error.stack?.includes('bot')) return 'telegram_bot';
    if (error.stack?.includes('express') || error.stack?.includes('http')) return 'api';
    if (error.stack?.includes('worker')) return 'worker';
    return 'unknown';
  }

  /**
   * Отправка критических уведомлений
   */
  async sendCriticalAlert(error) {
    if (!this.notificationService) return;

    try {
      const alert = {
        level: 'CRITICAL',
        title: `🚨 Critical Error in ${process.env.APP_NAME || 'Telegram Bot'}`,
        message: error.message,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        server: process.env.SERVER_NAME || 'unknown',
        errorType: error.name,
        isOperational: error.isOperational,
      };

      await this.notificationService.sendAlert(alert);
    } catch (notificationError) {
      console.error('Error sending critical alert:', notificationError);
    }
  }

  /**
   * Отправка HTTP ответа с ошибкой
   */
  async sendErrorResponse(error, res) {
    try {
      const statusCode = error.httpCode || 500;
      const isOperational = this.isTrustedError(error);
      
      const response = {
        success: false,
        error: {
          message: isOperational ? error.message : 'Internal server error',
          code: error.name || 'ERROR',
          timestamp: new Date().toISOString(),
        }
      };

      // Добавляем дополнительную информацию в development
      if (this.isDevelopment && isOperational) {
        response.error.description = error.description;
        response.error.details = error.details;
        response.error.stack = error.stack;
      }

      res.status(statusCode).json(response);
    } catch (responseError) {
      console.error('Error sending error response:', responseError);
      // Fallback
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Internal server error' } });
      }
    }
  }

  /**
   * Проверка является ли ошибка доверенной (операционной)
   */
  isTrustedError(error) {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    
    // Некоторые встроенные ошибки тоже можно считать операционными
    const trustedCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'];
    return trustedCodes.includes(error.code);
  }

  /**
   * Проверка является ли ошибка критической
   */
  isCriticalError(error) {
    if (error instanceof AppError) {
      return error.httpCode >= 500;
    }
    
    const criticalNames = ['ReferenceError', 'SyntaxError'];
    const criticalCodes = ['EMFILE', 'ENOMEM'];
    
    return criticalNames.includes(error.name) || criticalCodes.includes(error.code);
  }

  /**
   * Express middleware для обработки ошибок
   */
  createExpressMiddleware() {
    return async (err, req, res, next) => {
      // Добавляем контекст запроса к ошибке
      err.requestId = req.id || req.headers['x-request-id'];
      err.userId = req.user?.id;
      err.url = req.url;
      err.method = req.method;
      err.ip = req.ip;
      
      await this.handleError(err, res);
    };
  }

  /**
   * Wrapper для async функций для автоматической обработки ошибок
   */
  catchAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛡️ Завершение работы ErrorHandler...');
    
    try {
      // Даем время для завершения текущих операций
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ ErrorHandler завершен корректно');
      process.exit(0);
    } catch (error) {
      console.error('❌ Ошибка при завершении ErrorHandler:', error);
      process.exit(1);
    }
  }
}

// Экспорт классов
module.exports = {
  ErrorHandler,
  AppError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  RateLimitError,
  RedisConnectionError,
  QueueError,
};
