'use strict';

// ==== Vote management ====
let dependencies = {};

function setDependencies(deps) {
  dependencies = deps;
}

function ensureVoteIdle(room) {
  if (!room.vote) {
    room.vote = { phase: 'idle' };
  }
}

function beginSpeeches(room, io) {
  if (!room || !room.started) return;
  
  const activePlayers = Array.from(room.players.values())
    .filter(p => !p.kicked)
    .map(p => p.clientId);
  
  room.vote = {
    phase: 'speeches',
    speechOrder: [...activePlayers],
    speakingIdx: 0,
    endsAt: dependencies.nowSec ? dependencies.nowSec() + 60 : Math.floor(Date.now() / 1000) + 60,
    votes: {},
    votedBy: new Set(),
    activeAtVote: new Set(activePlayers),
    allowedTargets: new Set(activePlayers)
  };
  
  broadcastVote(room, io);
  if (dependencies.scheduleVoteTick) {
    dependencies.scheduleVoteTick(room, io);
  }
}

function nextSpeechOrBallot(room, io) {
  if (!room.vote || room.vote.phase !== 'speeches') return;
  
  const order = room.vote.speechOrder || [];
  const idx = room.vote.speakingIdx || 0;
  
  if (idx + 1 < order.length) {
    // Переходим к следующему оратору
    room.vote.speakingIdx = idx + 1;
    room.vote.endsAt = dependencies.nowSec ? dependencies.nowSec() + 60 : Math.floor(Date.now() / 1000) + 60;
    broadcastVote(room, io);
    if (dependencies.scheduleVoteTick) {
      dependencies.scheduleVoteTick(room, io);
    }
  } else {
    // Все выступили - переходим к голосованию
    enterBallot(room, io);
  }
}

function enterBallot(room, io) {
  if (!room.vote) return;
  
  room.vote.phase = 'ballot';
  room.vote.endsAt = dependencies.nowSec ? dependencies.nowSec() + 90 : Math.floor(Date.now() / 1000) + 90;
  room.vote.votes = {};
  room.vote.votedBy = new Set();
  room.vote.byVoter = new Map();
  
  broadcastVote(room, io);
  if (dependencies.scheduleVoteTick) {
    dependencies.scheduleVoteTick(room, io);
  }
}

function finishBallot(room, io) {
  if (!room.vote || room.vote.phase !== 'ballot') return;
  
  const totals = room.vote.votes || {};
  const votersByTarget = {};
  
  // Собираем информацию о том, кто за кого голосовал
  if (room.vote.byVoter) {
    for (const [voterId, targetId] of room.vote.byVoter) {
      if (!votersByTarget[targetId]) {
        votersByTarget[targetId] = [];
      }
      votersByTarget[targetId].push(voterId);
    }
  }
  
  // Находим игрока с максимальным количеством голосов
  let maxVotes = 0;
  let targetId = null;
  
  for (const [id, count] of Object.entries(totals)) {
    if (count > maxVotes) {
      maxVotes = count;
      targetId = id;
    }
  }
  
  if (targetId && maxVotes > 0) {
    // Исключаем игрока
    const player = Array.from(room.players.values()).find(p => p.clientId === targetId);
    if (player) {
      player.kicked = true;
    }
  }
  
  // Сбрасываем голосование
  room.vote = { phase: 'idle' };
  
  // Отправляем результат
  if (dependencies.setLastVoteAndBroadcast) {
    dependencies.setLastVoteAndBroadcast(room.code, room, { totals, votersByTarget });
  }
  
  // Обновляем состояние игры
  if (dependencies.emitGameState) {
    dependencies.emitGameState(room.code, room);
  }
  
  // Проверяем окончание игры
  if (dependencies.checkGameOver) {
    dependencies.checkGameOver(room);
  }
  
  // Если игра не закончилась, переходим к следующему ходу
  if (!room.gameOver && dependencies.advanceTurn) {
    dependencies.advanceTurn(room);
  }
}

function broadcastVote(room, io) {
  if (!room || !io) return;
  
  const payload = buildVotePayload(room);
  io.to(room.code).emit('vote:state', payload);
}

function buildVotePayload(room) {
  if (!room.vote) {
    return { roomId: room.code, phase: 'idle' };
  }
  
  return {
    roomId: room.code,
    phase: room.vote.phase,
    endsAt: room.vote.endsAt || null,
    speechOrder: room.vote.speechOrder || [],
    speakingIdx: room.vote.speakingIdx ?? -1,
    votes: room.vote.votes || {},
    votedBy: Array.from(room.vote.votedBy || []),
    totalVoters: room.vote.activeAtVote ? room.vote.activeAtVote.size : undefined,
    allowedTargets: room.vote.allowedTargets ? Array.from(room.vote.allowedTargets) : undefined,
  };
}

module.exports = {
  setDependencies,
  ensureVoteIdle,
  beginSpeeches,
  nextSpeechOrBallot,
  enterBallot,
  finishBallot,
  broadcastVote,
  buildVotePayload,
};



