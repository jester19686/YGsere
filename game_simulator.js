#!/usr/bin/env node

/**
 * Симулятор игры "Бункер"
 * Имитирует несколько игроков, заходящих в разные лобби и играющих
 */

const { io } = require('socket.io-client');
const crypto = require('crypto');

// Конфигурация симулятора
const CONFIG = {
  SERVER_URL: 'http://localhost:4000',
  TOTAL_PLAYERS: 8,
  ROOMS_COUNT: 2,
  SIMULATION_SPEED: 1000, // мс между действиями
  GAME_DURATION: 300000, // 5 минут
};

// Генератор случайных данных
const randomNick = () => `Player${Math.floor(Math.random() * 1000)}`;
const randomRoom = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const randomDelay = (min = 500, max = 2000) => Math.floor(Math.random() * (max - min)) + min;

// Класс для симуляции игрока
class SimulatedPlayer {
  constructor(id, serverUrl) {
    this.id = id;
    this.nick = randomNick();
    this.socket = null;
    this.room = null;
    this.isHost = false;
    this.connected = false;
    this.gameStarted = false;
    this.actions = [];
    this.serverUrl = serverUrl;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        console.log(`🎮 Игрок ${this.nick} подключился`);
        this.connected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log(`❌ Игрок ${this.nick} отключился`);
        this.connected = false;
      });

      this.socket.on('room:state', (data) => {
        console.log(`📢 ${this.nick} получил состояние комнаты:`, data.roomId);
        this.room = data.roomId;
        this.isHost = data.hostId === this.socket.id;
      });

      this.socket.on('game:state', (data) => {
        console.log(`🎯 ${this.nick} получил состояние игры в комнате ${data.roomId}`);
        this.gameStarted = true;
      });

      this.socket.on('presence', (data) => {
        console.log(`👥 ${this.nick} получил присутствие в комнате ${data.roomId}: ${data.players.length} игроков`);
      });

      this.socket.on('error', (error) => {
        console.error(`❌ Ошибка у ${this.nick}:`, error);
      });

      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
  }

  async joinRoom(roomCode) {
    if (!this.connected) return false;
    
    return new Promise((resolve) => {
      this.socket.emit('joinRoom', {
        roomId: roomCode,
        nick: this.nick,
        clientId: this.socket.id,
        avatarUrl: null
      });
      
      setTimeout(() => resolve(true), 1000);
    });
  }

  async createRoom() {
    if (!this.connected) return null;
    
    try {
      const response = await fetch(`${this.serverUrl}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxPlayers: 4,
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

  async startGame() {
    if (!this.connected || !this.room || !this.isHost) return false;
    
    this.socket.emit('room:start', { roomId: this.room });
    console.log(`🚀 ${this.nick} запустил игру в комнате ${this.room}`);
    return true;
  }

  async revealCard(key) {
    if (!this.connected || !this.room) return false;
    
    this.socket.emit('game:reveal', {
      roomId: this.room,
      key: key
    });
    console.log(`🃏 ${this.nick} открыл карту: ${key}`);
    return true;
  }

  async vote(targetId) {
    if (!this.connected || !this.room) return false;
    
    this.socket.emit('game:vote', {
      roomId: this.room,
      targetId: targetId
    });
    console.log(`🗳️ ${this.nick} проголосовал за ${targetId}`);
    return true;
  }

  async skipVote() {
    if (!this.connected || !this.room) return false;
    
    this.socket.emit('game:skipVote', {
      roomId: this.room
    });
    console.log(`⏭️ ${this.nick} пропустил голосование`);
    return true;
  }

  async leaveRoom() {
    if (!this.connected || !this.room) return false;
    
    this.socket.emit('leaveRoom', { roomId: this.room });
    console.log(`🚪 ${this.nick} покинул комнату ${this.room}`);
    this.room = null;
    this.isHost = false;
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}

// Класс симулятора игры
class GameSimulator {
  constructor(config) {
    this.config = config;
    this.players = [];
    this.rooms = [];
    this.isRunning = false;
  }

  async initialize() {
    console.log('🎮 Инициализация симулятора игры...');
    
    // Создаем игроков
    for (let i = 0; i < this.config.TOTAL_PLAYERS; i++) {
      const player = new SimulatedPlayer(i, this.config.SERVER_URL);
      this.players.push(player);
    }

    // Подключаем всех игроков
    console.log('🔌 Подключение игроков...');
    for (const player of this.players) {
      try {
        await player.connect();
        await new Promise(resolve => setTimeout(resolve, randomDelay(100, 500)));
      } catch (error) {
        console.error(`❌ Не удалось подключить игрока ${player.nick}:`, error.message);
      }
    }

    console.log(`✅ Подключено ${this.players.filter(p => p.connected).length} игроков`);
  }

  async createRooms() {
    console.log('🏠 Создание комнат...');
    
    const hosts = this.players.filter(p => p.connected).slice(0, this.config.ROOMS_COUNT);
    
    for (const host of hosts) {
      const roomCode = await host.createRoom();
      if (roomCode) {
        this.rooms.push({
          code: roomCode,
          host: host,
          players: [host]
        });
        host.room = roomCode;
        host.isHost = true;
      }
    }

    console.log(`✅ Создано ${this.rooms.length} комнат`);
  }

  async fillRooms() {
    console.log('👥 Заполнение комнат...');
    
    const availablePlayers = this.players.filter(p => p.connected && !p.room);
    
    for (const room of this.rooms) {
      const maxPlayers = 4;
      const neededPlayers = maxPlayers - room.players.length;
      
      for (let i = 0; i < neededPlayers && availablePlayers.length > 0; i++) {
        const player = availablePlayers.shift();
        if (player) {
          await player.joinRoom(room.code);
          room.players.push(player);
          await new Promise(resolve => setTimeout(resolve, randomDelay(500, 1500)));
        }
      }
    }

    console.log('✅ Комнаты заполнены');
  }

  async simulateGame(room) {
    console.log(`🎯 Начинаем симуляцию игры в комнате ${room.code}`);
    
    // Запускаем игру
    await room.host.startGame();
    
    // Ждем, пока игра действительно начнется
    console.log(`⏳ Ожидание начала игры в комнате ${room.code}...`);
    let attempts = 0;
    while (!room.host.gameStarted && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (room.host.gameStarted) {
      console.log(`✅ Игра успешно началась в комнате ${room.code}!`);
    } else {
      console.log(`❌ Игра не началась в комнате ${room.code} в течение 5 секунд`);
      return;
    }

    // Симулируем несколько раундов
    for (let round = 1; round <= 3; round++) {
      console.log(`\n🔄 Раунд ${round} в комнате ${room.code}`);
      
      // Каждый игрок открывает случайную карту
      for (const player of room.players) {
        if (!player.connected) continue;
        
        const cardKeys = ['gender', 'body', 'trait', 'profession', 'health', 'hobby', 'phobia', 'bigItem', 'backpack', 'extra'];
        const randomKey = cardKeys[Math.floor(Math.random() * cardKeys.length)];
        
        await player.revealCard(randomKey);
        await new Promise(resolve => setTimeout(resolve, randomDelay(1000, 3000)));
      }

      // Ждем завершения раунда
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Симулируем голосование
      console.log(`🗳️ Голосование в комнате ${room.code}`);
      for (const player of room.players) {
        if (!player.connected) continue;
        
        // Случайно голосуем за другого игрока или пропускаем
        if (Math.random() < 0.7) {
          const otherPlayers = room.players.filter(p => p.id !== player.id && p.connected);
          if (otherPlayers.length > 0) {
            const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
            await player.vote(target.id);
          }
        } else {
          await player.skipVote();
        }
        
        await new Promise(resolve => setTimeout(resolve, randomDelay(500, 2000)));
      }

      // Ждем завершения голосования
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`✅ Игра в комнате ${room.code} завершена`);
  }

  async runSimulation() {
    console.log('🚀 Запуск симуляции игры...');
    this.isRunning = true;

    try {
      // Инициализация
      await this.initialize();
      
      // Создание комнат
      await this.createRooms();
      
      // Заполнение комнат
      await this.fillRooms();
      
      // Симуляция игр в каждой комнате
      const gamePromises = this.rooms.map(room => this.simulateGame(room));
      await Promise.all(gamePromises);
      
      console.log('\n🎉 Симуляция завершена!');
      
    } catch (error) {
      console.error('❌ Ошибка в симуляции:', error);
    } finally {
      this.cleanup();
    }
  }

  cleanup() {
    console.log('🧹 Очистка...');
    
    for (const player of this.players) {
      player.disconnect();
    }
    
    this.isRunning = false;
    console.log('✅ Симулятор остановлен');
  }
}

// Запуск симулятора
async function main() {
  console.log('🎮 Симулятор игры "Бункер"');
  console.log('='.repeat(50));
  
  const simulator = new GameSimulator(CONFIG);
  
  // Обработка сигналов для корректного завершения
  process.on('SIGINT', () => {
    console.log('\n⏹️ Получен сигнал остановки...');
    simulator.cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n⏹️ Получен сигнал завершения...');
    simulator.cleanup();
    process.exit(0);
  });
  
  // Запуск симуляции
  await simulator.runSimulation();
}

// Проверка, что сервер запущен
async function checkServer() {
  try {
    const response = await fetch(`${CONFIG.SERVER_URL}/api/stats`);
    if (response.ok) {
      console.log('✅ Сервер доступен');
      return true;
    }
  } catch (error) {
    console.error('❌ Сервер недоступен. Убедитесь, что сервер запущен на порту 4000');
    return false;
  }
}

// Главная функция
if (require.main === module) {
  checkServer().then(serverOk => {
    if (serverOk) {
      main().catch(console.error);
    } else {
      process.exit(1);
    }
  });
}

module.exports = { GameSimulator, SimulatedPlayer };
