'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  uiMode: 'idle' | 'create' | 'join';
  gameType: 'bunker' | 'whoami';
  openLobby: boolean;
  maxPlayers: number;
  room: string;
  onClose: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onGameType: (v: 'bunker' | 'whoami') => void;
  onToggleOpen: () => void;
  onMaxPlayers: (v: number) => void;
  onRoomChange: (v: string) => void;
};

const FormModalComponent: React.FC<Props> = ({
  uiMode,
  gameType,
  openLobby,
  maxPlayers,
  room,
  onClose,
  onCreate,
  onJoin,
  onGameType,
  onToggleOpen,
  onMaxPlayers,
  onRoomChange,
}) => {
  const joinInputRef = useRef<HTMLInputElement>(null);

  if (uiMode === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        >
          {uiMode === 'create' ? (
            <>
              <h3 className="text-xl font-bold text-white mb-6">Параметры лобби</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Игра</label>
                  <select
                    value={gameType}
                    onChange={(e) => onGameType(e.target.value as 'bunker' | 'whoami')}
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  >
                    <option value="bunker" className="bg-gray-800">Бункер</option>
                    <option value="whoami" className="bg-gray-800">Кто я?</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Тип лобби</label>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onToggleOpen}
                    className={`w-full p-3 rounded-lg font-medium transition-all duration-200 ${
                      openLobby
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/20 border border-red-500/30 text-red-300'
                    }`}
                  >
                    {openLobby ? 'Открытое' : 'Закрытое'}
                  </motion.button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Количество игроков</label>
                  <input
                    type="number"
                    min={2}
                    max={16}
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    value={maxPlayers}
                    onChange={(e) => onMaxPlayers(Number(e.target.value))}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreate}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25"
                  >
                    Создать
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20"
                  >
                    Отмена
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-white mb-6">Войти по коду</h3>
              <div className="space-y-4">
                <input
                  ref={joinInputRef}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  placeholder="Код лобби"
                  value={room}
                  onChange={(e) => onRoomChange(e.target.value.toUpperCase())}
                />
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onJoin}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25"
                  >
                    Войти
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20"
                  >
                    Отмена
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default React.memo(FormModalComponent);


