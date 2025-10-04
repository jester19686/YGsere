/**
 * 🚀 КОМПЛЕКСНЫЙ СТРЕСС-ТЕСТ СИСТЕМЫ ОЧЕРЕДЕЙ
 * 
 * Симулирует реальную работу бота с множественными пользователями,
 * различными типами запросов и сценариями нагрузки
 */

const axios = require('axios');
const QueueManager = require('./lib/QueueManager');
const MetricsCollector = require('./lib/MetricsCollector');
const { ErrorHandler } = require('./lib/ErrorHandler');

class ComprehensiveStressTest {
  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.errorHandler = new ErrorHandler(this.metricsCollector);
    this.queueManager = new QueueManager(this.metricsCollector, this.errorHandler);
    
    // Конфигурация тестирования
    this.config = {
      // Общие настройки
      duration: 5 * 60 * 1000, // 5 минут тестирования
      monitoringPort: 3001,
      
      // Пользователи
      totalUsers: 100,
      concurrentUsers: 20,
      
      // Типы нагрузки
      loadTypes: {
        light: { rps: 5, users: 10 },      // 5 запросов/сек, 10 пользователей
        medium: { rps: 15, users: 30 },    // 15 запросов/сек, 30 пользователей  
        heavy: { rps: 30, users: 50 },     // 30 запросов/сек, 50 пользователей
        peak: { rps: 50, users: 100 }      // 50 запросов/сек, 100 пользователей
      },
      
      // Распределение типов сообщений (в процентах)
      messageDistribution: {
        simpleText: 40,    // Простые текстовые сообщения
        complexText: 25,   // Сложные текстовые запросы
        commands: 15,      // Команды бота
        images: 15,        // Изображения
        mixed: 5          // Смешанные запросы
      }
    };
    
    // Статистика тестирования
    this.testStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responsetimes: [],
      queueTimes: [],
      errors: {},
      startTime: null,
      endTime: null,
      userSessions: new Map(),
      peakConcurrency: 0,
      currentConcurrency: 0
    };
    
    // Шаблоны сообщений для реалистичности
    this.messageTemplates = this.initializeMessageTemplates();
    
    console.log('🧪 ComprehensiveStressTest инициализирован');
  }

  /**
   * Инициализация шаблонов сообщений для реалистичного тестирования
   */
  initializeMessageTemplates() {
    return {
      simpleText: [
        'Привет!',
        'Как дела?',
        'Что нового?',
        'Спасибо',
        'Понятно',
        'Хорошо',
        'Да',
        'Нет',
        'Может быть',
        'Согласен',
        'Отлично!',
        'Супер',
        'Классно',
        'Интересно',
        'Круто'
      ],
      
      complexText: [
        'Можешь объяснить принципы работы квантовых компьютеров и их применение в криптографии?',
        'Расскажи подробно о влиянии искусственного интеллекта на современную экономику и рынок труда',
        'Как изменения климата влияют на глобальную экосистему и что можно сделать для предотвращения катастрофы?',
        'Объясни сложные механизмы биохимических процессов в человеческом организме на клеточном уровне',
        'Проанализируй геополитическую ситуацию в современном мире и возможные сценарии развития событий',
        'Расскажи о последних достижениях в области космических технологий и планах колонизации Марса',
        'Как работают современные нейронные сети и какие прорывы ожидаются в области машинного обучения?',
        'Объясни принципы квантовой физики и их практическое применение в современных технологиях'
      ],
      
      commands: [
        '/start',
        '/help', 
        '/status',
        '/stats',
        '/health'
      ],
      
      questions: [
        'Что такое машинное обучение?',
        'Как работает блокчейн?',
        'Что такое облачные технологии?',
        'Как создать веб-сайт?',
        'Что такое API?',
        'Как работает интернет?',
        'Что такое базы данных?',
        'Как изучить программирование?',
        'Что такое DevOps?',
        'Как работает криптография?'
      ]
    };
  }

  /**
   * Симуляция пользователя с уникальным поведением
   */
  createVirtualUser(userId) {
    return {
      id: userId,
      name: `User${userId}`,
      
      // Характеристики пользователя
      activity: Math.random(), // 0-1, уровень активности
      messageFrequency: 1000 + Math.random() * 3000, // 1-4 секунды между сообщениями
      preferredMessageType: this.getRandomMessageType(),
      sessionDuration: 30000 + Math.random() * 120000, // 30сек - 2.5мин сессия
      
      // Состояние
      isActive: false,
      lastMessageTime: 0,
      messagesCount: 0,
      sessionStartTime: 0,
      
      // Метрики
      responseTimeSum: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Получение случайного типа сообщения с учетом распределения
   */
  getRandomMessageType() {
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const [type, percentage] of Object.entries(this.config.messageDistribution)) {
      cumulative += percentage;
      if (rand <= cumulative) {
        return type;
      }
    }
    
    return 'simpleText'; // fallback
  }

  /**
   * Генерация реалистичного сообщения
   */
  generateMessage(type) {
    switch (type) {
      case 'simpleText':
        return this.getRandomFromArray(this.messageTemplates.simpleText);
        
      case 'complexText':
        return this.getRandomFromArray(this.messageTemplates.complexText);
        
      case 'commands':
        return this.getRandomFromArray(this.messageTemplates.commands);
        
      case 'images':
        return {
          type: 'image',
          data: this.generateMockImageData()
        };
        
      case 'mixed':
        // Комбинированный запрос
        const text = this.getRandomFromArray(this.messageTemplates.questions);
        return `${text} И еще, ${this.getRandomFromArray(this.messageTemplates.simpleText)}`;
        
      default:
        return this.getRandomFromArray(this.messageTemplates.simpleText);
    }
  }

  /**
   * Генерация мок-данных изображения
   */
  generateMockImageData() {
    return [
      {
        file_id: `test_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file_unique_id: `unique_${Math.random().toString(36).substr(2, 9)}`,
        width: 800 + Math.floor(Math.random() * 1200),
        height: 600 + Math.floor(Math.random() * 800),
        file_size: 50000 + Math.floor(Math.random() * 200000)
      }
    ];
  }

  /**
   * Симуляция отправки сообщения через систему очередей
   */
  async sendMessage(user, message) {
    const startTime = Date.now();
    
    try {
      this.testStats.totalRequests++;
      this.testStats.currentConcurrency++;
      
      if (this.testStats.currentConcurrency > this.testStats.peakConcurrency) {
        this.testStats.peakConcurrency = this.testStats.currentConcurrency;
      }
      
      let job;
      
      if (typeof message === 'object' && message.type === 'image') {
        // Обработка изображения
        job = await this.queueManager.addImageProcessingJob({
          userId: user.id,
          chatId: user.id,
          photoData: message.data,
          processingType: 'analyze',
          priority: Math.floor(Math.random() * 3),
          timestamp: new Date().toISOString(),
          testRequest: true, // Отключаем реальную отправку
          userInfo: {
            firstName: user.name,
            testUser: true
          }
        });
      } else if (typeof message === 'string' && message.startsWith('/')) {
        // Команда
        job = await this.queueManager.addNotificationJob({
          userId: user.id,
          chatId: user.id,
          type: 'command_response',
          command: message,
          priority: 0, // Высокий приоритет для команд
          timestamp: new Date().toISOString(),
          testRequest: true
        });
      } else {
        // Текстовое сообщение
        const messageType = this.classifyMessage(message);
        const priority = messageType === 'complex' ? 2 : messageType === 'question' ? 1 : 0;
        
        job = await this.queueManager.addTextGenerationJob({
          userId: user.id,
          chatId: user.id,
          messageText: message,
          messageType: messageType,
          priority: priority,
          timestamp: new Date().toISOString(),
          testRequest: true,
          userInfo: {
            firstName: user.name,
            testUser: true
          }
        });
      }
      
      const queueTime = Date.now() - startTime;
      this.testStats.queueTimes.push(queueTime);
      this.testStats.successfulRequests++;
      
      // Обновляем метрики пользователя
      user.messagesCount++;
      user.lastMessageTime = Date.now();
      
      console.log(`✅ ${user.name}: Сообщение добавлено в очередь (ID: ${job.id}, время: ${queueTime}ms)`);
      
      return { success: true, jobId: job.id, queueTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.testStats.failedRequests++;
      this.testStats.responseTime.push(responseTime);
      
      // Записываем ошибку
      const errorType = error.name || 'UnknownError';
      this.testStats.errors[errorType] = (this.testStats.errors[errorType] || 0) + 1;
      
      console.error(`❌ ${user.name}: Ошибка отправки - ${error.message} (время: ${responseTime}ms)`);
      
      return { success: false, error: error.message, responseTime };
      
    } finally {
      this.testStats.currentConcurrency--;
    }
  }

  /**
   * Классификация сообщения для определения приоритета
   */
  classifyMessage(message) {
    if (message.length > 100) return 'complex';
    if (message.includes('?') || message.includes('как') || message.includes('что')) return 'question';
    if (message.length < 20) return 'simple';
    return 'medium';
  }

  /**
   * Симуляция пользовательской сессии
   */
  async simulateUserSession(user, duration) {
    user.isActive = true;
    user.sessionStartTime = Date.now();
    
    console.log(`👤 ${user.name}: Начинаю сессию на ${Math.round(duration/1000)}с`);
    
    const sessionEndTime = Date.now() + duration;
    
    while (Date.now() < sessionEndTime && user.isActive) {
      try {
        // Генерируем сообщение
        const messageType = this.getRandomMessageType();
        const message = this.generateMessage(messageType);
        
        // Отправляем сообщение
        await this.sendMessage(user, message);
        
        // Ждем перед следующим сообщением
        const delay = user.messageFrequency * (0.5 + Math.random());
        await this.sleep(delay);
        
      } catch (error) {
        console.error(`❌ ${user.name}: Ошибка в сессии - ${error.message}`);
        await this.sleep(1000); // Пауза при ошибке
      }
    }
    
    user.isActive = false;
    const sessionDuration = Date.now() - user.sessionStartTime;
    
    console.log(`👋 ${user.name}: Завершил сессию (${Math.round(sessionDuration/1000)}с, ${user.messagesCount} сообщений)`);
    
    return {
      userId: user.id,
      duration: sessionDuration,
      messagesCount: user.messagesCount,
      averageMessageInterval: sessionDuration / user.messagesCount
    };
  }

  /**
   * Мониторинг системы во время тестирования
   */
  async monitorSystemDuringTest() {
    const monitoringInterval = 10000; // Каждые 10 секунд
    
    while (this.testStats.startTime && !this.testStats.endTime) {
      try {
        // Получаем статистику очередей
        const queueStats = await this.queueManager.getQueueStats();
        
        // Получаем health check
        const health = await this.queueManager.healthCheck();
        
        // Системные метрики
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const currentTime = Date.now();
        const elapsedTime = Math.round((currentTime - this.testStats.startTime) / 1000);
        
        console.log('\n📊 === МОНИТОРИНГ СИСТЕМЫ ===');
        console.log(`⏱️  Время тестирования: ${elapsedTime}с`);
        console.log(`🏥 Статус системы: ${health.status}`);
        console.log(`📈 Всего запросов: ${this.testStats.totalRequests}`);
        console.log(`✅ Успешных: ${this.testStats.successfulRequests}`);
        console.log(`❌ Неудачных: ${this.testStats.failedRequests}`);
        console.log(`⚡ Текущая нагрузка: ${this.testStats.currentConcurrency} одновременных`);
        console.log(`🔝 Пиковая нагрузка: ${this.testStats.peakConcurrency} одновременных`);
        
        // Статистика очередей
        console.log('\n📋 Очереди:');
        for (const [name, stats] of Object.entries(queueStats)) {
          console.log(`   ${name}: ожидают ${stats.waiting}, активных ${stats.active}, завершено ${stats.completed}, ошибок ${stats.failed}`);
        }
        
        // Память
        console.log(`\n🧠 Память: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        
        // Средние времена
        if (this.testStats.queueTimes.length > 0) {
          const avgQueueTime = this.testStats.queueTimes.reduce((a, b) => a + b, 0) / this.testStats.queueTimes.length;
          console.log(`⏱️  Среднее время добавления в очередь: ${avgQueueTime.toFixed(2)}ms`);
        }
        
        console.log('===============================\n');
        
      } catch (error) {
        console.error('❌ Ошибка мониторинга:', error.message);
      }
      
      await this.sleep(monitoringInterval);
    }
  }

  /**
   * Сценарий "Пиковая нагрузка"
   */
  async runPeakLoadScenario(duration = 60000) {
    console.log('\n🚀 === СЦЕНАРИЙ: ПИКОВАЯ НАГРУЗКА ===');
    console.log(`Симуляция внезапного всплеска активности: ${this.config.loadTypes.peak.users} пользователей`);
    
    const users = Array.from({ length: this.config.loadTypes.peak.users }, (_, i) => 
      this.createVirtualUser(100000 + i)
    );
    
    // Запускаем всех пользователей одновременно
    const sessionPromises = users.map(user => 
      this.simulateUserSession(user, duration * (0.8 + Math.random() * 0.4))
    );
    
    await Promise.all(sessionPromises);
    
    console.log('✅ Сценарий пиковой нагрузки завершен');
  }

  /**
   * Сценарий "Постепенное увеличение нагрузки"
   */
  async runGradualLoadScenario(duration = 180000) {
    console.log('\n📈 === СЦЕНАРИЙ: ПОСТЕПЕННОЕ УВЕЛИЧЕНИЕ НАГРУЗКИ ===');
    console.log('Симуляция постепенного роста числа пользователей');
    
    const steps = 10;
    const stepDuration = duration / steps;
    const maxUsers = this.config.loadTypes.heavy.users;
    
    for (let step = 1; step <= steps; step++) {
      const usersInStep = Math.ceil((step / steps) * maxUsers);
      console.log(`\n📊 Шаг ${step}/${steps}: Запуск ${usersInStep} пользователей`);
      
      const users = Array.from({ length: usersInStep }, (_, i) => 
        this.createVirtualUser(200000 + (step * 1000) + i)
      );
      
      // Запускаем пользователей с небольшими задержками
      const sessionPromises = users.map((user, index) => {
        const delay = index * 100; // Задержка между запусками пользователей
        return new Promise(resolve => {
          setTimeout(async () => {
            const sessionResult = await this.simulateUserSession(user, stepDuration);
            resolve(sessionResult);
          }, delay);
        });
      });
      
      // Ждем завершения шага
      await Promise.allSettled(sessionPromises);
    }
    
    console.log('✅ Сценарий постепенного увеличения завершен');
  }

  /**
   * Сценарий "Смешанная нагрузка"
   */
  async runMixedLoadScenario(duration = 240000) {
    console.log('\n🎭 === СЦЕНАРИЙ: СМЕШАННАЯ НАГРУЗКА ===');
    console.log('Симуляция реальной работы с разными типами пользователей');
    
    const userTypes = [
      { count: 20, activity: 'high', messageFreq: 500 },    // Активные пользователи
      { count: 30, activity: 'medium', messageFreq: 2000 }, // Обычные пользователи
      { count: 25, activity: 'low', messageFreq: 5000 },    // Пассивные пользователи
      { count: 10, activity: 'burst', messageFreq: 100 }    // Спам-боты (тест защиты)
    ];
    
    const allUsers = [];
    let userIdCounter = 300000;
    
    // Создаем пользователей разных типов
    for (const userType of userTypes) {
      for (let i = 0; i < userType.count; i++) {
        const user = this.createVirtualUser(userIdCounter++);
        user.messageFrequency = userType.messageFreq;
        user.activity = userType.activity;
        allUsers.push(user);
      }
    }
    
    // Запускаем пользователей волнами
    const waveSize = 15;
    const waves = Math.ceil(allUsers.length / waveSize);
    
    for (let wave = 0; wave < waves; wave++) {
      const waveUsers = allUsers.slice(wave * waveSize, (wave + 1) * waveSize);
      console.log(`🌊 Волна ${wave + 1}/${waves}: ${waveUsers.length} пользователей`);
      
      const wavePromises = waveUsers.map(user => 
        this.simulateUserSession(user, duration * (0.7 + Math.random() * 0.6))
      );
      
      // Небольшая задержка между волнами
      if (wave < waves - 1) {
        setTimeout(() => {}, 2000);
      }
      
      await Promise.allSettled(wavePromises);
    }
    
    console.log('✅ Сценарий смешанной нагрузки завершен');
  }

  /**
   * Главный метод запуска тестирования
   */
  async runComprehensiveStressTest() {
    console.log('\n🧪 === КОМПЛЕКСНЫЙ СТРЕСС-ТЕСТ СИСТЕМЫ ===');
    console.log(`⏱️  Общая продолжительность: ${Math.round(this.config.duration / 1000 / 60)} минут`);
    console.log(`👥 Максимальное количество пользователей: ${this.config.totalUsers}`);
    console.log('');
    
    this.testStats.startTime = Date.now();
    
    try {
      // Запускаем мониторинг в фоне
      const monitoringPromise = this.monitorSystemDuringTest();
      
      // Выполняем различные сценарии нагрузки
      await this.runPeakLoadScenario(60000);           // 1 минута пиковой нагрузки
      await this.sleep(10000);                          // 10 секунд отдыха
      
      await this.runGradualLoadScenario(120000);        // 2 минуты постепенного роста
      await this.sleep(10000);                          // 10 секунд отдыха
      
      await this.runMixedLoadScenario(120000);          // 2 минуты смешанной нагрузки
      
      this.testStats.endTime = Date.now();
      
      // Ждем завершения активных задач
      console.log('\n⏳ Ожидание завершения активных задач...');
      await this.waitForQueueCompletion(30000);
      
      // Генерируем итоговый отчет
      await this.generateFinalReport();
      
    } catch (error) {
      console.error('💥 Критическая ошибка во время тестирования:', error);
      this.testStats.endTime = Date.now();
    }
    
    console.log('\n🎉 === СТРЕСС-ТЕСТ ЗАВЕРШЕН ===');
  }

  /**
   * Ожидание завершения активных задач в очередях
   */
  async waitForQueueCompletion(maxWaitTime = 60000) {
    const startWait = Date.now();
    
    while (Date.now() - startWait < maxWaitTime) {
      try {
        const queueStats = await this.queueManager.getQueueStats();
        const totalActive = Object.values(queueStats).reduce((sum, stats) => sum + (stats.active || 0), 0);
        
        if (totalActive === 0) {
          console.log('✅ Все активные задачи завершены');
          break;
        }
        
        console.log(`⏳ Ожидание завершения ${totalActive} активных задач...`);
        await this.sleep(2000);
        
      } catch (error) {
        console.error('❌ Ошибка проверки очередей:', error.message);
        break;
      }
    }
  }

  /**
   * Генерация итогового отчета
   */
  async generateFinalReport() {
    console.log('\n📊 === ИТОГОВЫЙ ОТЧЕТ СТРЕСС-ТЕСТИРОВАНИЯ ===');
    
    const totalDuration = this.testStats.endTime - this.testStats.startTime;
    const totalRequests = this.testStats.totalRequests;
    const successRate = (this.testStats.successfulRequests / totalRequests * 100).toFixed(2);
    const avgRPS = (totalRequests / (totalDuration / 1000)).toFixed(2);
    
    console.log(`\n⏱️  ОБЩАЯ СТАТИСТИКА:`);
    console.log(`   Продолжительность: ${Math.round(totalDuration / 1000)}с`);
    console.log(`   Всего запросов: ${totalRequests}`);
    console.log(`   Успешных: ${this.testStats.successfulRequests} (${successRate}%)`);
    console.log(`   Неудачных: ${this.testStats.failedRequests}`);
    console.log(`   Средний RPS: ${avgRPS}`);
    console.log(`   Пиковая нагрузка: ${this.testStats.peakConcurrency} одновременных запросов`);
    
    // Статистика времени ответа
    if (this.testStats.queueTimes.length > 0) {
      const sortedTimes = this.testStats.queueTimes.sort((a, b) => a - b);
      const avgTime = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      const maxTime = sortedTimes[sortedTimes.length - 1];
      
      console.log(`\n⚡ ВРЕМЕНА ОТВЕТА (добавление в очередь):`);
      console.log(`   Среднее: ${avgTime.toFixed(2)}ms`);
      console.log(`   Медиана (P50): ${p50}ms`);
      console.log(`   P95: ${p95}ms`);
      console.log(`   P99: ${p99}ms`);
      console.log(`   Максимальное: ${maxTime}ms`);
    }
    
    // Статистика ошибок
    if (Object.keys(this.testStats.errors).length > 0) {
      console.log(`\n❌ ОШИБКИ:`);
      for (const [errorType, count] of Object.entries(this.testStats.errors)) {
        const percentage = (count / totalRequests * 100).toFixed(2);
        console.log(`   ${errorType}: ${count} (${percentage}%)`);
      }
    }
    
    // Финальная статистика очередей
    try {
      const finalQueueStats = await this.queueManager.getQueueStats();
      console.log(`\n📋 ФИНАЛЬНАЯ СТАТИСТИКА ОЧЕРЕДЕЙ:`);
      for (const [name, stats] of Object.entries(finalQueueStats)) {
        console.log(`   ${name}:`);
        console.log(`     Завершено: ${stats.completed || 0}`);
        console.log(`     Ошибок: ${stats.failed || 0}`);
        console.log(`     Ожидают: ${stats.waiting || 0}`);
        console.log(`     Активных: ${stats.active || 0}`);
      }
    } catch (error) {
      console.error('❌ Ошибка получения финальной статистики:', error.message);
    }
    
    // Рекомендации
    console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
    if (successRate < 95) {
      console.log(`   ⚠️  Низкий процент успешных запросов (${successRate}%). Рекомендуется:`);
      console.log(`      - Увеличить количество воркеров`);
      console.log(`      - Оптимизировать Redis конфигурацию`);
      console.log(`      - Проверить системные ресурсы`);
    }
    
    if (this.testStats.queueTimes.length > 0) {
      const avgTime = this.testStats.queueTimes.reduce((a, b) => a + b, 0) / this.testStats.queueTimes.length;
      if (avgTime > 100) {
        console.log(`   ⚠️  Высокое время добавления в очередь (${avgTime.toFixed(2)}ms). Рекомендуется:`);
        console.log(`      - Оптимизировать Redis соединение`);
        console.log(`      - Включить pipelining`);
        console.log(`      - Проверить сетевую латентность`);
      }
    }
    
    if (avgRPS < 10) {
      console.log(`   ⚠️  Низкая пропускная способность (${avgRPS} RPS). Рекомендуется:`);
      console.log(`      - Увеличить concurrency воркеров`);
      console.log(`      - Оптимизировать алгоритмы обработки`);
      console.log(`      - Добавить горизонтальное масштабирование`);
    }
    
    if (successRate >= 98 && avgRPS >= 20) {
      console.log(`   ✅ Отличная производительность! Система готова к production нагрузке.`);
    }
    
    console.log(`\n📈 Мониторинг доступен: http://localhost:${this.config.monitoringPort}/admin/queues`);
    console.log('===============================================');
  }

  /**
   * Вспомогательные методы
   */
  getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Быстрый тест производительности
   */
  async runQuickPerformanceTest() {
    console.log('\n⚡ === БЫСТРЫЙ ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ ===');
    console.log('Тестирование базовой производительности системы (30 секунд)');
    
    this.testStats.startTime = Date.now();
    
    // Создаем 10 пользователей для быстрого теста
    const users = Array.from({ length: 10 }, (_, i) => this.createVirtualUser(400000 + i));
    
    // Запускаем мониторинг
    const monitoringPromise = this.monitorSystemDuringTest();
    
    // Симулируем нагрузку
    const sessionPromises = users.map(user => 
      this.simulateUserSession(user, 30000) // 30 секунд
    );
    
    await Promise.all(sessionPromises);
    this.testStats.endTime = Date.now();
    
    // Краткий отчет
    const duration = this.testStats.endTime - this.testStats.startTime;
    const rps = (this.testStats.totalRequests / (duration / 1000)).toFixed(2);
    const successRate = (this.testStats.successfulRequests / this.testStats.totalRequests * 100).toFixed(2);
    
    console.log('\n📊 РЕЗУЛЬТАТЫ БЫСТРОГО ТЕСТА:');
    console.log(`   RPS: ${rps}`);
    console.log(`   Успешность: ${successRate}%`);
    console.log(`   Всего запросов: ${this.testStats.totalRequests}`);
    
    if (rps >= 15 && successRate >= 95) {
      console.log('   ✅ Система работает хорошо!');
    } else {
      console.log('   ⚠️  Рекомендуется оптимизация');
    }
  }

  /**
   * Cleanup ресурсов после тестирования
   */
  async cleanup() {
    console.log('\n🧹 Очистка ресурсов после тестирования...');
    
    try {
      if (this.queueManager) {
        await this.queueManager.shutdown();
      }
      
      if (this.metricsCollector) {
        await this.metricsCollector.shutdown();
      }
      
      console.log('✅ Cleanup завершен');
    } catch (error) {
      console.error('❌ Ошибка при cleanup:', error.message);
    }
  }
}

// Экспорт класса для использования в других модулях
module.exports = ComprehensiveStressTest;

// Запуск тестирования если файл выполняется напрямую
if (require.main === module) {
  async function main() {
    const stressTest = new ComprehensiveStressTest();
    
    // Обработка сигналов завершения
    process.on('SIGINT', async () => {
      console.log('\n📡 Получен сигнал SIGINT, останавливаю тестирование...');
      await stressTest.cleanup();
      process.exit(0);
    });
    
    try {
      // Выбираем тип тестирования
      const testType = process.argv[2] || 'comprehensive';
      
      switch (testType) {
        case 'quick':
          await stressTest.runQuickPerformanceTest();
          break;
        case 'peak':
          await stressTest.runPeakLoadScenario(120000);
          break;
        case 'gradual':
          await stressTest.runGradualLoadScenario(180000);
          break;
        case 'mixed':
          await stressTest.runMixedLoadScenario(240000);
          break;
        default:
          await stressTest.runComprehensiveStressTest();
      }
      
    } catch (error) {
      console.error('💥 Критическая ошибка:', error);
    } finally {
      await stressTest.cleanup();
    }
  }
  
  main();
}
