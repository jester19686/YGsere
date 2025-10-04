const { Worker } = require('bullmq');
const IORedis = require('ioredis');

class NotificationWorker {
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

    // Создание воркера для уведомлений
    this.worker = new Worker(
      'notification',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: 10, // Высокая concurrency для быстрых уведомлений
        removeOnComplete: 100,
        removeOnFail: 200,
      }
    );

    this.setupEventHandlers();
    console.log('NotificationWorker инициализирован с concurrency: 10');
  }

  /**
   * Основная функция обработки уведомлений
   */
  async processJob(job) {
    const { 
      type, 
      recipients, 
      message, 
      options = {},
      priority = 'normal',
      scheduledFor 
    } = job.data;
    
    try {
      console.log(`Обработка уведомления ${job.id} типа: ${type}`);
      
      await job.updateProgress(10);

      // Проверка на отложенное уведомление
      if (scheduledFor && new Date(scheduledFor) > new Date()) {
        console.log(`Уведомление ${job.id} отложено до ${scheduledFor}`);
        // Переносим задачу на нужное время
        const delay = new Date(scheduledFor) - new Date();
        throw new Error(`DELAY:${delay}`);
      }

      await job.updateProgress(25);

      // Обработка разных типов уведомлений
      const result = await this.sendNotification(job, type, recipients, message, options);
      
      await job.updateProgress(100);

      console.log(`Уведомление ${job.id} отправлено успешно`);
      return {
        success: true,
        type: type,
        recipientsCount: Array.isArray(recipients) ? recipients.length : 1,
        sentAt: new Date().toISOString(),
        result: result
      };

    } catch (error) {
      if (error.message.startsWith('DELAY:')) {
        // Это не ошибка, а запрос на отложение
        const delay = parseInt(error.message.split(':')[1]);
        throw new Error(`Задача отложена на ${delay}ms`);
      }
      
      console.error(`Ошибка при отправке уведомления ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Отправка уведомления в зависимости от типа
   */
  async sendNotification(job, type, recipients, message, options) {
    switch (type) {
      case 'immediate':
        return await this.sendImmediateNotification(job, recipients, message, options);
      
      case 'broadcast':
        return await this.sendBroadcastNotification(job, recipients, message, options);
      
      case 'status_update':
        return await this.sendStatusUpdate(job, recipients, message, options);
      
      case 'queue_status':
        return await this.sendQueueStatusNotification(job, recipients, options);
      
      case 'error_alert':
        return await this.sendErrorAlert(job, recipients, message, options);
      
      case 'completion_notice':
        return await this.sendCompletionNotice(job, recipients, message, options);
      
      default:
        return await this.sendGenericNotification(job, recipients, message, options);
    }
  }

  /**
   * Мгновенное уведомление
   */
  async sendImmediateNotification(job, recipients, message, options) {
    const results = [];
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];
    
    await job.updateProgress(30);
    
    for (const recipient of recipientList) {
      try {
        await this.bot.telegram.sendMessage(recipient, message, {
          parse_mode: options.parseMode || 'HTML',
          disable_web_page_preview: options.disableWebPagePreview !== false,
          disable_notification: options.silent || false,
          reply_markup: options.replyMarkup || undefined
        });
        
        results.push({ recipient, status: 'sent' });
      } catch (error) {
        console.error(`Ошибка отправки уведомления пользователю ${recipient}:`, error);
        results.push({ recipient, status: 'failed', error: error.message });
      }
    }
    
    await job.updateProgress(80);
    return results;
  }

  /**
   * Массовая рассылка
   */
  async sendBroadcastNotification(job, recipients, message, options) {
    console.log(`Начинаю массовую рассылку для ${recipients.length} получателей`);
    
    const results = [];
    const batchSize = options.batchSize || 30; // Telegram rate limit
    const delay = options.delay || 1000; // 1 секунда между батчами
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const progress = 30 + ((i / recipients.length) * 50);
      await job.updateProgress(Math.floor(progress));
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          await this.bot.telegram.sendMessage(recipient, message, {
            parse_mode: options.parseMode || 'HTML',
            disable_web_page_preview: true,
            disable_notification: options.silent || false
          });
          return { recipient, status: 'sent' };
        } catch (error) {
          return { recipient, status: 'failed', error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Пауза между батчами для соблюдения лимитов Telegram
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`Массовая рассылка завершена: ${successful} успешно, ${failed} неудачно`);
    return { successful, failed, details: results };
  }

  /**
   * Обновление статуса
   */
  async sendStatusUpdate(job, recipients, message, options) {
    const statusMessage = `🔄 **Обновление статуса**\n\n${message}\n\n⏰ ${new Date().toLocaleString('ru-RU')}`;
    
    return await this.sendImmediateNotification(job, recipients, statusMessage, {
      ...options,
      parseMode: 'Markdown'
    });
  }

  /**
   * Уведомление о состоянии очередей
   */
  async sendQueueStatusNotification(job, recipients, options) {
    try {
      const queueStats = await this.queueManager.getQueueStats();
      
      let message = '📊 **Статус очередей:**\n\n';
      
      for (const [queueName, stats] of Object.entries(queueStats)) {
        if (stats.error) {
          message += `❌ ${queueName}: Ошибка - ${stats.error}\n`;
        } else {
          message += `🔸 **${queueName}:**\n`;
          message += `   • Ожидают: ${stats.waiting}\n`;
          message += `   • Активные: ${stats.active}\n`;
          message += `   • Завершено: ${stats.completed}\n`;
          message += `   • Неудачные: ${stats.failed}\n\n`;
        }
      }
      
      message += `🕐 Обновлено: ${new Date().toLocaleString('ru-RU')}`;
      
      return await this.sendImmediateNotification(job, recipients, message, {
        ...options,
        parseMode: 'Markdown'
      });
      
    } catch (error) {
      const errorMessage = `❌ Ошибка получения статистики очередей: ${error.message}`;
      return await this.sendImmediateNotification(job, recipients, errorMessage, options);
    }
  }

  /**
   * Уведомление об ошибке
   */
  async sendErrorAlert(job, recipients, message, options) {
    const alertMessage = `🚨 **ОШИБКА**\n\n${message}\n\n⏰ ${new Date().toLocaleString('ru-RU')}`;
    
    return await this.sendImmediateNotification(job, recipients, alertMessage, {
      ...options,
      parseMode: 'Markdown',
      silent: false // Ошибки не должны быть тихими
    });
  }

  /**
   * Уведомление о завершении задачи
   */
  async sendCompletionNotice(job, recipients, message, options) {
    const completionMessage = `✅ **Задача завершена**\n\n${message}\n\n🏁 Завершено: ${new Date().toLocaleString('ru-RU')}`;
    
    return await this.sendImmediateNotification(job, recipients, completionMessage, {
      ...options,
      parseMode: 'Markdown'
    });
  }

  /**
   * Общее уведомление
   */
  async sendGenericNotification(job, recipients, message, options) {
    return await this.sendImmediateNotification(job, recipients, message, options);
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`✅ Уведомление ${job.id} отправлено`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Уведомление ${job ? job.id : 'unknown'} не отправлено:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      if (progress % 25 === 0) {
        console.log(`📊 Прогресс уведомления ${job.id}: ${progress}%`);
      }
    });

    this.worker.on('error', (err) => {
      console.error('🔥 Ошибка NotificationWorker:', err);
    });

    this.worker.on('ready', () => {
      console.log('🚀 NotificationWorker готов к работе');
    });
  }

  /**
   * Получение статистики воркера
   */
  getStats() {
    return {
      concurrency: this.worker.concurrency,
      isRunning: this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
    };
  }

  /**
   * Изменение concurrency
   */
  setConcurrency(newConcurrency) {
    this.worker.concurrency = newConcurrency;
    console.log(`NotificationWorker concurrency изменена на: ${newConcurrency}`);
  }

  /**
   * Добавление отложенного уведомления
   */
  async scheduleNotification(type, recipients, message, scheduledFor, options = {}) {
    const delay = new Date(scheduledFor) - new Date();
    
    if (delay > 0) {
      return await this.queueManager.addNotificationJob({
        type,
        recipients,
        message,
        options,
        scheduledFor,
        delay: delay
      });
    } else {
      throw new Error('Время отправки должно быть в будущем');
    }
  }

  /**
   * Закрытие воркера
   */
  async close() {
    console.log('Закрытие NotificationWorker...');
    try {
      await this.worker.close();
      this.connection.disconnect();
      console.log('NotificationWorker закрыт');
    } catch (error) {
      console.error('Ошибка закрытия NotificationWorker:', error);
    }
  }
}

module.exports = NotificationWorker;
