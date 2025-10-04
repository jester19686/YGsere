'use strict';

const express = require('express');

function createRoomsRouter({ rooms, roomsList, broadcastRooms, rateLimitCreateRoom, code4 }) {
  const router = express.Router();

  router.get('/rooms', (_req, res) => {
    res.json({ rooms: roomsList() });
  });

  router.post('/rooms', (req, res) => {
    if (!rateLimitCreateRoom(req, res)) return;
    let { maxPlayers, game, open } = req.body || {};
    maxPlayers = Number(maxPlayers || 8);
    if (maxPlayers < 2) maxPlayers = 2;
    if (maxPlayers > 16) maxPlayers = 16;

    const normalizedGame = game === 'whoami' ? 'whoami' : 'bunker';
    const isOpen = !!open;

    let code;
    do { code = code4(); } while (rooms.has(code));

    rooms.set(code, {
      code,
      game: normalizedGame,
      maxPlayers,
      hostClientId: null,
      started: false,
      nextSeat: 1,
      players: new Map(),
      open: isOpen,
      bunker: null,
      turnOrder: null,
      currentTurnId: null,
      vote: null,
      revealAll: false,
      hostRevealHands: false,
      editorEnabled: false,
      paused: false,
      reconnect: new Map(),
      gameOver: false,
      winners: [],
      lastVote: null,
    });

    if (typeof broadcastRooms === 'function') setTimeout(() => broadcastRooms(), 0);
    res.json({ code, maxPlayers });
  });

  return router;
}

module.exports = { createRoomsRouter };



