'use strict';

/**
 * Инициализация Socket.IO: делегируем регистрацию всех обработчиков
 * внешней функции registerHandlers(socket, io), чтобы не тянуть в этот модуль
 * всю игровую логику. Это сохраняет текущее поведение и упрощает постепенный вынос логики.
 */
function initGameSockets(io, registerHandlers) {
  if (!io || typeof io.on !== 'function') return;
  if (typeof registerHandlers !== 'function') return;
  io.on('connection', (socket) => {
    registerHandlers(socket, io);
  });
}

module.exports = { initGameSockets };






