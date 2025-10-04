/**
 * 🚀 ОПТИМИЗИРОВАННЫЙ WORKER ДЛЯ ОБРАБОТКИ ИЗОБРАЖЕНИЙ
 * 
 * Использует OptimizedImageProcessor с worker threads для неблокирующей
 * обработки изображений
 */

const { Worker } = require('bullmq');
const IORedis = require('ioredis');

class OptimizedImageProcessingWorker {
  constructor(botInstance, queueManager) {
    this.bot = botInstance;
    this.queueManager = queueManager;
    
    // Конфигурация Redis
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxLoadingTimeout: 2000,
    };

    this.connection = new IORedis(this.redisConfig);

    // Создание оптимизированного воркера
    this.worker = new Worker(
      'image-processing',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: parseInt(process.env.IMAGE_WORKER_CONCURRENCY || '2'), // Консервативное значение
        removeOnComplete: parseInt(process.env.QUEUE_CLEANUP_COMPLETED || '15'),
        removeOnFail: parseInt(process.env.QUEUE_CLEANUP_FAILED || '30'),
        
        // Настройки для стабильности
        stalledInterval: 30 * 1000, // 30 секунд
        maxStalledCount: 1, // Один retry для зависших задач
      }
    );

    this.setupEventHandlers();
    console.log(`🚀 OptimizedImageProcessingWorker инициализирован с concurrency: ${this.worker.concurrency}`);
  }

  /**
   * Основная функция обработки задач изображений
   */
  async processJob(job) {
    const startTime = Date.now();
    const { 
      userId, 
      chatId, 
      photoData, 
      imageData, 
      processingType = 'quick', 
      options = {},
      testRequest = false,
      processingMessage
    } = job.data;
    
    console.log(`🔄 Начинаю обработку изображения ${job.id} (тип: ${processingType})`);
    
    try {
      // Проверяем, что OptimizedImageProcessor доступен
      if (!this.queueManager.imageProcessor) {
        throw new Error('OptimizedImageProcessor не доступен');
      }
      
      // Обновляем сообщение о начале обработки
      if (!testRequest && this.bot && processingMessage) {
        try {
          await this.bot.telegram.editMessageText(
            processingMessage.chat_id,
            processingMessage.message_id,
            null,
            `🔄 Обрабатываю изображение...\n⚡ Тип обработки: ${processingType}\n⏱️ Задача: ${job.id}`
          );
        } catch (editError) {
          console.log('ℹ️ Не удалось обновить сообщение о начале обработки:', editError.message);
        }
      }
      
      // Подготавливаем опции обработки
      const processingOptions = this.getProcessingOptions(processingType, options);
      
      // Обрабатываем изображение с помощью OptimizedImageProcessor
      const processingResult = await this.queueManager.processImageOptimized(imageData, processingOptions);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Изображение ${job.id} обработано за ${processingTime}ms`);
      
      // Отправляем результат пользователю (если не тестовый запрос)
      if (!testRequest && this.bot) {
        await this.sendResultToUser(chatId, processingResult, processingType, processingMessage);
      }
      
      // Возвращаем результат
      return {
        success: true,
        processingTime,
        processingType,
        result: processingResult,
        jobId: job.id,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Ошибка обработки изображения ${job.id}:`, error.message);
      
      // Отправляем сообщение об ошибке пользователю
      if (!testRequest && this.bot) {
        await this.sendErrorToUser(chatId, error, processingMessage);
      }
      
      // Возвращаем информацию об ошибке
      return {
        success: false,
        error: error.message,
        processingTime,
        processingType,
        jobId: job.id,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Получение опций обработки в зависимости от типа
   */
  getProcessingOptions(processingType, customOptions = {}) {
    const baseOptions = {
      includeAnalysis: true,
      includeOptimization: false,
      includeThumbnail: false,
      includeTextExtraction: false,
      includeObjectDetection: false,
      ...customOptions
    };

    switch (processingType) {
      case 'quick':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: false,
          includeThumbnail: false
        };

      case 'full':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: true,
          includeThumbnail: true
        };

      case 'analyze':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: false,
          includeThumbnail: true
        };

      case 'optimize':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: true,
          includeThumbnail: false
        };

      case 'ocr':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: false,
          includeThumbnail: true,
          includeTextExtraction: true
        };

      case 'ai':
        return {
          ...baseOptions,
          includeAnalysis: true,
          includeOptimization: false,
          includeThumbnail: true,
          includeObjectDetection: true
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Отправка результата обработки пользователю
   */
  async sendResultToUser(chatId, processingResult, processingType, processingMessage) {
    try {
      const message = this.formatResultMessage(processingResult, processingType);
      
      // Обновляем существующее сообщение или отправляем новое
      if (processingMessage) {
        try {
          await this.bot.telegram.editMessageText(
            processingMessage.chat_id,
            processingMessage.message_id,
            null,
            message,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          // Если не удалось отредактировать, отправляем новое сообщение
          await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
      } else {
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
      
    } catch (error) {
      console.error('❌ Ошибка отправки результата пользователю:', error.message);
      
      // Отправляем упрощенное сообщение в случае ошибки
      try {
        await this.bot.telegram.sendMessage(chatId, '✅ Изображение успешно обработано!');
      } catch (fallbackError) {
        console.error('❌ Ошибка отправки fallback сообщения:', fallbackError.message);
      }
    }
  }

  /**
   * Форматирование результата обработки для отправки пользователю
   */
  formatResultMessage(processingResult, processingType) {
    let message = `✅ **Изображение обработано!**\n\n`;
    
    // Основная информация
    if (processingResult.analysis) {
      const analysis = processingResult.analysis;
      message += `📊 **Анализ изображения:**\n`;
      message += `• Размер: ${analysis.width}×${analysis.height} пикселей\n`;
      message += `• Формат: ${analysis.format?.toUpperCase()}\n`;
      message += `• Размер файла: ${(analysis.size / 1024).toFixed(1)} КБ\n`;
      message += `• Соотношение сторон: ${analysis.aspectRatio?.toFixed(2)}\n`;
      message += `• Мегапикселей: ${analysis.megapixels?.toFixed(1)}\n`;
      
      if (analysis.qualityScore) {
        message += `• Оценка качества: ${analysis.qualityScore}/100\n`;
      }
      
      message += `\n`;
    }
    
    // Информация об оптимизации
    if (processingResult.optimization) {
      const opt = processingResult.optimization;
      message += `⚡ **Оптимизация:**\n`;
      message += `• Исходный размер: ${(opt.originalSize / 1024).toFixed(1)} КБ\n`;
      message += `• Оптимизированный: ${(opt.optimizedSize / 1024).toFixed(1)} КБ\n`;
      message += `• Сжатие: ${opt.compressionRatio}%\n\n`;
    }
    
    // Время обработки
    if (processingResult.processingTime) {
      const totalTime = processingResult.processingTime.total;
      message += `⏱️ **Время обработки:** ${totalTime}ms\n`;
      
      if (processingResult.processingTime.analysis) {
        message += `• Анализ: ${processingResult.processingTime.analysis}ms\n`;
      }
      if (processingResult.processingTime.optimization) {
        message += `• Оптимизация: ${processingResult.processingTime.optimization}ms\n`;
      }
    }
    
    // Извлеченный текст (OCR)
    if (processingResult.textExtraction) {
      const text = processingResult.textExtraction;
      message += `\n📝 **Распознанный текст:**\n`;
      if (text.text && text.text.length > 10) {
        message += `"${text.text.substring(0, 200)}${text.text.length > 200 ? '...' : ''}"\n`;
        message += `• Уверенность: ${(text.confidence * 100).toFixed(1)}%\n`;
      } else {
        message += `Текст не обнаружен\n`;
      }
    }
    
    // Обнаруженные объекты (AI)
    if (processingResult.objectDetection && processingResult.objectDetection.objects?.length > 0) {
      message += `\n🎯 **Обнаруженные объекты:**\n`;
      processingResult.objectDetection.objects.forEach((obj, index) => {
        if (index < 5) { // Показываем только первые 5 объектов
          message += `• ${obj.description} (${(obj.confidence * 100).toFixed(1)}%)\n`;
        }
      });
    }
    
    // Рекомендации по оптимизации
    if (processingResult.analysis?.optimizationSuggestions?.length > 0) {
      message += `\n💡 **Рекомендации:**\n`;
      processingResult.analysis.optimizationSuggestions.slice(0, 2).forEach(suggestion => {
        message += `• ${suggestion}\n`;
      });
    }
    
    // Информация о системе
    message += `\n🔧 Обработано оптимизированным процессором`;
    
    return message;
  }

  /**
   * Отправка сообщения об ошибке пользователю
   */
  async sendErrorToUser(chatId, error, processingMessage) {
    try {
      let errorMessage = `❌ **Ошибка обработки изображения**\n\n`;
      
      // Различные типы ошибок
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage += `⏱️ **Превышено время ожидания**\n`;
        errorMessage += `Изображение слишком большое или сложное для обработки.\n\n`;
        errorMessage += `💡 **Попробуйте:**\n`;
        errorMessage += `• Отправить изображение меньшего размера\n`;
        errorMessage += `• Сжать изображение перед отправкой\n`;
        errorMessage += `• Повторить попытку позже\n`;
      } else if (error.message.includes('download') || error.message.includes('network')) {
        errorMessage += `🌐 **Ошибка загрузки изображения**\n`;
        errorMessage += `Не удалось скачать изображение с серверов Telegram.\n\n`;
        errorMessage += `💡 **Попробуйте отправить изображение повторно**\n`;
      } else if (error.message.includes('format') || error.message.includes('invalid')) {
        errorMessage += `📁 **Неподдерживаемый формат**\n`;
        errorMessage += `Данный формат изображения не поддерживается.\n\n`;
        errorMessage += `💡 **Поддерживаемые форматы:** JPEG, PNG, WebP\n`;
      } else {
        errorMessage += `🔧 **Техническая ошибка**\n`;
        errorMessage += `${error.message}\n\n`;
        errorMessage += `💡 **Попробуйте повторить запрос позже**\n`;
      }
      
      errorMessage += `\n🔄 Если проблема повторяется, обратитесь к администратору.`;
      
      // Обновляем или отправляем сообщение об ошибке
      if (processingMessage) {
        try {
          await this.bot.telegram.editMessageText(
            processingMessage.chat_id,
            processingMessage.message_id,
            null,
            errorMessage,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          await this.bot.telegram.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        }
      } else {
        await this.bot.telegram.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }
      
    } catch (sendError) {
      console.error('❌ Ошибка отправки сообщения об ошибке:', sendError.message);
    }
  }

  /**
   * Настройка обработчиков событий воркера
   */
  setupEventHandlers() {
    this.worker.on('ready', () => {
      console.log('✅ OptimizedImageProcessingWorker готов к работе');
    });

    this.worker.on('active', (job) => {
      console.log(`🔄 Начата обработка изображения: ${job.id}`);
    });

    this.worker.on('completed', (job, result) => {
      const processingTime = result?.processingTime || 0;
      console.log(`✅ Изображение ${job.id} обработано за ${processingTime}ms`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Ошибка обработки изображения ${job?.id}:`, err.message);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Задача обработки изображения ${jobId} зависла`);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Ошибка OptimizedImageProcessingWorker:', err.message);
    });
  }

  /**
   * Graceful shutdown воркера
   */
  async close() {
    console.log('🛑 Закрываю OptimizedImageProcessingWorker...');
    
    try {
      await this.worker.close();
      await this.connection.quit();
      console.log('✅ OptimizedImageProcessingWorker закрыт');
    } catch (error) {
      console.error('❌ Ошибка закрытия OptimizedImageProcessingWorker:', error.message);
      throw error;
    }
  }
}

module.exports = OptimizedImageProcessingWorker;
