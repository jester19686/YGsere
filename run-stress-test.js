#!/usr/bin/env node

/**
 * 🚀 ГЛАВНЫЙ СКРИПТ СТРЕСС-ТЕСТИРОВАНИЯ
 * 
 * Запускает комплексное тестирование системы очередей
 * с мониторингом производительности в реальном времени
 */

require('dotenv').config();

const ComprehensiveStressTest = require('./comprehensive-stress-test');
const PerformanceMonitor = require('./performance-monitor');

// ASCII Art заставка
console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║      🧪 КОМПЛЕКСНОЕ СТРЕСС-ТЕСТИРОВАНИЕ СИСТЕМЫ 🚀         ║
║                                                              ║
║   📊 Performance Monitoring + 🔄 Queue Load Testing        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

class StressTestRunner {
  constructor() {
    this.stressTest = new ComprehensiveStressTest();
    this.performanceMonitor = new PerformanceMonitor(3001, 5000);
    this.testType = process.argv[2] || 'comprehensive';
    this.isRunning = false;
  }

  /**
   * Отображение доступных типов тестов
   */
  showAvailableTests() {
    console.log('🧪 ДОСТУПНЫЕ ТИПЫ ТЕСТИРОВАНИЯ:\n');
    
    console.log('📊 БАЗОВЫЕ ТЕСТЫ:');
    console.log('   quick       - Быстрый тест (30 сек, 10 пользователей)');
    console.log('   medium      - Средний тест (2 мин, 25 пользователей)');
    console.log('   intensive   - Интенсивный тест (5 мин, 50 пользователей)');
    console.log('');
    
    console.log('🎯 СПЕЦИАЛИЗИРОВАННЫЕ ТЕСТЫ:');
    console.log('   peak        - Пиковая нагрузка (100 пользователей одновременно)');
    console.log('   gradual     - Постепенное увеличение нагрузки');
    console.log('   mixed       - Смешанные сценарии использования');
    console.log('   endurance   - Тест на выносливость (длительная нагрузка)');
    console.log('');
    
    console.log('🚀 КОМПЛЕКСНЫЕ ТЕСТЫ:');
    console.log('   comprehensive - Полный комплексный тест (все сценарии)');
    console.log('   production    - Имитация production нагрузки');
    console.log('');
    
    console.log('💡 ПРИМЕРЫ ЗАПУСКА:');
    console.log('   npm run stress:test quick');
    console.log('   node run-stress-test.js peak');
    console.log('   node run-stress-test.js comprehensive');
    console.log('');
  }

  /**
   * Проверка готовности системы к тестированию
   */
  async checkSystemReadiness() {
    console.log('🔍 Проверка готовности системы...\n');
    
    const checks = [
      { name: 'Redis соединение', check: () => this.checkRedis() },
      { name: 'Monitoring API', check: () => this.checkMonitoringAPI() },
      { name: 'Системные ресурсы', check: () => this.checkSystemResources() },
    ];
    
    let allPassed = true;
    
    for (const { name, check } of checks) {
      try {
        const result = await check();
        if (result.success) {
          console.log(`✅ ${name}: ${result.message}`);
        } else {
          console.log(`❌ ${name}: ${result.message}`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        allPassed = false;
      }
    }
    
    console.log('');
    
    if (!allPassed) {
      console.log('⚠️ Обнаружены проблемы с системой. Рекомендации:');
      console.log('   1. Убедитесь, что Redis запущен: redis-cli ping');
      console.log('   2. Запустите мониторинг: npm run bot:optimized');
      console.log('   3. Проверьте доступные ресурсы системы');
      console.log('');
      return false;
    }
    
    console.log('✅ Система готова к тестированию!\n');
    return true;
  }

  /**
   * Проверка Redis соединения
   */
  async checkRedis() {
    try {
      // Попытка подключения через QueueManager
      await this.stressTest.queueManager.connection.ping();
      return { 
        success: true, 
        message: `Подключен (${this.stressTest.queueManager.connection.options.host}:${this.stressTest.queueManager.connection.options.port})` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Недоступен - ${error.message}` 
      };
    }
  }

  /**
   * Проверка Monitoring API
   */
  async checkMonitoringAPI() {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
      
      if (response.data.status === 'healthy') {
        return { success: true, message: 'Доступен и работает' };
      } else {
        return { success: false, message: `Статус: ${response.data.status}` };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Недоступен - убедитесь, что мониторинг запущен' 
      };
    }
  }

  /**
   * Проверка системных ресурсов
   */
  async checkSystemResources() {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    if (memPercent > 85) {
      return { 
        success: false, 
        message: `Высокое использование памяти: ${memPercent}% (${memUsedMB}/${memTotalMB}MB)` 
      };
    }
    
    return { 
      success: true, 
      message: `Память: ${memPercent}% (${memUsedMB}/${memTotalMB}MB)` 
    };
  }

  /**
   * Запуск конкретного типа теста
   */
  async runTest(testType) {
    console.log(`🚀 Запуск теста: ${testType.toUpperCase()}\n`);
    
    // Запускаем мониторинг производительности
    await this.performanceMonitor.startMonitoring();
    
    try {
      switch (testType) {
        case 'quick':
          await this.stressTest.runQuickPerformanceTest();
          break;
          
        case 'medium':
          await this.runMediumTest();
          break;
          
        case 'intensive':
          await this.runIntensiveTest();
          break;
          
        case 'peak':
          await this.stressTest.runPeakLoadScenario(120000); // 2 минуты
          break;
          
        case 'gradual':
          await this.stressTest.runGradualLoadScenario(180000); // 3 минуты
          break;
          
        case 'mixed':
          await this.stressTest.runMixedLoadScenario(240000); // 4 минуты
          break;
          
        case 'endurance':
          await this.runEnduranceTest();
          break;
          
        case 'production':
          await this.runProductionSimulation();
          break;
          
        case 'comprehensive':
        default:
          await this.stressTest.runComprehensiveStressTest();
          break;
      }
      
    } catch (error) {
      console.error('💥 Ошибка во время тестирования:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('Stack trace:', error.stack);
      }
    } finally {
      // Останавливаем мониторинг и генерируем отчет
      await this.performanceMonitor.stopMonitoring();
    }
  }

  /**
   * Средний тест (2 минуты, 25 пользователей)
   */
  async runMediumTest() {
    console.log('📊 Средний тест: 25 пользователей, 2 минуты\n');
    
    // Создаем пользователей
    const users = Array.from({ length: 25 }, (_, i) => 
      this.stressTest.createVirtualUser(500000 + i)
    );
    
    // Запускаем пользователей волнами
    const waveSize = 5;
    for (let i = 0; i < users.length; i += waveSize) {
      const wave = users.slice(i, i + waveSize);
      console.log(`🌊 Запуск волны ${Math.floor(i / waveSize) + 1}: ${wave.length} пользователей`);
      
      const wavePromises = wave.map(user => 
        this.stressTest.simulateUserSession(user, 120000 * (0.8 + Math.random() * 0.4))
      );
      
      await Promise.allSettled(wavePromises);
      
      // Небольшая пауза между волнами
      if (i + waveSize < users.length) {
        await this.sleep(2000);
      }
    }
  }

  /**
   * Интенсивный тест (5 минут, 50 пользователей)
   */
  async runIntensiveTest() {
    console.log('🔥 Интенсивный тест: 50 пользователей, 5 минут\n');
    
    const users = Array.from({ length: 50 }, (_, i) => 
      this.stressTest.createVirtualUser(600000 + i)
    );
    
    // Имитируем реальную нагрузку с пиками
    const phases = [
      { duration: 60000, activeUsers: 20, name: 'Разогрев' },
      { duration: 120000, activeUsers: 35, name: 'Основная нагрузка' },
      { duration: 60000, activeUsers: 50, name: 'Пиковая нагрузка' },
      { duration: 90000, activeUsers: 30, name: 'Снижение' },
      { duration: 30000, activeUsers: 10, name: 'Завершение' }
    ];
    
    for (const phase of phases) {
      console.log(`📈 Фаза: ${phase.name} (${phase.activeUsers} пользователей, ${phase.duration/1000}с)`);
      
      const phaseUsers = users.slice(0, phase.activeUsers);
      const sessionPromises = phaseUsers.map(user => 
        this.stressTest.simulateUserSession(user, phase.duration * (0.9 + Math.random() * 0.2))
      );
      
      await Promise.allSettled(sessionPromises);
    }
  }

  /**
   * Тест на выносливость (длительная нагрузка)
   */
  async runEnduranceTest() {
    console.log('⏰ Тест на выносливость: 10 минут постоянной нагрузки\n');
    console.log('   Цель: выявление утечек памяти и деградации производительности\n');
    
    const duration = 10 * 60 * 1000; // 10 минут
    const concurrentUsers = 20;
    
    const users = Array.from({ length: concurrentUsers }, (_, i) => 
      this.stressTest.createVirtualUser(700000 + i)
    );
    
    // Настраиваем пользователей для длительной работы
    users.forEach(user => {
      user.messageFrequency = 3000 + Math.random() * 2000; // 3-5 секунд между сообщениями
      user.sessionDuration = duration;
    });
    
    console.log(`🔄 Запуск ${concurrentUsers} пользователей на ${duration/1000/60} минут...`);
    
    const sessionPromises = users.map(user => 
      this.stressTest.simulateUserSession(user, duration)
    );
    
    await Promise.all(sessionPromises);
    
    console.log('✅ Тест на выносливость завершен');
  }

  /**
   * Имитация production нагрузки
   */
  async runProductionSimulation() {
    console.log('🏢 Имитация production нагрузки\n');
    console.log('   Сценарий: реальные паттерны использования бота\n');
    
    // Различные типы пользователей с реальными характеристиками
    const userProfiles = [
      { type: 'casual', count: 40, frequency: 10000, activity: 0.3 },      // Случайные пользователи
      { type: 'regular', count: 30, frequency: 5000, activity: 0.6 },      // Обычные пользователи
      { type: 'power', count: 15, frequency: 2000, activity: 0.9 },        // Активные пользователи
      { type: 'automated', count: 10, frequency: 1000, activity: 1.0 },    // Автоматизированные системы
      { type: 'burst', count: 5, frequency: 500, activity: 0.8 }           // Пиковые пользователи
    ];
    
    const allUsers = [];
    let userIdCounter = 800000;
    
    // Создаем пользователей по профилям
    for (const profile of userProfiles) {
      console.log(`👥 Создание ${profile.count} пользователей типа ${profile.type}`);
      
      for (let i = 0; i < profile.count; i++) {
        const user = this.stressTest.createVirtualUser(userIdCounter++);
        user.messageFrequency = profile.frequency;
        user.activity = profile.activity;
        user.userType = profile.type;
        allUsers.push(user);
      }
    }
    
    // Симулируем рабочий день (7 часов сжато в 7 минут)
    const workdayPhases = [
      { name: 'Утренний пик', duration: 60000, users: 0.8 },
      { name: 'Рабочее время', duration: 180000, users: 0.6 },
      { name: 'Обеденный пик', duration: 45000, users: 0.9 },
      { name: 'После обеда', duration: 120000, users: 0.5 },
      { name: 'Вечерний пик', duration: 75000, users: 1.0 }
    ];
    
    for (const phase of workdayPhases) {
      const activeUserCount = Math.floor(allUsers.length * phase.users);
      const activeUsers = allUsers.slice(0, activeUserCount);
      
      console.log(`\n🕐 ${phase.name}: ${activeUsers.length} активных пользователей (${phase.duration/1000}с)`);
      
      const sessionPromises = activeUsers.map(user => 
        this.stressTest.simulateUserSession(user, phase.duration * (0.7 + Math.random() * 0.6))
      );
      
      await Promise.allSettled(sessionPromises);
    }
    
    console.log('\n✅ Имитация production нагрузки завершена');
  }

  /**
   * Обработка сигналов завершения
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isRunning) {
        console.log(`\n📡 Получен сигнал ${signal}, останавливаю тестирование...`);
        this.isRunning = false;
        
        try {
          await this.performanceMonitor.stopMonitoring();
          await this.stressTest.cleanup();
        } catch (error) {
          console.error('❌ Ошибка при завершении:', error.message);
        }
        
        console.log('✅ Тестирование корректно завершено');
        process.exit(0);
      }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Главный метод запуска
   */
  async run() {
    try {
      // Настройка graceful shutdown
      this.setupGracefulShutdown();
      
      // Проверка аргументов
      if (this.testType === 'help' || this.testType === '--help' || this.testType === '-h') {
        this.showAvailableTests();
        return;
      }
      
      console.log('🌟 Информация о системе:');
      console.log(`   📦 Node.js: ${process.version}`);
      console.log(`   🖥️  Platform: ${process.platform} ${process.arch}`);
      console.log(`   🧠 Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
      console.log(`   ⏱️  PID: ${process.pid}`);
      console.log('');
      
      // Проверка готовности системы
      const systemReady = await this.checkSystemReadiness();
      if (!systemReady) {
        console.log('🛑 Тестирование отменено из-за проблем с системой');
        return;
      }
      
      this.isRunning = true;
      
      // Запуск тестирования
      console.log(`🎯 Тип тестирования: ${this.testType.toUpperCase()}`);
      console.log(`⏱️  Начало: ${new Date().toLocaleString('ru-RU')}`);
      console.log(`📊 Мониторинг: http://localhost:3001/admin/queues`);
      console.log('');
      
      await this.runTest(this.testType);
      
      console.log('\n🎉 === ТЕСТИРОВАНИЕ УСПЕШНО ЗАВЕРШЕНО ===');
      console.log(`⏱️  Завершено: ${new Date().toLocaleString('ru-RU')}`);
      console.log('📊 Детальные отчеты сохранены в файлы');
      console.log('📈 Проверьте логи мониторинга для дополнительной информации');
      
    } catch (error) {
      console.error('\n💥 Критическая ошибка:');
      console.error(`   ${error.name}: ${error.message}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.error('\n📚 Stack trace:');
        console.error(error.stack);
      }
      
      console.log('\n💡 Возможные решения:');
      console.log('   1. Проверьте, что Redis запущен и доступен');
      console.log('   2. Убедитесь, что система мониторинга запущена');
      console.log('   3. Проверьте доступность системных ресурсов');
      console.log('   4. Запустите с флагом --help для справки');
      
    } finally {
      // Cleanup
      if (this.isRunning) {
        await this.performanceMonitor.stopMonitoring();
        await this.stressTest.cleanup();
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  const runner = new StressTestRunner();
  runner.run();
}

module.exports = StressTestRunner;
