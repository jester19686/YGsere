/**
 * Скрипт для тестирования системы очередей
 * Симулирует множественные одновременные запросы
 */

const QueuedBot = require('./server-bot/QueuedBot');
const MonitoringServer = require('./lib/MonitoringServer');

class QueueSystemTester {
  constructor() {
    this.queuedBot = null;
    this.monitoringServer = null;
    this.testResults = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      startTime: null,
      endTime: null
    };
  }

  async init() {
    console.log('🔧 Инициализация тестовой системы...');
    
    // Создание бота
    this.queuedBot = new QueuedBot();
    
    // Создание monitoring server
    this.monitoringServer = new MonitoringServer(this.queuedBot.queueManager, 3001);
    
    // Запуск monitoring server
    await this.monitoringServer.start();
    
    console.log('✅ Тестовая система готова');
  }

  async testConcurrentTextRequests(count = 10) {
    console.log(`\n📝 Тестирование ${count} одновременных текстовых запросов...`);
    
    const testUserId = 123456789;
    const testChatId = 123456789;
    
    const requests = [];
    const startTime = Date.now();
    this.testResults.startTime = new Date();
    
    for (let i = 0; i < count; i++) {
      const testMessage = `Тестовое сообщение #${i + 1} - ${this.generateRandomText()}`;
      
      const requestPromise = this.queuedBot.queueManager.addTextGenerationJob({
        userId: testUserId + i, // Разные пользователи
        chatId: testChatId,
        messageText: testMessage,
        messageType: this.getRandomMessageType(),
        priority: Math.floor(Math.random() * 3) - 1, // -1, 0, 1
        timestamp: new Date().toISOString(),
        testRequest: true
      });
      
      requests.push(requestPromise);
    }

    try {
      const jobs = await Promise.all(requests);
      const endTime = Date.now();
      
      console.log(`✅ ${jobs.length} запросов добавлено в очередь за ${endTime - startTime}ms`);
      
      // Ждем выполнения всех задач
      await this.waitForJobsCompletion(jobs);
      
      this.testResults.totalRequests += count;
      this.testResults.successfulRequests += jobs.length;
      
    } catch (error) {
      console.error('❌ Ошибка при тестировании текстовых запросов:', error);
      this.testResults.failedRequests += count;
    }
  }

  async testConcurrentImageRequests(count = 5) {
    console.log(`\n🖼️ Тестирование ${count} одновременных запросов обработки изображений...`);
    
    const testUserId = 987654321;
    const testChatId = 987654321;
    
    // Мок данных для изображения
    const mockPhotoData = [
      {
        file_id: 'mock_file_id_1',
        file_unique_id: 'mock_unique_1',
        width: 1920,
        height: 1080,
        file_size: 500000
      }
    ];

    const requests = [];
    const startTime = Date.now();
    
    for (let i = 0; i < count; i++) {
      const requestPromise = this.queuedBot.queueManager.addImageProcessingJob({
        userId: testUserId + i,
        chatId: testChatId,
        photoData: mockPhotoData,
        processingType: this.getRandomImageProcessingType(),
        priority: 1,
        timestamp: new Date().toISOString(),
        testRequest: true
      });
      
      requests.push(requestPromise);
    }

    try {
      const jobs = await Promise.all(requests);
      const endTime = Date.now();
      
      console.log(`✅ ${jobs.length} запросов на обработку изображений добавлено за ${endTime - startTime}ms`);
      
      await this.waitForJobsCompletion(jobs);
      
      this.testResults.totalRequests += count;
      this.testResults.successfulRequests += jobs.length;
      
    } catch (error) {
      console.error('❌ Ошибка при тестировании обработки изображений:', error);
      this.testResults.failedRequests += count;
    }
  }

  async testMixedRequests(textCount = 15, imageCount = 8) {
    console.log(`\n🔀 Тестирование смешанных запросов: ${textCount} текстовых + ${imageCount} изображений...`);
    
    const allPromises = [];
    
    // Добавляем текстовые запросы
    for (let i = 0; i < textCount; i++) {
      allPromises.push(
        this.queuedBot.queueManager.addTextGenerationJob({
          userId: 111000 + i,
          chatId: 111000,
          messageText: `Смешанный тест - текст #${i + 1}`,
          messageType: this.getRandomMessageType(),
          priority: Math.floor(Math.random() * 3) - 1,
          timestamp: new Date().toISOString(),
          testRequest: true
        })
      );
    }
    
    // Добавляем запросы на обработку изображений
    for (let i = 0; i < imageCount; i++) {
      allPromises.push(
        this.queuedBot.queueManager.addImageProcessingJob({
          userId: 222000 + i,
          chatId: 222000,
          photoData: [{ file_id: `mock_${i}`, width: 800, height: 600 }],
          processingType: this.getRandomImageProcessingType(),
          priority: 1,
          timestamp: new Date().toISOString(),
          testRequest: true
        })
      );
    }

    const startTime = Date.now();
    
    try {
      const jobs = await Promise.all(allPromises);
      const endTime = Date.now();
      
      console.log(`✅ ${jobs.length} смешанных запросов добавлено за ${endTime - startTime}ms`);
      
      await this.waitForJobsCompletion(jobs);
      
      this.testResults.totalRequests += textCount + imageCount;
      this.testResults.successfulRequests += jobs.length;
      
    } catch (error) {
      console.error('❌ Ошибка при тестировании смешанных запросов:', error);
      this.testResults.failedRequests += textCount + imageCount;
    }
  }

  async waitForJobsCompletion(jobs, timeout = 60000) {
    console.log(`⏳ Ожидание завершения ${jobs.length} задач (таймаут: ${timeout/1000}с)...`);
    
    const startTime = Date.now();
    const jobPromises = jobs.map(job => job.waitUntilFinished());
    
    try {
      await Promise.race([
        Promise.all(jobPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      const endTime = Date.now();
      console.log(`✅ Все задачи завершены за ${endTime - startTime}ms`);
      
    } catch (error) {
      if (error.message === 'Timeout') {
        console.log(`⚠️ Таймаут ожидания. Некоторые задачи могут еще выполняться...`);
      } else {
        console.error('❌ Ошибка ожидания завершения задач:', error);
      }
    }
  }

  async getSystemStats() {
    try {
      const stats = await this.queuedBot.queueManager.getQueueStats();
      return stats;
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      return null;
    }
  }

  async printDetailedStats() {
    console.log('\n📊 === ДЕТАЛЬНАЯ СТАТИСТИКА СИСТЕМЫ ===');
    
    const stats = await this.getSystemStats();
    if (stats) {
      for (const [queueName, queueStats] of Object.entries(stats)) {
        console.log(`\n🔸 ${queueName.toUpperCase()}:`);
        if (queueStats.error) {
          console.log(`   ❌ Ошибка: ${queueStats.error}`);
        } else {
          console.log(`   📥 Ожидают: ${queueStats.waiting}`);
          console.log(`   ⚡ Активные: ${queueStats.active}`);
          console.log(`   ✅ Завершено: ${queueStats.completed}`);
          console.log(`   ❌ Неудачные: ${queueStats.failed}`);
          console.log(`   📊 Всего: ${queueStats.total}`);
        }
      }
    }
    
    console.log('\n🎯 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
    console.log(`📝 Всего запросов: ${this.testResults.totalRequests}`);
    console.log(`✅ Успешных: ${this.testResults.successfulRequests}`);
    console.log(`❌ Неудачных: ${this.testResults.failedRequests}`);
    
    if (this.testResults.startTime) {
      const duration = (new Date() - this.testResults.startTime) / 1000;
      console.log(`⏱️ Время выполнения: ${duration.toFixed(2)}с`);
      console.log(`🚀 Производительность: ${(this.testResults.totalRequests / duration).toFixed(2)} запросов/сек`);
    }
  }

  generateRandomText() {
    const phrases = [
      'Как дела?',
      'Расскажи анекдот',
      'Что такое искусственный интеллект?',
      'Помоги с математикой',
      'Переведи текст на английский',
      'Напиши стихотворение',
      'Объясни квантовую физику',
      'Дай совет по программированию'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  getRandomMessageType() {
    const types = ['simple', 'question', 'complex', 'normal'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getRandomImageProcessingType() {
    const types = ['analyze', 'enhance', 'extract_text', 'detect_objects', 'generate_description'];
    return types[Math.floor(Math.random() * types.length)];
  }

  async runFullTest() {
    console.log('🚀 === ЗАПУСК ПОЛНОГО ТЕСТИРОВАНИЯ СИСТЕМЫ ОЧЕРЕДЕЙ ===\n');
    
    try {
      await this.init();
      
      // Фаза 1: Тестирование текстовых запросов
      await this.testConcurrentTextRequests(20);
      await this.sleep(2000);
      
      // Фаза 2: Тестирование обработки изображений
      await this.testConcurrentImageRequests(10);
      await this.sleep(2000);
      
      // Фаза 3: Смешанное тестирование
      await this.testMixedRequests(25, 12);
      await this.sleep(3000);
      
      // Финальная статистика
      await this.printDetailedStats();
      
      console.log('\n🎉 === ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');
      console.log('📋 Проверьте Bull Board: http://localhost:3001/admin/queues');
      console.log('📊 API статистики: http://localhost:3001/api/stats');
      
    } catch (error) {
      console.error('💥 Критическая ошибка при тестировании:', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Очистка ресурсов...');
    
    if (this.monitoringServer) {
      await this.monitoringServer.stop();
    }
    
    if (this.queuedBot) {
      await this.queuedBot.shutdown();
    }
    
    console.log('✅ Очистка завершена');
  }
}

// Запуск тестирования
async function main() {
  const tester = new QueueSystemTester();
  
  // Обработка сигналов завершения
  process.on('SIGINT', async () => {
    console.log('\n📡 Получен сигнал SIGINT...');
    await tester.cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n📡 Получен сигнал SIGTERM...');
    await tester.cleanup();
    process.exit(0);
  });
  
  try {
    await tester.runFullTest();
  } catch (error) {
    console.error('💥 Ошибка в main:', error);
    await tester.cleanup();
    process.exit(1);
  }
}

// Запуск только если файл выполняется напрямую
if (require.main === module) {
  main();
}

module.exports = QueueSystemTester;
