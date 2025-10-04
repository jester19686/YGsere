'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Crown, Users } from 'lucide-react';

export type ActiveRoom = {
  code: string;
  game: 'bunker' | 'whoami';
  started: boolean;
  maxPlayers: number;
  count: number;
  hostNick: string;
  open: boolean;
};

type Props = {
  activeRooms: ActiveRoom[];
  filterGame: 'all' | 'bunker' | 'whoami';
  filterOpen: 'all' | 'open' | 'closed';
  currentRoom: string | null;
  onFilterGame: (v: 'all' | 'bunker' | 'whoami') => void;
  onFilterOpen: (v: 'all' | 'open' | 'closed') => void;
  onQuickJoin: (room: ActiveRoom) => void;
  roomsLoading: boolean;
};

const RoomsItem: React.FC<{ r: ActiveRoom; disabled: boolean; onClick: () => void }>
  = ({ r, disabled, onClick }) => (
  <motion.div
    initial={false}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ scale: 1.02, y: -2 }}
    className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-white truncate">{r.hostNick || 'Без хоста'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className={`px-2 py-1 rounded-md font-medium ${
            r.game === 'bunker'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {r.game === 'whoami' ? 'Кто я?' : 'Бункер'}
          </span>
          <div className="flex items-center gap-1 text-gray-300">
            <Users className="w-4 h-4" />
            <span className="font-semibold">{r.count}</span>/{r.maxPlayers}
          </div>
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
            r.started
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
          }`}>
            {r.started ? 'идёт' : 'ожидание'}
          </span>
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
            r.open
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {r.open ? 'открыто' : 'закрыто'}
          </span>
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        disabled={disabled}
        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
          !disabled
            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
            : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
        }`}
      >
        Войти
      </motion.button>
    </div>
  </motion.div>
);

const MemoRoomsItem = React.memo(RoomsItem);

const ActiveRoomsSectionComponent: React.FC<Props> = ({
  activeRooms,
  filterGame,
  filterOpen,
  currentRoom,
  onFilterGame,
  onFilterOpen,
  onQuickJoin,
  roomsLoading,
}) => {
  const roomsToShow = useMemo(() => {
    return activeRooms.filter((r) => {
      const byGame = filterGame === 'all' ? true : r.game === filterGame;
      const byOpen = filterOpen === 'all' ? true : filterOpen === 'open' ? !!r.open : !r.open;
      return byGame && byOpen;
    });
  }, [activeRooms, filterGame, filterOpen]);

  const chip = (active: boolean) => `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
    active
      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
  }`;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-5 h-5 text-gray-400" />
        <h2 className="text-2xl font-bold text-white">Активные комнаты</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400 font-medium">Фильтр:</span>
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterGame === 'all')} onClick={() => onFilterGame('all')}>Все игры</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterGame === 'bunker')} onClick={() => onFilterGame('bunker')}>Бункер</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterGame === 'whoami')} onClick={() => onFilterGame('whoami')}>Кто я?</motion.button>
        </div>
        <div className="w-px h-6 bg-white/20" />
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterOpen === 'all')} onClick={() => onFilterOpen('all')}>Все</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterOpen === 'open')} onClick={() => onFilterOpen('open')}>Открытые</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={chip(filterOpen === 'closed')} onClick={() => onFilterOpen('closed')}>Закрытые</motion.button>
        </div>
      </div>

      {roomsLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-gray-400">Загрузка...</div>
        </div>
      ) : roomsToShow.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          Под критерии ничего не нашлось.
        </div>
      ) : (
        <div className="space-y-3">
          {roomsToShow.map((r) => (
            <MemoRoomsItem key={r.code} r={r} disabled={!!currentRoom || r.started} onClick={() => onQuickJoin(r)} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(ActiveRoomsSectionComponent);


