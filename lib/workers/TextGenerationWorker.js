const { Worker } = require('bullmq');
const IORedis = require('ioredis');

class TextGenerationWorker {
  constructor(botInstance, queueManager) {
    this.bot = botInstance;
    this.queueManager = queueManager;
    
    // Конфигурация Redis (та же, что и в QueueManager)
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

    // Создание воркера
    this.worker = new Worker(
      'text-generation',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: 5, // Обрабатывать до 5 задач одновременно
        removeOnComplete: 50,
        removeOnFail: 100,
      }
    );

    this.setupEventHandlers();
    console.log('TextGenerationWorker инициализирован с concurrency: 5');
  }

  /**
   * Основная функция обработки задач генерации текста
   */
  async processJob(job) {
    const { userId, chatId, messageText, messageType, priority, testRequest } = job.data;
    
    // Добавляем таймаут для предотвращения зависания
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TEXT_GENERATION_TIMEOUT')), 60000); // 1 минута максимум
    });
    
    try {
      console.log(`💬 Обработка текстовой задачи ${job.id} для пользователя ${userId} (тип: ${messageType})`);
      
      await job.updateProgress(5);

      // Выполняем генерацию с таймаутом
      const result = await Promise.race([
        this.processTextWithSteps(job, userId, chatId, messageText, messageType, testRequest),
        timeoutPromise
      ]);

      await job.updateProgress(100);
      console.log(`✅ Текстовая задача ${job.id} выполнена успешно`);
      
      return result;

    } catch (error) {
      console.error(`❌ Ошибка при обработке текстовой задачи ${job.id}:`, error.message);
      
      // Обработка разных типов ошибок
      let errorMessage = '⚠️ Произошла ошибка при обработке вашего запроса.';
      
      if (error.message === 'TEXT_GENERATION_TIMEOUT') {
        errorMessage = '⏱️ Превышено время обработки запроса (1 мин). Попробуйте более простой запрос.';
      }
      
      // Отправка сообщения об ошибке (только для реальных пользователей)
      if (!testRequest) {
        try {
          await this.bot.telegram.sendMessage(chatId, errorMessage);
        } catch (sendError) {
          console.error('Ошибка отправки сообщения об ошибке:', sendError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Обработка текста по шагам с промежуточными обновлениями
   */
  async processTextWithSteps(job, userId, chatId, messageText, messageType, testRequest) {
    try {
      // Шаг 1: Симуляция AI обработки
      console.log(`🧠 Генерирую ответ для задачи ${job.id}...`);
      await job.updateProgress(15);
      
      await this.simulateAIResponse(job, messageText);
      await job.updateProgress(50);

      // Шаг 2: Генерация ответа
      const response = await this.generateAIResponse(messageText, messageType);
      await job.updateProgress(80);

      // Шаг 3: Отправка ответа (только для реальных пользователей)
      if (!testRequest) {
        console.log(`📤 Отправляю ответ пользователю ${userId}...`);
        await this.sendResponse(chatId, response, messageType);
      } else {
        console.log(`🧪 Тестовый запрос - пропускаю отправку ответа`);
      }
      
      await job.updateProgress(95);

      return { 
        success: true, 
        response: response,
        processedAt: new Date().toISOString(),
        messageType,
        userId,
        chatId,
        messageLength: messageText.length
      };
      
    } catch (error) {
      console.error(`💥 Ошибка на этапе генерации текста ${job.id}:`, {
        error: error.message,
        userId,
        messageType,
        messageLength: messageText.length
      });
      throw error;
    }
  }

  /**
   * Симуляция AI обработки (замените на реальную логику)
   */
  async simulateAIResponse(job, messageText) {
    const processingTime = Math.random() * 2000 + 1000; // 1-3 секунды
    
    // Имитация прогресса обработки
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, processingTime / steps));
      await job.updateProgress(10 + (i * 8)); // от 10% до 50%
    }
  }

  /**
   * Генерация AI ответа (замените на вашу логику)
   */
  async generateAIResponse(messageText, messageType) {
    // TODO: Интегрируйте здесь вашу AI логику
    // Например, вызов OpenAI, Claude, или локальной модели
    
    const responses = [
      `Понял ваш запрос: "${messageText}". Обрабатываю...`,
      `Интересный вопрос! Дайте подумать над: "${messageText}"`,
      `Спасибо за сообщение: "${messageText}". Вот мой ответ...`,
      `Анализирую ваш запрос: "${messageText}". Результат готов!`
    ];
    
    // Симуляция разного времени обработки в зависимости от типа
    let delay = 1000;
    switch (messageType) {
      case 'complex':
        delay = 3000;
        break;
      case 'simple':
        delay = 500;
        break;
      default:
        delay = 1500;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Отправка ответа пользователю
   */
  async sendResponse(chatId, response, messageType) {
    try {
      // Добавление эмодзи в зависимости от типа сообщения
      let emoji = '💬';
      switch (messageType) {
        case 'complex':
          emoji = '🧠';
          break;
        case 'simple':
          emoji = '✨';
          break;
        case 'question':
          emoji = '❓';
          break;
      }

      const finalMessage = `${emoji} ${response}`;
      
      await this.bot.telegram.sendMessage(chatId, finalMessage, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      
    } catch (error) {
      console.error('Ошибка отправки ответа:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий воркера
   */
  setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`✅ Текстовая задача ${job.id} завершена успешно`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Текстовая задача ${job ? job.id : 'unknown'} провалена:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      if (progress % 25 === 0) { // Логируем каждые 25%
        console.log(`📊 Прогресс задачи ${job.id}: ${progress}%`);
      }
    });

    this.worker.on('error', (err) => {
      console.error('🔥 Ошибка TextGenerationWorker:', err);
    });

    this.worker.on('ready', () => {
      console.log('🚀 TextGenerationWorker готов к работе');
    });
  }

  /**
   * Динамическое изменение параметров воркера
   */
  setConcurrency(newConcurrency) {
    this.worker.concurrency = newConcurrency;
    console.log(`Concurrency изменена на: ${newConcurrency}`);
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
   * Приостановка воркера
   */
  async pause() {
    await this.worker.pause();
    console.log('TextGenerationWorker приостановлен');
  }

  /**
   * Возобновление воркера
   */
  async resume() {
    await this.worker.resume();
    console.log('TextGenerationWorker возобновлен');
  }

  /**
   * Корректное закрытие воркера
   */
  async close() {
    console.log('Закрытие TextGenerationWorker...');
    try {
      await this.worker.close();
      this.connection.disconnect();
      console.log('TextGenerationWorker закрыт');
    } catch (error) {
      console.error('Ошибка закрытия TextGenerationWorker:', error);
    }
  }
}

module.exports = TextGenerationWorker;
