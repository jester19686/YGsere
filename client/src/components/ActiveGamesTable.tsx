'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { User, Shield, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSocket } from '@/lib/socket';

interface ActiveRoom {
  code: string;
  game: 'bunker' | 'whoami';
  started: boolean;
  maxPlayers: number;
  count: number;
  hostNick: string;
  open: boolean;
}

interface ActiveGamesTableProps {
  maxDisplay?: number;
  showPagination?: boolean;
  showFilters?: boolean;
}

const ActiveGamesTable: React.FC<ActiveGamesTableProps> = ({
  maxDisplay = 5,
  showPagination = true,
  showFilters = true,
}) => {
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Фильтры
  const [filterGame, setFilterGame] = useState<'all' | 'bunker' | 'whoami'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed' | 'playing'>('all');

  // API Base URL
  const API_BASE = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : 'http://localhost:4000');
    return raw.replace(/\/+$/, '');
  }, []);

  // Первичная загрузка через REST API
  useEffect(() => {
    let canceled = false;
    
    const loadRooms = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/rooms`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({ rooms: [] }));
        
        if (!canceled) {
          setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    loadRooms();

    return () => {
      canceled = true;
    };
  }, [API_BASE]);

  // Real-time обновления через WebSocket
  useEffect(() => {
    const socket = getSocket();

    const onRoomsUpdate = (payload: { rooms: ActiveRoom[] }) => {
      if (Array.isArray(payload?.rooms)) {
        setRooms(payload.rooms);
        setLoading(false);
      }
    };

    socket.on('rooms:update', onRoomsUpdate);
    
    // Запросить текущее состояние комнат при подключении
    if (socket.connected) {
      socket.emit('rooms:get');
    }

    socket.on('connect', () => {
      socket.emit('rooms:get');
    });

    return () => {
      socket.off('rooms:update', onRoomsUpdate);
    };
  }, []);

  // Фильтрация комнат
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Фильтр по типу игры
      if (filterGame !== 'all' && room.game !== filterGame) {
        return false;
      }

      // Фильтр по статусу
      if (filterStatus === 'open' && (!room.open || room.started)) {
        return false;
      }
      if (filterStatus === 'closed' && (room.open || room.started)) {
        return false;
      }
      if (filterStatus === 'playing' && !room.started) {
        return false;
      }

      return true;
    });
  }, [rooms, filterGame, filterStatus]);

  // Пагинация
  const totalPages = Math.ceil(filteredRooms.length / maxDisplay);
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * maxDisplay;
    const end = start + maxDisplay;
    return filteredRooms.slice(start, end);
  }, [filteredRooms, currentPage, maxDisplay]);

  // Сброс страницы при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [filterGame, filterStatus]);

  // Определение статуса комнаты
  const getRoomStatus = (room: ActiveRoom) => {
    if (room.started) {
      return {
        label: 'Игра идёт',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        icon: Flame,
      };
    }
    if (room.open) {
      return {
        label: 'Открыта',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: Shield,
      };
    }
    return {
      label: 'Закрыта',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
      icon: Shield,
    };
  };

  // Стадия игры
  const getGameStage = (room: ActiveRoom) => {
    if (!room.started) {
      return 'Ожидание игроков';
    }
    // Можно добавить больше стадий, если backend будет отправлять phase
    return 'В процессе';
  };

  return (
    <div className="relative">
      {/* Фильтры */}
      {showFilters && (
        <div className="mb-6 flex flex-wrap gap-4">
          {/* Фильтр по типу игры */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Игра:</span>
            <div className="flex gap-2">
              {['all', 'bunker', 'whoami'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterGame(type as 'all' | 'bunker' | 'whoami')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filterGame === type
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                  }`}
                >
                  {type === 'all' ? 'Все' : type === 'bunker' ? 'Бункер' : 'Кто я?'}
                </button>
              ))}
            </div>
          </div>

          {/* Фильтр по статусу */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Статус:</span>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Все' },
                { value: 'open', label: 'Открытые' },
                { value: 'closed', label: 'Закрытые' },
                { value: 'playing', label: 'В игре' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterStatus(value as 'all' | 'open' | 'closed' | 'playing')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filterStatus === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Таблица */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800/20 to-slate-700/20 rounded-2xl blur-xl" />
        <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-5 gap-4 p-6 border-b border-white/10 bg-slate-950/50">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Создатель
            </div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Статус
            </div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Игроков
            </div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Стадия игры
            </div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center">
              Действие
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="inline-block w-8 h-8 border-4 border-gray-700 border-t-orange-500 rounded-full animate-spin mb-4" />
                <p>Загрузка активных игр...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-12 text-center">
                <Shield className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-4">
                  {filterGame !== 'all' || filterStatus !== 'all'
                    ? 'Нет игр с выбранными фильтрами'
                    : 'Нет активных игр'}
                </p>
                <p className="text-gray-600 text-sm">
                  {filterGame !== 'all' || filterStatus !== 'all'
                    ? 'Попробуйте изменить фильтры'
                    : 'Будь первым, кто создаст игру!'}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {paginatedRooms.map((room, idx) => {
                  const status = getRoomStatus(room);
                  const StatusIcon = status.icon;
                  const isJoinable = !room.started && room.open;
                  
                  // Подсказка для недоступных комнат
                  const getTooltip = () => {
                    if (room.started) return 'Игра уже началась, подключиться невозможно';
                    if (!room.open) return 'Лобби закрыто создателем';
                    return '';
                  };

                  return (
                    <motion.div
                      key={room.code}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`grid grid-cols-5 gap-4 p-6 transition-all duration-200 ${
                        isJoinable 
                          ? 'hover:bg-white/5 opacity-100' 
                          : 'opacity-60 cursor-not-allowed'
                      }`}
                      title={!isJoinable ? getTooltip() : ''}
                    >
                      {/* Создатель */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-300">{room.hostNick}</span>
                          {!isJoinable && (
                            <span className="text-xs text-gray-500">
                              Код: {room.code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Статус */}
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 ${status.bgColor} border ${status.borderColor} rounded-full ${status.color} text-sm font-medium`}
                        >
                          <StatusIcon className="w-4 h-4" />
                          {status.label}
                        </span>
                      </div>

                      {/* Игроков */}
                      <div className="flex items-center">
                        <span className="text-gray-300 font-medium">
                          {room.count}/{room.maxPlayers}
                        </span>
                      </div>

                      {/* Стадия игры */}
                      <div className="flex items-center">
                        <span className="text-gray-400">{getGameStage(room)}</span>
                      </div>

                      {/* Действие */}
                      <div className="flex items-center justify-center">
                        {room.started ? (
                          // Игра уже идёт
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Flame className="w-4 h-4" />
                            <span>Игра началась</span>
                          </div>
                        ) : !room.open ? (
                          // Лобби закрыто
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Shield className="w-4 h-4" />
                            <span>Закрыто</span>
                          </div>
                        ) : (
                          // Можно подключиться
                          <Link
                            href={`/lobby?join=${room.code}`}
                            className="px-6 py-2 bg-gradient-to-r from-orange-500/80 to-red-600/80 hover:from-orange-500 hover:to-red-600 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105"
                          >
                            Подключиться
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Pagination */}
          {showPagination && totalPages > 1 && !loading && filteredRooms.length > 0 && (
            <div className="p-6 bg-slate-950/50 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  Показано {paginatedRooms.length} из {filteredRooms.length} игр
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      currentPage === 1
                        ? 'bg-slate-800/30 text-gray-600 cursor-not-allowed'
                        : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="text-sm text-gray-400 px-4">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      currentPage === totalPages
                        ? 'bg-slate-800/30 text-gray-600 cursor-not-allowed'
                        : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveGamesTable;
