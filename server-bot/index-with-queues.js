/**
 * Telegram Bot с системой очередей
 * Этот файл заменяет обычный index.js для использования очередей
 */

const QueuedBot = require('./QueuedBot');

let queuedBot = null;

async function main() {
  try {
    console.log('🚀 Запуск Telegram бота с системой очередей...');
    
    // Создание и инициализация бота
    queuedBot = new QueuedBot();
    
    // Запуск бота
    await queuedBot.launchWithRetry();
    
  } catch (error) {
    console.error('💥 Критическая ошибка при запуске:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.once('SIGINT', async () => {
  console.log('\n📡 Получен сигнал SIGINT...');
  if (queuedBot) {
    await queuedBot.shutdown();
  }
  process.exit(0);
});

process.once('SIGTERM', async () => {
  console.log('\n📡 Получен сигнал SIGTERM...');
  if (queuedBot) {
    await queuedBot.shutdown();
  }
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Необработанная ошибка Promise:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Необработанное исключение:', error);
  process.exit(1);
});

// Запуск
main();
