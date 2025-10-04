#!/usr/bin/env node

/**
 * СТРЕСС-ТЕСТ игры "Бункер"
 * Максимальная нагрузка: много игроков, много лобби, долгая симуляция
 */

const { io } = require('socket.io-client');

const CONFIG = {
  SERVER_URL: 'http://localhost:4000',
  TOTAL_PLAYERS: 50,        // 50 игроков!
  ROOMS_COUNT: 12,          // 12 лобби!
  PLAYERS_PER_ROOM: 4,      // по 4 игрока в каждом лобби
  SIMULATION_DELAY: 100,    // быстрая симуляция
  GAME_ROUNDS: 5,           // 5 раундов в каждой игре!
  WAVE_DELAY: 2000,         // задержка между волнами
  TOTAL_WAVES: 3,           // 3 волны игр
  CONNECTION_BATCH: 10,     // подключаем по 10 игроков за раз
};

class StressTestPlayer {
  constructor(id) {
    this.id = id;
    this.nick = `Stress${String(id).padStart(3, '0')}`;
    this.socket = null;
    this.room = null;
    this.connected = false;
    this.gameStarted = false;
    this.isHost = false;
    this.actionsCount = 0;
    this.errors = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(CONFIG.SERVER_URL, {
        transports: ['websocket'],
        timeout: 15000,
        forceNew: true,
      });
      
      this.socket.on('connect', () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
      });

      this.socket.on('room:state', (data) => {
        this.room = data.roomId;
        this.isHost = data.hostId === this.socket.id;
      });

      this.socket.on('game:state', (data) => {
        this.gameStarted = true;
      });

      this.socket.on('presence', (data) => {
        // Молча обрабатываем
      });

      this.socket.on('error', (error) => {
        this.errors++;
      });

      setTimeout(() => reject(new Error('Connection timeout')), 20000);
    });
  }

  async createRoom() {
    try {
      const response = await fetch(`${CONFIG.SERVER_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxPlayers: CONFIG.PLAYERS_PER_ROOM,
          game: 'bunker',
          open: true
        })
      });
      
      const data = await response.json();
      return data.code;
    } catch (error) {
      this.errors++;
      return null;
    }
  }

  async joinRoom(roomCode) {
    this.socket.emit('joinRoom', {
      roomId: roomCode,
      nick: this.nick,
      clientId: this.socket.id,
      avatarUrl: null
    });
    this.actionsCount++;
  }

  async startGame() {
    this.socket.emit('room:start', { roomId: this.room });
    this.actionsCount++;
  }

  async revealCard(key) {
    this.socket.emit('game:reveal', {
      roomId: this.room,
      key: key
    });
    this.actionsCount++;
  }

  async vote(targetId) {
    this.socket.emit('game:vote', {
      roomId: this.room,
      targetId: targetId
    });
    this.actionsCount++;
  }

  async skipVote() {
    this.socket.emit('game:skipVote', {
      roomId: this.room
    });
    this.actionsCount++;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

class StressTestSimulator {
  constructor() {
    this.players = [];
    this.rooms = [];
    this.stats = {
      connected: 0,
      roomsCreated: 0,
      gamesStarted: 0,
      gamesCompleted: 0,
      totalActions: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  async initialize() {
    console.log('🔥 ИНИЦИАЛИЗАЦИЯ СТРЕСС-ТЕСТА');
    console.log('='.repeat(80));
    console.log(`📊 МАКСИМАЛЬНАЯ КОНФИГУРАЦИЯ:`);
    console.log(`   • Игроков: ${CONFIG.TOTAL_PLAYERS}`);
    console.log(`   • Лобби: ${CONFIG.ROOMS_COUNT}`);
    console.log(`   • Игроков в лобби: ${CONFIG.PLAYERS_PER_ROOM}`);
    console.log(`   • Раундов в игре: ${CONFIG.GAME_ROUNDS}`);
    console.log(`   • Волн игр: ${CONFIG.TOTAL_WAVES}`);
    console.log(`   • Пакетов подключения: ${CONFIG.CONNECTION_BATCH}`);
    console.log('='.repeat(80));

    this.stats.startTime = Date.now();
    
    // Создаем игроков
    for (let i = 1; i <= CONFIG.TOTAL_PLAYERS; i++) {
      this.players.push(new StressTestPlayer(i));
    }

    // Подключаем игроков пакетами
    console.log('\n🔌 ПАКЕТНОЕ ПОДКЛЮЧЕНИЕ ИГРОКОВ...');
    for (let i = 0; i < this.players.length; i += CONFIG.CONNECTION_BATCH) {
      const batch = this.players.slice(i, i + CONFIG.CONNECTION_BATCH);
      const batchPromises = batch.map(player => this.connectPlayer(player));
      
      await Promise.allSettled(batchPromises);
      
      console.log(`✅ Пакет ${Math.floor(i / CONFIG.CONNECTION_BATCH) + 1}: подключено ${this.stats.connected} игроков`);
      
      // Небольшая пауза между пакетами
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ ПОДКЛЮЧЕНО ${this.stats.connected} из ${CONFIG.TOTAL_PLAYERS} игроков`);
  }

  async connectPlayer(player) {
    try {
      await player.connect();
      this.stats.connected++;
    } catch (error) {
      this.stats.totalErrors++;
    }
  }

  async createRooms() {
    console.log('\n🏠 СОЗДАНИЕ МНОЖЕСТВА ЛОББИ...');
    
    const hosts = this.players.filter(p => p.connected).slice(0, CONFIG.ROOMS_COUNT);
    
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      const roomCode = await host.createRoom();
      
      if (roomCode) {
        this.rooms.push({
          code: roomCode,
          host: host,
          players: [host],
          gameStarted: false,
          completedRounds: 0
        });
        this.stats.roomsCreated++;
      } else {
        this.stats.totalErrors++;
      }
      
      // Небольшая пауза между созданием лобби
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ СОЗДАНО ${this.stats.roomsCreated} ЛОББИ`);
  }

  async fillRooms() {
    console.log('\n👥 ЗАПОЛНЕНИЕ ВСЕХ ЛОББИ...');
    
    const availablePlayers = this.players.filter(p => p.connected && !p.room);
    
    for (const room of this.rooms) {
      const neededPlayers = CONFIG.PLAYERS_PER_ROOM - room.players.length;
      
      for (let i = 0; i < neededPlayers && availablePlayers.length > 0; i++) {
        const player = availablePlayers.shift();
        if (player) {
          await player.joinRoom(room.code);
          room.players.push(player);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    console.log(`✅ ВСЕ ЛОББИ ЗАПОЛНЕНЫ`);
  }

  async runWave(waveNumber) {
    console.log(`\n🌊 ВОЛНА ${waveNumber}/${CONFIG.TOTAL_WAVES}`);
    console.log('='.repeat(50));
    
    // Запускаем все игры в волне
    console.log('🚀 ЗАПУСК ВСЕХ ИГР В ВОЛНЕ...');
    const startPromises = this.rooms.map(async (room, index) => {
      await room.host.startGame();
      
      // Ждем подтверждения начала игры
      let attempts = 0;
      while (!room.host.gameStarted && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (room.host.gameStarted) {
        room.gameStarted = true;
        this.stats.gamesStarted++;
      }
    });

    await Promise.all(startPromises);
    console.log(`✅ ЗАПУЩЕНО ${this.stats.gamesStarted} ИГР В ВОЛНЕ`);

    // Симулируем все игры в волне
    console.log('🎮 СИМУЛЯЦИЯ ВСЕХ ИГР В ВОЛНЕ...');
    const gamePromises = this.rooms.map(async (room) => {
      if (!room.gameStarted) return;
      
      for (let round = 1; round <= CONFIG.GAME_ROUNDS; round++) {
        // Открытие карт
        for (const player of room.players) {
          if (!player.connected) continue;
          
          const cardKeys = ['gender', 'body', 'trait', 'profession', 'health', 'hobby', 'phobia', 'bigItem', 'backpack', 'extra'];
          const randomKey = cardKeys[Math.floor(Math.random() * cardKeys.length)];
          
          await player.revealCard(randomKey);
          await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY));
        }

        // Пауза между раундами
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Голосование
        for (const player of room.players) {
          if (!player.connected) continue;
          
          if (Math.random() < 0.7) {
            const otherPlayers = room.players.filter(p => p.id !== player.id && p.connected);
            if (otherPlayers.length > 0) {
              const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
              await player.vote(target.socket.id);
            }
          } else {
            await player.skipVote();
          }
          
          await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY));
        }

        // Пауза после голосования
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        room.completedRounds++;
      }

      this.stats.gamesCompleted++;
    });

    await Promise.all(gamePromises);
    console.log(`✅ ВОЛНА ${waveNumber} ЗАВЕРШЕНА`);
  }

  async runStressTest() {
    try {
      // Инициализация
      await this.initialize();
      
      // Создание лобби
      await this.createRooms();
      
      // Заполнение лобби
      await this.fillRooms();
      
      // Запуск волн игр
      for (let wave = 1; wave <= CONFIG.TOTAL_WAVES; wave++) {
        await this.runWave(wave);
        
        if (wave < CONFIG.TOTAL_WAVES) {
          console.log(`\n⏳ ПАУЗА ПЕРЕД ВОЛНОЙ ${wave + 1}...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.WAVE_DELAY));
        }
      }
      
      // Итоговая статистика
      this.printFinalStats();
      
    } catch (error) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА В СТРЕСС-ТЕСТЕ:', error);
    } finally {
      this.cleanup();
    }
  }

  printFinalStats() {
    this.stats.endTime = Date.now();
    const duration = Math.round((this.stats.endTime - this.stats.startTime) / 1000);
    
    // Подсчитываем общую статистику
    this.stats.totalActions = this.players.reduce((sum, p) => sum + p.actionsCount, 0);
    this.stats.totalErrors = this.players.reduce((sum, p) => sum + p.errors, 0) + this.stats.totalErrors;
    
    console.log('\n' + '='.repeat(80));
    console.log('🔥 ИТОГОВАЯ СТАТИСТИКА СТРЕСС-ТЕСТА');
    console.log('='.repeat(80));
    console.log(`⏱️  Время выполнения: ${duration} секунд`);
    console.log(`👥 Подключено игроков: ${this.stats.connected}/${CONFIG.TOTAL_PLAYERS} (${Math.round(this.stats.connected/CONFIG.TOTAL_PLAYERS*100)}%)`);
    console.log(`🏠 Создано лобби: ${this.stats.roomsCreated}/${CONFIG.ROOMS_COUNT} (${Math.round(this.stats.roomsCreated/CONFIG.ROOMS_COUNT*100)}%)`);
    console.log(`🚀 Запущено игр: ${this.stats.gamesStarted}`);
    console.log(`🎯 Завершено игр: ${this.stats.gamesCompleted}`);
    console.log(`🎮 Всего действий: ${this.stats.totalActions}`);
    console.log(`❌ Всего ошибок: ${this.stats.totalErrors}`);
    console.log(`📈 Успешность игр: ${Math.round((this.stats.gamesCompleted / this.stats.gamesStarted) * 100)}%`);
    console.log(`⚡ Действий в секунду: ${Math.round(this.stats.totalActions / duration)}`);
    console.log(`🎯 Игр в секунду: ${Math.round(this.stats.gamesCompleted / duration * 10) / 10}`);
    console.log('='.repeat(80));
    
    // Анализ производительности
    if (this.stats.totalErrors === 0) {
      console.log('🏆 ОТЛИЧНО! Никаких ошибок!');
    } else if (this.stats.totalErrors < 5) {
      console.log('✅ ХОРОШО! Минимальные ошибки');
    } else if (this.stats.totalErrors < 20) {
      console.log('⚠️  УДОВЛЕТВОРИТЕЛЬНО! Есть ошибки, но система стабильна');
    } else {
      console.log('❌ ПЛОХО! Много ошибок, нужна оптимизация');
    }
  }

  cleanup() {
    console.log('\n🧹 ОЧИСТКА СТРЕСС-ТЕСТА...');
    
    for (const player of this.players) {
      player.disconnect();
    }
    
    console.log('✅ СТРЕСС-ТЕСТ ЗАВЕРШЕН');
  }
}

// Проверка сервера
async function checkServer() {
  try {
    const response = await fetch(`${CONFIG.SERVER_URL}/api/stats`);
    if (response.ok) {
      console.log('✅ Сервер доступен');
      return true;
    }
  } catch (error) {
    console.error('❌ Сервер недоступен. Запустите: node index.js');
    return false;
  }
}

// Главная функция
async function main() {
  const serverOk = await checkServer();
  if (!serverOk) {
    process.exit(1);
  }

  const simulator = new StressTestSimulator();
  
  // Обработка сигналов
  process.on('SIGINT', () => {
    console.log('\n⏹️ Получен сигнал остановки...');
    simulator.cleanup();
    process.exit(0);
  });
  
  await simulator.runStressTest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { StressTestSimulator, StressTestPlayer };




