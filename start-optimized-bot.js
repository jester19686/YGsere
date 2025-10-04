#!/usr/bin/env node

/**
 * Основной скрипт запуска оптимизированной системы очередей
 */

require('dotenv').config();

const OptimizedQueuedBot = require('./server-bot/OptimizedQueuedBot');

// Проверка Node.js версии
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Требуется Node.js версии 16 или выше');
  console.error(`   Текущая версия: ${nodeVersion}`);
  process.exit(1);
}

// Проверка переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ Переменная TELEGRAM_BOT_TOKEN не установлена');
  console.error('   Создайте файл .env и добавьте: TELEGRAM_BOT_TOKEN=your_bot_token');
  process.exit(1);
}

// ASCII Art заставка
console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 OPTIMIZED TELEGRAM BOT WITH QUEUE SYSTEM 🚀           ║
║                                                              ║
║   📊 Metrics + 🛡️  Error Handling + ⚡ Performance        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

console.log('🌟 Системная информация:');
console.log(`   📦 Node.js: ${process.version}`);
console.log(`   🖥️  Platform: ${process.platform} ${process.arch}`);
console.log(`   🧠 Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
console.log(`   ⏱️  PID: ${process.pid}`);
console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Создание и запуск бота
async function main() {
  let bot;
  
  try {
    console.log('🚀 Инициализация OptimizedQueuedBot...');
    bot = new OptimizedQueuedBot();
    
    console.log('⚡ Запуск всех систем...');
    await bot.start();
    
    console.log('');
    console.log('🎉 === СИСТЕМА УСПЕШНО ЗАПУЩЕНА ===');
    console.log('');
    console.log('🔗 Доступные интерфейсы:');
    console.log(`   📊 Главная: http://localhost:${process.env.MONITORING_PORT || 3001}`);
    console.log(`   📋 Bull Board: http://localhost:${process.env.MONITORING_PORT || 3001}/admin/queues`);
    console.log(`   🏥 Health Check: http://localhost:${process.env.MONITORING_PORT || 3001}/api/health`);
    console.log(`   📈 Prometheus: http://localhost:${process.env.MONITORING_PORT || 3001}/api/metrics`);
    console.log('');
    console.log('📝 Команды бота:');
    console.log('   /start - Начать работу');
    console.log('   /help - Справка');
    console.log('   /status - Статус очередей');
    console.log('   /stats - Пользовательская статистика');
    console.log('');
    console.log('⏹️  Для остановки нажмите Ctrl+C');
    console.log('');
    
  } catch (error) {
    console.error('💥 Критическая ошибка при запуске:');
    console.error(`   ${error.name}: ${error.message}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('\n📚 Stack trace:');
      console.error(error.stack);
    }
    
    // Попытка graceful shutdown если бот был инициализирован
    if (bot) {
      try {
        console.log('\n🛑 Попытка graceful shutdown...');
        await bot.shutdown('ERROR');
      } catch (shutdownError) {
        console.error('❌ Ошибка при shutdown:', shutdownError.message);
      }
    }
    
    console.log('\n💡 Возможные решения:');
    console.log('   1. Проверьте, запущен ли Redis: redis-cli ping');
    console.log('   2. Проверьте токен бота в .env файле');
    console.log('   3. Проверьте доступность порта мониторинга');
    console.log('   4. Убедитесь, что все зависимости установлены: npm install');
    
    process.exit(1);
  }
}

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:');
  console.error(`   ${error.name}: ${error.message}`);
  console.error('   Stack:', error.stack);
  console.error('\n🚨 Принудительное завершение программы...');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Promise Rejection:');
  console.error('   Reason:', reason);
  console.error('   Promise:', promise);
  console.error('\n🚨 Принудительное завершение программы...');
  process.exit(1);
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n📡 Получен SIGINT (Ctrl+C)');
});

process.on('SIGTERM', () => {
  console.log('\n📡 Получен SIGTERM');
});

// Запуск основной функции
main();
