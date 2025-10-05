require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { createCorsMiddleware } = require('./lib/cors');
const { Server } = require('socket.io');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
// Game modules (DI)
const rounds = require('./game/rounds');
const timers = require('./game/timers');
const voteMod = require('./game/vote');

// Импортируем функции из rounds для прямого использования
const { allReachedQuota } = rounds;

// Связка модулей (dependency injection)
timers.setVoteFunctions(voteMod.nextSpeechOrBallot, voteMod.finishBallot);
voteMod.setDependencies({
  clearTurnTimer: timers.clearTurnTimer,
  ensureTurnState,
  getRoomPlayerById,
  checkGameOver,
  emitGameState,
  ensureRoundState: rounds.ensureRoundState,
  advanceRound: rounds.advanceRound,
  emitRoundState,
  beginTurn,
  scheduleVoteTick: timers.scheduleVoteTick,
  clearVoteTick: timers.clearVoteTick,
  setLastVoteAndBroadcast,
  advanceTurn,
  nowSec: timers.nowSec,
});

// Характеристики и генератор руки
const {
  generateHand,
  ORDER,
  generateBunker,
  generateCataclysm,
  HAND_KEYS,
  GENDERS,
  BODIES,
  TRAITS,
  PROFESSIONS,
  HEALTHS,
  HOBBIES,
  PHOBIAS,
  BIG_ITEMS,
  BACKPACK,
  EXTRAS,
  ABILITIES,
} = require('./data/cards');


const PORT = Number(process.env.PORT || 4000);

// === Параметры анти-спама для создания комнат ===
const RATE_ROOMS_WINDOW_MS = Number(process.env.RATE_ROOMS_WINDOW_MS || 60_000);
const RATE_ROOMS_MAX = Number(process.env.RATE_ROOMS_MAX || 10);

const app = express();
app.set('trust proxy', true);

const randomItem = (arr = []) => arr[Math.floor(Math.random() * arr.length)];

// === Статистика игры ===
let gameStats = {
  activePlayers: 0, // legacy/incremental (no longer trusted for GET)
  activeGames: 0,   // legacy/incremental (no longer trusted for GET)
  completedGames: 0
};

// Функции для обновления статистики
const updateStats = (action, gameId) => {
  switch (action) {
    case 'player_joined':
      gameStats.activePlayers++;
      break;
    case 'player_left':
      gameStats.activePlayers = Math.max(0, gameStats.activePlayers - 1);
      break;
    case 'game_started':
      gameStats.activeGames++;
      break;
    case 'game_ended':
      gameStats.activeGames = Math.max(0, gameStats.activeGames - 1);
      gameStats.completedGames++;
      break;
  }
  console.log(`Stats updated: ${action}`, gameStats);
};

// === Accurate, low-cost snapshot based on in-memory rooms ===
function computeStatsSnapshot() {
  try {
    const uniquePlayerIds = new Set();
    let activeGames = 0;

    for (const room of rooms.values()) {
      if (room && room.started && !room.gameOver) activeGames++;
      if (room && room.players && typeof room.players.values === 'function') {
        for (const p of room.players.values()) {
          // считаем только актуальных игроков комнаты (без kicked)
          if (!p) continue;
          if (p.kicked) continue;
          const pid = p.clientId || p.id;
          if (pid) uniquePlayerIds.add(pid);
        }
      }
    }

    return {
      activePlayers: uniquePlayerIds.size,
      activeGames,
      completedGames: gameStats.completedGames,
    };
  } catch (e) {
    console.error('computeStatsSnapshot failed:', e);
    // Fallback to legacy counters on error
    return {
      activePlayers: Math.max(0, Number(gameStats.activePlayers) || 0),
      activeGames: Math.max(0, Number(gameStats.activeGames) || 0),
      completedGames: Math.max(0, Number(gameStats.completedGames) || 0),
    };
  }
}

const REROLL_POOLS = {
  gender: GENDERS,
  body: BODIES,
  trait: TRAITS,
  profession: PROFESSIONS,
  health: HEALTHS,
  hobby: HOBBIES,
  phobia: PHOBIAS,
  bigItem: BIG_ITEMS,
  backpack: BACKPACK,
  extra: EXTRAS,
  ability1: ABILITIES,
  ability2: ABILITIES,
};

function randomValueForKey(key, hand = {}) {
  const pool = REROLL_POOLS[key];
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const exclude = new Set();
  if (hand && hand[key]) exclude.add(hand[key]);
  if (key === 'ability1' && hand?.ability2) exclude.add(hand.ability2);
  if (key === 'ability2' && hand?.ability1) exclude.add(hand.ability1);

  const candidates = pool.filter((item) => !exclude.has(item));
  const source = candidates.length ? candidates : pool;
  return randomItem(source);
}

// Разрешённые origin'ы: FRONT_ORIGIN="http://localhost:3000,https://mydomain.tld"
const origins = (process.env.FRONT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

//app.use(cors({
//  origin: origins.length ? origins : true,     // dev: true (отражает пришедший Origin)
//  credentials: origins.length > 0,             // credentials только если origin фиксированный
//}));


// ===== In-memory состояние =====
/**
 * room = {
 *   code: string,
 *   game: 'bunker'|'whoami',
 *   maxPlayers: number,
 *   hostClientId: string|null,
 *   started: boolean,
 *   nextSeat: number,
 *   players: Map<clientId, Player>
 *   open: boolean,
 *   bunker: object|null,        // 👈 добавлено поле
 *   turnOrder: string[]|null,   // порядок ходов (clientId по возрастанию seat)
 *   currentTurnId: string|null, // кто сейчас ходит
 * }
 * Player = { ... }
 */
const rooms = new Map();

// Грейс-таймеры удаления пустых комнат (на случай рефреша страницы)
const emptyRoomTimers = new Map(); // Map<roomCode, NodeJS.Timeout>


// healthcheck (nginx/uptime)
app.get('/health', (_req, res) => res.send('ok'));



// === In-memory rate-limit по IP для POST /rooms ===
const createRoomRate = new Map();


// ✅ ЕДИНСТВЕННЫЙ CORS до всех роутов
app.use(createCorsMiddleware(process.env.FRONT_ORIGIN || 'http://localhost:3000'));

app.use(express.json());
// ====== Users and avatars ======
const { AVATARS_DIR, initAvatarDir, enqueueAvatarJob, tryGetCachedAvatarPath, upsertUserProfile } = require('./store/users');
initAvatarDir();
app.use('/avatars', express.static(AVATARS_DIR, { maxAge: '7d', immutable: false }));


// ====== Simple auth audit + rate limit ======
const AUTH_RATE_WINDOW_MS = Number(process.env.AUTH_RATE_WINDOW_MS || 60_000);
const AUTH_RATE_MAX = Number(process.env.AUTH_RATE_MAX || 20);
const authRate = new Map(); // Map<ip, number[]>

function rateLimitAuth(req, res) {
  const ip = getClientIp(req) || 'unknown';
  const now = Date.now();
  const arr = authRate.get(ip) || [];
  const fresh = arr.filter((ts) => now - ts < AUTH_RATE_WINDOW_MS);
  if (fresh.length >= AUTH_RATE_MAX) {
    res.setHeader('Retry-After', Math.ceil(AUTH_RATE_WINDOW_MS / 1000));
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return false;
  }
  fresh.push(now);
  authRate.set(ip, fresh);
  return true;
}

function auditAuth(event, payload) {
  const line = JSON.stringify({ t: new Date().toISOString(), evt: event, ...payload }) + '\n';
  fsp.appendFile(path.join(__dirname, 'server.log'), line, 'utf8').catch(() => {});
}

// ===== Routers =====
const { createAuthRouter } = require('./routes/auth');
app.use(createAuthRouter({ rateLimitAuth }));

// API endpoint для получения статистики (точный срез по rooms)
app.get('/api/stats', (req, res) => {
  const snapshot = computeStatsSnapshot();
  res.json(snapshot);
});

// API endpoint для обновления статистики (для тестирования)
app.post('/api/stats', (req, res) => {
  const { action, gameId } = req.body;
  updateStats(action, gameId);
  res.json({ success: true, stats: gameStats });
});

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) {
    return xfwd.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function rateLimitCreateRoom(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();

  const arr = createRoomRate.get(ip) || [];
  const fresh = arr.filter((ts) => now - ts < RATE_ROOMS_WINDOW_MS);

  if (fresh.length >= RATE_ROOMS_MAX) {
    // берем самый старый таймстамп в окне
    const oldest = Math.min(...fresh);
    const retryAfterMs = Math.max(0, RATE_ROOMS_WINDOW_MS - (now - oldest));
    res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
    res.status(429).json({
      error: 'rate_limited',
      message: `Слишком часто создаёте комнаты. Попробуйте позже.`,
      retryAfterMs,
    });
    return false;
  }

  fresh.push(now);
  createRoomRate.set(ip, fresh);
  return true;
}

// Утилиты
function code4() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}
// ⏳ Планирование удаления комнаты (через 5 минут после gameOver)
function scheduleRoomCleanup(room) {
  if (room.cleanupTimer) return;
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const now = Date.now();
  room.cleanupAt = room.cleanupAt && room.cleanupAt > now ? room.cleanupAt : now + FIVE_MIN_MS;
  const delay = Math.max(0, room.cleanupAt - now);
  room.cleanupTimer = setTimeout(() => {
    try {
      const roomKey = room.id || room.code;
      io.to(roomKey).emit('room:closed', { roomId: roomKey });
    } catch {}
    try { rooms.delete(room.id || room.code); } catch {}
    try { broadcastRooms(io); } catch {}
  }, delay);
}

function sortBySeat(playersArr) {
  return playersArr.sort((a, b) => (a.seat || 0) - (b.seat || 0));
}

function computeTurnOrder(room) {
  // по сиденьям (seat) → clientId, исключаем исключённых (kicked)
  const order = sortBySeat(
    Array.from(room.players.values()).filter(p => !p.kicked)
  ).map(p => p.clientId);
  return order;
}
function ensureTurnState(room) {
  if (!room.turnOrder || room.turnOrder.length === 0) {
    room.turnOrder = computeTurnOrder(room);
  } else {
    // актуализируем порядок при изменениях состава
    const existing = new Set([
  ...Array.from(room.players.keys()),
  ...(room.reconnect ? Array.from(room.reconnect.keys()) : []),
]);

const isKicked = (id) => {
  const p = room.players.get(id) || room.reconnect?.get(id);
  return !!(p && p.kicked);
};

room.turnOrder = room.turnOrder.filter(
  (id) => existing.has(id) && !isKicked(id)
);
    // добавим новых в конец, в порядке seat
    const known = new Set(room.turnOrder);
    const newbies = computeTurnOrder(room).filter(id => !known.has(id));
    room.turnOrder.push(...newbies);
  }
  if (!room.currentTurnId && room.turnOrder.length) {
    room.currentTurnId = room.turnOrder[0];
  }
}
function advanceTurn(room) {
  ensureTurnState(room);
  const order = room.turnOrder || [];
  if (!order.length) { room.currentTurnId = null; return; }

  const cur = room.currentTurnId;
  const idx = Math.max(0, order.indexOf(cur));
  const nextId = order[(idx + 1) % order.length];
  room.currentTurnId = nextId;

  beginTurn(room.code, room.currentTurnId); // эмит + рестарт таймера
}




// ==== Turn timer per room ====
// перенесено в game/timers


// удобный helper при смене хода
function beginTurn(roomId, currentTurnId) {
  const room = ensureRoom(roomId);
  if (!room) return; // ⬅️ guard

  if (room.gameOver) {
    // Игра финализирована — никаких ходов/таймеров.
    return;
  }

  io.to(roomId).emit('game:turn', { roomId, currentTurnId });
  resetSkipVotes(room);
  timers.startTurnTimer(roomId, room, io);
}


// ---- Список основных характеристик (без спец.возможностей) ----
const CORE_KEYS = [
  'gender','body','trait','profession','health',
  'hobby','phobia','bigItem','backpack','extra'
];

// Вернуть игрока комнаты по его id (clientId)
function getRoomPlayerById(room, playerId) {
  if (!room || !room.players) return null;
  const arr = Array.from(room.players.values());
  return arr.find(p => p.id === playerId || p.clientId === playerId) || null;
}

// Открыть одну случайную нераскрытую характеристику игроку (учитываем hiddenKey)
function revealRandomFor(room, playerId) {
  const pl = getRoomPlayerById(room, playerId);
  if (!pl || !pl.hand) return;

  const hiddenKey = pl.hiddenKey;
  const revealed = pl.revealed || {};
  const already = new Set(pl.revealedKeys || []);

  // только основные ключи, без ability1/ability2, и не hiddenKey
  const candidates = CORE_KEYS.filter(
    (k) => k !== hiddenKey && !revealed[k] && !already.has(k)
    );
  if (candidates.length === 0) return;

  const key = candidates[Math.floor(Math.random() * candidates.length)];

  // записываем и в revealed, и в revealedKeys — чтобы у игрока локально кнопка стала «Открыто»
  pl.revealed = { ...revealed, [key]: pl.hand[key] };
  pl.revealedKeys = Array.isArray(pl.revealedKeys) ? pl.revealedKeys : [];
  if (!already.has(key)) pl.revealedKeys.push(key);
}


// ⬇️ Единая логика: авто-раскрытие при скипе + учёт квоты раунда
function applySkipAutoReveal(room, prevPlayerId, roomId) {
  if (!prevPlayerId) return;

  // раскрыть одну случайную обычную характеристику (без ability1/ability2)
  revealRandomFor(room, prevPlayerId);

  // персонально владельцу — актуализируем Hand
  const prevPlayer = getRoomPlayerById(room, prevPlayerId);
  if (prevPlayer) {
    io.to(prevPlayer.id).emit('game:you', {
      hand: prevPlayer.hand,
      hiddenKey: prevPlayer.hiddenKey ?? null,
      revealedKeys: prevPlayer.revealedKeys || [],
    });
  }

  // общий стейт — чтобы все увидели раскрытие
  emitGameState(roomId, room);

  // 👇 учёт квоты раунда (для обычных ключей; revealRandomFor уже выбирает только их)
  rounds.ensureRoundState(room);
  rounds.bumpRevealedThisRound(room, prevPlayerId);
  emitRoundState(room);

  // если все достигли квоты — переключаем раунд и оповещаем
  if (rounds.allReachedQuota(room)) {
    beginSpeeches(room);
    return; // дальше состояние разошлёт broadcastVote()
  }
}


// Унифицированная отправка game:state (как вы делаете в game:sync/room:start)
function emitGameState(roomId, room) {
  const sec = Math.min(room.turnTimerSec || 0, 120);
  const total = getActivePlayersCount(room);
  io.to(roomId).emit('game:state', {
    roomId,
    phase: 'reveal',
    players: publicPlayers(room),
    bunker: room.bunker,
    cataclysm: room.cataclysm,
    currentTurnId: room.currentTurnId,
    turnSeconds: sec,
    round: room.round,
    voteSkip: {
      votes: room.skipVotes ? room.skipVotes.size : 0,
      total,
      needed: Math.ceil(total / 2),
      voters: Array.from(room.skipVotes || []),
    },
    revealAll: !!room.revealAll,
    editorEnabled: !!room.editorEnabled,
    paused: !!room.paused,
    gameOver: !!room.gameOver,
    winners: Array.isArray(room.winners) ? room.winners : [],
    lastVote: room.lastVote || null,
    cleanupAt: room.cleanupAt || null,
  });

  if (room.hostRevealHands) {
    emitHostHands(room);
  }
}


function emitHostHands(room) {
  if (!room?.hostRevealHands || !room.hostClientId) return;

  const hostPlayer = room.players?.get(room.hostClientId);
  if (!hostPlayer || !hostPlayer.id) return;

  const hands = {};
  room.players.forEach((player) => {
    if (player?.clientId && player?.hand) {
      hands[player.clientId] = { ...player.hand };
    }
  });

  io.to(hostPlayer.id).emit('game:revealAll:host', { roomId: room.code, hands });
}

// 👇 единый хелпер: сохранить и разослать "итоги последнего голосования"
function setLastVoteAndBroadcast(roomId, room, { totals, votersByTarget }) {
  // totals: { [playerId]: number }, votersByTarget: { [playerId]: string[] }
  const totalEligible = [...room.players.values()].filter(p => !p.kicked).length;
  const totalVoters = Object.values(votersByTarget || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);

  room.lastVote = {
    at: timers.nowSec(),
    totalEligible,
    totalVoters,
    totals: totals || {},
    votersByTarget: votersByTarget || {},
  };

  io.to(roomId).emit('vote:result', { roomId, lastVote: room.lastVote });
}



function getActiveIds(room) {
  const arr = room.turnOrder || [];
  return arr.filter(id => {
    const p = room.players.get(id) || room.reconnect?.get(id);
    return p && !p.kicked;
  });
}

function checkGameOver(room) {
  const places = room?.bunker?.places || 0;
  if (!places) return;

  const activeIds = getActiveIds(room);
  if (activeIds.length > 0 && activeIds.length <= places) {
    room.gameOver = true;
    room.winners = [...activeIds];

    timers.clearTurnTimer(room.code, room);     // ⬅️ исправили: используем timers.clearTurnTimer
    room.vote = { phase: 'idle' }; // ⬅️ добавили
    resetSkipVotes(room);          // ⬅️ добавили

    room.currentTurnId = null; // 👈 опционально, но аккуратнее

    // Обновляем статистику при завершении игры
    updateStats('game_ended', room.code);

    // ⏳ назначаем удаление через 5 минут и сообщаем deadline клиентам
    scheduleRoomCleanup(room);
    io.to(room.code).emit('game:over', {
      roomId: room.code,
      winners: room.winners,
      cleanupAt: room.cleanupAt,
    });
    emitGameState(room.code, room);
  }
}


function emitRoundState(room) {
  if (!room || !room.code) return;
  io.to(room.code).emit('game:round', {
    roomId: room.code,
    number: room.round?.number || 1,
    quota: room.round?.quota || 0,
    revealedBy: room.round?.revealedBy || {},
  });
}




function presencePayload(room) {
  return {
    roomId: room.code,
    players: sortBySeat(Array.from(room.players.values()).map(p => ({
      id: p.clientId,
      nick: p.nick,
      seat: p.seat,
      avatarUrl: p.avatarUrl || null,
    }))),
    maxPlayers: room.maxPlayers,
  };
}
function roomStatePayload(room) {
  return {
    roomId: room.code,
    hostId: room.hostClientId || null,
    started: !!room.started,
    maxPlayers: room.maxPlayers,
    game: room.game || 'bunker',
    open: !!room.open,
    players: sortBySeat(Array.from(room.players.values()).map(p => ({
      id: p.clientId,
      nick: p.nick,
      seat: p.seat,
      avatarUrl: p.avatarUrl || null,
    }))),
  };
}
function publicPlayers(room) {
  const revealAll = !!room.revealAll;
  const arr = Array.from(room.players.values()).map((p) => {
    const hand = p.hand ? { ...p.hand } : {};
    const payload = {
      id: p.clientId,
      nick: p.nick,
      avatarUrl: p.avatarUrl || null,
      revealed: revealAll ? hand : { ...(p.revealed || {}) },
      seat: p.seat,
      kicked: !!p.kicked,
      abilities: [p.hand?.ability1, p.hand?.ability2] || [],
    };
    if (revealAll) {
      payload.hand = hand;
    }
    return payload;
  });
  // Активные по seat, «исключённые» — вниз, тоже по seat
  return arr.sort((a, b) => {
    if (!!a.kicked === !!b.kicked) return (a.seat || 0) - (b.seat || 0);
    return a.kicked ? 1 : -1;
  });
}


/* ===== Активные комнаты (для лобби) ===== */
function roomsList() {
  return Array.from(rooms.values())
  .filter((room) => (room.players ? room.players.size : 0) > 0) // ⬅️ показываем только НЕпустые
   .map((room) => {
    const hostNick = room.hostClientId && room.players.get(room.hostClientId)
      ? room.players.get(room.hostClientId).nick
      : '';
    return {
      code: room.code,
      game: room.game || 'bunker',
      started: !!room.started,
      maxPlayers: room.maxPlayers,
      count: room.players.size,
      hostNick,
      open: !!room.open,
    };
  });
}
function broadcastRooms(ioInstance) {
  ioInstance.emit('rooms:update', { rooms: roomsList() });


}


// ===== Skip-vote state per room =====
function ensureSkipVote(room) {
  if (!room.skipVotes) room.skipVotes = new Set(); // Set<clientId>
  return room.skipVotes;
}

function getActivePlayersCount(room) {
  // Используй свою реальную структуру игроков.
  // Если есть Map room.players -> берем всех некикнутых:
  const list = room.players ? Array.from(room.players.values()) : [];
  return list.filter(p => !p.kicked).length;
}

function broadcastVoteState(room) {
  const votesSet = ensureSkipVote(room);
  const total = getActivePlayersCount(room);
  const votes = votesSet.size;
  const needed = Math.ceil(total / 2);
  io.to(room.code || room.roomId || room.id).emit('game:voteSkipState', {
    roomId: room.code || room.roomId || room.id,
    votes, total, needed,
    voters: Array.from(votesSet), // clientId'ы проголосовавших
  });
}



function buildVotePayload(room) {
  return room.vote ? {
    roomId: room.code,
    phase: room.vote.phase,
    endsAt: room.vote.endsAt || null,
    speechOrder: room.vote.speechOrder || [],
    speakingIdx: room.vote.speakingIdx ?? -1,
    votes: room.vote.votes || {},
    votedBy: Array.from(room.vote.votedBy || []),
    totalVoters: room.vote.activeAtVote ? room.vote.activeAtVote.size : undefined,
    allowedTargets: room.vote.allowedTargets ? Array.from(room.vote.allowedTargets) : undefined,
  } : { roomId: room.code, phase: 'idle' };
}


function resetSkipVotes(room) {
  room.skipVotes = new Set();
  broadcastVoteState(room);
}


// ---- ROUNDS --------------------------------------------------
// перенесено в game/rounds.js


// ===== Голосование: каркас двух этапов (спичи → голосование) =====

// перенесено в game/timers.js

const broadcastVote = (room) => voteMod.broadcastVote(room, ioRef);

const ensureVoteIdle = (room) => voteMod.ensureVoteIdle(room);

const beginSpeeches = (room) => voteMod.beginSpeeches(room, ioRef);

const nextSpeechOrBallot = (room) => voteMod.nextSpeechOrBallot(room, ioRef);

const enterBallot = (room) => voteMod.enterBallot(room, ioRef);
const finishBallot = (room) => voteMod.finishBallot(room, ioRef);

// перенесено в game/vote.js

// перенесено в game/timers.js








  






// перенесено в game/timers.js




// ===== REST =====
app.get('/', (_, res) => {
  res.type('html').send('Привет! Сервер для игры "Бункер" работает 🚀');
});
app.get('/health', (_, res) => res.json({ ok: true, service: 'bunker-server' }));

// Rooms router
const { createRoomsRouter } = require('./routes/rooms');
app.use(createRoomsRouter({
  rooms,
  roomsList,
  broadcastRooms: () => broadcastRooms(io),
  rateLimitCreateRoom,
  code4,
}));

let ioRef = null;

// ===== WS =====
const server = http.createServer(app);
// Инициализация Socket.IO с теми же CORS
const io = new Server(server, {
  // для дев-сборки разрешаем любой Origin (браузер всё равно шлёт реальный)
  cors: { origin: true, credentials: true },
});
ioRef = io;



function ensureRoom(roomId) {
  const room = rooms.get(roomId);
  return room || null;
}

// === Socket.IO: регистрация обработчиков через внешнюю функцию ===
const { initGameSockets } = require('./sockets/game');
function registerSocketHandlers(socket, io) {
  socket.on('ping', () => socket.emit('pong'));

  socket.on('rooms:get', () => {
    socket.emit('rooms:update', { rooms: roomsList() });
  });


  // Игрок голосует за/против пропуска хода
socket.on('game:voteSkip', ({ roomId, vote }) => {
  const room = ensureRoom(roomId);
  if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}

  if (!room || !room.started) return;
  // Нельзя скипать ход, пока идёт голосование
   if (room.vote && room.vote.phase && room.vote.phase !== 'idle') {
   // можно ответить клиенту для UI, что скип недоступен
   socket.emit('game:voteSkipDenied', { roomId, reason: 'voting-phase' });
   return;
 }

  // голосовать можно после 120+
  if ((room.turnTimerSec || 0) < 120) return;

  const cid = socket.clientId || socket.handshake?.auth?.clientId;
  if (!cid) return;

  const voter = room.players.get(cid);
  if (!voter || voter.kicked) return; // ⛔ кикнутые не голосуют за пропуск

  const votesSet = ensureSkipVote(room);
  if (vote) votesSet.add(cid); else votesSet.delete(cid);

  broadcastVoteState(room);

  const total = getActivePlayersCount(room);
  const needed = Math.ceil(total / 2); // ≥ 50%
  if (votesSet.size >= needed) {
    const prevId = room.currentTurnId;
    // ✅ единая логика: авто-раскрытие + учёт квоты
    applySkipAutoReveal(room, prevId, room.code || roomId);


    // вдруг после авто-раскрытия активных стало ≤ мест — финал
checkGameOver(room);
if (room.gameOver) {
  return; // checkGameOver сам разошлёт game:over + game:state
}
    // уведомление для баннера
    io.to(roomId).emit('game:skipSuccess', {
      roomId,
      prevPlayerId: prevId,
      prevNick: getRoomPlayerById(room, prevId)?.nick || ''
    });
    // меняем ход
    advanceTurn(room);
  }


});

// --- Голосование (каркас): синк, старт, голос, досрочное закрытие ---
socket.on('vote:getState', ({ roomId }) => {
  const room = ensureRoom(roomId);
  if (!room) return;
  socket.emit('vote:state', buildVotePayload(room));
});

socket.on('vote:start', ({ roomId, clientId }) => {
  const room = ensureRoom(roomId);
  if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}

  if (!room || !room.started) return;
  const senderId = socket.clientId;
  if (!senderId || room.hostClientId !== senderId) return; // только реальный хост этого сокета
  beginSpeeches(room);
});

socket.on('vote:cast', ({ roomId, clientId, targetId }) => {
  const room = ensureRoom(roomId);

  
  if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}

  if (!room || !room.started || !room.vote) return;
  if (room.vote.phase !== 'ballot') return;

  const voterId = socket.clientId;
  if (!voterId) return;

  // ⛔ запрет голосовать за себя
  if (targetId === voterId) {
    socket.emit('vote:error', { roomId, reason: 'self_vote_forbidden' });
    return;
  }

  // ⛔ кикнутые не голосуют
  const voter = room.players.get(voterId);
  if (!voter || voter.kicked) return;

  // ✅ голосовать может только тот, кто был в составе на момент старта ballot
  const eligible = room.vote.activeAtVote instanceof Set
    ? room.vote.activeAtVote
    : new Set(room.turnOrder || []);
  if (!eligible.has(voterId)) return;

  // ⛔ нельзя голосовать по уже кикнутому
  const target = room.players.get(targetId) || getRoomPlayerById(room, targetId);
  if (!target || target.kicked) return;

  // ⛔ если идёт переголосование среди ограниченного списка — проверим цель
  if (room.vote.allowedTargets instanceof Set && room.vote.allowedTargets.size > 0) {
    const targetClientId = (room.players.get(targetId)?.clientId) || targetId;
    if (!room.vote.allowedTargets.has(targetClientId)) return;
  }

  room.vote.votedBy = room.vote.votedBy || new Set();
  if (room.vote.votedBy.has(voterId)) return;

  room.vote.votes = room.vote.votes || {};
  room.vote.votes[target.clientId || targetId] =
    (room.vote.votes[target.clientId || targetId] || 0) + 1;

  room.vote.votedBy.add(voterId);
  room.vote.byVoter?.set(voterId, (target.clientId || targetId)); // ⬅️ копим кто-кого
  broadcastVote(room);
});


socket.on('vote:forceClose', ({ roomId, clientId }) => {
  const room = ensureRoom(roomId);
  if (room?.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}
  if (!room || !room.started || !room.vote) return;
  const senderId = socket.clientId;
  if (!senderId || room.hostClientId !== senderId) return;
  if (room.vote.phase !== 'ballot') return;
  finishBallot(room);
});



  socket.on('joinRoom', ({ roomId, nick, clientId, avatarUrl }) => {
    const room = ensureRoom(roomId);
    if (!room) {
      socket.emit('room:error', { reason: 'not_found', roomId });
      
      return;
    }
    if (!clientId || typeof clientId !== 'string') {
      socket.emit('room:error', { reason: 'invalid_client', roomId });
      return;
    }
    socket.clientId = clientId; // ✅ запоминаем тут

    let existing = room.players.get(clientId);

    if (room.started && !existing) {
      const comeback = room.reconnect?.get(clientId);
      if (comeback) {
        comeback.id = socket.id;
        comeback.clientId = clientId;
        room.players.set(clientId, comeback);
        room.reconnect.delete(clientId);
        existing = comeback;
      } else {
        socket.emit('room:error', { reason: 'game_started', roomId });
        return;
      }
    }
    if (room.players.size >= room.maxPlayers && !existing) {
      socket.emit('room:error', { reason: 'full', roomId });
      return;
    }

    socket.join(roomId);


    // Если на комнату был поставлен таймер удаления — отменяем (кто-то вернулся после рефреша)
if (emptyRoomTimers.has(room.code)) {
  clearTimeout(emptyRoomTimers.get(room.code));
  emptyRoomTimers.delete(room.code);
}

    if (existing) {
      existing.id = socket.id;
      const cleanNick = String(nick || '').trim();
      if (cleanNick && !/^guest$/i.test(cleanNick) && !/^гость$/i.test(cleanNick)) {
        existing.nick = cleanNick;
      }
      if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
        existing.avatarUrl = avatarUrl.trim();
      }
    } else {
      const seat = room.nextSeat++;
      room.players.set(clientId, {
        id: socket.id,
        clientId,
        nick: String(nick || 'Гость'),
        roomId,
        seat,
        revealed: {},
        revealedKeys: [],
        avatarUrl: (typeof avatarUrl === 'string' && avatarUrl.trim()) ? avatarUrl.trim() : null,
      });
    }

    if (!room.hostClientId) room.hostClientId = clientId;

    socket.emit('room:state', roomStatePayload(room));
    io.to(roomId).emit('presence', presencePayload(room));
    broadcastRooms(io);

    // Обновляем статистику при присоединении игрока
    if (!existing) {
      updateStats('player_joined', roomId);
    }


    if (room.started) {
  ensureTurnState(room);
  resetSkipVotes(room); // сбросить голоса при изменении состава
  rounds.ensureRoundState(room);
  emitRoundState(room);
  io.to(roomId).emit('game:turn', { roomId, currentTurnId: room.currentTurnId });
  emitGameState(roomId, room);
  // 🔁 сразу пушим текущее состояние голосования, чтобы новый клиент не ждал vote:getState
  broadcastVote(room);
  }
// 👉 если есть сохранённые итоги — сразу отдадим и их новому/вернувшемуся клиенту
if (room.lastVote) {
  socket.emit('vote:result', {
    roomId: room.code,
    lastVote: room.lastVote,
  });
}



  });

  socket.on('vote:speech:finish', ({ roomId }) => {
  const room = ensureRoom(roomId);
  if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}

  if (!room || !room.vote || room.vote.phase !== 'speeches') return;

  // Находим игрока по текущему сокету
  const player = Array.from(room.players.values()).find(p => p.id === socket.id);
  if (!player) return;

  const order = room.vote.speechOrder || [];
  const idx = typeof room.vote.speakingIdx === 'number' ? room.vote.speakingIdx : -1;
  const currentId = order[idx];

  // Разрешаем только текущему оратору
  if (!currentId || currentId !== player.clientId) return;

  const now = Math.floor(Date.now() / 1000);


 

  // Переходим к следующему оратору или к голосованию
  if (idx + 1 < order.length) {
    room.vote.speakingIdx = idx + 1;
    room.vote.endsAt = now + 60;         // новый спич = 60 сек
    broadcastVote(room);                  // обновим у всех баннер/индикаторы
    timers.scheduleVoteTick(room, ioRef); // ← чтобы таймер спичей продолжил тикать
    
  } else {
    // Все выступили — переходим к голосованию (90 сек тишины)
    enterBallot(room);
  

  }
  
});


  socket.on('leaveRoom', ({ roomId, clientId }) => {
    const room = ensureRoom(roomId);
    if (!room) return;

    let cid = clientId;
    if (!cid) {
      const found = Array.from(room.players.values()).find(p => p.id === socket.id);
      cid = found?.clientId || null;
    }
    if (!cid) return;

    if (room.players.has(cid)) {
      room.players.delete(cid);
      socket.leave(roomId);
      
      // Обновляем статистику при выходе игрока
      updateStats('player_left', roomId);
      
      if (room.hostClientId === cid) {
        const first = sortBySeat(Array.from(room.players.values()))[0]?.clientId || null;
        room.hostClientId = first;
      }
      if (room.players.size === 0) {
  // Вместо немедленного удаления — отложим на 15с (грейс на рефреш)
  if (emptyRoomTimers.has(room.code)) {
    clearTimeout(emptyRoomTimers.get(room.code));
  }
  const t = setTimeout(() => {
    const r = rooms.get(room.code);
    if (!r || r.players.size > 0) return; // кто-то уже вернулся — не удаляем
    rooms.delete(room.code);
    broadcastRooms(io);
  }, 15000);
  emptyRoomTimers.set(room.code, t);
  return; // дальше не продолжаем
}


io.to(roomId).emit('presence', presencePayload(room));
io.to(roomId).emit('room:state', roomStatePayload(room));
broadcastRooms(io);

// 🧭 Актуализируем порядок/ход, если игра идёт
if (room.started) {
  ensureTurnState(room);
  resetSkipVotes(room);
  if (!room.turnOrder.includes(room.currentTurnId)) {
    room.currentTurnId = room.turnOrder[0] || null;
  }

  // 🏁 вдруг активных стало ≤ мест — финалим партию
  checkGameOver(room);                 // ⬅️ добавили
  if (room.gameOver) return;           // ⬅️ добавили
  
  beginTurn(roomId, room.currentTurnId);
  ensureTurnState(room);
  rounds.ensureRoundState(room);
  emitRoundState(room);
  emitGameState(roomId, room);
}


    }
  });

  socket.on('room:getState', ({ roomId }) => {
    const room = ensureRoom(roomId);
    if (!room) return;
    socket.emit('room:state', roomStatePayload(room));
  });

  socket.on('game:skipTurn', ({ roomId }) => {
  const room = ensureRoom(roomId);
  if (!room || !room.started) return;

  if (room.gameOver) {                     // ⬅️ добавили
    socket.emit('game:over', { roomId, winners: room.winners || [] });
    return;
  }

  if ((room.turnTimerSec || 0) < 120) return; // ваша защита

  // открыть одну случайную х-ку у игрока, чей ход пропускаем
  const prevId = room.currentTurnId;

// ✅ единая логика: авто-раскрытие + учёт квоты
applySkipAutoReveal(room, prevId, roomId);

// уведомление для баннера на клиенте
io.to(roomId).emit('game:skipSuccess', {
  roomId,
  prevPlayerId: prevId,
  prevNick: getRoomPlayerById(room, prevId)?.nick || ''
});

advanceTurn(room);


});









  // ---- Синхронизация экрана игры ----
  socket.on('game:sync', ({ roomId }) => {
    const room = ensureRoom(roomId);
    if (!room || !room.started) return;

    const me = Array.from(room.players.values()).find(p => p.id === socket.id);
    if (me && me.hand) {
      socket.emit('game:you', {
        hand: me.hand,
        hiddenKey: me.hiddenKey ?? null,
        revealedKeys: me.revealedKeys || [],
      });
    }
    const sec = Math.min(room.turnTimerSec || 0, 120);
socket.emit('game:state', {
  
  roomId,
  phase: 'reveal',
  players: publicPlayers(room),
  bunker: room.bunker,
  cataclysm: room.cataclysm,
  currentTurnId: room.currentTurnId,
  turnSeconds: sec,
  round: room.round,
  // ▼ добавьте эти поля
  lastVoteTotals: room.lastVote?.totals || null,
  lastVoteVotersByTarget: room.lastVote?.votersByTarget || null,
  lastVoteTotalVoters: room.lastVote?.totalVoters ?? null,
  lastVoteTotalEligible: room.lastVote?.totalEligible ?? null,
  
  // 👇 добавь это, чтобы клиент сразу отрисовал счётчик голосов
  voteSkip: {
    votes: (room.skipVotes ? room.skipVotes.size : 0),
    total: getActivePlayersCount(room),
    needed: Math.ceil(getActivePlayersCount(room) / 2),
    voters: Array.from(room.skipVotes || []),

  },
  gameOver: !!room.gameOver,
  winners: Array.isArray(room.winners) ? room.winners : [],
  
  lastVote: room.lastVote || null,     // ⬅️ добавили
  cleanupAt: room.cleanupAt || null,
  
});
// 🔁 сразу пушим текущее состояние голосования, чтобы клиент отрисовал «спичи/голос»
broadcastVote(room);

// 👉 если есть итоги последнего голосования — отдадим их сразу,
// чтобы блок «Результат последнего голосования» появился без доп. событий
if (room.lastVote) {
  socket.emit('vote:result', {
    roomId,
    lastVote: room.lastVote,
  });
}
  });

  // ---- Старт игры (только хост) ----
  socket.on('room:start', ({ roomId }) => {
    const room = ensureRoom(roomId);
    if (!room) return;

    // 🔒 Ранняя проверка прав хоста — прежде чем трогать ход

    // На всякий случай гасим любые остатки голосований до старта
    room.vote = { phase: 'idle' };
    const meStart = Array.from(room.players.values()).find(p => p.id === socket.id);
    if (!meStart || room.hostClientId !== meStart.clientId) {
    socket.emit('room:error', { reason: 'not_host', roomId });
    return;
    }


    // 👇 Инициализируем порядок ходов и текущий ход
    ensureTurnState(room);
    

    const me = Array.from(room.players.values()).find(p => p.id === socket.id);
    if (!me || room.hostClientId !== me.clientId) {
      socket.emit('room:error', { reason: 'not_host', roomId });
      return;
    }

    if (room.started) return;
    if (room.players.size < 2) {
      socket.emit('room:error', { reason: 'not_enough_players', roomId, min: 2 });
      return;
    }

    room.revealAll = false;
    room.hostRevealHands = false;
    room.editorEnabled = false;
    room.paused = false;
    io.to(roomId).emit('game:editorState', { roomId, enabled: room.editorEnabled });
    socket.emit('game:revealAll:host', { roomId, hands: {} });

    room.started = true;
    
    // Обновляем статистику при старте игры
    updateStats('game_started', roomId);
    
ensureTurnState(room);
rounds.ensureRoundState(room);

// 👇 сначала генерируем бункер/катаклизм и раздаём руки
let places = Math.max(1, Math.floor(room.players.size / 2));
if (room.players.size >= 3 && room.players.size <= 5) {
  places = 2; // фикс для 3–5 игроков
}
room.bunker = generateBunker({ places });

room.cataclysm = generateCataclysm();

for (const player of room.players.values()) {
  player.hand = generateHand();
  player.hiddenKey = null;
  player.revealedKeys = [];
  player.revealed = {};

  io.to(player.id).emit('game:you', {
    hand: player.hand,
    hiddenKey: player.hiddenKey,
    revealedKeys: player.revealedKeys,
  });
}

// 👉 сначала room:state
io.to(roomId).emit('room:state', roomStatePayload(room));

// 👉 теперь стартуем ход/таймер
beginTurn(roomId, room.currentTurnId);

// 👉 и сразу отдадим game:state с актуальным таймером
io.to(roomId).emit('game:state', {
  roomId,
  phase: 'reveal',
  players: publicPlayers(room),
  bunker: room.bunker,
  cataclysm: room.cataclysm,
  currentTurnId: room.currentTurnId,
  turnSeconds: Math.min(room.turnTimerSec || 0, 120),
  round: room.round,
  voteSkip: {
    votes: (room.skipVotes ? room.skipVotes.size : 0),
    total: getActivePlayersCount(room),
    needed: Math.ceil(getActivePlayersCount(room) / 2),
    voters: Array.from(room.skipVotes || []),
  },
  gameOver: !!room.gameOver,
  winners: Array.isArray(room.winners) ? room.winners : [],
  lastVote: room.lastVote || null,
  cleanupAt: room.cleanupAt || null,
});

    broadcastRooms(io);
  });

  // ---- Открыть "следующую" карту по порядку ----
  socket.on('game:reveal', ({ roomId }) => {
    const room = ensureRoom(roomId);
    if (!room || !room.started) return;
    if (room.gameOver) {
   socket.emit('game:over', { roomId, winners: room.winners || [] });
   return;
 }

    
// во время голосования «следующую» карту открывать нельзя
if (room.vote && room.vote.phase && room.vote.phase !== 'idle') {
  return;
}


    const player = Array.from(room.players.values()).find(p => p.id === socket.id);
    if (!player || !player.hand) return;


    // 🔒 проверки раунда
  rounds.ensureRoundState(room);
  const playerId = socket.clientId || player.clientId;
  const alreadyProf = player.revealed?.profession || (player.revealedKeys || []).includes('profession');
  const profHiddenForever = player.hiddenKey === 'profession';
  const done = room.round.revealedBy[playerId] || 0;
  if (done >= room.round.quota) {
    socket.emit('game:revealDenied', { roomId, reason: 'round-quota-reached' });
    return;
  }

    let nextKey = null;
    for (const k of ORDER) {
      if (k === player.hiddenKey) continue;
      if (!player.revealedKeys.includes(k)) { nextKey = k; break; }
    }
    if (!nextKey) return;

     // 1-й раунд: сначала профессия (если она не скрыта навсегда)
  if (room.round.number === 1 && !alreadyProf && !profHiddenForever) {
    nextKey = 'profession';
  }

    player.revealedKeys.push(nextKey);
    player.revealed[nextKey] = player.hand[nextKey];

    // 📈 учёт квоты раунда (ORDER — только обычные ключи)
  rounds.bumpRevealedThisRound(room, playerId);
emitRoundState(room);

// 1) Сначала ОБЯЗАТЕЛЬНО разошлём обновлённое состояние с открытой ячейкой
io.to(socket.id).emit('game:you', {
  hand: player.hand,
  hiddenKey: player.hiddenKey ?? null,
  revealedKeys: player.revealedKeys,
});
io.to(roomId).emit('game:state', {
  roomId,
  phase: 'reveal',
  players: publicPlayers(room),
  bunker: room.bunker,
  cataclysm: room.cataclysm,
  currentTurnId: room.currentTurnId,
  turnSeconds: Math.min(room.turnTimerSec || 0, 120),
  round: room.round,
  voteSkip: {
    votes: (room.skipVotes ? room.skipVotes.size : 0),
    total: getActivePlayersCount(room),
    needed: Math.ceil(getActivePlayersCount(room) / 2),
    voters: Array.from(room.skipVotes || []),
  },
  cleanupAt: room.cleanupAt || null,
});

// 2) Если квота закрыта — мягко стартуем спичи после микро-паузы,
//    и только если голосование ещё не начато
if (rounds.allReachedQuota(room)) {
  setTimeout(() => {
    const r = ensureRoom(roomId);
    if (!r) return;
    if (!r.vote || r.vote.phase === 'idle') {
      beginSpeeches(r); // внутри broadcastVote + scheduleVoteTick
    }
  }, 20);
  return;
}
  });

  // ---- Открыть КОНКРЕТНУЮ карту по ключу ----
  socket.on('game:revealKey', ({ roomId, key }) => {
    const room = ensureRoom(roomId);
    if (!room || !room.started) return;
    if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}


    // во время голосования разрешаем раскрывать только спец-возможности
if (room.vote && room.vote.phase && room.vote.phase !== 'idle') {
  if (!rounds.isAbilityKey(key)) return;
}

    const player = Array.from(room.players.values()).find(p => p.id === socket.id);
    if (!player || !player.hand) return;


      rounds.ensureRoundState(room);

const playerId = socket.clientId || player.clientId; // чей reveal
const ability = rounds.isAbilityKey(key);

// 1-й раунд: сначала профессия
const alreadyProf = player.revealed?.profession || (player.revealedKeys || []).includes('profession');
const profHiddenForever = player.hiddenKey === 'profession';
if (!ability && room.round.number === 1 && !alreadyProf && key !== 'profession' && !profHiddenForever) {
  socket.emit('game:revealDenied', { roomId, reason: 'need-profession-first' });
  return;
}

// Лимит на раунд
const done = room.round.revealedBy[playerId] || 0;
if (!ability && done >= room.round.quota) {
  socket.emit('game:revealDenied', { roomId, reason: 'round-quota-reached' });
  return;
}







    if (!Object.prototype.hasOwnProperty.call(player.hand, key)) return;
    if (key === player.hiddenKey) return;
    if (player.revealedKeys.includes(key)) return;

    player.revealedKeys.push(key);
    player.revealed[key] = player.hand[key];

    // учёт квоты (только для обычных характеристик)
if (!ability) {
  rounds.bumpRevealedThisRound(room, playerId);
  emitRoundState(room);
}

// 1) Сначала отдадим всем обновлённое состояние
io.to(socket.id).emit('game:you', {
  hand: player.hand,
  hiddenKey: player.hiddenKey ?? null,
  revealedKeys: player.revealedKeys,
});
io.to(roomId).emit('game:state', {
  roomId,
  phase: 'reveal',
  players: publicPlayers(room),
  bunker: room.bunker,
  cataclysm: room.cataclysm,
  currentTurnId: room.currentTurnId,
  turnSeconds: Math.min(room.turnTimerSec || 0, 120),
  round: room.round,
  voteSkip: {
    votes: (room.skipVotes ? room.skipVotes.size : 0),
    total: getActivePlayersCount(room),
    needed: Math.ceil(getActivePlayersCount(room) / 2),
    voters: Array.from(room.skipVotes || []),
  },
  cleanupAt: room.cleanupAt || null,
});

// 2) Если квота достигнута (и это была НЕ ability) — запускаем спичи через микро-паузу
if (!ability && rounds.allReachedQuota(room)) {
  setTimeout(() => {
    const r = ensureRoom(roomId);
    if (!r) return;
    if (!r.vote || r.vote.phase === 'idle') {
      beginSpeeches(r);
    }
  }, 20);
  return;
}
  });

socket.on('game:revealAll:toggle', ({ roomId, enabled }) => {
  const room = ensureRoom(roomId);
  if (!room) return;

  const requesterId = socket.clientId;
  if (!requesterId || room.hostClientId !== requesterId) return;

  room.revealAll = !!enabled;

  if (room.revealAll && room.hostRevealHands) {
    room.hostRevealHands = false;
    socket.emit('game:revealAll:host', { roomId, hands: {} });
  }

  emitGameState(roomId, room);
});

socket.on('game:revealAll:host', ({ roomId, enabled }) => {
  const room = ensureRoom(roomId);
  if (!room) return;

  const requesterId = socket.clientId;
  if (!requesterId || room.hostClientId !== requesterId) return;

  room.hostRevealHands = !!enabled;

  if (room.hostRevealHands) {
    emitHostHands(room);
  } else {
    socket.emit('game:revealAll:host', { roomId, hands: {} });
  }
});

socket.on('game:editorState', ({ roomId }) => {
  const room = ensureRoom(roomId);
  if (!room) return;

  socket.emit('game:editorState', { roomId, enabled: !!room.editorEnabled });
});

socket.on('game:editor:toggle', ({ roomId, enabled }) => {
  const room = ensureRoom(roomId);
  if (!room) return;

  const requesterId = socket.clientId;
  if (!requesterId || room.hostClientId !== requesterId) return;

  room.editorEnabled = !!enabled;

  io.to(roomId).emit('game:editorState', { roomId, enabled: room.editorEnabled });
  emitGameState(roomId, room);
});

socket.on('game:pause', ({ roomId, paused }) => {
  const room = ensureRoom(roomId);
  if (!room || !room.started || room.gameOver) return;

  const requesterId = socket.clientId;
  if (!requesterId || room.hostClientId !== requesterId) return;

  room.paused = !!paused;
  emitGameState(roomId, room);
});

socket.on('game:reroll', ({ roomId, targetId, key }) => {
  const room = ensureRoom(roomId);
  if (!room || !room.started || !room.editorEnabled) return;

  const requesterId = socket.clientId;
  if (!requesterId || room.hostClientId !== requesterId) return;

  const safeKey = typeof key === 'string' ? key : '';
  if (!HAND_KEYS.includes(safeKey)) return;

  const target = getRoomPlayerById(room, targetId);
  if (!target || !target.hand) return;

  const nextValue = randomValueForKey(safeKey, target.hand);
  if (nextValue == null || nextValue === undefined) return;

  target.hand[safeKey] = nextValue;
  if (target.revealed && Object.prototype.hasOwnProperty.call(target.revealed, safeKey)) {
    target.revealed[safeKey] = nextValue;
  }

  emitGameState(roomId, room);

  if (target.id) {
    io.to(target.id).emit('game:you', {
      hand: target.hand,
      hiddenKey: target.hiddenKey ?? null,
      revealedKeys: target.revealedKeys || [],
    });
  }
});

  // Клиент просит перейти к следующему игроку (после успешного reveal на клиенте)
socket.on('game:nextTurn', ({ roomId }) => {
  const room = ensureRoom(roomId);
  if (room.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}

  if (!room || !room.started) return;
  advanceTurn(room);
});


// Хост может назначить ход вручную (форс)
socket.on('game:turn:force', ({ roomId, playerId }) => {
  const room = ensureRoom(roomId);

  if (room?.gameOver) {
  socket.emit('game:over', { roomId, winners: room.winners || [] });
  return;
}
  if (!room || !room.started) return;

  // проверим права хоста
  const me = Array.from(room.players.values()).find(p => p.id === socket.id);
  if (!me || room.hostClientId !== me.clientId) {
    socket.emit('room:error', { reason: 'not_host', roomId });
    return;
  }

  if (!room.players.has(playerId)) return;
  ensureTurnState(room);
  room.currentTurnId = playerId;
  beginTurn(roomId, room.currentTurnId); // эмит + resetSkipVotes + startTurnTimer
});






  socket.on('disconnect', () => {
    // no-op
    // Снять игрока из всех комнат, где он был
  for (const room of rooms.values()) {
    const p = Array.from(room.players.values()).find(u => u.id === socket.id);
    if (!p) continue;

    const cid = p.clientId || p.id;
    try {
      if (!room.reconnect) room.reconnect = new Map();
      room.reconnect.set(cid, { ...p });
      setTimeout(() => {
        if (room.reconnect?.has(cid)) room.reconnect.delete(cid);
      }, 30_000);
    } catch {}
    room.players.delete(cid);

    if (room.players.size === 0) {
      // Вместо немедленного удаления — отложим на 15с (грейс на рефреш)
      if (emptyRoomTimers.has(room.code)) {
        clearTimeout(emptyRoomTimers.get(room.code));
      }
      const t = setTimeout(() => {
        const r = rooms.get(room.code);
        if (!r || r.players.size > 0) return; // кто-то уже вернулся — не удаляем
        // Только здесь действительно удаляем и обновляем список
        try { timers.clearTurnTimer(room.code); } catch {}
        rooms.delete(room.code);
        broadcastRooms(io);
      }, 15000);
      emptyRoomTimers.set(room.code, t);
      continue;
    }

    // если не опустела — обновим состояние комнаты и список
    io.to(room.code).emit('presence', presencePayload(room));
    io.to(room.code).emit('room:state', roomStatePayload(room));
    broadcastRooms(io);

    // если игра шла — НE переключаем ход сразу
  if (room.started) {
  resetSkipVotes(room); // состав изменился — голоса скипа обнуляем

  const cid = p.clientId || p.id;
  const wasCurrent = room.currentTurnId === cid;

  if (wasCurrent) {
    // даём 30с на реjoin: если вернётся — ход останется у него
    setTimeout(() => {
      const r = rooms.get(room.code);
      if (!r) return;
      const returned = r.players.has(cid);
      const stillCurrent = r.currentTurnId === cid;
      if (stillCurrent && !returned) {
        advanceTurn(r);         // только теперь реально передаём ход
        emitGameState(r.code, r);
      }
    }, 30000);
  } else {
    // ушёл не текущий — можно аккуратно обновить очередь без смены хода
    ensureTurnState(room);
    emitGameState(room.code, room);
  }
  // Раундовую инфу можно отправить без смены хода
  rounds.ensureRoundState(room);
  emitRoundState(room);
}
  }
  });
}

initGameSockets(io, registerSocketHandlers);

// server.listen(PORT, () => {
//   console.log(`HTTP+WS запущены на http://localhost:${PORT} (WS тот же порт)`);
// });


// в самом низу — единый запуск
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP+WS запущены на http://localhost:${PORT} (WS тот же порт)`);
});
