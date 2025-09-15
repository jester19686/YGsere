'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { getSocket, getClientId } from '@/lib/socket'; // 👈 добавили getClientId
// База для REST API сервера: env или текущий хост
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '');


type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type UIMode = 'idle' | 'create' | 'join';

/** 👇 добавили seat для стабильного порядка игроков */
type PresencePlayer = { id: string; nick: string; seat?: number };
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
const LS_SHOW_LOGS = 'bunker:showLogs';
const LS_INTRO_SHOWN = 'bunker:introShown';
const LS_AUTORUN_DONE = 'bunker:autoRedirectDone'; // пер-ключ, дальше дополним :roomId




export default function LobbyPage() {
  const router = useRouter();

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [uiMode, setUiMode] = useState<UIMode>('idle');

  // макет: classic | sidebar
  const [layoutMode, setLayoutMode] = useState<'classic' | 'sidebar'>('sidebar');

  // ник
  const [nick, setNick] = useState('');
  const [isNickSet, setIsNickSet] = useState(false);

  // 👇 ДОБАВЛЕНО: флаг завершения проверки localStorage (чтобы не редиректить раньше времени)
  const [nickChecked, setNickChecked] = useState(false);

  // лобби
  const [log, setLog] = useState<string[]>([]);
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

  // const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'; // больше не нужен
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  // 👇 состояние «Активных комнат»
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(true);

  // логи выключены по умолчанию
  const [showLogs, setShowLogs] = useState<boolean>(false);
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
      s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId() });
      s.emit('room:getState', { roomId: savedRoom });
    }
  } catch {}
}, [isNickSet, nick]);


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
    // 👇 отмечаем, что проверка localStorage завершена
    setNickChecked(true);
  }, []);

  // 👇 РЕДИРЕКТ НА /auth, если ник не задан (отдельная страница авторизации)
  useEffect(() => {
    // ждём пока дочитаем localStorage
    if (!nickChecked) return;

    // не редиректим, если уже на /auth (чтобы не зациклить)
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (!isNickSet && !path.startsWith('/auth')) {
      const next = path || '/';
      router.replace(`/auth?next=${encodeURIComponent(next)}`);
    }
  }, [isNickSet, router, nickChecked]);

  // загрузим сохранённое состояние тумблера логов
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_SHOW_LOGS);
      if (v != null) setShowLogs(v === '1');
    } catch {}
  }, []);

  // 👇 первичная загрузка списка комнат по REST (на случай, если сокет подключится позже)
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setRoomsLoading(true);
        const res = await fetch(`${API_BASE}/rooms`);
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
  }, [apiUrl]);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;





    

    const onConnect = () => {
      setStatus('connected');
      setLog((l) => [`✅ connected: ${s.id}`, ...l].slice(0, 200)); // log cap

      // запросим текущее состояние комнат
      s.emit('rooms:get');
      s.off('game:state', onGameState);


      try {
        const savedRoom = window.localStorage.getItem(LS_ROOM);
        if (savedRoom && isNickSet) {
          s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId() });
          s.emit('room:getState', { roomId: savedRoom });
        }
      } catch {}
    };

    const onDisconnect = () => {
      setStatus('disconnected');
      setLog((l) => ['❌ disconnected', ...l].slice(0, 200)); // log cap
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
      setLog((l) => [`👥 presence: ${JSON.stringify(payload)}`, ...l].slice(0, 200)); // log cap
    };

    const onRoomState = (payload: RoomStatePayload) => {
      setPlayers(sortBySeat(payload.players));
      setCurrentRoom(payload.roomId);
      setHostId(payload.hostId);
      setStarted(payload.started);
      setRoomGame(payload.game ?? 'bunker');
      setLog((l) => [
        `📢 state: ${JSON.stringify({
          hostId: payload.hostId,
          started: payload.started,
          game: payload.game,
        })}`,
        ...l,
      ].slice(0, 200)); // log cap
      try {
        window.localStorage.setItem(LS_ROOM, payload.roomId);
      } catch {}
    };

    const onRoomError = (e: { reason: string; roomId: string; min?: number }) => {
      const msg =
        e.reason === 'not_found'
          ? `Лобби ${e.roomId} не найдено`
          : e.reason === 'full'
          ? `Лобби ${e.roomId} заполнено`
          : e.reason === 'game_started'
          ? `В лобби ${e.roomId} уже началась игра`
          : e.reason === 'not_host'
          ? `Старт может нажать только хост`
          : e.reason === 'not_enough_players'
          ? `Мало игроков (минимум ${e.min ?? 2})`
          : `Ошибка для лобби ${e.roomId}`;
      setLog((l) => [`⚠️ ${msg}`, ...l].slice(0, 200)); // log cap
      showNotice(msg, e.reason === 'not_found' ? 'Проверьте код и попробуйте ещё раз' : undefined, 'error');
      if (e.reason === 'not_found') {
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
          s.emit('joinRoom', { roomId: savedRoom, nick, clientId: getClientId() });
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
  }, [isNickSet, nick]);

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




  const resetNick = () => {
    setIsNickSet(false);
    setNick('');
    try {
      window.localStorage.removeItem(LS_NICK);
    } catch {}
    // 👇 отправляем на отдельную страницу авторизации
    const next = typeof window !== 'undefined' ? window.location.pathname : '/';
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
  };

  // действия с лобби
  const join = () => {
    if (!isNickSet) { showNotice('Сначала подтвердите ник', undefined, 'error'); return; }
   if (!room)      { showNotice('Введите код лобби', undefined, 'error');       return; }
    socketRef.current?.emit('joinRoom', { roomId: room, nick, clientId: getClientId() });
    try {
      window.localStorage.setItem(LS_ROOM, room);
    } catch {}
    setUiMode('idle');
  };

  // 👇 вместо мгновенного входа: открываем форму «Войти по коду» без автоподстановки,
  // но если лобби открыто — входим сразу.
  const quickJoin = (r: ActiveRoom) => {
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
  };

  const leave = () => {
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
  };

  const createLobby = async () => {
    if (!isNickSet) { showNotice('Сначала подтвердите ник', undefined, 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPlayers, game: gameType, open: openLobby }), // 👈 ПЕРЕДАЁМ open
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { code: string; maxPlayers: number } = await res.json();
      setRoom(data.code);
      setCurrentRoom(data.code);
      setLog((l) => [
        `🆕 создано лобби: ${data.code} (max ${data.maxPlayers})`,
        ...l,
      ].slice(0, 200)); // log cap
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
      showNotice('Не удалось создать лобби', message, 'error');
    }
  };

  const isHost = hostId === getClientId();

  const startGame = () => {
    if (!currentRoom) return;
    if (!isHost) return;
    if (players.length < 2) { showNotice('Нужно минимум 2 игрока', undefined, 'error'); return; }
    socketRef.current?.emit('room:start', { roomId: currentRoom });
    // дальше автопереход сработает, когда started станет true
  };

  const goToGame = () => {
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
};


  // тумблер логов
  const toggleLogs = () => {
    setShowLogs((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_SHOW_LOGS, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // ——— UI ———

  const TopBar = () => (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-bold">Лобби</h1>
      <div className="flex items-center gap-3 text-sm">
        <span>
          WS статус: <b>{status}</b>
        </span>
        <span>
          · Ник: <b>{nick}</b>
        </span>
        <button
          onClick={resetNick}
          className="text-xs underline text-gray-400 hover:text-gray-200"
        >
          сменить
        </button>

        {/* тумблер логов */}
        <span className="ml-4 opacity-60">Логи:</span>
        <button
          onClick={toggleLogs}
          className={`px-2 py-1 rounded border text-xs ${
            showLogs
              ? 'bg-emerald-600/20 border-emerald-600 text-emerald-200'
              : 'bg-gray-800 border-white/10 text-gray-300'
          }`}
          title="Показать/скрыть логи"
        >
          {showLogs ? 'вкл' : 'выкл'}
        </button>

        {/* переключатель макета */}
        <span className="ml-4 opacity-60">Макет:</span>
        <button
          onClick={() => setLayoutMode(layoutMode === 'sidebar' ? 'classic' : 'sidebar')}
          className="px-2 py-1 rounded bg-gray-800 border border-white/10 text-xs"
        >
          {layoutMode === 'sidebar' ? 'Старая' : 'Новая'}
        </button>
      </div>
    </div>
  );

  /** ===== Общий блок «Активные комнаты» с фильтрами ===== */
  const ActiveRoomsSection = () => {
    const roomsToShow = activeRooms.filter((r) => {
      const byGame = filterGame === 'all' ? true : r.game === filterGame;
      const byOpen =
        filterOpen === 'all'
          ? true
          : filterOpen === 'open'
          ? !!r.open
          : !r.open;
      return byGame && byOpen;
    });

    const chip = (active: boolean) =>
      `px-3 py-1 rounded border text-xs ${
        active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 border-white/10 text-gray-300 hover:bg-gray-700'
      }`;

    return (
      <>
        <h2 className="font-semibold mt-6 mb-2">Активные комнаты</h2>

        {/* Фильтры */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wider text-gray-400 mr-1">
            Фильтр:
          </span>
          <button className={chip(filterGame === 'all')} onClick={() => setFilterGame('all')}>Все игры</button>
          <button className={chip(filterGame === 'bunker')} onClick={() => setFilterGame('bunker')}>Бункер</button>
          <button className={chip(filterGame === 'whoami')} onClick={() => setFilterGame('whoami')}>Кто я?</button>
          <span className="opacity-40 mx-1">|</span>
          <button className={chip(filterOpen === 'all')} onClick={() => setFilterOpen('all')}>Все</button>
          <button className={chip(filterOpen === 'open')} onClick={() => setFilterOpen('open')}>Открытые</button>
          <button className={chip(filterOpen === 'closed')} onClick={() => setFilterOpen('closed')}>Закрытые</button>
        </div>

        <div className="border rounded p-2 glass">
          {roomsLoading ? (
            <div className="text-sm text-gray-500 p-2">Загрузка...</div>
          ) : roomsToShow.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">Под критерии ничего не нашлось.</div>
          ) : (
            <ul className="space-y-2">
              {roomsToShow.map((r) => (
                <li
                  key={r.code}
                  className="border rounded p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.hostNick || 'Без хоста'}</div>

                    {/* улучшенная строка описания */}
                    <div className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          r.game === 'bunker'
                            ? 'text-emerald-400 font-semibold'
                            : 'text-gray-200'
                        }
                      >
                        {r.game === 'whoami' ? 'Кто я?' : 'Бункер'}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>
                        <b>{r.count}</b>/{r.maxPlayers}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>{r.started ? 'идёт' : 'ожидание'}</span>
                      <span className="opacity-40">•</span>
                      <span
                        className={
                          r.open
                            ? 'text-emerald-400 font-medium'
                            : 'text-rose-400 font-medium'
                        }
                      >
                        {r.open ? 'открыто' : 'закрыто'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => quickJoin(r)}
                    disabled={!!currentRoom || r.started}
                    className={`px-3 py-2 rounded ${
                      !currentRoom && !r.started
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                    title={
                      !currentRoom && !r.started
                        ? (r.open ? 'Войти сразу' : 'Перейти к вводу кода')
                        : currentRoom
                        ? 'Вы уже в лобби'
                        : 'Игра уже началась'
                    }
                  >
                    Войти
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  };

  const ClassicLayout = () => (
    <div className={`grid gap-6 ${currentRoom ? 'md:grid-cols-2' : ''}`}>
      <div>
        <h2 className="font-semibold mb-2">Лобби</h2>

        {currentRoom ? (
          <div className="border rounded p-3 mb-4 glass">
            <div className="text-sm text-gray-400 mb-1">Код лобби</div>
            <div className="text-2xl font-bold tracking-widest">{currentRoom}</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  if (currentRoom) await navigator.clipboard.writeText(currentRoom);
                }}
                className="btn-secondary"
              >
                Скопировать
              </button>
              {started ? (
                <button onClick={goToGame} className="btn-primary">
                  Открыть экран игры
                </button>
              ) : isHost && players.length >= 2 ? (
                <button onClick={startGame} className="btn-primary">
                  Начать игру
                </button>
              ) : null}
              {currentRoom && (
                <button
                  onClick={leave}
                  className="btn-secondary bg-red-600 hover:brightness-110"
                >
                  Выйти
                </button>
              )}
            </div>
          </div>
        ) : uiMode === 'create' ? (
          <div className="border rounded p-3 mb-4 glass">
            <div className="text-sm text-gray-400 mb-2">Параметры лобби</div>

            <label className="text-sm">Игра</label>
            <div className="mt-1 mb-3">
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as 'bunker' | 'whoami')}
                className="border p-2 rounded w-60 bg-transparent"
              >
                <option value="bunker">Бункер</option>
                <option value="whoami">Кто я?</option>
              </select>
            </div>

            {/* 👇 КНОПКА ВКЛ/ВЫКЛ «Тип лобби» */}
            <div className="mt-1 mb-3 flex items-center gap-3">
              <label className="text-sm">Тип лобби:</label>
              <button
                type="button"
                onClick={() => setOpenLobby((v) => !v)}
                className={`px-3 py-1 rounded text-sm font-medium border ${
                  openLobby
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                    : 'bg-rose-600/20 border-rose-500 text-rose-200'
                }`}
                title="Переключить открытость лобби"
              >
                {openLobby ? 'Открытое' : 'Закрытое'}
              </button>
            </div>

            <label className="text-sm">Количество игроков</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={2}
                max={16}
                className="border p-2 rounded w-28 bg-transparent"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
              <button onClick={createLobby} className="btn-primary">
                Создать лобби
              </button>
              <button onClick={() => setUiMode('idle')} className="btn-secondary">
                Назад
              </button>
            </div>
          </div>
        ) : uiMode === 'join' ? (
          <div className="border rounded p-3 mb-4 glass">
            <div className="text-sm text-gray-400 mb-2">Войти по коду</div>
            <input
              ref={joinInputRef}
              className="border p-2 rounded w-full mb-2 bg-transparent"
              placeholder="Код лобби"
              value={room}
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
            />
            <div className="flex gap-2">
              <button onClick={join} className="btn-primary">
                Войти
              </button>
              <button onClick={() => setUiMode('idle')} className="btn-secondary">
                Назад
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            <button onClick={() => setUiMode('create')} className="btn-primary py-3">
              Создать лобби
            </button>
            <button onClick={() => setUiMode('join')} className="btn-secondary py-3">
              Войти в лобби
            </button>
          </div>
        )}

        {/* обновлённый блок активных комнат */}
        <ActiveRoomsSection />

        {/* лог только если включён */}
        {showLogs && (
          <>
            <h2 className="font-semibold mt-6 mb-2">Лог</h2>
            <ul className="space-y-1 max-h-64 overflow-auto border rounded p-2 glass">
              {log.map((line, i) => (
                <li key={i} className="text-xs font-mono">
                  {line}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {currentRoom && (
        <div>
          <h2 className="font-semibold mb-2">Игроки в лобби</h2>

          {/* Заголовок колонок */}
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-gray-400 grid grid-cols-[1fr_96px_96px] gap-2">
            <div>Имя</div>
            <div className="text-right">Место</div>
            <div className="text-right">Роль</div>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-gray-500">Пока никого…</p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => {
                const isHostP = p.id === hostId;
                return (
                  <li
                    key={p.id}
                    className="border rounded p-2 glass grid grid-cols-[1fr_96px_96px] items-center gap-2"
                  >
                    {/* Имя */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center">
                        👤
                      </div>
                      <div className="truncate font-medium">
                        {p.nick}
                        {isHostP ? ' 👑' : ''}
                      </div>
                    </div>
                    {/* Место */}
                    <div className="text-right text-sm text-gray-200">
                      {typeof p.seat === 'number' ? p.seat : '—'}
                    </div>
                    {/* Роль */}
                    <div className="text-right text-sm text-gray-200">
                      {isHostP ? 'Хост' : 'Игрок'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const SidebarLayout = () => (
    <div className="grid grid-cols-[300px,1fr] gap-6">
      {/* Sidebar */}
      <aside className="border rounded p-4 glass h-fit sticky top-6">
        {/* Профиль */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-gray-300">
            👤
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{nick}</div>
            <div className="text-xs text-gray-500">WS: {status}</div>
          </div>
        </div>

        {/* Большая карточка кода — только когда в лобби */}
        {currentRoom && (
          <div className="border rounded p-4 mb-4 glass">
            <div className="text-xs text-gray-400">Код лобби</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-3xl font-bold tracking-[0.35em]">{currentRoom}</div>
              <button
                onClick={async () => {
                  if (currentRoom) await navigator.clipboard.writeText(currentRoom);
                }}
                className="btn-secondary"
                title="Скопировать код"
              >
                Скопировать
              </button>
            </div>
          </div>
        )}

        {/* Игроки — только если в комнате */}
        {currentRoom && (
          <>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
              Игроки
            </div>
            <div className="rounded border border-white/10 mb-6">
              {/* Заголовок колонок */}
              <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-gray-400 grid grid-cols-[1fr_64px_72px] gap-2">
                <div>Имя</div>
                <div className="text-right">Место</div>
                <div className="text-right">Роль</div>
              </div>
              {players.length === 0 ? (
                <div className="text-sm text-gray-500 p-3">Пока никого…</div>
              ) : (
                <ul className="max-h-[260px] overflow-auto divide-y divide-white/5">
                  {players.map((p) => {
                    const isHostP = p.id === hostId;
                    return (
                      <li
                        key={p.id}
                        className="p-3 grid grid-cols-[1fr_64px_72px] items-center gap-2"
                      >
                        {/* Имя */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center">
                            👤
                          </div>
                          <div className="truncate font-medium text-sm">
                            {p.nick}
                            {isHostP ? ' 👑' : ''}
                          </div>
                        </div>
                        {/* Место */}
                        <div className="text-right text-xs text-gray-200">
                          {typeof p.seat === 'number' ? p.seat : '—'}
                        </div>
                        {/* Роль */}
                        <div className="text-right text-xs text-gray-200">
                          {isHostP ? 'Хост' : 'Игрок'}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Действия / Формы */}
        {!currentRoom ? (
          uiMode === 'idle' ? (
            <>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Действия
              </div>
              <div className="space-y-2 mb-6">
                <button onClick={() => setUiMode('create')} className="btn-primary w-full py-3">
                  Создать лобби
                </button>
                <button onClick={() => setUiMode('join')} className="btn-secondary w-full py-3">
                  Войти в лобби
                </button>
              </div>
            </>
          ) : uiMode === 'create' ? (
            <>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Параметры лобби
              </div>
              <div className="rounded border border-white/10 p-3 mb-6">
                <label className="text-xs">Игра</label>
                <select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value as 'bunker' | 'whoami')}
                  className="mt-1 mb-3 w-full border rounded p-2 bg-transparent"
                >
                  <option value="bunker">Бункер</option>
                  <option value="whoami">Кто я?</option>
                </select>

                {/* 👇 КНОПКА ВКЛ/ВЫКЛ «Тип лобби» */}
                <div className="mt-1 mb-3 flex items-center gap-2">
                  <label className="text-xs">Тип лобби:</label>
                  <button
                    type="button"
                    onClick={() => setOpenLobby((v) => !v)}
                    className={`px-3 py-1 rounded text-xs font-medium border ${
                      openLobby
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-rose-600/20 border-rose-500 text-rose-200'
                    }`}
                    title="Переключить открытость лобби"
                  >
                    {openLobby ? 'Открытое' : 'Закрытое'}
                  </button>
                </div>

                <label className="text-xs">Количество игроков</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={2}
                    max={16}
                    className="border p-2 rounded w-24 bg-transparent"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={createLobby} className="btn-primary">Создать</button>
                  <button onClick={() => setUiMode('idle')} className="btn-secondary">Отмена</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Войти по коду
              </div>
              <div className="rounded border border-white/10 p-3 mb-6">
                <input
                  ref={joinInputRef}
                  className="border p-2 rounded w-full mb-2 bg-transparent"
                  placeholder="Код лобби"
                  value={room}
                  onChange={(e) => setRoom(e.target.value.toUpperCase())}
                />
                <div className="flex gap-2">
                  <button onClick={join} className="btn-primary">Войти</button>
                  <button onClick={() => setUiMode('idle')} className="btn-secondary">Отмена</button>
                </div>
              </div>
            </>
          )
        ) : (
          <div className="rounded border border-white/10 p-3 mb-6">
            <div className="flex flex-col gap-2">
              {!started && isHost && players.length >= 2 && (
                <button onClick={startGame} className="btn-primary">Начать игру</button>
              )}
              {started && (
                <button onClick={goToGame} className="btn-primary">Открыть экран игры</button>
              )}
              <button onClick={leave} className="btn-secondary bg-red-600 hover:brightness-110">
                Выйти из лобби
              </button>
            </div>
          </div>
        )}

        {/* Активные комнаты (обновлённые с фильтрами) */}
        <ActiveRoomsSection />
      </aside>

      {/* Content: лог — только если включен тумблер */}
      <section className="space-y-6">
        {showLogs && (
          <div className="border rounded p-5 glass">
            <div className="mb-3 font-semibold">Лог</div>
            <ul className="space-y-1 max-h-96 overflow-auto text-xs">
              {log.map((line, i) => (
                <li key={i} className="font-mono">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );

  // основной экран лобби
  return (
    <main className="min-h-[100dvh] relative flex flex-col bg-gradient-to-b from-[#0d0d1a] via-[#111133] to-black bg-radial-glow bg-vignette overflow-x-hidden">
      {/* полупрозрачные волны поверх */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/bg_waves.png')] bg-cover bg-center opacity-40"
      />

      {/* весь контент поверх фона */}
      <div className="relative z-10">
        {/* Шапка фиксированной ширины */}
        <div className="px-6 w-full max-w-6xl mx-auto">
          <TopBar />
        </div>

        {/* Центрируем контент и сдвигаем чуть вверх */}
        <div className="flex items-start pt-[12vh]">
          <div className="w-full max-w-6xl mx-auto px-6 overflow-x-hidden">
            <div className="absolute -z-10 -top-12 -left-20 w-72 h-72 rounded-full blur-3xl opacity-30 bg-indigo-700/40" />
            <div className="absolute -z-10 -bottom-16 -right-24 w-80 h-80 rounded-full blur-3xl opacity-25 bg-emerald-600/40" />
            {layoutMode === 'sidebar' ? <SidebarLayout /> : <ClassicLayout />}
          </div>
        </div>
      </div>

      {/* ▾ Уведомление снизу по центру (как виджет конца игры) */}
      {notice && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 sm:px-8 py-5 sm:py-6 rounded-xl border shadow-xl cursor-pointer"
          style={{
            // двойной фон: первый — цвет темы (если он с альфой), второй — сплошной, чтобы убрать прозрачность
            background: 'var(--c-card), #0f172a',
            borderColor: 'var(--c-border)'
          }}
          role="status"
          aria-live="polite"
          onClick={() => setNotice(null)}
        >
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-extrabold mb-1">
              {notice.top}
            </div>
            {notice.bottom && (
              <div className="text-sm sm:text-base opacity-90 select-none">
                {notice.bottom}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
