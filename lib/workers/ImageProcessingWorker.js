const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');

class ImageProcessingWorker {
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

    // Создание воркера для обработки изображений
    this.worker = new Worker(
      'image-processing',
      this.processJob.bind(this),
      {
        connection: this.connection,
        concurrency: 3, // Меньше concurrency для ресурсоемких задач
        removeOnComplete: 25,
        removeOnFail: 50,
      }
    );

    this.setupEventHandlers();
    console.log('ImageProcessingWorker инициализирован с concurrency: 3');
  }

  /**
   * Основная функция обработки задач изображений
   */
  async processJob(job) {
    const { userId, chatId, photoData, processingType, options, testRequest } = job.data;
    
    // Добавляем таймаут для всей операции обработки
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PROCESSING_TIMEOUT')), 120000); // 2 минуты максимум
    });
    
    try {
      console.log(`🖼️ Начинаю обработку изображения ${job.id} для пользователя ${userId} (тип: ${processingType})`);
      
      await job.updateProgress(5);

      // Выполняем обработку с таймаутом
      const result = await Promise.race([
        this.processImageWithSteps(job, userId, chatId, photoData, processingType, options, testRequest),
        timeoutPromise
      ]);

      await job.updateProgress(100);
      console.log(`✅ Задача обработки изображения ${job.id} выполнена успешно`);
      
      return result;

    } catch (error) {
      console.error(`❌ Ошибка при обработке изображения ${job.id}:`, error.message);
      
      // Обработка разных типов ошибок
      let errorMessage = '⚠️ Произошла ошибка при обработке изображения.';
      
      if (error.message === 'PROCESSING_TIMEOUT') {
        errorMessage = '⏱️ Превышено время обработки изображения (2 мин). Попробуйте изображение меньшего размера.';
      } else if (error.message.includes('Таймаут загрузки')) {
        errorMessage = '⏱️ Не удалось загрузить изображение. Проверьте соединение и попробуйте снова.';
      } else if (error.message.includes('HTTP ошибка')) {
        errorMessage = '🌐 Ошибка доступа к серверам Telegram. Попробуйте позже.';
      } else if (error.message.includes('Сетевая ошибка')) {
        errorMessage = '📡 Проблемы с сетью. Проверьте соединение.';
      }
      
      // Отправка сообщения об ошибке (только для реальных пользователей, не для тестов)
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
   * Обработка изображения по шагам с промежуточными обновлениями прогресса
   */
  async processImageWithSteps(job, userId, chatId, photoData, processingType, options, testRequest) {
    try {
      // Шаг 1: Загрузка изображения
      console.log(`📥 Загружаю изображение для задачи ${job.id}...`);
      
      let imageBuffer;
      if (testRequest) {
        // Для тестовых запросов используем мок-данные
        console.log(`🧪 Тестовый режим - использую мок изображение`);
        imageBuffer = Buffer.from('mock-image-data-for-testing');
      } else {
        // Для реальных запросов загружаем изображение
        imageBuffer = await this.downloadImage(photoData);
      }
      
      await job.updateProgress(25);

      // Шаг 2: Обработка изображения
      console.log(`🔍 Обрабатываю изображение (тип: ${processingType})...`);
      const result = await this.processImage(job, imageBuffer, processingType, options);
      await job.updateProgress(75);

      // Шаг 3: Отправка результата (только для реальных пользователей)
      if (!testRequest) {
        console.log(`📤 Отправляю результат пользователю ${userId}...`);
        await this.sendResult(chatId, result, processingType);
      } else {
        console.log(`🧪 Тестовый запрос - пропускаю отправку результата`);
      }
      
      await job.updateProgress(95);

      return { 
        success: true, 
        result: result,
        processedAt: new Date().toISOString(),
        processingType,
        userId,
        chatId,
        imageSize: imageBuffer ? imageBuffer.length : 0
      };
      
    } catch (error) {
      // Логируем ошибку с контекстом
      console.error(`💥 Ошибка на этапе обработки изображения ${job.id}:`, {
        error: error.message,
        userId,
        processingType,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Загрузка изображения с серверов Telegram
   */
  async downloadImage(photoData) {
    try {
      // Выбираем изображение наилучшего качества
      const photo = photoData[photoData.length - 1];
      
      console.log(`Загружаю изображение file_id: ${photo.file_id}`);
      
      // Получаем информацию о файле
      const file = await this.bot.telegram.getFile(photo.file_id);
      
      // Получаем токен бота из конфигурации
      const botToken = process.env.TELEGRAM_BOT_TOKEN || this.bot.token;
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      
      console.log(`URL изображения: ${fileUrl}`);
      
      // Загружаем файл с помощью axios
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 секунд таймаут
        maxContentLength: 20 * 1024 * 1024, // Максимум 20MB
      });
      
      console.log(`Изображение загружено, размер: ${response.data.length} байт`);
      return Buffer.from(response.data);
      
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error.message);
      
      // Более детальная информация об ошибке
      if (error.code === 'ECONNABORTED') {
        throw new Error('Таймаут загрузки изображения (>30сек)');
      } else if (error.response) {
        throw new Error(`HTTP ошибка ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Сетевая ошибка при загрузке изображения');
      } else {
        throw new Error(`Ошибка загрузки: ${error.message}`);
      }
    }
  }

  /**
   * Обработка изображения
   */
  async processImage(job, imageBuffer, processingType, options = {}) {
    try {
      switch (processingType) {
        case 'analyze':
          return await this.analyzeImage(job, imageBuffer);
        
        case 'enhance':
          return await this.enhanceImage(job, imageBuffer, options);
        
        case 'extract_text':
          return await this.extractText(job, imageBuffer);
        
        case 'detect_objects':
          return await this.detectObjects(job, imageBuffer);
        
        case 'generate_description':
          return await this.generateDescription(job, imageBuffer);
        
        default:
          return await this.basicAnalysis(job, imageBuffer);
      }
    } catch (error) {
      console.error('Ошибка обработки изображения:', error);
      throw error;
    }
  }

  /**
   * Анализ изображения
   */
  async analyzeImage(job, imageBuffer) {
    // Симуляция анализа изображения
    await this.simulateProcessing(job, 'Анализирую изображение...', 2000);
    
    // TODO: Интегрируйте здесь вашу логику анализа изображений
    // Например, использование TensorFlow.js, OpenCV, или внешнего API
    
    const analysis = {
      type: 'analysis',
      size: `${imageBuffer.length} байт`,
      format: 'JPEG/PNG',
      estimated_objects: Math.floor(Math.random() * 10) + 1,
      quality: ['Высокое', 'Среднее', 'Низкое'][Math.floor(Math.random() * 3)],
      colors: ['Яркие', 'Приглушенные', 'Монохромные'][Math.floor(Math.random() * 3)]
    };
    
    return {
      success: true,
      data: analysis,
      message: 'Анализ изображения завершен'
    };
  }

  /**
   * Улучшение изображения
   */
  async enhanceImage(job, imageBuffer, options) {
    await this.simulateProcessing(job, 'Улучшаю качество изображения...', 3000);
    
    // TODO: Реализуйте логику улучшения изображения
    
    return {
      success: true,
      data: {
        type: 'enhancement',
        improvements: ['Повышена резкость', 'Улучшена яркость', 'Снижен шум'],
        original_size: imageBuffer.length,
        enhanced_size: Math.floor(imageBuffer.length * 1.2)
      },
      message: 'Изображение успешно улучшено'
    };
  }

  /**
   * Извлечение текста из изображения (OCR)
   */
  async extractText(job, imageBuffer) {
    await this.simulateProcessing(job, 'Извлекаю текст из изображения...', 2500);
    
    // TODO: Интегрируйте OCR библиотеку (например, Tesseract.js)
    
    const mockTexts = [
      'Обнаружен текст: "Пример текста на изображении"',
      'Найдены числа: 12345',
      'Текст не обнаружен',
      'Извлечен текст: "Hello World"'
    ];
    
    return {
      success: true,
      data: {
        type: 'text_extraction',
        text: mockTexts[Math.floor(Math.random() * mockTexts.length)],
        confidence: Math.floor(Math.random() * 40) + 60 // 60-100%
      },
      message: 'Извлечение текста завершено'
    };
  }

  /**
   * Обнаружение объектов
   */
  async detectObjects(job, imageBuffer) {
    await this.simulateProcessing(job, 'Обнаруживаю объекты на изображении...', 3500);
    
    // TODO: Интегрируйте YOLO, SSD или другую модель детекции объектов
    
    const objects = [
      'человек', 'автомобиль', 'дерево', 'здание', 'собака', 'кошка', 
      'стол', 'стул', 'компьютер', 'телефон'
    ];
    
    const detectedObjects = [];
    const numObjects = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < numObjects; i++) {
      detectedObjects.push({
        object: objects[Math.floor(Math.random() * objects.length)],
        confidence: Math.floor(Math.random() * 30) + 70
      });
    }
    
    return {
      success: true,
      data: {
        type: 'object_detection',
        objects: detectedObjects,
        total_objects: detectedObjects.length
      },
      message: `Обнаружено объектов: ${detectedObjects.length}`
    };
  }

  /**
   * Генерация описания изображения
   */
  async generateDescription(job, imageBuffer) {
    await this.simulateProcessing(job, 'Генерирую описание изображения...', 4000);
    
    // TODO: Интегрируйте модель генерации описаний (например, BLIP, GPT-4 Vision)
    
    const descriptions = [
      'На изображении видно красивый пейзаж с зелеными деревьями и голубым небом.',
      'Фотография показывает городскую сцену с людьми и транспортом.',
      'Изображение содержит интерьер комнаты с мебелью и декоративными элементами.',
      'На картинке изображены различные предметы на столе или поверхности.'
    ];
    
    return {
      success: true,
      data: {
        type: 'description_generation',
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        style: 'detailed'
      },
      message: 'Описание изображения сгенерировано'
    };
  }

  /**
   * Базовый анализ изображения
   */
  async basicAnalysis(job, imageBuffer) {
    await this.simulateProcessing(job, 'Выполняю базовый анализ...', 1500);
    
    return {
      success: true,
      data: {
        type: 'basic_analysis',
        size: `${(imageBuffer.length / 1024).toFixed(2)} KB`,
        processed: true
      },
      message: 'Базовый анализ завершен'
    };
  }

  /**
   * Симуляция процесса обработки с обновлением прогресса
   */
  async simulateProcessing(job, statusMessage, duration) {
    console.log(`${statusMessage} (задача ${job.id})`);
    
    const steps = 10;
    const stepDuration = duration / steps;
    
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const progress = 20 + (i * 6); // от 20% до 80%
      await job.updateProgress(progress);
    }
  }

  /**
   * Отправка результата пользователю
   */
  async sendResult(chatId, result, processingType) {
    try {
      let message = '🖼️ **Результат обработки изображения:**\n\n';
      
      if (result.success) {
        message += `✅ ${result.message}\n\n`;
        
        // Форматирование результата в зависимости от типа
        switch (result.data.type) {
          case 'analysis':
            message += `📊 **Анализ:**\n`;
            message += `• Размер: ${result.data.size}\n`;
            message += `• Качество: ${result.data.quality}\n`;
            message += `• Цвета: ${result.data.colors}\n`;
            message += `• Объектов: ~${result.data.estimated_objects}`;
            break;
            
          case 'text_extraction':
            message += `📝 **Извлеченный текст:**\n`;
            message += `${result.data.text}\n`;
            message += `🎯 Уверенность: ${result.data.confidence}%`;
            break;
            
          case 'object_detection':
            message += `🔍 **Обнаруженные объекты:**\n`;
            result.data.objects.forEach(obj => {
              message += `• ${obj.object} (${obj.confidence}%)\n`;
            });
            break;
            
          case 'description_generation':
            message += `📝 **Описание:**\n`;
            message += result.data.description;
            break;
            
          case 'enhancement':
            message += `✨ **Улучшения:**\n`;
            result.data.improvements.forEach(improvement => {
              message += `• ${improvement}\n`;
            });
            break;
            
          default:
            message += `📋 ${JSON.stringify(result.data, null, 2)}`;
        }
      } else {
        message += `❌ Обработка не удалась: ${result.message}`;
      }
      
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
    } catch (error) {
      console.error('Ошибка отправки результата:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий воркера
   */
  setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`✅ Задача обработки изображения ${job.id} завершена`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Задача обработки изображения ${job ? job.id : 'unknown'} провалена:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      if (progress % 20 === 0) { // Логируем каждые 20%
        console.log(`📊 Прогресс обработки изображения ${job.id}: ${progress}%`);
      }
    });

    this.worker.on('error', (err) => {
      console.error('🔥 Ошибка ImageProcessingWorker:', err);
    });

    this.worker.on('ready', () => {
      console.log('🚀 ImageProcessingWorker готов к работе');
    });
  }

  /**
   * Изменение concurrency
   */
  setConcurrency(newConcurrency) {
    this.worker.concurrency = newConcurrency;
    console.log(`ImageProcessingWorker concurrency изменена на: ${newConcurrency}`);
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      concurrency: this.worker.concurrency,
      isRunning: this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
    };
  }

  /**
   * Закрытие воркера
   */
  async close() {
    console.log('Закрытие ImageProcessingWorker...');
    try {
      await this.worker.close();
      this.connection.disconnect();
      console.log('ImageProcessingWorker закрыт');
    } catch (error) {
      console.error('Ошибка закрытия ImageProcessingWorker:', error);
    }
  }
}

module.exports = ImageProcessingWorker;
