/**
 * Быстрый тест для проверки исправления обработки изображений
 */

const QueuedBot = require('./server-bot/QueuedBot');

class ImageProcessingTester {
  constructor() {
    this.queuedBot = null;
  }

  async init() {
    console.log('🔧 Инициализация тестера обработки изображений...');
    this.queuedBot = new QueuedBot();
    console.log('✅ Тестер готов');
  }

  async testImageProcessingWithMock() {
    console.log('\n🖼️ Тестирование обработки изображений с мок-данными...');
    
    // Мок данных для изображения (реальный file_id не нужен для тестирования воркера)
    const mockPhotoData = [
      {
        file_id: 'BAADBAADrwADBREAAUmcTVqt4RxPAg', // Пример file_id
        file_unique_id: 'AQADBREAAF6peHBy',
        width: 800,
        height: 600,
        file_size: 45231
      }
    ];

    const testCases = [
      { type: 'analyze', description: 'Анализ изображения' },
      { type: 'extract_text', description: 'Извлечение текста' },
      { type: 'detect_objects', description: 'Поиск объектов' },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${i + 1}. Тестирую: ${testCase.description}`);
      
      try {
        const job = await this.queuedBot.queueManager.addImageProcessingJob({
          userId: 999888777 + i,
          chatId: 999888777,
          photoData: mockPhotoData,
          processingType: testCase.type,
          priority: 1,
          timestamp: new Date().toISOString(),
          testRequest: true // Важно! Отключает реальную загрузку изображения
        });

        console.log(`✅ Задача ${testCase.type} добавлена в очередь (ID: ${job.id})`);

        // Ждем некоторое время для обработки
        await this.sleep(2000);
        
      } catch (error) {
        console.error(`❌ Ошибка при тестировании ${testCase.type}:`, error.message);
      }
    }
  }

  async testConcurrentImageProcessing(count = 3) {
    console.log(`\n🔀 Тестирование ${count} одновременных обработок изображений...`);
    
    const mockPhotoData = [
      {
        file_id: 'BAADBAADrwADBREAAUmcTVqt4RxPAg',
        file_unique_id: 'AQADBREAAF6peHBy',
        width: 1920,
        height: 1080,
        file_size: 150000
      }
    ];

    const promises = [];
    
    for (let i = 0; i < count; i++) {
      const promise = this.queuedBot.queueManager.addImageProcessingJob({
        userId: 777666555 + i,
        chatId: 777666555,
        photoData: mockPhotoData,
        processingType: 'analyze',
        priority: 1,
        timestamp: new Date().toISOString(),
        testRequest: true
      });
      
      promises.push(promise);
    }

    try {
      const jobs = await Promise.all(promises);
      console.log(`✅ ${jobs.length} задач обработки изображений добавлено одновременно`);
      
      // Ждем выполнения
      await this.sleep(5000);
      
    } catch (error) {
      console.error('❌ Ошибка при одновременном добавлении задач:', error.message);
    }
  }

  async checkQueueStatus() {
    console.log('\n📊 Проверка статуса очередей...');
    
    try {
      const stats = await this.queuedBot.queueManager.getQueueStats();
      
      for (const [queueName, queueStats] of Object.entries(stats)) {
        if (queueName === 'imageProcessing') {
          console.log(`\n🖼️ Очередь обработки изображений:`);
          console.log(`   📥 Ожидают: ${queueStats.waiting}`);
          console.log(`   ⚡ Активные: ${queueStats.active}`);
          console.log(`   ✅ Завершено: ${queueStats.completed}`);
          console.log(`   ❌ Неудачные: ${queueStats.failed}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Ошибка получения статуса:', error.message);
    }
  }

  async testImageProcessingWorkerDirectly() {
    console.log('\n🔧 Прямое тестирование ImageProcessingWorker...');
    
    try {
      // Получаем воркер напрямую
      const imageWorker = this.queuedBot.workers.imageProcessing;
      
      if (!imageWorker) {
        console.error('❌ ImageProcessingWorker не найден');
        return;
      }

      console.log('📊 Статус воркера:', imageWorker.getStats());
      
      // Можно добавить дополнительные тесты воркера здесь
      
    } catch (error) {
      console.error('❌ Ошибка тестирования воркера:', error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runQuickTest() {
    console.log('🚀 === БЫСТРЫЙ ТЕСТ ОБРАБОТКИ ИЗОБРАЖЕНИЙ ===\n');
    
    try {
      await this.init();
      
      // Даем время воркерам инициализироваться
      await this.sleep(2000);
      
      // Тест 1: Мок обработка (без реальной загрузки изображений)
      await this.testImageProcessingWithMock();
      
      // Небольшая пауза
      await this.sleep(3000);
      
      // Тест 2: Одновременная обработка
      await this.testConcurrentImageProcessing(3);
      
      // Пауза для обработки
      await this.sleep(5000);
      
      // Тест 3: Проверка статуса
      await this.checkQueueStatus();
      
      // Тест 4: Проверка воркера
      await this.testImageProcessingWorkerDirectly();
      
      console.log('\n🎉 === ТЕСТ ЗАВЕРШЕН ===');
      console.log('📋 Если ошибок нет, то проблема с зависанием при обработке изображений исправлена!');
      console.log('📊 Мониторинг: http://localhost:3001/admin/queues (если запущен)');
      
    } catch (error) {
      console.error('💥 Критическая ошибка при тестировании:', error);
    }
  }

  async cleanup() {
    console.log('\n🧹 Очистка ресурсов...');
    
    if (this.queuedBot) {
      await this.queuedBot.shutdown();
    }
    
    console.log('✅ Очистка завершена');
  }
}

// Запуск тестирования
async function main() {
  const tester = new ImageProcessingTester();
  
  // Обработка сигналов завершения
  process.on('SIGINT', async () => {
    console.log('\n📡 Получен сигнал SIGINT...');
    await tester.cleanup();
    process.exit(0);
  });
  
  try {
    await tester.runQuickTest();
    
    // Оставляем тестер работать для наблюдения
    console.log('\n⏳ Тестер остается активным. Нажмите Ctrl+C для выхода.');
    
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

module.exports = ImageProcessingTester;
