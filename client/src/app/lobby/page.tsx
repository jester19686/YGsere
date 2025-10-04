'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
const TopBar = dynamic(() => import('./components/TopBar'), { ssr: false });
const PlayerInfoBar = dynamic(() => import('./components/PlayerInfoBar'), { ssr: false });
const ActiveRoomsSection = dynamic(() => import('./components/ActiveRoomsSection'), { ssr: false });
const PlayersSection = dynamic(() => import('./components/PlayersSection'), { ssr: false });
const FormModal = dynamic(() => import('./components/FormModal'), { ssr: false });
import AuthModal from '@/components/AuthModal';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { getSocket, getClientId } from '@/lib/socket'; // 👈 добавили getClientId
// База для REST API: env или локальный fallback на порт 4000
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : 'http://localhost:4000');
// убираем хвостовые слэши, чтобы не было //rooms
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');
// корректно склеиваем
const api = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type UIMode = 'idle' | 'create' | 'join';

/** 👇 добавили seat для стабильного порядка игроков */
type PresencePlayer = { id: string; nick: string; seat?: number; avatarUrl?: string | null };
type PresencePayload = { roomId: string; players: PresencePlayer[]; maxPlayers?: number };
type RoomStatePayload = {
  roomId: string;
  hostId: string | null;
  started: boolean;
  maxPlayers: number;
  game?: 'bunker';
  players: PresencePlayer[];
};

/** 👇 тип для «Активных комнат» (ДОБАВЛЕНО: open) */
type ActiveRoom = {
  code: string;
  game: 'bunker' | 'whoami';
  started: boolean;
  maxPlayers: number;
  count: number;
  hostNick: string;
  open: boolean; // 👈 добавлено
};

const LS_NICK = 'bunker:nick';
const LS_ROOM = 'bunker:lastRoom';
const LS_STAY_LOBBY = 'bunker:stayInLobby';
const LS_INTRO_SHOWN = 'bunker:introShown';
const LS_AUTORUN_DONE = 'bunker:autoRedirectDone'; // пер-ключ, дальше дополним :roomId




export default function LobbyPage() {
  const router = useRouter();

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [uiMode, setUiMode] = useState<UIMode>('idle');

  

  // ник и аватар
  const [nick, setNick] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isNickSet, setIsNickSet] = useState(false);

  // 👇 ДОБАВЛЕНО: флаг завершения проверки localStorage (чтобы не редиректить раньше времени)
  const [nickChecked, setNickChecked] = useState(false);
  const [room, setRoom] = useState('');
  const [players, setPlayers] = useState<PresencePlayer[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [hostId, setHostId] = useState<string | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [roomGame, setRoomGame] = useState<'bunker' | 'whoami'>('bunker');

  // выбор игры при создании
  const [gameType, setGameType] = useState<'bunker' | 'whoami'>('bunker');
  // 👇 ДОБАВЛЕНО: флаг «открытое/закрытое» лобби
  const [openLobby, setOpenLobby] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const redirectOnceRef = useRef(false);
  const stayInLobbyRef = useRef(false);

  // const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000'; // не используется

  // 👇 состояние «Активных комнат»
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(true);

  
  // ▼ Уведомление-виджет (внизу по центру)
  const [notice, setNotice] = useState<{ top: string; bottom?: string; kind?: 'info'|'error'|'success' } | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);
  const showNotice = (top: string, bottom?: string, kind: 'info'|'error'|'success' = 'info') => {
    try { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); } catch {}
    setNotice({ top, bottom, kind });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4500);
  };
  useEffect(() => () => { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); }, []);

  // 👇 ref для автофокуса на поле «Код лобби»
  const joinInputRef = useRef<HTMLInputElement>(null);

  // 👇 ФИЛЬТРЫ ДЛЯ «Активных комнат»
  const [filterGame, setFilterGame] = useState<'all' | 'bunker' | 'whoami'>('all');
  const [filterOpen, setFilterOpen] = useState<'all' | 'open' | 'closed'>('all');

  const sortBySeat = (arr: PresencePlayer[]) =>
    [...arr].sort(
      (a, b) =>
        (a.seat ?? Number.POSITIVE_INFINITY) - (b.seat ?? Number.POSITIVE_INFINITY),


    );



    // 🔁 Как только ник подтверждён, а сокет уже подключен — автоматически ре-джоинимся в сохранённую комнату
useEffect(() => {
  if (!isNickSet) return;
  const s = socketRef.current;
  if (!s || !s.connected) return;
  try {
    const savedRoom = localStorage.getItem(LS_ROOM);
    if (savedRoom) {
      s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId(), avatarUrl });
      s.emit('room:getState', { roomId: savedRoom });
    }
  } catch {}
}, [isNickSet, nick, avatarUrl]);


  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const flag = window.localStorage.getItem(LS_STAY_LOBBY);
        if (flag) {
          stayInLobbyRef.current = true;
          window.localStorage.removeItem(LS_STAY_LOBBY);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LS_NICK) : null;
    if (saved && saved.trim()) {
      setNick(saved);
      setIsNickSet(true);
    }
    try {
      const av = typeof window !== 'undefined' ? window.localStorage.getItem('bunker:avatar') : null;
      if (av) setAvatarUrl(av);
    } catch {}
    // авто-подхват auth из query
    try {
      const url = new URL(window.location.href);
      const auth = url.searchParams.get('auth');
      if (auth) {
        // поллинг подтверждения, чтобы не ждать ручного обновления
        const RAW_API_BASE =
          process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
        const API_BASE = RAW_API_BASE.replace(/\/+$/, '');
        (async () => {
          try {
            const s = await fetch(`${API_BASE}/api/auth/tg/otp/status?code=${encodeURIComponent('AUTH_' + auth)}`);
            const js = await s.json();
            if (js?.status === 'confirmed' && js?.profile) {
              const name = js.profile.name || '';
              const avatar = js.profile.avatarUrl || null;
              if (name) {
                setNick(name);
                setIsNickSet(true);
                try { localStorage.setItem(LS_NICK, name); } catch {}
              }
              if (avatar) {
                setAvatarUrl(avatar);
                try { localStorage.setItem('bunker:avatar', avatar); } catch {}
              }
              url.searchParams.delete('auth');
              window.history.replaceState({}, '', url.toString());
            }
          } catch {}
        })();
      }
    } catch {}
    setNickChecked(true);
  }, []);

  // Больше не редиректим на /auth — показываем модалку авторизации

  

  // 👇 первичная загрузка списка комнат по REST (на случай, если сокет подключится позже)
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setRoomsLoading(true);
        const res = await fetch(api('/rooms'));
        const data = await res.json().catch(() => ({ rooms: [] }));
        if (!canceled) {
          setActiveRooms(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch {
        // ignore
      } finally {
        if (!canceled) setRoomsLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;





    

    const onConnect = () => {
      setStatus('connected');

      // запросим текущее состояние комнат
      s.emit('rooms:get');
      s.off('game:state', onGameState);


      try {
        const savedRoom = window.localStorage.getItem(LS_ROOM);
        if (savedRoom && isNickSet) {
          s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId(), avatarUrl });
          s.emit('room:getState', { roomId: savedRoom });
        }
      } catch {}
    };

    const onDisconnect = () => {
      setStatus('disconnected');
      setPlayers([]);
      setCurrentRoom(null);
      setStarted(false);
      setHostId(null);
      setUiMode('idle');
      setRoom('');
      redirectOnceRef.current = false;
      
    };

    const onPresence = (payload: PresencePayload) => {
      setPlayers(sortBySeat(payload.players));
      setCurrentRoom(payload.roomId);
    };

    const onRoomState = (payload: RoomStatePayload) => {
      setPlayers(sortBySeat(payload.players));
      setCurrentRoom(payload.roomId);
      setHostId(payload.hostId);
      setStarted(payload.started);
      setRoomGame(payload.game ?? 'bunker');
      try {
        window.localStorage.setItem(LS_ROOM, payload.roomId);
      } catch {}
    };

    const onRoomError = (err: { reason: string; roomId: string; min?: number }) => {
      const msg =
        err.reason === 'not_found'
          ? `Лобби ${err.roomId} не найдено`
          : err.reason === 'full'
          ? `Лобби ${err.roomId} заполнено`
          : err.reason === 'game_started'
          ? `В лобби ${err.roomId} уже началась игра`
          : err.reason === 'not_host'
          ? `Старт может нажать только хост`
          : err.reason === 'not_enough_players'
          ? `Мало игроков (минимум ${err.min ?? 2})`
          : `Ошибка для лобби ${err.roomId}`;
      showNotice(msg, err.reason === 'not_found' ? 'Проверьте код и попробуйте ещё раз' : undefined, 'error');
      if (err.reason === 'not_found') {
        try {
          window.localStorage.removeItem(LS_ROOM);
        } catch {}
      }
    };

    // 👇 динамические обновления «Активных комнат»
    const onRoomsUpdate = (p: { rooms: ActiveRoom[] }) => {
      setActiveRooms(Array.isArray(p?.rooms) ? p.rooms : []);
      setRoomsLoading(false);
    };

    const onGameState = (p: { roomId: string }) => {
  // Любой game:state означает, что игра точно стартовала
  setStarted(true);
  setCurrentRoom(p.roomId || null);
};




    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('presence', onPresence);
    s.on('room:state', onRoomState);
    s.on('room:error', onRoomError);
    s.on('rooms:update', onRoomsUpdate);
    s.on('game:state', onGameState);

    setStatus(s.connected ? 'connected' : 'connecting');

    if (s.connected) {
      s.emit('rooms:get');
      try {
        const savedRoom = window.localStorage.getItem(LS_ROOM);
        if (savedRoom && isNickSet) {
          s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId(), avatarUrl });
          s.emit('room:getState', { roomId: savedRoom });
        }
      } catch {}
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('presence', onPresence);
      s.off('room:state', onRoomState);
      s.off('room:error', onRoomError);
      s.off('rooms:update', onRoomsUpdate);
    };
  }, [isNickSet, nick, avatarUrl]);

  // автопереход в экран игры после старта (оставил как было)
    // Если пришли из /game/... с флагом nf=1 — покажем уведомление
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  useEffect(() => {
    const nf = search?.get('nf');
    const code = search?.get('code');
    if (nf === '1') {
      showNotice('Лобби не найдено', code ? `Код: ${code}` : undefined, 'error');
      // очистим query, чтобы при F5 не сыпалось снова
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('nf');
        if (code) url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // однократно при заходе

    useEffect(() => {
  // Если пользователь просил остаться в лобби — не редиректим (пока сам не зайдёт в игру)
  try {
    if (localStorage.getItem(LS_STAY_LOBBY) === '1') return;
  } catch {}

  // Нужны room и started
  if (!started || !currentRoom) return;

  // Если автопереход уже "израсходован" для этой комнаты — больше не редиректим
  const autoKey = `${LS_AUTORUN_DONE}:${currentRoom}`;
  try {
    if (localStorage.getItem(autoKey) === '1') return;
  } catch {}

  // Защита от многократного пуша в рамках одной сессии
  if (redirectOnceRef.current) return;
  redirectOnceRef.current = true;

  // Устанавливаем "израсходовано" ПЕРЕД переходом (чтобы не сработало повторно)
  try { localStorage.setItem(autoKey, '1'); } catch {}

  // Выбираем маршрут: интро (если ещё не было) или игра
  try {
    const introKey = `${LS_INTRO_SHOWN}:${currentRoom}`;
    const seen = localStorage.getItem(introKey) === '1';
    const path =
      roomGame === 'whoami'
        ? `/whoami/${currentRoom}`
        : (seen ? `/game/${currentRoom}` : `/game/${currentRoom}/intro`);
    router.push(path);
  } catch {
    const fallback =
      roomGame === 'whoami' ? `/whoami/${currentRoom}` : `/game/${currentRoom}/intro`;
    router.push(fallback);
  }
}, [started, currentRoom, router, roomGame]);




  const resetNick = useCallback(() => {
    setIsNickSet(false);
    setNick('');
    try {
      window.localStorage.removeItem(LS_NICK);
      window.localStorage.removeItem('bunker:avatar');
    } catch {}
  }, []);

  // действия с лобби
  const join = useCallback(() => {
    if (!isNickSet) { showNotice('Сначала подтвердите ник', undefined, 'error'); return; }
   if (!room)      { showNotice('Введите код лобби', undefined, 'error');       return; }
    socketRef.current?.emit('joinRoom', { roomId: room, nick, clientId: getClientId() });
    try {
      window.localStorage.setItem(LS_ROOM, room);
    } catch {}
    setUiMode('idle');
  }, [isNickSet, room, nick]);

  // 👇 вместо мгновенного входа: открываем форму «Войти по коду» без автоподстановки,
  // но если лобби открыто — входим сразу.
  const quickJoin = useCallback((r: ActiveRoom) => {
    if (currentRoom) return;
    if (!isNickSet) { showNotice('Сначала подтвердите ник', undefined, 'error'); return; }
    if (r.open && !r.started) {
      // мгновенный вход в открытое лобби
      socketRef.current?.emit('joinRoom', { roomId: r.code, nick, clientId: getClientId() });
      try { window.localStorage.setItem(LS_ROOM, r.code); } catch {}
      setCurrentRoom(r.code);
      setRoom(r.code);
      setUiMode('idle');
    } else {
      // закрытое — пусть введут код сами
      setUiMode('join');
      setRoom('');
      setTimeout(() => joinInputRef.current?.focus(), 0);
    }
  }, [currentRoom, isNickSet, nick]);

  const leave = useCallback(() => {
    if (!currentRoom) return;
    socketRef.current?.emit('leaveRoom', { roomId: currentRoom });
    setCurrentRoom(null);
    setPlayers([]);
    setHostId(null);
    setStarted(false);
    setUiMode('idle');
    setRoom('');
    redirectOnceRef.current = false;
    try {
      window.localStorage.removeItem(LS_ROOM);
    } catch {}
  }, [currentRoom]);

  const createLobby = useCallback(async () => {
    if (!isNickSet) { showNotice('Сначала подтвердите ник', undefined, 'error'); return; }
    try {
      const url = api('/rooms');
      console.debug('[createLobby] POST', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPlayers, game: gameType, open: openLobby }), // 👈 ПЕРЕДАЁМ open
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { code: string; maxPlayers: number } = await res.json();
      setRoom(data.code);
      setCurrentRoom(data.code);
      socketRef.current?.emit('joinRoom', {
        roomId: data.code,
        nick,
        clientId: getClientId(),
      });
      try {
        window.localStorage.setItem(LS_ROOM, data.code);
      } catch {}
      setUiMode('idle');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message === 'Failed to fetch') {
        console.error('[createLobby] Network error. API_BASE =', API_BASE);
        console.error('Проверь, что сервер на 4000 запущен и URL доступен напрямую из браузера.');
      }
      showNotice('Не удалось создать лобби', message, 'error');
    }
  }, [isNickSet, maxPlayers, gameType, openLobby, nick]);

  const isHost = hostId === getClientId();

  const startGame = useCallback(() => {
    if (!currentRoom) return;
    if (!isHost) return;
    if (players.length < 2) { showNotice('Нужно минимум 2 игрока', undefined, 'error'); return; }
    socketRef.current?.emit('room:start', { roomId: currentRoom });
    // дальше автопереход сработает, когда started станет true
  }, [currentRoom, isHost, players.length]);

  const goToGame = useCallback(() => {
  if (!currentRoom) return;

  // Помечаем автопереход как израсходованный для этой комнаты
  try { localStorage.setItem(`${LS_AUTORUN_DONE}:${currentRoom}`, '1'); } catch {}

  try {
    const introKey = `${LS_INTRO_SHOWN}:${currentRoom}`;
    const seen = localStorage.getItem(introKey) === '1';
    const path =
      roomGame === 'whoami'
        ? `/whoami/${currentRoom}`
        : (seen ? `/game/${currentRoom}` : `/game/${currentRoom}/intro`);
    router.push(path);
  } catch {
    const fallback =
      roomGame === 'whoami' ? `/whoami/${currentRoom}` : `/game/${currentRoom}/intro`;
    router.push(fallback);
  }
}, [currentRoom, roomGame, router]);

  
  

  // ——— UI ———

  

  

  /** ===== Общий блок «Активные комнаты» с фильтрами — используется версиЯ из components ===== */

  

  

  

  // основной экран лобби
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.3),transparent_50%)] animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,119,198,0.2),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(120,200,255,0.1),transparent_50%)] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-600/15 blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-gradient-to-r from-emerald-500/15 to-teal-600/15 blur-3xl" />

      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
          <TopBar
            status={status}
            nick={nick}
            onBack={() => router.push('/')}
            onResetNick={resetNick}
          />
          <PlayerInfoBar
            avatarUrl={avatarUrl}
            nick={nick}
            status={status}
            currentRoom={currentRoom}
            isHost={hostId === getClientId()}
            started={started}
            playersCount={players.length}
            onStart={startGame}
            onGoToGame={goToGame}
            onLeave={leave}
            onCreateClick={() => setUiMode('create')}
            onJoinClick={() => setUiMode('join')}
          />
          
          {/* Большая карточка кода — только когда в лобби */}
          {currentRoom && (
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">#</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Код лобби</h2>
              </div>
              
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="flex-1">
                  <div className="text-4xl font-bold tracking-[0.35em] text-white mb-2">{currentRoom}</div>
                  <div className="text-sm text-gray-400">Поделитесь этим кодом с друзьями</div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    if (currentRoom) await navigator.clipboard.writeText(currentRoom);
                  }}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300"
                  title="Скопировать код"
                >
                  Скопировать
                </motion.button>
              </div>
            </motion.div>
          )}
          
          <AuthModal
            open={nickChecked && !isNickSet}
            nick={nick}
            onChangeNick={(v) => setNick(v)}
            onConfirm={(nickOverride) => {
              const v = (nickOverride || nick).trim();
              if (!v) return;
              setNick(v);
              try { window.localStorage.setItem(LS_NICK, v); } catch {}
              setIsNickSet(true);
            }}
            onClose={() => {
              // при закрытии без ввода ника оставляем лобби доступным, но кнопки входа/создания предупредят
            }}
          />
          <PlayersSection players={players} currentRoom={currentRoom} hostId={hostId} />
          <ActiveRoomsSection
            activeRooms={activeRooms}
            filterGame={filterGame}
            filterOpen={filterOpen}
            currentRoom={currentRoom}
            onFilterGame={setFilterGame}
            onFilterOpen={setFilterOpen}
            onQuickJoin={quickJoin}
            roomsLoading={roomsLoading}
          />
          <FormModal
            uiMode={uiMode}
            gameType={gameType}
            openLobby={openLobby}
            maxPlayers={maxPlayers}
            room={room}
            onClose={() => setUiMode('idle')}
            onCreate={createLobby}
            onJoin={join}
            onGameType={setGameType}
            onToggleOpen={() => setOpenLobby((v) => !v)}
            onMaxPlayers={setMaxPlayers}
            onRoomChange={setRoom}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl cursor-pointer max-w-md"
            onClick={() => setNotice(null)}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">
                {notice.top}
              </div>
              {notice.bottom && (
                <div className="text-gray-300">
                  {notice.bottom}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
