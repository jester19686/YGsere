'use strict';

// ==== Round management ====
function ensureRoundState(room) {
  if (!room.round) {
    room.round = {
      number: 1,
      quota: 1, // количество характеристик, которые нужно открыть в раунде
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

module.exports = {
  ensureRoundState,
  bumpRevealedThisRound,
  allReachedQuota,
  isAbilityKey,
};



