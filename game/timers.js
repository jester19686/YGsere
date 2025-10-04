'use strict';

// ==== Turn timer per room ====
function startTurnTimer(roomId, room, io) {
  if (!room) return;
  clearTurnTimer(roomId, room);
  room.turnTimerSec = 0;
  room.turnTimer = setInterval(() => {
    const r = room; // room уже передан, не нужно искать заново
    if (!r) { clearTurnTimer(roomId, room); return; }
    r.turnTimerSec = (r.turnTimerSec || 0) + 1;
    const sec = Math.min(r.turnTimerSec, 120);
    io.to(roomId).emit('game:turnTick', { roomId, seconds: sec });
  }, 1000);
}

function clearTurnTimer(roomId, room) {
  if (!room || !room.turnTimer) return;
  clearInterval(room.turnTimer);
  room.turnTimer = null;
}

// Vote timer functions
function scheduleVoteTick(room, io) {
  clearVoteTick(room);
  const rest = Math.max(0, (room.vote?.endsAt || 0) - nowSec());
  room.vote._tid = setTimeout(() => onVoteTimer(room, io), rest * 1000 + 50);
}

function onVoteTimer(room, io) {
  if (!room.vote) return;
  const now = nowSec();
  const ends = room.vote.endsAt || 0;
  // если дедлайн сдвинулся вперёд (мы пришли по старому таймеру) — перепланируем
  if (ends && now < ends) {
    return scheduleVoteTick(room, io);
  }
  if (room.vote.phase === 'speeches') {
    if (typeof nextSpeechOrBallot === 'function') {
      return nextSpeechOrBallot(room, io);
    } else {
      console.error('nextSpeechOrBallot function not initialized in timers module');
      return;
    }
  }
  if (room.vote.phase === 'ballot') {
    if (typeof finishBallot === 'function') {
      return finishBallot(room, io);
    } else {
      console.error('finishBallot function not initialized in timers module');
      return;
    }
  }
}

function clearVoteTick(room) {
  try {
    if (room?.vote?._tid) {
      clearTimeout(room.vote._tid);
      room.vote._tid = null;
    }
  } catch {}
}

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

// These functions need to be imported from vote module
let nextSpeechOrBallot, finishBallot;

function setVoteFunctions(nextSpeechOrBallotFn, finishBallotFn) {
  nextSpeechOrBallot = nextSpeechOrBallotFn;
  finishBallot = finishBallotFn;
}

module.exports = {
  startTurnTimer,
  clearTurnTimer,
  scheduleVoteTick,
  onVoteTimer,
  clearVoteTick,
  nowSec,
  setVoteFunctions,
};
