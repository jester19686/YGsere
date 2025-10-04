#!/usr/bin/env node

/**
 * Массовый тест игры "Бункер"
 * Много игроков, много лобби, полная симуляция
 */

const { io } = require('socket.io-client');

const CONFIG = {
  SERVER_URL: 'http://localhost:4000',
  TOTAL_PLAYERS: 20,        // 20 игроков
  ROOMS_COUNT: 5,           // 5 лобби
  PLAYERS_PER_ROOM: 4,      // по 4 игрока в каждом лобби
  SIMULATION_DELAY: 200,    // задержка между действиями (мс)
  GAME_ROUNDS: 2,           // количество раундов в каждой игре
};

class MassTestPlayer {
  constructor(id) {
    this.id = id;
    this.nick = `MassPlayer${String(id).padStart(3, '0')}`;
    this.socket = null;
    this.room = null;
    this.connected = false;
    this.gameStarted = false;
    this.isHost = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(CONFIG.SERVER_URL, {
        transports: ['websocket'],
        timeout: 10000,
      });
      
      this.socket.on('connect', () => {
        console.log(`✅ ${this.nick} подключился`);
        this.connected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log(`❌ ${this.nick} отключился`);
        this.connected = false;
      });

      this.socket.on('room:state', (data) => {
        this.room = data.roomId;
        this.isHost = data.hostId === this.socket.id;
        console.log(`📢 ${this.nick} в комнате ${data.roomId} (хост: ${this.isHost})`);
      });

      this.socket.on('game:state', (data) => {
        this.gameStarted = true;
        console.log(`🎯 ${this.nick} игра началась в ${data.roomId}`);
      });

      this.socket.on('presence', (data) => {
        console.log(`👥 ${this.nick} видит ${data.players.length} игроков в ${data.roomId}`);
      });

      this.socket.on('error', (error) => {
        console.error(`❌ Ошибка у ${this.nick}:`, error);
      });

      setTimeout(() => reject(new Error('Timeout')), 15000);
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
      console.log(`🏠 ${this.nick} создал комнату: ${data.code}`);
      return data.code;
    } catch (error) {
      console.error(`❌ ${this.nick} не смог создать комнату:`, error.message);
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
    console.log(`🚪 ${this.nick} входит в комнату ${roomCode}`);
  }

  async startGame() {
    this.socket.emit('room:start', { roomId: this.room });
    console.log(`🚀 ${this.nick} запускает игру в ${this.room}`);
  }

  async revealCard(key) {
    this.socket.emit('game:reveal', {
      roomId: this.room,
      key: key
    });
    console.log(`🃏 ${this.nick} открывает карту: ${key}`);
  }

  async vote(targetId) {
    this.socket.emit('game:vote', {
      roomId: this.room,
      targetId: targetId
    });
    console.log(`🗳️ ${this.nick} голосует за ${targetId}`);
  }

  async skipVote() {
    this.socket.emit('game:skipVote', {
      roomId: this.room
    });
    console.log(`⏭️ ${this.nick} пропустил голосование`);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

class MassiveGameSimulator {
  constructor() {
    this.players = [];
    this.rooms = [];
    this.stats = {
      connected: 0,
      roomsCreated: 0,
      gamesStarted: 0,
      gamesCompleted: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('🎮 Инициализация массового теста...');
    console.log(`📊 Планируется: ${CONFIG.TOTAL_PLAYERS} игроков, ${CONFIG.ROOMS_COUNT} лобби`);
    
    // Создаем игроков
    for (let i = 1; i <= CONFIG.TOTAL_PLAYERS; i++) {
      this.players.push(new MassTestPlayer(i));
    }

    // Подключаем всех игроков с задержкой
    console.log('\n🔌 Подключение игроков...');
    for (let i = 0; i < this.players.length; i++) {
      try {
        await this.players[i].connect();
        this.stats.connected++;
        await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY));
      } catch (error) {
        console.error(`❌ Не удалось подключить ${this.players[i].nick}:`, error.message);
        this.stats.errors++;
      }
    }

    console.log(`✅ Подключено ${this.stats.connected} из ${CONFIG.TOTAL_PLAYERS} игроков`);
  }

  async createRooms() {
    console.log('\n🏠 Создание лобби...');
    
    const hosts = this.players.filter(p => p.connected).slice(0, CONFIG.ROOMS_COUNT);
    
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      const roomCode = await host.createRoom();
      
      if (roomCode) {
        this.rooms.push({
          code: roomCode,
          host: host,
          players: [host],
          gameStarted: false
        });
        this.stats.roomsCreated++;
        console.log(`✅ Лобби ${i + 1}/${CONFIG.ROOMS_COUNT} создано: ${roomCode}`);
      } else {
        this.stats.errors++;
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY * 2));
    }

    console.log(`✅ Создано ${this.stats.roomsCreated} лобби`);
  }

  async fillRooms() {
    console.log('\n👥 Заполнение лобби...');
    
    const availablePlayers = this.players.filter(p => p.connected && !p.room);
    
    for (const room of this.rooms) {
      const neededPlayers = CONFIG.PLAYERS_PER_ROOM - room.players.length;
      
      for (let i = 0; i < neededPlayers && availablePlayers.length > 0; i++) {
        const player = availablePlayers.shift();
        if (player) {
          await player.joinRoom(room.code);
          room.players.push(player);
          await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY));
        }
      }
      
      console.log(`✅ Лобби ${room.code}: ${room.players.length}/${CONFIG.PLAYERS_PER_ROOM} игроков`);
    }
  }

  async startAllGames() {
    console.log('\n🚀 Запуск всех игр...');
    
    const startPromises = this.rooms.map(async (room, index) => {
      console.log(`🎯 Запуск игры ${index + 1}/${this.rooms.length} в лобби ${room.code}`);
      
      // Запускаем игру
      await room.host.startGame();
      
      // Ждем подтверждения начала игры
      let attempts = 0;
      while (!room.host.gameStarted && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
      }
      
      if (room.host.gameStarted) {
        room.gameStarted = true;
        this.stats.gamesStarted++;
        console.log(`✅ Игра ${index + 1} успешно началась в лобби ${room.code}`);
      } else {
        console.log(`❌ Игра ${index + 1} не началась в лобби ${room.code}`);
        this.stats.errors++;
      }
    });

    await Promise.all(startPromises);
    console.log(`✅ Запущено ${this.stats.gamesStarted} игр`);
  }

  async simulateAllGames() {
    console.log('\n🎮 Симуляция всех игр...');
    
    const gamePromises = this.rooms.map(async (room, index) => {
      if (!room.gameStarted) return;
      
      console.log(`\n🎯 Симуляция игры в лобби ${room.code} (${room.players.length} игроков)`);
      
      for (let round = 1; round <= CONFIG.GAME_ROUNDS; round++) {
        console.log(`\n🔄 Раунд ${round} в лобби ${room.code}`);
        
        // Каждый игрок открывает случайную карту
        for (const player of room.players) {
          if (!player.connected) continue;
          
          const cardKeys = ['gender', 'body', 'trait', 'profession', 'health', 'hobby', 'phobia', 'bigItem', 'backpack', 'extra'];
          const randomKey = cardKeys[Math.floor(Math.random() * cardKeys.length)];
          
          await player.revealCard(randomKey);
          await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION_DELAY));
        }

        // Ждем завершения раунда
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Голосование
        console.log(`🗳️ Голосование в лобби ${room.code}`);
        for (const player of room.players) {
          if (!player.connected) continue;
          
          // Случайно голосуем или пропускаем
          if (Math.random() < 0.8) {
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

        // Ждем завершения голосования
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      this.stats.gamesCompleted++;
      console.log(`✅ Игра в лобби ${room.code} завершена`);
    });

    await Promise.all(gamePromises);
    console.log(`✅ Завершено ${this.stats.gamesCompleted} игр`);
  }

  async runMassiveTest() {
    console.log('🎮 МАССОВЫЙ ТЕСТ ИГРЫ "БУНКЕР"');
    console.log('='.repeat(60));
    console.log(`📊 Конфигурация:`);
    console.log(`   • Игроков: ${CONFIG.TOTAL_PLAYERS}`);
    console.log(`   • Лобби: ${CONFIG.ROOMS_COUNT}`);
    console.log(`   • Игроков в лобби: ${CONFIG.PLAYERS_PER_ROOM}`);
    console.log(`   • Раундов в игре: ${CONFIG.GAME_ROUNDS}`);
    console.log('='.repeat(60));

    try {
      // Инициализация
      await this.initialize();
      
      // Создание лобби
      await this.createRooms();
      
      // Заполнение лобби
      await this.fillRooms();
      
      // Запуск всех игр
      await this.startAllGames();
      
      // Симуляция всех игр
      await this.simulateAllGames();
      
      // Итоговая статистика
      this.printFinalStats();
      
    } catch (error) {
      console.error('❌ Критическая ошибка в тесте:', error);
    } finally {
      this.cleanup();
    }
  }

  printFinalStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`✅ Подключено игроков: ${this.stats.connected}/${CONFIG.TOTAL_PLAYERS}`);
    console.log(`🏠 Создано лобби: ${this.stats.roomsCreated}/${CONFIG.ROOMS_COUNT}`);
    console.log(`🚀 Запущено игр: ${this.stats.gamesStarted}`);
    console.log(`🎯 Завершено игр: ${this.stats.gamesCompleted}`);
    console.log(`❌ Ошибок: ${this.stats.errors}`);
    console.log(`📈 Успешность: ${Math.round((this.stats.gamesCompleted / this.stats.gamesStarted) * 100)}%`);
    console.log('='.repeat(60));
  }

  cleanup() {
    console.log('\n🧹 Очистка...');
    
    for (const player of this.players) {
      player.disconnect();
    }
    
    console.log('✅ Массовый тест завершен');
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

  const simulator = new MassiveGameSimulator();
  
  // Обработка сигналов
  process.on('SIGINT', () => {
    console.log('\n⏹️ Получен сигнал остановки...');
    simulator.cleanup();
    process.exit(0);
  });
  
  await simulator.runMassiveTest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MassiveGameSimulator, MassTestPlayer };




