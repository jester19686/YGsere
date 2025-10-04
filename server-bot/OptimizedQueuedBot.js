/**
 * Оптимизированный бот с полной интеграцией систем мониторинга, метрик и error handling
 */

const { Telegraf } = require('telegraf');
const QueueManager = require('../lib/QueueManager');
const MetricsCollector = require('../lib/MetricsCollector');
const { ErrorHandler, AppError, ValidationError, TimeoutError } = require('../lib/ErrorHandler');
const MonitoringServer = require('../lib/MonitoringServer');

// Workers
const TextGenerationWorker = require('../lib/workers/TextGenerationWorker');
const OptimizedImageProcessingWorker = require('../lib/workers/OptimizedImageProcessingWorker');
const NotificationWorker = require('../lib/workers/NotificationWorker');

class OptimizedQueuedBot {
  constructor() {
    // Проверка переменных окружения
    this.validateEnvironment();
    
    // Инициализация компонентов
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.metricsCollector = new MetricsCollector();
    this.errorHandler = new ErrorHandler(this.metricsCollector);
    this.queueManager = new QueueManager(this.metricsCollector, this.errorHandler);
    this.monitoringServer = new MonitoringServer(
      this.queueManager, 
      this.metricsCollector, 
      this.errorHandler,
      parseInt(process.env.MONITORING_PORT || '3001')
    );
    
    // Воркеры
    this.workers = {};
    this.isShuttingDown = false;
    
    // Статистика
    this.userActivityTracker = new Map(); // userId -> lastActivityTime
    this.startTime = Date.now();
    
    console.log('🚀 OptimizedQueuedBot инициализирован');
  }

  /**
   * Валидация переменных окружения
   */
  validateEnvironment() {
    const required = ['TELEGRAM_BOT_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Предупреждения для опциональных переменных
    const optional = {
      'REDIS_HOST': 'localhost',
      'REDIS_PORT': '6379',
      'MONITORING_PORT': '3001',
      'NODE_ENV': 'development'
    };
    
    for (const [key, defaultValue] of Object.entries(optional)) {
      if (!process.env[key]) {
        console.warn(`⚠️ ${key} не установлен, используется значение по умолчанию: ${defaultValue}`);
      }
    }
  }

  /**
   * Инициализация воркеров
   */
  async initializeWorkers() {
    console.log('🔧 Инициализация воркеров...');
    
    try {
      // Создание воркеров с оптимизированными настройками
      this.workers.textGeneration = new TextGenerationWorker(
        this.bot, 
        this.queueManager,
        this.metricsCollector,
        this.errorHandler
      );
      
      this.workers.imageProcessing = new OptimizedImageProcessingWorker(
        this.bot, 
        this.queueManager,
        this.metricsCollector,
        this.errorHandler
      );
      
      this.workers.notification = new NotificationWorker(
        this.bot, 
        this.queueManager,
        this.metricsCollector,
        this.errorHandler
      );
      
      // Регистрация воркеров в queue manager
      this.queueManager.workers = this.workers;
      
      console.log('✅ Воркеры инициализированы');
      
      // Обновляем метрики активных воркеров
      Object.keys(this.workers).forEach(workerName => {
        this.metricsCollector.updateActiveWorkers(workerName, 1);
      });
      
    } catch (error) {
      throw new AppError(`Failed to initialize workers: ${error.message}`, true, 500);
    }
  }

  /**
   * Настройка обработчиков сообщений с метриками
   */
  setupBotHandlers() {
    console.log('📡 Настройка обработчиков бота...');
    
    // Middleware для отслеживания активности пользователей
    this.bot.use(async (ctx, next) => {
      const startTime = Date.now();
      const userId = ctx.from?.id;
      
      // Обновляем активность пользователя
      if (userId) {
        this.userActivityTracker.set(userId, Date.now());
      }
      
      try {
        await next();
      } catch (error) {
        console.error('Error in bot middleware:', error);
        await this.errorHandler.handleError(error, null, false);
      } finally {
        // Записываем время ответа бота
        if (userId) {
          const duration = (Date.now() - startTime) / 1000;
          const messageType = this.getMessageType(ctx);
          this.metricsCollector.recordBotResponse(messageType, duration);
        }
      }
    });

    // Команда /start
    this.bot.start(async (ctx) => {
      this.metricsCollector.recordTelegramMessage('command');
      
      const welcomeMessage = `
🤖 **Привет! Я продвинутый Telegram бот с системой очередей**

🚀 **Новые возможности:**
• ⚡ Неблокирующая обработка запросов
• 📊 Система мониторинга в реальном времени  
• 🔄 Умная очередь задач
• 🛡️ Надежная обработка ошибок

📋 **Доступные команды:**
/help - Подробная справка
/status - Статус системы очередей
/stats - Ваша персональная статистика

📈 **Мониторинг:** http://localhost:${process.env.MONITORING_PORT || 3001}

Отправьте любое текстовое сообщение или изображение - я обработаю их мгновенно через систему очередей!
      `;
      
      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Команда /help
    this.bot.help(async (ctx) => {
      this.metricsCollector.recordTelegramMessage('command');
      
      const helpMessage = `
📖 **Подробное руководство**

🔤 **Текстовые сообщения:**
• Простые вопросы - быстрая обработка (высокий приоритет)
• Сложные запросы - глубокий анализ (средний приоритет)
• Все сообщения обрабатываются в фоне через очереди

🖼️ **Изображения:**
• Автоматический анализ содержимого
• Извлечение текста (OCR)
• Определение объектов и сцен
• Улучшение качества (скоро)

⚙️ **Системные команды:**
/status - Текущий статус очередей
/stats - Статистика пользователя
/health - Проверка здоровья системы

📊 **Мониторинг:**
• Bull Board: http://localhost:${process.env.MONITORING_PORT || 3001}/admin/queues
• API: http://localhost:${process.env.MONITORING_PORT || 3001}/api/stats
• Health: http://localhost:${process.env.MONITORING_PORT || 3001}/api/health

🚀 **Производительность:**
• До 50+ текстовых запросов в секунду
• До 10 изображений одновременно
• Латентность < 100ms для добавления в очередь
      `;
      
      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Команда /status  
    this.bot.command('status', async (ctx) => {
      this.metricsCollector.recordTelegramMessage('command');
      
      try {
        const stats = await this.queueManager.getQueueStats();
        const health = await this.queueManager.healthCheck();
        
        let statusMessage = `📊 **Статус системы очередей**\n\n`;
        
        // Общий статус
        statusMessage += `🏥 **Общее состояние:** ${health.status === 'healthy' ? '✅ Здоров' : '❌ Проблемы'}\n`;
        statusMessage += `🔌 **Redis:** ${health.redis.connected ? '✅ Подключен' : '❌ Отключен'}\n\n`;
        
        // Статистика очередей
        statusMessage += `📋 **Очереди:**\n`;
        for (const [name, queueStats] of Object.entries(stats)) {
          const emoji = this.getQueueEmoji(name);
          statusMessage += `${emoji} **${name}:**\n`;
          statusMessage += `   • Ожидают: ${queueStats.waiting || 0}\n`;
          statusMessage += `   • Активные: ${queueStats.active || 0}\n`;
          statusMessage += `   • Завершено: ${queueStats.completed || 0}\n`;
          statusMessage += `   • Ошибки: ${queueStats.failed || 0}\n`;
          statusMessage += `   • Приостановлена: ${queueStats.isPaused ? '⏸️ Да' : '▶️ Нет'}\n\n`;
        }
        
        // Системная информация
        const uptime = Math.round(process.uptime());
        statusMessage += `⏱️ **Время работы:** ${uptime}с\n`;
        statusMessage += `🧠 **Память:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n`;
        statusMessage += `👥 **Активные пользователи:** ${this.getActiveUserCount()}\n`;
        
        await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        await this.errorHandler.handleError(error);
        await ctx.reply('❌ Ошибка получения статуса. Попробуйте позже.');
      }
    });

    // Команда /stats
    this.bot.command('stats', async (ctx) => {
      this.metricsCollector.recordTelegramMessage('command');
      
      const userId = ctx.from.id;
      const userStats = await this.getUserStats(userId);
      
      const statsMessage = `
📈 **Ваша персональная статистика**

👤 **Пользователь:** ${ctx.from.first_name || 'Аноним'}
🆔 **ID:** ${userId}

📊 **Активность:**
• Сообщений отправлено: ${userStats.messagesCount || 0}
• Изображений обработано: ${userStats.imagesCount || 0}
• Команд выполнено: ${userStats.commandsCount || 0}
• Последняя активность: ${userStats.lastActivity || 'Неизвестно'}

⚡ **Использование очередей:**
• Текстовые задачи: ${userStats.textTasks || 0}
• Задачи изображений: ${userStats.imageTasks || 0}
• Уведомления: ${userStats.notifications || 0}

🕐 **Время:**
• Первое использование: ${userStats.firstSeen || 'Сейчас'}
• Среднее время ответа: ${userStats.avgResponseTime || 'N/A'}
      `;
      
      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
    });

    // Обработка текстовых сообщений
    this.bot.on('text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return; // Игнорируем команды
      
      this.metricsCollector.recordTelegramMessage('text');
      
      try {
        // Определяем приоритет на основе длины сообщения
        const messageLength = ctx.message.text.length;
        const priority = messageLength > 100 ? 2 : messageLength > 30 ? 1 : 0;
        
        const job = await this.queueManager.addTextGenerationJob({
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageText: ctx.message.text,
          messageType: this.classifyTextMessage(ctx.message.text),
          priority: priority,
          timestamp: new Date().toISOString(),
          userInfo: {
            firstName: ctx.from.first_name,
            username: ctx.from.username,
          }
        });
        
        await ctx.reply(`🔄 Добавляю ваш запрос в очередь обработки...\n📋 ID задачи: ${job.id}`, {
          reply_to_message_id: ctx.message.message_id
        });
        
      } catch (error) {
        await this.errorHandler.handleError(error);
        await ctx.reply('❌ Ошибка добавления в очередь. Попробуйте позже.');
      }
    });

    // Обработка изображений с оптимизированным процессором
    this.bot.on('photo', async (ctx) => {
      this.metricsCollector.recordTelegramMessage('image');
      
      try {
        // Отправляем подтверждение получения сразу
        const processingMessage = await ctx.reply(`🖼️ Получил изображение! Начинаю обработку...\n⚡ Используется оптимизированный процессор`, {
          reply_to_message_id: ctx.message.message_id
        });
        
        // Подготавливаем данные изображения для оптимизированного процессора
        const largestPhoto = ctx.message.photo.reduce((largest, photo) => 
          photo.file_size > (largest.file_size || 0) ? photo : largest
        );
        
        // Получаем file URL для передачи в worker thread
        const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
        
        const imageData = {
          file_id: largestPhoto.file_id,
          file_url: fileLink.href,
          file_path: fileLink.pathname,
          width: largestPhoto.width,
          height: largestPhoto.height,
          file_size: largestPhoto.file_size
        };
        
        // Определяем тип обработки по размеру изображения
        let processingType = 'quick'; // По умолчанию быстрый анализ
        if (largestPhoto.file_size > 1024 * 1024) { // Больше 1MB
          processingType = 'full'; // Полная обработка
        }
        
        // Добавляем в очередь с оптимизированным процессором
        const job = await this.queueManager.addImageProcessingJob({
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          photoData: ctx.message.photo,
          imageData: imageData,
          processingType: processingType,
          priority: 1,
          timestamp: new Date().toISOString(),
          userInfo: {
            firstName: ctx.from.first_name,
            username: ctx.from.username,
          },
          processingMessage: {
            chat_id: processingMessage.chat.id,
            message_id: processingMessage.message_id
          }
        });
        
        console.log(`📸 Изображение добавлено в очередь: ${job.id} (${processingType} обработка)`);
        
        // Отслеживаем статистику пользователя
        this.updateUserActivity(ctx.from.id, 'image');
        
      } catch (error) {
        console.error('❌ Ошибка обработки изображения:', error);
        await this.errorHandler.handleError(error);
        
        try {
          await ctx.reply(`❌ Произошла ошибка при обработке изображения: ${error.message}\n\n💡 Попробуйте отправить изображение меньшего размера или повторите попытку позже.`);
        } catch (replyError) {
          console.error('❌ Ошибка отправки сообщения об ошибке:', replyError);
        }
      }
    });

    // Обработка неподдерживаемых типов
    this.bot.on('message', async (ctx) => {
      this.metricsCollector.recordTelegramMessage('other');
      
      await ctx.reply(`
🤔 **Неподдерживаемый тип сообщения**

📝 **Поддерживается:**
• Текстовые сообщения
• Изображения (JPG, PNG, WebP)
• Команды (/help, /status, /stats)

❓ Попробуйте отправить текст или изображение!
      `, { parse_mode: 'Markdown' });
    });

    console.log('✅ Обработчики бота настроены');
  }

  /**
   * Определение типа сообщения для метрик
   */
  getMessageType(ctx) {
    if (ctx.message?.text?.startsWith('/')) return 'command';
    if (ctx.message?.text) return 'text';
    if (ctx.message?.photo) return 'image';
    return 'other';
  }

  /**
   * Классификация текстового сообщения
   */
  classifyTextMessage(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('?') || lowerText.includes('как') || lowerText.includes('что')) {
      return 'question';
    }
    if (text.length > 200) {
      return 'complex';
    }
    if (lowerText.includes('привет') || lowerText.includes('здравствуй')) {
      return 'greeting';
    }
    
    return 'simple';
  }

  /**
   * Получение эмодзи для очереди
   */
  getQueueEmoji(queueName) {
    const emojis = {
      'textGeneration': '💬',
      'imageProcessing': '🖼️',
      'notification': '🔔'
    };
    return emojis[queueName] || '⚙️';
  }

  /**
   * Подсчет активных пользователей (за последние 5 минут)
   */
  getActiveUserCount() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let activeCount = 0;
    
    for (const [userId, lastActivity] of this.userActivityTracker) {
      if (lastActivity > fiveMinutesAgo) {
        activeCount++;
      } else {
        // Удаляем старые записи
        this.userActivityTracker.delete(userId);
      }
    }
    
    return activeCount;
  }

  /**
   * Получение статистики пользователя (заглушка)
   */
  async getUserStats(userId) {
    // TODO: Реализовать сохранение статистики в Redis/БД
    return {
      messagesCount: 'N/A',
      imagesCount: 'N/A',
      commandsCount: 'N/A',
      lastActivity: 'Сейчас',
      textTasks: 'N/A',
      imageTasks: 'N/A',
      notifications: 'N/A',
      firstSeen: 'Сейчас',
      avgResponseTime: 'N/A'
    };
  }

  /**
   * Запуск всех систем
   */
  async start() {
    try {
      console.log('🚀 Запуск OptimizedQueuedBot...');
      
      // 1. Инициализация воркеров
      await this.initializeWorkers();
      
      // 2. Настройка обработчиков бота
      this.setupBotHandlers();
      
      // 3. Запуск мониторинга
      await this.monitoringServer.start();
      
      // 4. Запуск бота
      console.log('🤖 Запуск Telegram бота...');
      await this.bot.launch();
      
      // 5. Настройка graceful shutdown
      this.setupGracefulShutdown();
      
      console.log('✅ OptimizedQueuedBot успешно запущен!');
      console.log(`📊 Мониторинг: http://localhost:${process.env.MONITORING_PORT || 3001}`);
      console.log(`📋 Bull Board: http://localhost:${process.env.MONITORING_PORT || 3001}/admin/queues`);
      console.log(`📈 Метрики: http://localhost:${process.env.MONITORING_PORT || 3001}/api/metrics`);
      
    } catch (error) {
      console.error('❌ Ошибка запуска OptimizedQueuedBot:', error);
      await this.errorHandler.handleError(error, null, true);
      process.exit(1);
    }
  }

  /**
   * Настройка graceful shutdown
   */
  setupGracefulShutdown() {
    process.once('SIGINT', () => this.shutdown('SIGINT'));
    process.once('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  /**
   * Graceful shutdown всех систем
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      console.log('⚠️ Shutdown уже выполняется...');
      return;
    }
    
    this.isShuttingDown = true;
    console.log(`🛑 Получен сигнал ${signal}, начинаю graceful shutdown...`);
    
    try {
      // 1. Останавливаем прием новых сообщений
      console.log('🤖 Остановка Telegram бота...');
      this.bot.stop(signal);
      
      // 2. Закрываем monitoring server
      console.log('📊 Закрытие monitoring server...');
      await this.monitoringServer.shutdown();
      
      // 3. Graceful shutdown queue manager
      console.log('📋 Shutdown queue manager...');
      await this.queueManager.shutdown();
      
      // 4. Закрываем metrics collector
      if (this.metricsCollector) {
        await this.metricsCollector.shutdown();
      }
      
      console.log('✅ OptimizedQueuedBot корректно завершен');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Ошибка при shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = OptimizedQueuedBot;
