'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, LogOut, User } from 'lucide-react';

type Props = {
  avatarUrl: string | null;
  nick: string;
  status: 'disconnected' | 'connecting' | 'connected';
  currentRoom: string | null;
  isHost: boolean;
  started: boolean;
  playersCount: number;
  onStart: () => void;
  onGoToGame: () => void;
  onLeave: () => void;
  onCreateClick: () => void;
  onJoinClick: () => void;
};

const PlayerInfoBarComponent: React.FC<Props> = ({
  avatarUrl,
  nick,
  status,
  currentRoom,
  isHost,
  started,
  playersCount,
  onStart,
  onGoToGame,
  onLeave,
  onCreateClick,
  onJoinClick,
}) => (
  <motion.div
    initial={false}
    animate={{ opacity: 1, y: 0 }}
    className="mb-8 p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-lg border border-white/10 bg-white/5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>
        <div>
          <div className="text-xl font-bold text-white">{nick}</div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span>WS: {status}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-300 font-medium">Действия</div>
        {!currentRoom ? (
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreateClick}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300"
            >
              Создать лобби
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onJoinClick}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20 transition-all duration-300"
            >
              Войти в лобби
            </motion.button>
          </div>
        ) : (
          <div className="flex gap-3">
            {!started && isHost && playersCount >= 2 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStart}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Начать игру
              </motion.button>
            )}
            {started && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onGoToGame}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Открыть экран игры
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLeave}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Выйти из лобби
            </motion.button>
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

export default React.memo(PlayerInfoBarComponent);


