#!/usr/bin/env node

/**
 * Быстрый тест игры - 4 игрока в одной комнате
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:4000';

class QuickTestPlayer {
  constructor(id) {
    this.id = id;
    this.nick = `TestPlayer${id}`;
    this.socket = null;
    this.room = null;
    this.connected = false;
    this.gameStarted = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL);
      
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
        console.log(`📢 ${this.nick} в комнате ${data.roomId}, хост: ${data.hostId === this.socket.id}`);
        this.room = data.roomId;
      });

      this.socket.on('game:state', (data) => {
        console.log(`🎯 ${this.nick} игра началась в ${data.roomId}`);
        this.gameStarted = true;
      });

      this.socket.on('presence', (data) => {
        console.log(`👥 ${this.nick} видит ${data.players.length} игроков`);
      });

      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
  }

  async createRoom() {
    try {
      const response = await fetch(`${SERVER_URL}/rooms`, {
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
    console.log(`🚀 ${this.nick} запускает игру`);
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

async function quickTest() {
  console.log('🎮 Быстрый тест игры');
  console.log('='.repeat(30));

  const players = [];
  
  // Создаем 4 игроков
  for (let i = 1; i <= 4; i++) {
    players.push(new QuickTestPlayer(i));
  }

  try {
    // Подключаем всех
    console.log('🔌 Подключение игроков...');
    for (const player of players) {
      await player.connect();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Первый игрок создает комнату
    const roomCode = await players[0].createRoom();
    if (!roomCode) {
      throw new Error('Не удалось создать комнату');
    }

    // ВСЕ игроки входят в комнату (включая создателя)
    for (let i = 0; i < players.length; i++) {
      await players[i].joinRoom(roomCode);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Запускаем игру
    console.log('\n🚀 Запуск игры...');
    await players[0].startGame();
    
    // Ждем, пока игра действительно начнется
    console.log('⏳ Ожидание начала игры...');
    let attempts = 0;
    while (!players[0].gameStarted && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (players[0].gameStarted) {
      console.log('✅ Игра успешно началась!');
    } else {
      console.log('❌ Игра не началась в течение 5 секунд');
    }

    // Симулируем игру
    console.log('\n🎯 Симуляция игры...');
    
    // Раунд 1: открываем карты
    console.log('\n🔄 Раунд 1: Открытие карт');
    const cardKeys = ['gender', 'body', 'trait', 'profession'];
    for (let i = 0; i < players.length; i++) {
      await players[i].revealCard(cardKeys[i]);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Голосование
    console.log('\n🗳️ Голосование');
    for (let i = 0; i < players.length; i++) {
      const targetIndex = (i + 1) % players.length;
      await players[i].vote(players[targetIndex].socket.id);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n✅ Тест завершен!');

  } catch (error) {
    console.error('❌ Ошибка в тесте:', error);
  } finally {
    // Отключаем всех
    console.log('\n🧹 Отключение игроков...');
    for (const player of players) {
      player.disconnect();
    }
  }
}

// Проверка сервера
async function checkServer() {
  try {
    const response = await fetch(`${SERVER_URL}/api/stats`);
    if (response.ok) {
      console.log('✅ Сервер доступен');
      return true;
    }
  } catch (error) {
    console.error('❌ Сервер недоступен. Запустите: node index.js');
    return false;
  }
}

if (require.main === module) {
  checkServer().then(serverOk => {
    if (serverOk) {
      quickTest().catch(console.error);
    } else {
      process.exit(1);
    }
  });
}

module.exports = { QuickTestPlayer, quickTest };
