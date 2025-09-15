'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { getSocket, getClientId } from '@/lib/socket';
import Image from 'next/image';

/* 👇 Подключаем файл с темами (CSS-переменные) */
import '@/styles/themes.css';

type Hand = {
  gender: string;
  body: string;
  trait: string;
  profession: string;
  health: string;
  hobby: string;
  phobia: string;
  bigItem: string;
  backpack: string;
  extra: string;
  ability1: string; // 👈 ДОБАВЛЕНО: Спец. возможность 1
  ability2: string; // 👈 ДОБАВЛЕНО: Спец. возможность 2
};

type BunkerInfo = {
  description: string;
  items: string[];
  sizeM2: number;
  stayText: string;
  foodText: string;
  places?: number;
};

type RoundState = {
  number: number;                          // номер раунда
  quota: number;                           // лимит обычных характеристик на игрока
  revealedBy: Record<string, number>;      // { playerId: сколько открыл в этом раунде }
};


type Cataclysm = { title: string; text: string; image: string };

type GameYou = { hand: Hand; hiddenKey: keyof Hand | null; revealedKeys: (keyof Hand)[] };

type PresencePayloadGame = { roomId: string; players: PresencePlayer[] };


/** 👇 добавили kicked?: boolean для возможной поддержки «кикнутых» */
type PublicPlayer = { id: string; nick: string; avatarUrl?: string; revealed: Partial<Hand>; kicked?: boolean };

type GameStatePayload = {
  roomId: string;
  phase: 'reveal';
  players: PublicPlayer[];
  bunker?: BunkerInfo;
  cataclysm?: Cataclysm; // ⬅️ ДОБАВЛЕНО
  currentTurnId?: string;     // 👈 КТО ХОДИТ (истина с сервера)
  turnOrder?: string[];       // 👈 (опционально) порядок ходов
  turnSeconds?: number;       // 👈 СЕКУНДЫ СЕРВЕРНОГО ТАЙМЕРА
  voteSkip?: { votes: number; total: number; needed: number; voters: string[] }; // 👈 новое
    round?: RoundState;  // ← состояние раунда с сервера
  gameOver?: boolean;
  winners?: string[];  
  cleanupAt?: number | null; // ⏳ серверный дедлайн удаления (ms epoch)

  // 👇 ДОБАВИТЬ ЭТИ ПОЛЯ
  lastVoteTotals?: Record<string, number>;
  lastVoteVotersByTarget?: Record<string, string[]>;
  lastVoteTotalVoters?: number;
  lastVoteTotalEligible?: number;
  lastVote?: LastVoteResult | null; // 👈 ДОБАВЛЕНО: сервер уже шлёт это поле


};

type PresencePlayer = { id: string; nick: string };
type RoomStatePayload = {
  roomId: string;
  hostId: string | null;
  started: boolean;
  maxPlayers: number;
  players: PresencePlayer[];
};

type VoteSkipState = { votes: number; total: number; needed: number; voters: string[] };


type VotePhase = 'idle' | 'speeches' | 'ballot';
type VoteStatePayload = {
  roomId: string;
  phase: VotePhase;
  endsAt?: number | null;
  speechOrder?: string[];
  speakingIdx?: number;
  votes?: Record<string, number>;
  votedBy?: string[];
  allowedTargets?: string[]; // 👈 добавлено: список кандидатов для второго тура
};





// --- Типы для итогов голосования и события сокета ---
type VoteTotals = Record<string, number>;
type VoteVotersByTarget = Record<string, string[]>;

type LastVoteResult = {
  totals: VoteTotals;
  votersByTarget?: VoteVotersByTarget;
  totalVoters?: number;
  totalEligible?: number;
  type?: 'kick' | 'skip';
  kickedPlayerId?: string;
  startedAt?: number;
  finishedAt?: number;
};

// Сервер может прислать «плоско» или вложенно (roomId + lastVote)
type VoteResultEventFlat = {
  roomId: string | number;
  totals?: VoteTotals;
  votes?: VoteTotals; // на некоторых серверах поле называется votes
  votersByTarget?: VoteVotersByTarget;
  totalVoters?: number;
  totalEligible?: number;
};
type VoteResultEventNested = { roomId: string | number; lastVote: LastVoteResult };



const LS_NICK = 'bunker:nick';
const LS_ROOM = 'bunker:lastRoom';
const LS_STAY_LOBBY = 'bunker:stayInLobby';
const LS_THEME = 'bunker:theme'; // 👈 ключ темы
const LS_BUNKER_COLLAPSED = 'bunker:bunkerCollapsed'; /* 👈 ДОБАВЛЕНО: запоминание свёрнутости */
const LS_TURN_PREFIX = 'bunker:turn:';               /* 👈 локальный фолбэк хода: bunker:turn:<roomId> */
const LS_ABILITIES_COLLAPSED = 'bunker:abilitiesCollapsed'; // 👈 запоминание свёрнутости «Спец возможностей»
const LS_AUTORUN_DONE = 'bunker:autoRedirectDone';
const LS_VOTE_PREFIX = 'bunker:vote:'; // 👈 кэш состояния голосования на время страницы
const LS_LASTVOTE_COLLAPSED = 'bunker:lastVoteCollapsed';



/* ===== Темы: вынесли в модуль-скоуп и добавили хелпер ===== */
const THEMES = ['amber', 'lobby'] as const; // 👈 rust → lobby
type ThemeName = typeof THEMES[number];
function isThemeName(v: unknown): v is ThemeName {
  return (THEMES as readonly string[]).includes(String(v));
}

const COLS: { key: keyof Hand; title: string; info?: boolean }[] = [
  { key: 'gender',     title: 'Пол' },
  { key: 'body',       title: 'Телосложение' },
  { key: 'trait',      title: 'Человеческая черта' },
  { key: 'profession', title: 'Профессия', info: true },
  { key: 'health',     title: 'Здоровье' },
  { key: 'hobby',      title: 'Хобби/Увлечение' },
  { key: 'phobia',     title: 'Фобия/Страх' },
  { key: 'bigItem',    title: 'Крупный инвентарь' },
  { key: 'backpack',   title: 'Рюкзак' },
  { key: 'extra',      title: 'Доп. сведение' },
];

/* 👇 ДОБАВЛЕНО: колонки таблицы «Спец. возможности» */
const COLS_ABILITIES: { key: keyof Hand; title: string }[] = [
  { key: 'ability1', title: 'Спец. возможность 1' },
  { key: 'ability2', title: 'Спец. возможность 2' },
];

// 👇 Хелпер: является ли ключ спец. возможностью
const isAbilityKey = (k: keyof Hand): boolean => k === 'ability1' || k === 'ability2';


// ── UI: прогресс-полоска «как в результатах голосования» ──
function KickProgress({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="w-full h-3 rounded border"
         style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-muted)' }}>
      <div
        className="h-3 rounded transition-[width] duration-300 ease-out"
        style={{ width: `${p}%`, backgroundColor: 'var(--c-accent)' }}
        aria-hidden
      />
    </div>
  );
}

type KickVoteRowProps = {
  meId: string;
  player: PublicPlayer;
  count: number;
  totalVoters: number;
  hasVoted: boolean;
  onVote: (targetId: string) => void;
};
function KickVoteRow({ meId, player, count, totalVoters, hasVoted, onVote }: KickVoteRowProps) {
  const isSelf = player.id === meId;
  const disabled = hasVoted || isSelf || !!player.kicked;
  const percent = totalVoters > 0 ? (count / totalVoters) * 100 : 0;
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold truncate">{player.nick}{isSelf ? ' (вы)' : ''}</div>
        <button
          disabled={disabled}
          onClick={() => onVote(player.id)}
          className={`h-8 px-3 rounded ${disabled
            ? 'bg-[color:rgba(120,120,120,.28)] text-[color:#9ca3af] cursor-not-allowed border border-[color:rgba(255,255,255,.08)]'
            : 'themed-btn text-[color:var(--btn-text)]'}`}
          title={isSelf ? 'Нельзя голосовать за себя' : (hasVoted ? 'Вы уже проголосовали' : `Голосовать за ${player.nick}`)}
        >
          {hasVoted ? 'Голос учтён' : isSelf ? 'Нельзя' : 'Голосовать'}
        </button>
      </div>
      <KickProgress percent={percent} />
      <div className="mt-1 text-sm opacity-80 select-none">{Math.round(percent)}%</div>
    </li>
  );
}

// --- Голосование за кик: безопасно достаём totalVoters без any ---
type KickBallotLike = { totalVoters?: unknown } & Record<string, unknown>;
const getKickTotalVoters = (v: unknown, fallback: number): number => {
  if (v && typeof v === 'object') {
    const obj = v as KickBallotLike;
    const cand1 = obj.totalVoters;
    const cand2 = obj['totalVers']; // на старых серверах поле могло называться так
    const n = typeof cand1 === 'number' ? cand1 : (typeof cand2 === 'number' ? cand2 : undefined);
    if (typeof n === 'number' && n > 0) return n;
  }
  return fallback;
};


export default function GamePage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();

  const [nick, setNick] = useState<string>('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [started, setStarted] = useState<boolean>(false);

  const [myHand, setMyHand] = useState<Hand | null>(null);
  const [hiddenKey, setHiddenKey] = useState<keyof Hand | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<(keyof Hand)[]>([]);
  const [publicPlayers, setPublicPlayers] = useState<PublicPlayer[]>([]);

  // ⚠️ значение maxPlayers не используем — оставляем только сеттер, чтобы не ругался ESLint
  const [, setMaxPlayers] = useState<number | null>(null);
  const [bunker, setBunker] = useState<BunkerInfo | null>(null);
  const [cataclysm, setCataclysm] = useState<Cataclysm | null>(null); // ⬅️ НОВОЕ

  // 👇 новое состояние: панелька под шестерёнкой
  const [showTopMenu, setShowTopMenu] = useState(false);

  const [lastVote, setLastVote] = useState<LastVoteResult | null>(null);

 




  const socketRef = useRef<Socket | null>(null);

  // чтобы в сокет-хендлерах всегда были актуальные ники
const publicPlayersRef = useRef<PublicPlayer[]>([]);


  // 🔄 Дебаунс для повторного запроса game:state
const syncDebounceRef = useRef<number | null>(null);

const [round, setRound] = useState<RoundState>({ number: 1, quota: 0, revealedBy: {} });

const [gameOver, setGameOver] = useState(false);
const [winners, setWinners] = useState<string[]>([]);




 const [cleanupAt, setCleanupAt] = useState<number | null>(null);
 const [cleanupLeft, setCleanupLeft] = useState<number>(0); // секунды до удаления


 // ⛔ не пускаем на страницу, если код не похож на наш формат
  useEffect(() => {
    const CODE_RE = /^[A-Z0-9]{4,5}$/; // у тебя встречаются 4 и 5 символов (например 9NSF, 3MX44)
    if (!CODE_RE.test(roomId.toUpperCase())) {
      router.replace('/lobby');
    }
  }, [roomId, router]);

// ⏳ Тикаем локальный таймер от серверного дедлайна; по нулю — уводим в лобби
useEffect(() => {
  if (!gameOver || !cleanupAt) {
    setCleanupLeft(0);
    return;
  }
  const tick = () => {
    const ms = cleanupAt - Date.now();
    const sec = Math.max(0, Math.ceil(ms / 1000));
    setCleanupLeft(sec);
    if (sec <= 0) {
      try { socketRef.current?.emit('room:leave', { roomId }); } catch {}
      router.push('/lobby');
    }
  };
  tick();
  const t = window.setInterval(tick, 1000);
  return () => clearInterval(t);
}, [gameOver, cleanupAt, roomId, router]);



// ▼ Сворачивание «Результат последнего голосования»
const [lastVoteCollapsed, setLastVoteCollapsed] = useState(true);
const didAutoExpandLastVoteRef = useRef(false);
useEffect(() => {
  try {
    const v = localStorage.getItem(LS_LASTVOTE_COLLAPSED);
    if (v === '0') setLastVoteCollapsed(false);
  } catch {}
}, []);
const toggleLastVote = () =>
  setLastVoteCollapsed(v => {
    const next = !v;
    // если пользователь сам свернул — больше не авто-раскрываем
    if (next) didAutoExpandLastVoteRef.current = true;
    try { localStorage.setItem(LS_LASTVOTE_COLLAPSED, next ? '1' : '0'); } catch {}
    return next;
  });

// Авто-раскрыть только при первом появлении результатов
useEffect(() => {
  if (!lastVote) {
    // сбрасываем флаг, чтобы следующее появление опять могло авто-раскрыть
    didAutoExpandLastVoteRef.current = false;
    return;
  }
  if (!didAutoExpandLastVoteRef.current && lastVoteCollapsed) {
    didAutoExpandLastVoteRef.current = true;
    setLastVoteCollapsed(false);
  }
}, [lastVote, lastVoteCollapsed]);


// голоса за пропуск хода
const [voteSkip, setVoteSkip] = useState<VoteSkipState>({
  votes: 0,
  total: 0,
  needed: 0,
  voters: []
});


  // Голосование: локальный стейт
  const [vote, setVote] = useState<VoteStatePayload>({
    roomId: String(roomId),
    phase: 'idle',
  });


const requestGameSync = useCallback(() => {
  if (syncDebounceRef.current) return;
  syncDebounceRef.current = window.setTimeout(() => {
    syncDebounceRef.current = null;
    socketRef.current?.emit('game:sync', { roomId });
  }, 80);
}, [roomId]);






// ✅ Уведомление об успешном пропуске (сервер присылает game:skipSuccess)
const onSkipSuccess = useCallback((p: { roomId: string; prevPlayerId?: string; prevNick?: string }) => {
  if (String(p.roomId) !== String(roomId)) return;
  const nick =
    p.prevNick ??
    publicPlayersRef.current.find(pl => pl.id === p.prevPlayerId)?.nick ??
    '';

  setSkipNoticeText(`Ход игрока (${nick || '—'}) пропущен`);
  setShowSkipNotice(true);

  if (hideNoticeRef.current) {
    clearTimeout(hideNoticeRef.current);
    hideNoticeRef.current = null;
  }
  hideNoticeRef.current = window.setTimeout(() => {
    setShowSkipNotice(false);
  }, 1800);

}, [roomId]);










  // const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'; // не используется

  const myClientId = getClientId();

  /* === Тема: циклический переключатель + загрузка/сохранение === */
  const [theme, setTheme] = useState<ThemeName>('amber'); // 👈 дефолт — lobby



  // 🔁 Если ник появился уже после подключения — дожимаем join/sync
useEffect(() => {
  if (!nick) return;
  const s = socketRef.current;
  if (!s || !s.connected) return;
  s.emit('joinRoom', { roomId, nick, clientId: getClientId() });
  s.emit('room:getState', { roomId });
  s.emit('game:sync', { roomId });
}, [nick, roomId]);



// ⛳ Как только зашли в игру — автопереход для этой комнаты больше не нужен
useEffect(() => {
  if (!roomId) return;
  try {
    localStorage.setItem(`${LS_AUTORUN_DONE}:${roomId}`, '1');
    localStorage.removeItem(LS_STAY_LOBBY);
  } catch {}
}, [roomId]);



  // загрузить тему из LS
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LS_THEME);
      if (isThemeName(saved)) setTheme(saved);
    } catch {}
  }, []);

  // ✅ прокидываем тему на body (чтобы фон из themes.css работал глобально)
  useEffect(() => {
    try {
      document.body.classList.add('theme-bg');
      document.body.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  // сохранить тему в LS
  useEffect(() => {
    try { window.localStorage.setItem(LS_THEME, theme); } catch {}
  }, [theme]);

  const nextTheme = () => {
    const idx = (THEMES as readonly string[]).indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  };

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LS_NICK) : null;
    if (!saved) { router.replace('/lobby'); return; }
    setNick(saved);
  }, [router]);

  useEffect(() => {
    try { window.localStorage.setItem(LS_ROOM, String(roomId)); } catch {}
  }, [roomId]);

  /* ===== Жёсткая синхронизация хода ===== */
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);

  // секунды хода с сервера
  const [serverTurnSeconds, setServerTurnSeconds] = useState(0);



  // ⏱️ Тик раз в секунду во время голосования/спичей
const [voteTick, forceVoteTick] = useState(0);
useEffect(() => {
  if (vote.phase === 'idle') return;
  const t = window.setInterval(() => {
    forceVoteTick((x) => x + 1);
  }, 1000);
  return () => clearInterval(t);
}, [vote.phase, vote.endsAt]);



  // 🔁 Восстанавливаем «спичи» после F5, если endsAt ещё в будущем
useEffect(() => {
  try {
    const raw = sessionStorage.getItem(LS_VOTE_PREFIX + roomId);
    if (!raw) return;
    const parsed = JSON.parse(raw) as VoteStatePayload;
    const now = Math.floor(Date.now() / 1000);
    if ((parsed?.phase === 'speeches' || parsed?.phase === 'ballot') && (parsed?.endsAt || 0) > now) {
      setVote(parsed);
    }
  } catch {}
  // запросим актуализацию у сервера (на случай, если что-то изменилось)
  socketRef.current?.emit('vote:getState', { roomId });
}, [roomId]);

  


  // Фолбэк: достаём ход из LS до прихода сокет-состояния
  useEffect(() => {
    if (!roomId) return;
    try {
      const v = localStorage.getItem(LS_TURN_PREFIX + roomId);
      if (v) setCurrentTurnId(v);
    } catch {}
  }, [roomId]);

  

  useEffect(() => {
    if (!nick) return;

    const s = getSocket();
    socketRef.current = s;

    const joinAndSync = () => {
      let joinNick = nick;
  if (!joinNick) {
    try { joinNick = localStorage.getItem(LS_NICK) || ''; } catch {}
  }
  if (!joinNick) return; // нет ника — не джоинимся, подождём эффект [nick]
  s.emit('joinRoom', { roomId, nick: joinNick, clientId: myClientId });
      s.emit('room:getState', { roomId });
      s.emit('game:sync', { roomId });
    };

    const onConnect = () => { joinAndSync(); };
    const onRoomError = (e: { roomId: string; reason?: string; message?: string }) => {
      if (String(e?.roomId) !== String(roomId)) return;
      if (e?.reason === 'not_found') {
        try { s.emit('room:leave', { roomId }); } catch {}
        // передаём код и флаг nf=1, чтобы лобби показало виджет
        router.replace(`/lobby?nf=1&code=${encodeURIComponent(roomId)}`);
      }
    };
    const onRoomClosed = ({ roomId: closedId }: { roomId: string }) => {
      if (String(closedId) !== String(roomId)) return;
      try { s.emit('room:leave', { roomId }); } catch {}
      router.push('/lobby');
    };
    const onPresence = (p?: PresencePayloadGame) => {
      // если пришло без roomId — всё равно синкнем нашу комнату
      if (p?.roomId && String(p.roomId) !== String(roomId)) return;
      requestGameSync();
     };


    const onRoomState = (p: RoomStatePayload) => {
      setHostId(p.hostId);
      setStarted(p.started);
      setMaxPlayers(p.maxPlayers);
        if (String(p.roomId) === String(roomId)) {
      requestGameSync();
       }
      };


      

    const onGameState = (p: GameStatePayload) => {
      setPublicPlayers(p.players);
      if (p.bunker) setBunker(p.bunker);
      if (p.cataclysm) setCataclysm(p.cataclysm); // ⬅️ ДОБАВЛЕНО
      if (p.round) setRound(p.round);
      

      setGameOver(!!p.gameOver);
      setWinners(Array.isArray(p.winners) ? p.winners : []);
      setCleanupAt(typeof p.cleanupAt === 'number' ? p.cleanupAt : null);



      publicPlayersRef.current = p.players;

// 👇 Подхватываем в обоих случаях: «плоские» поля ИЛИ цельный объект lastVote
  if (p.lastVoteTotals && Object.keys(p.lastVoteTotals).length > 0) {
    setLastVote({
      totals: p.lastVoteTotals,
      votersByTarget: p.lastVoteVotersByTarget,
      totalVoters: typeof p.lastVoteTotalVoters === 'number'
        ? p.lastVoteTotalVoters
        : Object.values(p.lastVoteTotals).reduce((a, b) => a + b, 0),
      totalEligible: p.lastVoteTotalEligible,
    });
  } else if (p.lastVote && p.lastVote.totals && Object.keys(p.lastVote.totals).length > 0) {
    setLastVote(p.lastVote);
  }

      

if (typeof p.turnSeconds === 'number') {
  serverTurnSecondsRef.current = p.turnSeconds;
}



      // 👇 подтягиваем «истину» по ходу из общего состояния
      if (p.currentTurnId) {
        setCurrentTurnId(p.currentTurnId);
        try { localStorage.setItem(LS_TURN_PREFIX + roomId, p.currentTurnId); } catch {}
      }
      if (typeof p.turnSeconds === 'number') {
    setServerTurnSeconds(p.turnSeconds);
  }
  if (p.voteSkip) {
   setVoteSkip(p.voteSkip);
 }
    };
    const onGameYou = (p: GameYou) => {
      setMyHand(p.hand);
      setHiddenKey(p.hiddenKey ?? null);
      setRevealedKeys(p.revealedKeys);
    };
    // 👇 отдельное событие смены хода
    const onGameTurn = (p: { roomId: string; currentTurnId: string }) => {
  if (String(p.roomId) !== String(roomId)) return;
  setCurrentTurnId(p.currentTurnId);
  
  try { localStorage.setItem(LS_TURN_PREFIX + roomId, p.currentTurnId); } catch {}
  setServerTurnSeconds(0);
  serverTurnSecondsRef.current = 0;
  setVoteSkip({ votes: 0, total: 0, needed: 0, voters: [] });
};

// где объявляешь остальные хэндлеры сокета
// ⬇️ единый обработчик результата голосования
const onVoteResult = (p: VoteResultEventFlat | VoteResultEventNested) => {
  if (String(p?.roomId) !== String(roomId)) return;
  // Сервер может прислать { roomId, lastVote: {...} } ИЛИ плоско
  const lv: LastVoteResult | VoteResultEventFlat =
    (p as VoteResultEventNested)?.lastVote ?? (p as VoteResultEventFlat);
  const totals: VoteTotals = (lv as LastVoteResult).totals
    ?? (lv as VoteResultEventFlat).votes
    ?? {};
  setLastVote({
    totals,
    votersByTarget: lv.votersByTarget,
    totalVoters: typeof lv.totalVoters === 'number'
      ? lv.totalVoters
      : Object.values(totals as VoteTotals).reduce((a: number, b: number) => a + b, 0),
    totalEligible: lv.totalEligible,
  });

  // очищаем кэш тайминга голосования, чтобы F5 не «залипал»
  try { sessionStorage.removeItem(LS_VOTE_PREFIX + roomId); } catch {}

  // запросим актуализацию игрового состояния (раунд/квота/кикнутые и т.д.)
  requestGameSync();
};


    // голоса за пропуск хода
const onVoteSkipState = (payload: { roomId: string; votes: number; total: number; needed: number; voters: string[] }) => {
  if (String(payload.roomId) !== String(roomId)) return;
  setVoteSkip({ votes: payload.votes, total: payload.total, needed: payload.needed, voters: payload.voters });
};


    // тики серверного таймера
      const onTurnTick = (p: { roomId: string; seconds: number }) => {
      if (String(p.roomId) !== String(roomId)) return;
       setServerTurnSeconds(p.seconds);
       serverTurnSecondsRef.current = p.seconds;

     };

     const onGameRound = (r: RoundState & { roomId: string }) => {
  if (String(r.roomId) !== String(roomId)) return;
  setRound({ number: r.number, quota: r.quota, revealedBy: r.revealedBy });
};

const onVoteState = (p: VoteStatePayload) => {
  setVote(p);
  try { sessionStorage.setItem(LS_VOTE_PREFIX + roomId, JSON.stringify(p)); } catch {}
};



const onGameOver = (p: { roomId: string; winners: string[]; cleanupAt?: number }) => {
  if (String(p.roomId) !== String(roomId)) return;
  setGameOver(true);
  setWinners(Array.isArray(p.winners) ? p.winners : []);

  if (typeof p.cleanupAt === 'number') setCleanupAt(p.cleanupAt);
  
};




    s.on('connect', onConnect);
    s.on('presence', onPresence);
    s.on('room:state', onRoomState);
    s.on('game:state', onGameState);
    s.on('game:you', onGameYou);
    s.on('game:turn', onGameTurn);
    s.on('game:turnTick', onTurnTick);
    s.on('game:voteSkipState', onVoteSkipState);
    s.on('game:skipSuccess', onSkipSuccess);
    s.on('game:round', onGameRound);
    s.on('vote:state', onVoteState);
    s.on('vote:result', onVoteResult);
    s.on('game:over', onGameOver);
    s.on('room:closed', onRoomClosed);
    s.on('room:error', onRoomError);
    

    s.emit('vote:getState', { roomId }); // спросим актуальное состояние
    

    if (s.connected) joinAndSync();

    return () => {
      s.off('connect', onConnect);
      s.off('presence', onPresence);
      s.off('room:state', onRoomState);
      s.off('game:state', onGameState);
      s.off('game:you', onGameYou);
      s.off('game:turn', onGameTurn);
      s.off('game:turnTick', onTurnTick);
      s.off('game:voteSkipState', onVoteSkipState);
      s.off('game:skipSuccess', onSkipSuccess);
      s.off('game:round', onGameRound);
      s.off('vote:state', onVoteState);
      s.off('game:over', onGameOver);
      s.off('vote:result', onVoteResult);
      s.off('room:closed', onRoomClosed);
      s.off('room:error', onRoomError)
      
      if (syncDebounceRef.current) {
  clearTimeout(syncDebounceRef.current);
  syncDebounceRef.current = null;
}
    };
  }, [roomId, nick, myClientId, onSkipSuccess, requestGameSync, router]);

  const revealKey = (key: keyof Hand) =>
    socketRef.current?.emit('game:revealKey', { roomId, key });

  const backToLobby = () => {
  try { window.localStorage.setItem(LS_STAY_LOBBY, '1'); } catch {}
  router.push('/lobby');
};



  const BTN_BASE = 'h-8 w-full max-w-full text-[12px] rounded';
  const BTN_ACTIVE = 'themed-btn text-[color:var(--btn-text)]';
  const BTN_DISABLED = 'bg-[color:rgba(120,120,120,.28)] text-[color:#9ca3af] cursor-not-allowed border border-[color:rgba(255,255,255,.08)]';
  const BTN_OPENED   = 'bg-[color:#16a34a] text-white cursor-default border border-[color:rgba(255,255,255,.12)]';


  // refs для корректного определения «был именно пропуск»
const serverTurnSecondsRef = useRef(0);
const hideNoticeRef = useRef<number | null>(null);


const startVoteSpeeches = () => socketRef.current?.emit('vote:start', { roomId });
const castVote = (targetId: string) => socketRef.current?.emit('vote:cast', { roomId, targetId });


  /* 👇 turns — локальное состояние оставляем (НЕ удаляю) */
  const [turnIdx, setTurnIdx] = useState<number>(0);

  // 👇 ограничение: за свой ход можно открыть только одну обычную характеристику
const [hasOpenedThisTurn, setHasOpenedThisTurn] = useState(false);

// ⏱️ Таймер хода: 0..120 (после — «120+»)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [turnSeconds, setTurnSeconds] = useState(0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timerRef = useRef<number | null>(null);

// панель уведомления о пропуске
const [showSkipNotice, setShowSkipNotice] = useState(false);
const [skipNoticeText, setSkipNoticeText] = useState('');


// 👇 Панель голосования видима при 120+ сек или во время уведомления
const isSkipPanelVisible = (serverTurnSeconds >= 120) || showSkipNotice;

  // мемоизированный список активных игроков (без кикнутых)
  const activePlayers = useMemo(
    () => publicPlayers.filter(p => !('kicked' in p) || !p.kicked),
    [publicPlayers]
  );

  // Текущий игрок теперь из currentTurnId (истина с сервера), с фолбэком на локальный индекс
  const currentPlayerId =
    currentTurnId ??
    (activePlayers.length ? activePlayers[turnIdx]?.id ?? null : null);


    // Нельзя голосовать, если это твой ход
    const isMyTurnNow = myClientId === currentPlayerId;

    // Я кикнут?
  const meKicked = useMemo(() => {
  const me = publicPlayers.find(p => p.id === myClientId);
  return !!me?.kicked;
}, [publicPlayers, myClientId]);


    // при смене текущего игрока обнуляем флаг
     useEffect(() => {
     setHasOpenedThisTurn(false);
     }, [currentPlayerId]);


     // Ник игрока, чей ход сейчас (берём server currentTurnId, иначе локальный фолбэк)
const currentTurnNick = useMemo(() => {
  const id = currentTurnId ?? currentPlayerId ?? null;
  return publicPlayers.find(p => p.id === id)?.nick ?? '';
}, [publicPlayers, currentTurnId, currentPlayerId]);


// 👇 Текущий оратор (во время «Спичи») и таймер до конца речи
const speakingId = useMemo(() => {
  if (vote.phase !== 'speeches') return null;
  const idx = typeof vote.speakingIdx === 'number' ? vote.speakingIdx : -1;
  if (idx < 0) return null;
  const order = vote.speechOrder || [];
  return order[idx] || null;
}, [vote.phase, vote.speakingIdx, vote.speechOrder]);

const speechSecondsLeft = useMemo(() => {
  // привязываем пересчёт к локальному тику, чтобы удовлетворить ESLint
  void voteTick;
  if (vote.phase !== 'speeches' || !vote.endsAt) return 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, vote.endsAt - now); // 0..60
}, [vote.phase, vote.endsAt, voteTick]);

// ⏳ Сколько осталось до конца голосования (ballot)
const ballotSecondsLeft = useMemo(() => {
  void voteTick; // привязываем к локальному тику раз в секунду
  if (vote.phase !== 'ballot' || !vote.endsAt) return 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, vote.endsAt - now); // 0..90
}, [vote.phase, vote.endsAt, voteTick]);





// Сколько я уже открыл в этом раунде
const myRevealedThisRound = round.revealedBy[myClientId] ?? 0;
// Есть ли ещё лимит (quota==0 трактуем как «лимита нет»)
const hasRoundQuota = round.quota === 0 ? true : (myRevealedThisRound < round.quota);
// В 1-м раунде сначала «Профессия» (но не требуем, если она скрыта навсегда)
const mustRevealProfessionFirst = round.number === 1 && !revealedKeys.includes('profession') && hiddenKey !== 'profession';

   // Когда голосование закончилось и фаза вернулась в idle — снова можно открыть одну обычную карту
useEffect(() => {
  if (vote.phase === 'idle') {
    setHasOpenedThisTurn(false);
  }
}, [vote.phase]);
  




  // Если началась игра — локально ставим 0 (оставляем как было)
  useEffect(() => {
    if (started) setTurnIdx(0);
  }, [started]);

  // Если состав активных поменялся — не вылетаем за пределы индекса
  useEffect(() => {
    if (turnIdx >= activePlayers.length && activePlayers.length > 0) {
      setTurnIdx(0);
    }
  }, [activePlayers, turnIdx]);

  const renderCell = (p: PublicPlayer, key: keyof Hand) => {
    const isSelf = p.id === myClientId;

    

    const containerCls =
      'min-h-[88px] flex flex-col justify-between whitespace-normal break-words min-w-0 overflow-hidden';

    if (isSelf && myHand) {
      const ability = isAbilityKey(key);
      const isHiddenForever = ability ? false : key === hiddenKey; // для способностей «скрыто до конца» не бывает
      const isRevealed = revealedKeys.includes(key);
      const isMyTurn = myClientId === currentPlayerId;

        // ✅ Обычные хар-ки: только в свой ход и не больше одной за ход
        // ✅ Спецвозможности: всегда (если ещё не открыто), не зависят от хода/started
      const canOpen = !gameOver && (
  ability
    ? !isRevealed
    : (
        started &&
        vote.phase === 'idle' &&
        isMyTurn &&
        !hasOpenedThisTurn &&
        !isHiddenForever &&
        !isRevealed &&
        hasRoundQuota &&
        (!mustRevealProfessionFirst || key === 'profession')
      )
);


      return (
        <div className={containerCls}>
          <div className="font-semibold">{myHand[key]}</div>
          {isRevealed ? (
  // «Открыто» всегда показываем
  <button disabled className={`${BTN_BASE} ${BTN_OPENED}`} title="Уже открыто">
    Открыто
  </button>
) : canOpen ? (
  // «Открыть» показываем только когда это допустимо
  <button
    onClick={() => {
  if (!canOpen) return;

  // 1) Оптимистично подсветим «Открыто» сразу
  setRevealedKeys(prev => (prev.includes(key) ? prev : [...prev, key]));

  // 2) Отправим на сервер
  revealKey(key);

  // 3) Для обычных характеристик фиксируем «одну за ход» и просим сервер перейти к следующему
  if (!ability) {
    setHasOpenedThisTurn(true);
    socketRef.current?.emit('game:nextTurn', { roomId });
  }
}}
    className={`${BTN_BASE} ${BTN_ACTIVE}`}
    title={
  ability
    ? 'Открыть спец. возможность (не влияет на ход и раунды)'
    : !hasRoundQuota
      ? `Достигнут лимит раунда: ${myRevealedThisRound}/${round.quota}`
      : (mustRevealProfessionFirst && key !== 'profession')
        ? 'В 1-м раунде сначала откройте «Профессию»'
        : 'Открыть эту карту для всех'
}

  >
    Открыть
  </button>
) : (
  // Если открыть нельзя — кнопка «Открыть» пропадает (оставляем высоту для ровной сетки)
  <div className="h-8" />
)}

        </div>
      );
    }

    const val = p.revealed?.[key];
    return (
      <div className={containerCls}>
        <span className={val ? 'font-semibold' : 'text-gray-400'}>
          {val ?? 'закрыто'}
        </span>
        <div className={`${BTN_BASE} ${BTN_DISABLED} opacity-0 pointer-events-none`} />
      </div>
    );
  };

  // активные (не кикнутые) / всего игроков в лобби
  const activeCount = activePlayers.length; // 👈 используем activePlayers, чтобы не ругался ESLint
  const totalInLobby = publicPlayers.length;

  /* 👇 ДОБАВЛЕНО: состояние свёрнутости «Бункера» + загрузка/сохранение */
  const [bunkerCollapsed, setBunkerCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(LS_BUNKER_COLLAPSED);
      if (v === '1') setBunkerCollapsed(true);
    } catch {}
  }, []);
  const toggleBunker = () => {
    setBunkerCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem(LS_BUNKER_COLLAPSED, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  /* Вкладка «Спец возможности»: по умолчанию свёрнута */
const [abilitiesCollapsed, setAbilitiesCollapsed] = useState<boolean>(false);
useEffect(() => {
  try {
    const v = window.localStorage.getItem(LS_ABILITIES_COLLAPSED);
    if (v === '1') setAbilitiesCollapsed(true);  // уважаем «свёрнуто»
  } catch {}
}, []);

const toggleAbilities = () => {
  setAbilitiesCollapsed(prev => {
    const next = !prev;
    try { window.localStorage.setItem(LS_ABILITIES_COLLAPSED, next ? '1' : '0'); } catch {}
    return next;
  });
};


useEffect(() => {
  return () => {
    if (hideNoticeRef.current) {
      clearTimeout(hideNoticeRef.current);
      hideNoticeRef.current = null;
    }
  };
}, []);





  return (
    <main
      data-theme={theme}
      className="min-h-screen p-6 max-w-screen-2xl mx-auto"
      style={{ color: 'var(--c-text)' }}
    >
      {/* ── Шапка: заголовок + шестерёнка + Вернуться в лобби ── */}
      <div className="relative flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Bunker — игра</h1>

        <div className="flex items-center gap-2">
          {/* Шестерёнка: открывает панель */}
          <button
            onClick={() => setShowTopMenu(v => !v)}
            aria-label="Настройки"
            className="themed-btn w-9 h-9 rounded flex items-center justify-center"
            title="Показать настройки"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 15a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.6-2.6.7a7.7 7.7 0 0 0-1.7-1l-.4-2.7h-4l-.4 2.7a7.7 7.7 0 0 0-1.7 1l-2.6-.7-2 3.6L4.5 13a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2.1 1.6 2 3.6 2.6-.7a7.7 7.7 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.7 7.7 0 0 0 1.7-1l2.6.7 2-3.6L19.4 15Z" />
            </svg>
          </button>

          {/* Вернуться в лобби */}
          <button
            onClick={backToLobby}
            className="px-3 py-2 rounded themed-btn"
          >
            Вернуться в лобби
          </button>
        </div>

        {/* Выпадающая панель: Лобби/Хост + Сменить тему */}
        {/* Боковая панель справа */}
{showTopMenu && (
  <div
    className="fixed top-0 right-0 h-full w-80 rust-panel z-30 p-5 shadow-xl flex flex-col"
    style={{ backgroundColor: 'var(--c-card)', borderLeft: '1px solid var(--c-border)' }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold">Настройки</h3>
      <button
        onClick={() => setShowTopMenu(false)}
        className="themed-btn w-8 h-8 flex items-center justify-center"
        title="Закрыть"
      >
        ✕
      </button>
    </div>

    <div className="text-sm mb-4 space-y-1">
  <div>
    Лобби: <b>{roomId}</b>
  </div>
  {hostId && (
    <div>
      Хост: <code className="text-xs">{hostId}</code>
    </div>
  )}
  </div>

    {/* 👇 ВСТАВЛЕНО: переход в превью интро */}
    <button
      onClick={() => router.push(`/game/${roomId}/intro?preview=1`)}
      className="w-full px-3 py-2 mb-2 rounded themed-btn"
    >
      Посмотреть интро
    </button>

    <button
      onClick={nextTheme}
      className="w-full px-3 py-2 rounded themed-btn"
      title={`Сменить тему (текущая: ${theme})`}
    >
      Сменить тему
    </button>


    {hostId === myClientId && !gameOver && vote.phase === 'idle' && (
  <button
    onClick={startVoteSpeeches}
    className="w-full px-3 py-2 rounded themed-btn mt-2"
    title="Начать голосование: спичи → голосование"
  >
    Начать голосование
  </button>
)}

  </div>
)}

      </div>

      {/* ===== Катаклизм (над Бункером) ===== */}
      {cataclysm && (
        <section className="mb-8 relative overflow-hidden rounded-xl rust-panel">
          {/* Кнопка "!" для перехода в превью интро */}
               <button
                onClick={() => router.push(`/game/${roomId}/intro?preview=1`)}
                className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center 
                           border border-white text-white/90 hover:text-white hover:bg-white/10 transition"
                title="Посмотреть интро"
                >
                        !
                 </button>



          {/* Фоновое изображение (фиксированное, тёмная маска и виньетка по краям) */}
          <div aria-hidden className="absolute inset-0 -z-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${cataclysm.image}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'brightness(0.9)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(120% 80% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)'
              }}
            />
            <div className="absolute inset-0 backdrop-blur-[1px]" />
          </div>

          {/* Текст поверх */}
          <div className="px-6 md:px-10 lg:px-16 xl:px-24 py-10 text-center max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-5">{cataclysm.title}</h2>
            <p className="text-base md:text-lg leading-7 opacity-90">
              {cataclysm.text}
            </p>
          </div>
        </section>
      )}

      {/* ===== Блок «Бункер» ===== */}
      {bunker && (
        <section
          className={`mb-10 rounded-xl rust-panel px-6 md:px-10 lg:px-16 xl:px-24 ${bunkerCollapsed ? 'py-4' : 'py-7'}`}
        >
          {/* Кликабельная шапка на всю горизонталь */}
          <div
            onClick={toggleBunker}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleBunker()}

            role="button"
            tabIndex={0}
            className="-mx-6 md:-mx-10 lg:-mx-16 xl:-mx-24 px-6 md:px-10 lg:px-16 xl:px-24 py-2 cursor-pointer select-none"
            aria-expanded={!bunkerCollapsed}
            aria-controls="bunker-content"
          >
            <h2 className="text-center text-4xl font-extrabold mb-0 flex items-center justify-center gap-3">
              Бункер
              <span aria-hidden className={`inline-block translate-y-[1px] transition-transform ${bunkerCollapsed ? '' : 'rotate-180'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </h2>
          </div>

          {/* Контент сворачивается */}
          {!bunkerCollapsed && (
            <div id="bunker-content">
              {/* две колонки — слева текст (центрируем/сужаем), справа карточки */}
              <div className="flex flex-col md:flex-row gap-8">
                {/* Левая колонка (текст) */}
                <div className="flex-1 pr-6 md:max-w-[760px] md:mx-auto">
                  <p className="text-[17px] leading-7 font-semibold mb-6">
                    {bunker.description}
                  </p>

                  <div>
                    <div className="mb-2">В бункере присутствует:</div>
                    <ul className="list-disc ml-6 space-y-2">
                      {bunker.items.map((it, i) => (
                        <li key={i} className="font-semibold">{it}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-10">
                    <div className="text-3xl md:text-4xl font-extrabold">
                      Количество мест:{' '}
                      <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                        {bunker.places ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Правая колонка — карточки */}
                <div className="grid gap-5 w-[460px] shrink-0 md:self-start pl-6">
                  <div className="rounded-lg rust-panel px-5 py-4 flex items-center gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-md flex items-center justify-center"
                         style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" style={{ color: 'var(--c-accent)' }}>
                        <path d="M7 3H3v4M3 3l6 6M17 3h4v4M21 3l-6 6M3 17v4h4M3 21l6-6M17 21h4v-4M21 21l-6-6"
                              stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm opacity-80">Размер бункера</div>
                      <div className="font-semibold">{bunker.sizeM2} м²</div>
                    </div>
                  </div>

                  <div className="rounded-lg rust-panel px-5 py-4 flex items-center gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-md flex items-center justify-center"
                         style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" style={{ color: 'var(--c-accent)' }}>
                        <path d="M7 3v2m10-2v2M3 8h18M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8"
                              stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm opacity-80">Время нахождения</div>
                      <div className="font-semibold">{bunker.stayText}</div>
                    </div>
                  </div>

                  <div className="rounded-lg rust-panel px-5 py-4 flex items-center gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-md flex items-center justify-center"
                         style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" style={{ color: 'var(--c-accent)' }}>
                        <path d="M4 18c2 0 4-2 4-4 0-2-2-4-4-4m0 8c-1.5 0-2 1-2 2h12m-4-8c2 0 4-2 4-4"
                              stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm opacity-80">Количество еды и воды</div>
                      <div className="font-semibold">{bunker.foodText}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      

      {/* Заголовок-счётчик над таблицей */}
      <div className="mb-2 text-center">
        <h3 className="text-3xl md:text-4xl font-extrabold">
          Желающие попасть в бункер:{' '}
          <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
            {activeCount}/{totalInLobby}
          </span>
        </h3>
      </div>

      <div className="text-center text-xs opacity-80 mt-1">
  Раунд {round.number}. Открыто вами: {round.quota === 0 ? myRevealedThisRound : `${myRevealedThisRound}/${round.quota}`}
</div>


{/* ===== Баннер голосования (показывается, если идёт голосование) ===== */}
{!gameOver && vote.phase !== 'idle' && (
  <div
    className="rounded-lg border mb-4 px-4 py-3 rust-panel"
    style={{ borderColor: 'var(--c-border)' }}
  >
    {vote.phase === 'speeches' && (
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <b>Спичи</b> — по 60 сек. Сейчас говорит:{' '}
          <span className="font-semibold">
            {(() => {
              const curId = vote.speechOrder?.[vote.speakingIdx ?? -1];
              return publicPlayers.find(p => p.id === curId)?.nick ?? '—';
            })()}
          </span>
        </div>

        {/* таймер + кнопка «Закончить свой спич» (кнопка видна только текущему оратору) */}
        <div className="text-xs opacity-80 flex items-center gap-2">
          <span>До конца: {speechSecondsLeft} c</span>
          {speakingId === myClientId && (
            <button
              onClick={() => socketRef.current?.emit('vote:speech:finish', { roomId })}
              className="themed-btn px-3 py-1 text-[12px]"
              title="Завершить свою речь раньше времени"
            >
              Закончить свой спич
            </button>
          )}
        </div>
      </div>
    )}

    {vote.phase === 'ballot' && (
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <b>Голосование</b> — 90 сек тишины. Выберите игрока:
        </div>
        <div className="text-xs opacity-80">
          До конца: {ballotSecondsLeft} c
        </div>
      </div>
    )}

    {vote.phase === 'ballot' && (
      <section
        className="mt-3 border rounded-lg px-4 py-4"
        style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
      >
        <ul>
          {publicPlayers
        .filter(p => !p.kicked)
        .filter(p => {
          const allowed = Array.isArray(vote.allowedTargets) && vote.allowedTargets.length > 0
            ? new Set(vote.allowedTargets)
            : null;
          return !allowed || allowed.has(p.id);
        })
            .map(p => {
              const cnt = vote.votes?.[p.id] ?? 0;
              const totalVoters = getKickTotalVoters(
   vote,
   publicPlayers.filter(u => !u.kicked).length
);
              const hasVoted = Array.isArray(vote.votedBy) ? vote.votedBy.includes(myClientId) : false;
              return (
                <KickVoteRow
                  key={p.id}
                  meId={myClientId}
                  player={p}
                  count={cnt}
                  totalVoters={typeof totalVoters === 'number' && totalVoters > 0 ? totalVoters : publicPlayers.length}
                  hasVoted={hasVoted || meKicked}
                  onVote={(targetId) => { if (!(hasVoted || meKicked || targetId === myClientId)) castVote(targetId); }}
                />
              );
            })}
        </ul>
        <div className="mt-2 text-sm opacity-80 text-center select-none">
          До завершения: {ballotSecondsLeft}s
        </div>
      </section>
    )}

  </div>
)}


    {/* ===== Финальный хот-бар: показывается после завершения игры ===== */}
{gameOver && (
  <div
    className="rounded-lg border mb-4 px-4 py-3 rust-panel"
    style={{ borderColor: 'var(--c-border)' }}
  >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        {winners.includes(myClientId) ? (
          <>
            <b>Вы прошли в бункер!</b>{' '}
            <span className="font-semibold text-emerald-400">
              {publicPlayers.find(p => p.id === myClientId)?.nick ?? nick}
            </span>
          </>
        ) : (
          <>
            <b>В бункер успешно прошли:</b>{' '}
            <span className="font-semibold text-emerald-400">
              {publicPlayers
  .filter(p => winners.includes(p.id))
  .map(p => p.nick)
  .join(', ') || '—'}
            </span>
          </>
        )}
      </div>

      {/* Статус справа — можно убрать, если не нужен */}
      <div className="text-xs opacity-70">
        Игра завершена
      </div>
    </div>
  </div>
)}



      {/* ===== Голосование за пропуск — панель/уведомление (вставляется только при видимости) ===== */}
 {!gameOver && vote.phase === 'idle' && currentPlayerId && isSkipPanelVisible && (
   <div
     className="mt-3 border rounded-t-lg -mb-px"
     style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
   >
    <div className="px-4 md:px-6 lg:px-8 xl:px-10 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Левая часть: либо уведомление, либо прогресс */}
      <div className="text-sm md:text-base flex-1">
        {showSkipNotice ? (
          <div className="w-full text-center font-semibold">
            {skipNoticeText}
          </div>
        ) : (
          <>
            Пропуск хода игрока: <b>({currentTurnNick || '—'})</b>{' '}
            <b>{voteSkip.votes}</b> из <b>{voteSkip.total}</b> (нужно <b>{voteSkip.needed}</b>)
            <div className="mt-2 w-full md:w-[420px] h-2 rounded bg-[color:rgba(255,255,255,.08)] overflow-hidden">
              <div
                className="h-full bg-[color:#16a34a]"
                style={{
                  width:
                    voteSkip.total > 0
                      ? `${Math.min(100, Math.round((voteSkip.votes / voteSkip.total) * 100))}%`
                      : '0%',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Правая часть: кнопка голосования (скрываем при уведомлении) */}
      <div className="shrink-0">
        {showSkipNotice ? null : (() => {
          const iVoted = voteSkip.voters.includes(myClientId);
          if (isMyTurnNow || meKicked) {
  return (
    <div className="text-xs md:text-sm opacity-70 select-none">
      {meKicked ? 'Исключённые не голосуют' : 'Игрок на ходу не голосует'}
    </div>
  );
}
return (
  <button
    onClick={() => {
      const wantVote = !iVoted;
      setVoteSkip(prev => {
        const nextVoters = wantVote
          ? [...prev.voters, myClientId]
          : prev.voters.filter(v => v !== myClientId);
        return { ...prev, voters: nextVoters, votes: nextVoters.length };
      });
      socketRef.current?.emit('game:voteSkip', { roomId, vote: wantVote });
    }}
    className={`px-4 py-2 rounded ${iVoted ? 'bg-[color:#374151] text-white' : 'themed-btn'}`}
    title={iVoted ? 'Отменить голос' : 'Проголосовать за пропуск'}
  >
    {iVoted ? 'Отменить голос' : 'Голосовать за пропуск'}
  </button>
);

        })()}
      </div>
    </div>
  </div>
)}






      {/* Таблица */}
<div
  className="rounded-lg border overflow-visible relative"
  style={{ borderColor: 'var(--c-border)' }}
>
  <table className="w-full table-fixed text-sm table-metal">
    <thead>
      <tr className="text-left">
        <th className="px-4 py-3 w-[220px] whitespace-normal break-words min-w-0 overflow-hidden">Имя</th>
        {COLS.map(({ title, info, key }) => (
          <th key={key as string} className="px-4 py-3 whitespace-normal break-words min-w-0 overflow-hidden">
            <div className="flex items-center gap-1">
              <span>{title}</span>
              {info ? (
                <span
                  title="Подсказка"
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px]"
                  style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  i
                </span>
              ) : null}
            </div>
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {publicPlayers.length === 0 ? (
        <tr>
          <td
            colSpan={1 + COLS.length}
            className="px-4 py-6 text-center text-gray-400"
          >
            Пока пусто. Начните раскрывать карты.
          </td>
        </tr>
      ) : (
        publicPlayers.map((p) => {
          const isWinner = gameOver && winners.includes(p.id);
          return (
            <tr key={p.id} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
              <td className="px-4 py-4 min-w-0 overflow-visible relative">
                <div className="flex items-center gap-3">
                  {/* Индикатор слева: Говорит / Ходит */}
                  {vote.phase === 'speeches' && speakingId === p.id ? (
                    <div
                      className="
                        pointer-events-none select-none
                        absolute -left-20 top-1/2 -translate-y-1/2 z-20
                      "
                      title="Сейчас говорит этот игрок"
                    >
                      {/* Пульсирующая метка слева (синяя) */}
                      <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/80"></span>
                      <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/50 animate-ping"></span>

                      {/* Таблетка «Говорит» */}
                      <div
                        className="
                          relative px-2.5 py-1 rounded-xl
                          text-[11px] leading-none font-medium tracking-wide
                          border shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.45)]
                          bg-gradient-to-b from-zinc-800/90 to-zinc-900/90
                          text-zinc-100 border-white/10 backdrop-blur-[2px]
                        "
                      >
                        Говорит
                        <span
                          className="
                            absolute -right-1 top-1/2 -translate-y-1/2
                            w-2 h-2 rotate-45
                            bg-zinc-900/90 border-r border-b border-white/10
                            shadow-[2px_2px_6px_rgba(0,0,0,0.35)]
                          "
                        />
                      </div>
                    </div>
                  ) : (vote.phase === 'idle' && !gameOver && currentPlayerId === p.id) ? (
                    <div
                      className="
                        pointer-events-none select-none
                        absolute -left-20 top-1/2 -translate-y-1/2 z-20
                      "
                      title="Сейчас ход этого игрока"
                    >
                      <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400/80"></span>
                      <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400/50 animate-ping"></span>
                      <div
                        className="
                          relative px-2.5 py-1 rounded-xl
                          text-[11px] leading-none font-medium tracking-wide
                          border shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.45)]
                          bg-gradient-to-b from-zinc-800/90 to-zinc-900/90
                          text-zinc-100 border-white/10 backdrop-blur-[2px]
                        "
                      >
                        Ходит
                        <span
                          className="
                            absolute -right-1 top-1/2 -translate-y-1/2
                            w-2 h-2 rotate-45
                            bg-zinc-900/90 border-r border-b border-white/10
                            shadow-[2px_2px_6px_rgba(0,0,0,0.35)]
                          "
                        />
                      </div>
                    </div>
                  ) : null}

                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center overflow-hidden ${p.kicked ? 'opacity-60 grayscale' : ''}`}
                    style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
                  >
                    {p.avatarUrl ? (
                      <Image
                        src={p.avatarUrl}
                        alt={p.nick}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <div className="leading-5">
                    <div className={`font-medium ${p.kicked ? 'line-through text-gray-400' : (isWinner ? 'text-emerald-400' : '')}`}>
                      {p.nick}
                      {p.id === hostId ? ' 👑' : ''}
                    </div>
                    <div className="text-xs opacity-60 break-words">
                      id: {p.id}
                    </div>
                  </div>
                </div>
              </td>

              {COLS.map(({ key }) => (
                <td
                  key={key as string}
                  className={`px-4 py-4 align-top whitespace-normal break-words min-w-0 ${key === 'extra' ? 'relative overflow-visible' : 'overflow-hidden'}`}
                >
                  {renderCell(p, key)}

                  {/* ⏱️ Правый таймер: только у текущего игрока и только в колонке "Доп. сведение" */}
                  {vote.phase === 'idle' && !gameOver && key === 'extra' && currentPlayerId === p.id && (
                    <div
                      className="
                        pointer-events-none select-none
                        absolute -right-14 top-1/2 -translate-y-1/2 z-20
                      "
                      title="Таймер хода"
                    >
                      {/* Пульсирующая метка справа */}
                      <span className="absolute -right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/80"></span>
                      <span className="absolute -right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/50 animate-ping"></span>

                      {/* Таблетка с секундомером */}
                      <div
                        className="
                          relative px-2.5 py-1 rounded-xl
                          text-[11px] leading-none font-medium tracking-wide
                          border shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.45)]
                          bg-gradient-to-b from-zinc-800/90 to-zinc-900/90
                          text-zinc-100 border-white/10 backdrop-blur-[2px]
                        "
                      >
                        {serverTurnSeconds < 120 ? serverTurnSeconds : '120+'}
                        {/* Стрелка-указатель к ячейке (слева от бейджа) */}
                        <span
                          className="
                            absolute -left-1 top-1/2 -translate-y-1/2
                            w-2 h-2 rotate-45
                            bg-zinc-900/90 border-l border-t border-white/10
                            shadow-[-2px_2px_6px_rgba(0,0,0,0.35)]
                          "
                        />
                      </div>
                    </div>
                  )}

                  {/* ⏱️ Правый таймер речи */}
                  {vote.phase === 'speeches' && key === 'extra' && speakingId === p.id && (
                    <div
                      className="
                        pointer-events-none select-none
                        absolute -right-14 top-1/2 -translate-y-1/2 z-20
                      "
                      title="До конца речи"
                    >
                      {/* Пульсирующая метка справа (синяя) */}
                      <span className="absolute -right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/80"></span>
                      <span className="absolute -right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400/50 animate-ping"></span>

                      {/* Таблетка с секундомером речи */}
                      <div
                        className="
                          relative px-2.5 py-1 rounded-xl
                          text-[11px] leading-none font-medium tracking-wide
                          border shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.45)]
                          bg-gradient-to-b from-zinc-800/90 to-zinc-900/90
                          text-zinc-100 border-white/10 backdrop-blur-[2px]
                        "
                      >
                        {speechSecondsLeft}
                        <span
                          className="
                            absolute -left-1 top-1/2 -translate-y-1/2
                            w-2 h-2 rotate-45
                            bg-zinc-900/90 border-l border-t border-white/10
                            shadow-[-2px_-2px_6px_rgba(0,0,0,0.35)]
                          "
                        />
                      </div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          );
        })
      )}
    </tbody>
  </table>
</div>


      {/* 👇 NEW: подпись «кто ходит» под основной таблицей */}
      <div className="text-center mt-3 text-sm opacity-90 hidden" aria-hidden>
        Ходит ={' '}
        <b>{publicPlayers.find(u => u.id === currentPlayerId)?.nick ?? '—'}</b>
      </div>

{/* ===== Заголовок «Результат последнего голосования» как у «Спец возможности» ===== */}
{lastVote && Object.keys(lastVote.totals || {}).length > 0 && (
  <>
    <div
      onClick={toggleLastVote}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleLastVote()}
      role="button"
      tabIndex={0}
      aria-controls="lastvote-panel"
      aria-expanded={!lastVoteCollapsed}
      className={`mt-8 w-full border ${lastVoteCollapsed ? 'rounded-lg' : 'rounded-t-lg'} cursor-pointer select-none`}
      style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
    >
      <h2 className="text-center text-4xl font-extrabold mb-0 py-6 flex items-center justify-center gap-3">
        Результат последнего голосования
        <span
         aria-hidden
          className={`inline-block translate-y-[1px] transition-transform ${lastVoteCollapsed ? '' : 'rotate-180'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </h2>
    </div>

    {!lastVoteCollapsed && (
      <section
        id="lastvote-panel"
        className="border rounded-b-lg border-t-0 mt-0 mb-6 px-6 py-5"
        style={{ borderColor: 'var(--c-border)' }}
      >
        <div className="space-y-4">
          {Object.entries(lastVote.totals)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([playerId, count]) => {
              const totalVoters =
                typeof lastVote.totalVoters === 'number'
                  ? lastVote.totalVoters
                  : Object.values(lastVote.totals).reduce((x, y) => (x as number) + (y as number), 0);
              const pct = totalVoters > 0 ? (Number(count) / totalVoters) * 100 : 0;
              const nick = publicPlayers.find(p => p.id === playerId)?.nick ?? 'Игрок';
              const rawVoters = lastVote.votersByTarget?.[playerId] || [];
              const votersList =
                Array.isArray(rawVoters) && rawVoters.length
                  ? rawVoters
                      .map(v => publicPlayers.find(p => p.id === v)?.nick ?? String(v))
                      .join(', ')
                  : null;
              return (
                <div key={playerId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{nick}</div>
                    <div className="text-sm opacity-80">{Math.round(pct)}%</div>
                  </div>
                  <div
                    className="w-full h-3 rounded border"
                    style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-muted)' }}
                  >
                    <div
                      className="h-3 rounded"
                      style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: 'var(--c-accent)' }}
                      aria-hidden
                    />
                  </div>
                  {votersList && <div className="text-xs opacity-70">{votersList}</div>}
                </div>
              );
            })}
        </div>
      </section>
    )}
  </>
)}






      {/* ===== Спец возможности — кнопка управления вплотную к таблице ===== */}
{/* ===== Заголовок «Спец возможности» с обводкой как у таблицы ===== */}
<div
  onClick={toggleAbilities}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleAbilities()}
  role="button"
  tabIndex={0}
  aria-controls="abilities-table"
  aria-expanded={!abilitiesCollapsed}
  className={`mt-8 w-full border ${abilitiesCollapsed ? 'rounded-lg' : 'rounded-t-lg'} cursor-pointer select-none`}
  style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
>
  <h2 className="text-center text-4xl font-extrabold mb-0 py-6 flex items-center justify-center gap-3">
    Спец. возможности
    <span
      aria-hidden
      className={`inline-block translate-y-[1px] transition-transform ${abilitiesCollapsed ? '' : 'rotate-180'}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  </h2>
</div>


{/* Сама таблица — сворачивается/разворачивается */}
<div
  id="abilities-table"
  className={`overflow-x-hidden border ${abilitiesCollapsed ? 'hidden' : 'rounded-b-lg border-t-0'}`}
  style={{ borderColor: 'var(--c-border)' }}
>
  <table className="w-full table-fixed text-sm table-metal">
    <thead>
      <tr className="text-left">
        <th className="px-4 py-3 w-[220px] whitespace-normal break-words min-w-0 overflow-hidden">Имя</th>
        {COLS_ABILITIES.map(({ title, key }) => (
          <th
            key={key as string}
            className="px-4 py-3 whitespace-normal break-words min-w-0 overflow-hidden"
          >
            {title}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {publicPlayers.length === 0 ? (
        <tr>
          <td
            colSpan={1 + COLS_ABILITIES.length}
            className="px-4 py-6 text-center text-gray-400"
          >
            Пока пусто. Начните раскрывать карты.
          </td>
        </tr>
      ) : (
        publicPlayers.map((p) => (
          <tr key={p.id} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
            
            <td className="px-4 py-4 min-w-0 overflow-hidden">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center overflow-hidden ${p.kicked ? 'opacity-60 grayscale' : ''}`}
                  style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}
                >
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt={p.nick}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <div className="leading-5">
  <div className={`font-medium ${
    p.kicked ? 'line-through text-gray-400' : (winners.includes(p.id) ? 'text-emerald-400' : '')
  }`}>
    {p.nick}
    {p.id === hostId ? ' 👑' : ''}
  </div>
  <div className="text-xs opacity-60 break-words">
    id: {p.id}
  </div>
</div>

              </div>
            </td>

            {COLS_ABILITIES.map(({ key }) => (
              <td
                key={key as string}
                className="px-4 py-4 align-top whitespace-normal break-words min-w-0 overflow-hidden"
              >
                {renderCell(p, key)}
              </td>
            ))}
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>

{gameOver && cleanupAt && (
     <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 sm:px-8 py-5 sm:py-6 rounded-xl border shadow-xl"
          style={{
            background: 'var(--c-card), #0f172a',
            borderColor: 'var(--c-border)' // красная рамка
         }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="text-xl sm:text-2xl font-extrabold mb-1">Игра завершена</div>
        <div className="text-sm sm:text-base opacity-90 select-none">
          Автовыход в лобби через{' '}
          <span className="font-mono tabular-nums text-lg sm:text-xl font-semibold">
            {String(Math.floor((cleanupLeft ?? 0) / 60)).padStart(2, '0')}:
            {String((cleanupLeft ?? 0) % 60).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  )}
    </main>
  );
}
