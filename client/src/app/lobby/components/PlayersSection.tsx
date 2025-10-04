'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

export type PresencePlayer = { id: string; nick: string; seat?: number; avatarUrl?: string | null };

const PlayerItem: React.FC<{ p: PresencePlayer; isHost: boolean }>
  = ({ p, isHost }) => (
  <li className="p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 grid grid-cols-[1fr_96px_96px] items-center gap-2">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt={p.nick} className="w-full h-full object-cover" />
        ) : (
          <span>👤</span>
        )}
      </div>
      <div className="truncate font-medium text-white">
        {p.nick}
        {isHost ? ' 👑' : ''}
      </div>
    </div>
    <div className="text-right text-sm text-gray-200">
      {typeof p.seat === 'number' ? p.seat : '—'}
    </div>
    <div className="text-right text-sm text-gray-200">
      {isHost ? 'Хост' : 'Игрок'}
    </div>
  </li>
);

const MemoPlayerItem = React.memo(PlayerItem);

const PlayersSectionComponent: React.FC<{
  players: PresencePlayer[];
  currentRoom: string | null;
  hostId: string | null;
}> = ({ players, currentRoom, hostId }) => {
  if (!currentRoom) return null;
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
    >
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-gray-400" />
        <h2 className="text-2xl font-bold text-white">Игроки в лобби</h2>
      </div>
      <div className="px-3 py-2 text-[12px] uppercase tracking-wider text-gray-400 grid grid-cols-[1fr_96px_96px] gap-2 rounded-lg bg-white/5 border border-white/10">
        <div>Имя</div>
        <div className="text-right">Место</div>
        <div className="text-right">Роль</div>
      </div>
      {players.length === 0 ? (
        <div className="text-sm text-gray-400 p-4">Пока никого…</div>
      ) : (
        <ul className="mt-3 space-y-2">
          {players.map((p) => (
            <MemoPlayerItem key={p.id} p={p} isHost={p.id === hostId} />
          ))}
        </ul>
      )}
    </motion.div>
  );
};

export default React.memo(PlayersSectionComponent);


