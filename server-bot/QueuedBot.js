require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Импорт наших компонентов очереди
const QueueManager = require('../lib/QueueManager');
const TextGenerationWorker = require('../lib/workers/TextGenerationWorker');
const ImageProcessingWorker = require('../lib/workers/ImageProcessingWorker');
const NotificationWorker = require('../lib/workers/NotificationWorker');

class QueuedBot {
  constructor() {
    this.BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN не задан в .env');
      process.exit(1);
    }

    // Настройка прокси
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    // Создание бота
    this.bot = new Telegraf(this.BOT_TOKEN, {
      telegram: {
        apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
        agent,
      },
    });

    // Инициализация системы очередей
    this.queueManager = null;
    this.workers = {};
    
    // Статистика пользователей
    this.userSessions = new Map();
    this.rateLimiter = new Map();
    
    // Инициализация
    this.init();
  }

  async init() {
    try {
      console.log('Инициализация QueuedBot...');
      
      // Создание менеджера очередей
      this.queueManager = new QueueManager();
      
      // Ожидание готовности Redis соединения
      await this.waitForRedisConnection();
      
      // Создание воркеров
      this.workers.textGeneration = new TextGenerationWorker(this.bot, this.queueManager);
      this.workers.imageProcessing = new ImageProcessingWorker(this.bot, this.queueManager);
      this.workers.notification = new NotificationWorker(this.bot, this.queueManager);
      
      // Настройка обработчиков бота
      this.setupBotHandlers();
      
      console.log('QueuedBot успешно инициализирован');
      
    } catch (error) {
      console.error('Ошибка инициализации QueuedBot:', error);
      throw error;
    }
  }

  async waitForRedisConnection() {
    console.log('Ожидание подключения к Redis...');
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        await this.queueManager.connection.ping();
        console.log('✅ Подключение к Redis установлено');
        return;
      } catch (error) {
        attempts++;
        console.log(`Попытка ${attempts}/${maxAttempts} подключения к Redis...`);
        if (attempts >= maxAttempts) {
          throw new Error('Не удалось подключиться к Redis');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  setupBotHandlers() {
    console.log('Настройка обработчиков бота...');

    // Команда /start
    this.bot.start(async (ctx) => {
      await this.handleStart(ctx);
    });

    // Команда /help
    this.bot.command('help', async (ctx) => {
      await this.handleHelp(ctx);
    });

    // Команда /status - показать статус очередей
    this.bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    // Команда /stats - показать статистику
    this.bot.command('stats', async (ctx) => {
      await this.handleStats(ctx);
    });

    // Обработка текстовых сообщений
    this.bot.on('text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    // Обработка изображений
    this.bot.on('photo', async (ctx) => {
      await this.handlePhoto(ctx);
    });

    // Обработка документов (изображения как документы)
    this.bot.on('document', async (ctx) => {
      await this.handleDocument(ctx);
    });

    // Обработка callback queries (inline кнопки)
    this.bot.on('callback_query', async (ctx) => {
      await this.handleCallbackQuery(ctx);
    });

    // Middleware для логирования
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const user = ctx.from;
      console.log(`📨 Входящее сообщение от ${user.username || user.id}: ${ctx.message?.text || ctx.updateType}`);
      
      await next();
      
      const duration = Date.now() - start;
      console.log(`⚡ Обработано за ${duration}ms`);
    });

    console.log('✅ Обработчики бота настроены');
  }

  async handleStart(ctx) {
    const user = ctx.from;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `tg_${user.id}`;
    
    // Обработка payload для авторизации (оригинальный функционал)
    const payload = (ctx.startPayload || '').trim();
    
    if (payload && payload.startsWith('AUTH_')) {
      const token = payload.slice('AUTH_'.length);
      await ctx.reply('Авторизация через сайт', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Авторизовать', callback_data: `AUTH:${token}` }]],
        },
      });
      return;
    }

    if (payload) {
      // Старый функционал авторизации
      try {
        const resp = await fetch(process.env.APP_BASE_URL + '/api/auth/tg/otp/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: payload,
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            photo_url: null,
          })
        });
        const ok = resp.ok;
        await ctx.reply(ok ? `Готово. Возвращайтесь на сайт.` : `Не удалось подтвердить.`);
      } catch (e) {
        await ctx.reply('Ошибка подтверждения. Попробуйте снова.');
      }
      return;
    }

    // Новый функционал с очередями
    const welcomeMessage = `
🤖 **Привет, ${name}!**

Я теперь работаю с системой очередей и могу обрабатывать множество запросов одновременно!

**Доступные возможности:**
📝 Отправьте текст - я обработаю его через AI
🖼️ Отправьте изображение - я проанализирую его
⚙️ /status - статус очередей
📊 /stats - статистика обработки
❓ /help - справка по командам

**Что нового:**
✅ Неблокирующая обработка запросов
✅ Система очередей для масштабируемости  
✅ Мониторинг производительности
✅ Параллельная обработка изображений и текста

Попробуйте отправить несколько сообщений подряд - увидите разницу!
    `;

    await ctx.reply(welcomeMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    // Отправляем приветственное уведомление в очередь
    await this.queueManager.addNotificationJob({
      type: 'immediate',
      recipients: [ctx.chat.id],
      message: `👋 Пользователь ${name} начал использовать бота с системой очередей!`,
      options: { silent: true }
    });
  }

  async handleHelp(ctx) {
    const helpMessage = `
🔧 **Справка по командам:**

**Основные команды:**
• /start - перезапуск бота
• /help - эта справка
• /status - состояние очередей
• /stats - статистика работы

**Обработка контента:**
📝 **Текст** - отправьте любое текстовое сообщение
   • Простые запросы обрабатываются быстро
   • Сложные запросы могут занять больше времени
   
🖼️ **Изображения** - отправьте фото или изображение
   • Анализ содержимого
   • Извлечение текста (OCR)
   • Определение объектов
   • Генерация описания

**Специальные возможности:**
⚡ Параллельная обработка запросов
📊 Мониторинг производительности
🔄 Автоматические повторы при ошибках
📈 Система приоритетов для задач

**Примеры использования:**
1. Отправьте "Расскажи анекдот" для быстрого ответа
2. Загрузите фото для анализа
3. Отправьте несколько запросов подряд
    `;

    await ctx.reply(helpMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  }

  async handleStatus(ctx) {
    try {
      const stats = await this.queueManager.getQueueStats();
      
      let statusMessage = '📊 **Статус очередей:**\n\n';
      
      for (const [queueName, queueStats] of Object.entries(stats)) {
        const emoji = this.getQueueEmoji(queueName);
        statusMessage += `${emoji} **${this.getQueueDisplayName(queueName)}:**\n`;
        
        if (queueStats.error) {
          statusMessage += `   ❌ Ошибка: ${queueStats.error}\n\n`;
        } else {
          statusMessage += `   • Ожидают: ${queueStats.waiting}\n`;
          statusMessage += `   • Обрабатываются: ${queueStats.active}\n`;
          statusMessage += `   • Завершено: ${queueStats.completed}\n`;
          statusMessage += `   • Неудачные: ${queueStats.failed}\n\n`;
        }
      }

      // Статус воркеров
      statusMessage += '🔧 **Статус воркеров:**\n';
      for (const [name, worker] of Object.entries(this.workers)) {
        const workerStats = worker.getStats();
        statusMessage += `• ${name}: ${workerStats.isRunning ? '🟢' : '🔴'} `;
        statusMessage += `(concurrency: ${workerStats.concurrency})\n`;
      }

      statusMessage += `\n🕐 Обновлено: ${new Date().toLocaleString('ru-RU')}`;

      await ctx.reply(statusMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить', callback_data: 'refresh_status' }],
            [{ text: '📈 Детальная статистика', callback_data: 'detailed_stats' }]
          ]
        }
      });

    } catch (error) {
      console.error('Ошибка получения статуса:', error);
      await ctx.reply('❌ Ошибка получения статуса очередей');
    }
  }

  async handleStats(ctx) {
    // Получение детальной статистики
    const userSession = this.getUserSession(ctx.from.id);
    
    let statsMessage = '📈 **Детальная статистика:**\n\n';
    
    statsMessage += `👤 **Ваша сессия:**\n`;
    statsMessage += `• Текстовых запросов: ${userSession.textRequests}\n`;
    statsMessage += `• Изображений: ${userSession.imageRequests}\n`;
    statsMessage += `• Последняя активность: ${userSession.lastActivity.toLocaleString('ru-RU')}\n\n`;
    
    // Системная статистика
    try {
      const queueStats = await this.queueManager.getQueueStats();
      let totalJobs = 0;
      
      for (const stats of Object.values(queueStats)) {
        if (!stats.error) {
          totalJobs += stats.total;
        }
      }
      
      statsMessage += `🔢 **Общая статистика:**\n`;
      statsMessage += `• Всего задач: ${totalJobs}\n`;
      statsMessage += `• Активных пользователей: ${this.userSessions.size}\n`;
      
    } catch (error) {
      statsMessage += `❌ Ошибка получения статистики`;
    }

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
  }

  async handleTextMessage(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;

    // Rate limiting
    if (this.isRateLimited(userId)) {
      await ctx.reply('⏱️ Пожалуйста, подождите немного перед отправкой следующего запроса.');
      return;
    }

    // Обновление сессии пользователя
    const userSession = this.getUserSession(userId);
    userSession.textRequests++;
    userSession.lastActivity = new Date();

    // Немедленный ответ пользователю
    const processingMsg = await ctx.reply('🔄 Добавляю ваш запрос в очередь обработки...');

    try {
      // Определение типа сообщения и приоритета
      const messageType = this.categorizeMessage(messageText);
      const priority = this.calculatePriority(messageType, userId);

      // Добавление задачи в очередь
      const job = await this.queueManager.addTextGenerationJob({
        userId,
        chatId,
        messageText,
        messageType,
        priority,
        processingMsgId: processingMsg.message_id,
        timestamp: new Date().toISOString()
      });

      // Обновление сообщения о статусе
      await this.bot.telegram.editMessageText(
        chatId,
        processingMsg.message_id,
        null,
        `✅ Запрос добавлен в очередь (ID: ${job.id})\n🕐 Ожидаемое время обработки: ${this.getEstimatedTime(messageType)}`
      );

      // Установка rate limit
      this.setRateLimit(userId);

    } catch (error) {
      console.error('Ошибка добавления текстовой задачи:', error);
      await this.bot.telegram.editMessageText(
        chatId,
        processingMsg.message_id,
        null,
        '❌ Произошла ошибка при добавлении запроса в очередь'
      );
    }
  }

  async handlePhoto(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const photo = ctx.message.photo;

    // Rate limiting для изображений (более строгий)
    if (this.isRateLimited(userId, 'image')) {
      await ctx.reply('⏱️ Обработка изображений требует больше времени. Подождите перед отправкой следующего изображения.');
      return;
    }

    // Обновление сессии пользователя
    const userSession = this.getUserSession(userId);
    userSession.imageRequests++;
    userSession.lastActivity = new Date();

    const processingMsg = await ctx.reply('🖼️ Добавляю изображение в очередь обработки...');

    try {
      // Определение типа обработки (можно расширить)
      const processingType = ctx.message.caption ? 
        this.determineImageProcessingType(ctx.message.caption) : 'analyze';

      const job = await this.queueManager.addImageProcessingJob({
        userId,
        chatId,
        photoData: photo,
        processingType,
        priority: 1, // Изображения имеют высокий приоритет
        processingMsgId: processingMsg.message_id,
        timestamp: new Date().toISOString()
      });

      await this.bot.telegram.editMessageText(
        chatId,
        processingMsg.message_id,
        null,
        `✅ Изображение добавлено в очередь (ID: ${job.id})\n🔍 Тип обработки: ${processingType}\n🕐 Ожидаемое время: 30-60 сек`
      );

      // Установка rate limit для изображений
      this.setRateLimit(userId, 'image');

    } catch (error) {
      console.error('Ошибка добавления задачи обработки изображения:', error);
      await this.bot.telegram.editMessageText(
        chatId,
        processingMsg.message_id,
        null,
        '❌ Произошла ошибка при добавлении изображения в очередь'
      );
    }
  }

  async handleDocument(ctx) {
    const document = ctx.message.document;
    
    // Проверяем, является ли документ изображением
    if (document.mime_type && document.mime_type.startsWith('image/')) {
      // Преобразуем документ в формат фото для обработки
      ctx.message.photo = [{
        file_id: document.file_id,
        file_unique_id: document.file_unique_id,
        width: 0, // Неизвестно для документов
        height: 0,
        file_size: document.file_size
      }];
      
      await this.handlePhoto(ctx);
    } else {
      await ctx.reply('📄 Поддерживаются только изображения. Отправьте фото или изображение как документ.');
    }
  }

  async handleCallbackQuery(ctx) {
    const data = ctx.callbackQuery?.data || '';
    
    try {
      if (data === 'refresh_status') {
        await ctx.answerCbQuery('Обновляю статус...');
        await this.handleStatus(ctx);
        return;
      }

      if (data === 'detailed_stats') {
        await ctx.answerCbQuery('Получаю статистику...');
        await this.handleStats(ctx);
        return;
      }

      // Оригинальная обработка авторизации
      if (data.startsWith('AUTH:')) {
        const token = data.slice('AUTH:'.length);
        const user = ctx.from;
        
        const resp = await fetch(process.env.APP_BASE_URL + '/api/auth/tg/otp/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: `AUTH_${token}`,
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            photo_url: null,
          })
        });

        let ok = false;
        try {
          const js = await resp.json();
          ok = !!js?.ok && js?.status === 'confirmed';
        } catch { 
          ok = resp.ok; 
        }

        await ctx.answerCbQuery(ok ? 'Успешно' : 'Ошибка');
        
        const site = process.env.FRONT_BASE_URL || 'http://localhost:3000/lobby';
        const backUrl = `${site}${site.includes('?') ? '&' : '?'}auth=${encodeURIComponent(token)}`;
        
        try {
          await ctx.editMessageText(ok ? '✅ Авторизовано. Вернитесь на сайт.' : '❌ Не удалось авторизовать.', {
            reply_markup: ok ? { inline_keyboard: [[{ text: 'Перейти на сайт', url: backUrl }]] } : undefined,
          });
        } catch {}

        // Дополнительные действия при успешной авторизации
        if (ok) {
          try {
            await ctx.reply('Перейти на сайт', {
              reply_markup: { inline_keyboard: [[{ text: 'Перейти на сайт', url: backUrl }]] }
            });
            await ctx.reply(`Ссылка: ${backUrl}`);
          } catch {}
        }
        
        return;
      }

      await ctx.answerCbQuery('Неизвестная команда');
      
    } catch (error) {
      console.error('Ошибка обработки callback query:', error);
      await ctx.answerCbQuery('Произошла ошибка');
    }
  }

  // Вспомогательные методы

  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        textRequests: 0,
        imageRequests: 0,
        lastActivity: new Date(),
        joinedAt: new Date()
      });
    }
    return this.userSessions.get(userId);
  }

  isRateLimited(userId, type = 'text') {
    const key = `${userId}_${type}`;
    const now = Date.now();
    const limit = this.rateLimiter.get(key);
    
    if (!limit) return false;
    
    const cooldown = type === 'image' ? 30000 : 5000; // 30с для изображений, 5с для текста
    return (now - limit) < cooldown;
  }

  setRateLimit(userId, type = 'text') {
    const key = `${userId}_${type}`;
    this.rateLimiter.set(key, Date.now());
  }

  categorizeMessage(text) {
    const length = text.length;
    const hasComplexWords = /анализ|сложн|детальн|подробн|глубок/i.test(text);
    const hasQuestions = text.includes('?') || /как|что|где|когда|почему|зачем/i.test(text);
    
    if (length > 200 || hasComplexWords) return 'complex';
    if (hasQuestions) return 'question';
    if (length < 50) return 'simple';
    return 'normal';
  }

  calculatePriority(messageType, userId) {
    let priority = 0;
    
    switch (messageType) {
      case 'simple': priority = 2; break;
      case 'question': priority = 1; break;
      case 'complex': priority = -1; break;
      default: priority = 0;
    }
    
    // Премиум пользователи (можно настроить)
    const premiumUsers = new Set(); // Добавьте ID премиум пользователей
    if (premiumUsers.has(userId)) {
      priority += 2;
    }
    
    return priority;
  }

  getEstimatedTime(messageType) {
    switch (messageType) {
      case 'simple': return '5-10 сек';
      case 'question': return '10-20 сек';
      case 'complex': return '20-60 сек';
      default: return '10-30 сек';
    }
  }

  determineImageProcessingType(caption) {
    if (!caption) return 'analyze';
    
    const lower = caption.toLowerCase();
    if (lower.includes('текст') || lower.includes('ocr')) return 'extract_text';
    if (lower.includes('объект') || lower.includes('найти')) return 'detect_objects';
    if (lower.includes('описание') || lower.includes('что на')) return 'generate_description';
    if (lower.includes('улучш') || lower.includes('качество')) return 'enhance';
    
    return 'analyze';
  }

  getQueueEmoji(queueName) {
    const emojis = {
      textGeneration: '💬',
      imageProcessing: '🖼️',
      notification: '🔔'
    };
    return emojis[queueName] || '⚙️';
  }

  getQueueDisplayName(queueName) {
    const names = {
      textGeneration: 'Генерация текста',
      imageProcessing: 'Обработка изображений',
      notification: 'Уведомления'
    };
    return names[queueName] || queueName;
  }

  async launchWithRetry() {
    const RETRY_MS = Number(process.env.BOT_RETRY_MS || 10000);
    try {
      try { 
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true }); 
      } catch {}
      
      await this.bot.launch({
        allowedUpdates: ['message', 'callback_query']
      });
      
      console.log('🚀 QueuedBot запущен успешно');
      
      // Отправка уведомления о запуске
      if (process.env.ADMIN_CHAT_ID) {
        await this.queueManager.addNotificationJob({
          type: 'immediate',
          recipients: [process.env.ADMIN_CHAT_ID],
          message: '🤖 QueuedBot запущен и готов к работе!'
        });
      }
      
    } catch (e) {
      console.error('Ошибка запуска бота:', e?.message || e);
      console.log(`Повторный запуск через ${Math.round(RETRY_MS/1000)}с...`);
      setTimeout(() => this.launchWithRetry(), RETRY_MS);
    }
  }

  async shutdown() {
    console.log('🛑 Останавливаю QueuedBot...');
    
    try {
      // Остановка бота
      this.bot.stop('SIGTERM');
      
      // Закрытие воркеров
      for (const [name, worker] of Object.entries(this.workers)) {
        await worker.close();
        console.log(`✅ ${name} воркер закрыт`);
      }
      
      // Закрытие менеджера очередей
      if (this.queueManager) {
        await this.queueManager.close();
        console.log('✅ QueueManager закрыт');
      }
      
      console.log('👋 QueuedBot остановлен');
      
    } catch (error) {
      console.error('Ошибка при останове:', error);
    }
  }
}

module.exports = QueuedBot;
