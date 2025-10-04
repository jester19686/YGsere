'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User } from 'lucide-react';

type Props = {
  status: 'disconnected' | 'connecting' | 'connected';
  nick: string;
  onBack: () => void;
  onResetNick: () => void;
};

const TopBarComponent: React.FC<Props> = ({ status, nick, onBack, onResetNick }) => (
  <motion.div
    initial={false}
    animate={{ opacity: 1, y: 0 }}
    className="mb-8 flex items-center justify-between p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
  >
    <div className="flex items-center gap-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBack}
        className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg hover:from-gray-500 hover:to-gray-600 transition-all duration-200"
        title="Вернуться на главную"
      >
        <ArrowLeft className="w-6 h-6 text-white" />
      </motion.button>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
        <User className="w-6 h-6 text-white" />
      </div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        Лобби
      </h1>
    </div>
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <span className="text-gray-300">WS статус:</span>
        <span className="font-semibold text-white">{status}</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300">Ник:</span>
        <span className="font-semibold text-white">{nick}</span>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onResetNick}
        className="text-xs px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all duration-200 border border-white/10"
      >
        сменить
      </motion.button>
    </div>
  </motion.div>
);

export default React.memo(TopBarComponent);


