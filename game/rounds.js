'use strict';

// ==== Round management ====
function ensureRoundState(room) {
  if (!room.round) {
    room.round = {
      number: 1,
      quota: 3, // количество характеристик, которые нужно открыть в раунде (раунд 1 = 3 хода)
      revealedBy: {} // { [playerId]: number } - сколько открыл каждый игрок
    };
  }
}

function bumpRevealedThisRound(room, playerId) {
  ensureRoundState(room);
  if (!room.round.revealedBy) {
    room.round.revealedBy = {};
  }
  room.round.revealedBy[playerId] = (room.round.revealedBy[playerId] || 0) + 1;
}

function allReachedQuota(room) {
  ensureRoundState(room);
  const activePlayers = Array.from(room.players.values()).filter(p => !p.kicked);
  const quota = room.round.quota;
  
  return activePlayers.every(player => {
    const revealed = room.round.revealedBy[player.clientId] || 0;
    return revealed >= quota;
  });
}

function isAbilityKey(key) {
  return key === 'ability1' || key === 'ability2';
}

// Переход к следующему раунду
function advanceRound(room) {
  ensureRoundState(room);
  room.round.number += 1;
  
  // Устанавливаем квоту в зависимости от номера раунда
  // Раунд 1: 3 хода, Раунд 2: 2 хода, Раунд 3+: 1 ход
  if (room.round.number === 2) {
    room.round.quota = 2;
  } else if (room.round.number >= 3) {
    room.round.quota = 1;
  } else {
    room.round.quota = 3;
  }
  
  // Сброс счётчика открытых характеристик
  room.round.revealedBy = {};
}

module.exports = {
  ensureRoundState,
  bumpRevealedThisRound,
  allReachedQuota,
  isAbilityKey,
  advanceRound,
};



