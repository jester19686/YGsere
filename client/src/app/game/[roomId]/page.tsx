'use client';

import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from 'react';

import { useParams, useRouter } from 'next/navigation';

import type { Socket } from 'socket.io-client';

import { getSocket, getClientId } from '@/lib/socket';

import { createPortal } from 'react-dom';

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

type BunkerOptimality = {
  area: {
    percentage: number;
    isOptimal: boolean;
    status: string;
  };
  survival: {
    percentage: number;
    isOptimal: boolean;
    status: string;
  };
  supplies: {
    percentage: number;
    isOptimal: boolean;
    status: string;
  };
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

type PublicPlayer = { id: string; nick: string; avatarUrl?: string; revealed: Partial<Hand>; kicked?: boolean; hand?: Partial<Hand> };

type GameStatePayload = {

  roomId: string;

  phase: 'reveal';

  players: PublicPlayer[];

  bunker?: BunkerInfo;

  cataclysm?: Cataclysm; // ⬅️ ДОБАВЛЕНО

  currentTurnId?: string;     // 👈 КТО ХОДИТ (истина с сервера)

  turnOrder?: string[];       // 👈 (опционально) порядок ходов

  turnSeconds?: number;       // 👈 СЕКУНДЫ СЕРВЕРНОГО ТАЙМЕРА

  voteSkip?: { votes: number; total: number; needed: number; voters: string[] }; // рџ'€ РЅРѕРІРѕРµ

    round?: RoundState;  // ← состояние раунда с сервера

  started?: boolean;

     editorEnabled?: boolean;

  paused?: boolean;

  revealAll?: boolean;

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

const THEMES = ['amber', 'lobby'] as const; // рџ'€ rust в†' lobby

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

  { key: 'hobby',      title: 'Хобби / Увлечение' },

  { key: 'phobia',     title: 'Фобия / Страх' },

  { key: 'bigItem',    title: 'Крупный инвентарь' },

  { key: 'backpack',   title: 'Рюкзак' },

  { key: 'extra',      title: 'Доп. сведения' },

];

/* 👇 ДОБАВЛЕНО: колонки таблицы «Спец. возможности» */

const COLS_ABILITIES: { key: keyof Hand; title: string }[] = [

  { key: 'ability1', title: 'Спец. возможность 1' },

  { key: 'ability2', title: 'Спец. возможность 2' },

];

// 👇 Хелпер: является ли ключ спец. возможностью

const isAbilityKey = (k: keyof Hand): boolean => k === 'ability1' || k === 'ability2';

// 👇 Хелпер: получение иконки профессии
const getProfessionIcon = (player: PublicPlayer, profession?: string): string => {
  const professionIcons: Record<string, string> = {
    'Кузнец (Эксперт)': '🔨',
    'Окулист (Любитель)': '👁️',
    'Лингвист (Новичок)': '🌐',
    'Военнослужащий (Опытный)': '🪖',
    'Программист (Профессионал)': '💻',
    'Врач (Специалист)': '👨‍⚕️',
    'Учитель (Методист)': '👩‍🏫',
    'Инженер (Конструктор)': '🛠️',
    'Повар (Шеф)': '👨‍🍳',
    'Психолог (Консультант)': '🧠',
    'Спасатель (Профессионал)': '🚒',
    'Строитель (Бригадир)': '👷',
    'Водитель (Дальнобойщик)': '🚚',
    'Полицейский (Детектив)': '👮',
    'Пилот (Капитан)': '✈️',
    'Моряк (Старпом)': '⚓',
    'Артист (Заслуженный)': '🎭',
    'Журналист (Редактор)': '📰',
    'Биолог (Исследователь)': '🔬',
    'Химик (Лаборант)': '🧪'
  };
  
  return profession && player.revealed?.profession ? (professionIcons[profession] || '?') : '?';
};

// 👇 Функция для расчета оптимальности параметров бункера
const calculateBunkerOptimality = (bunker: BunkerInfo, activePlayersCount: number): BunkerOptimality => {
  const currentLoad = activePlayersCount;
  
  // Расчет оптимальности площади (м² на человека)
  const areaPerPerson = bunker.sizeM2 / Math.max(1, currentLoad);
  const optimalAreaPerPerson = 25; // оптимально 25 м² на человека
  const areaPercentage = Math.min(100, Math.round((areaPerPerson / optimalAreaPerPerson) * 100));
  const areaIsOptimal = areaPercentage >= 80;
  const areaStatus = areaIsOptimal ? 'ОПТИМАЛЬНО' : areaPercentage >= 60 ? 'ПРИЕМЛЕМО' : 'КРИТИЧНО';
  
  // Расчет оптимальности времени выживания (зависит от количества людей)
  const survivalMonths = extractMonthsFromText(bunker.stayText);
  const optimalSurvivalMonths = Math.max(12, 24 - (currentLoad - 1) * 2); // уменьшается с ростом людей
  const survivalPercentage = Math.min(100, Math.round((survivalMonths / optimalSurvivalMonths) * 100));
  const survivalIsOptimal = survivalPercentage >= 80;
  const survivalStatus = survivalIsOptimal ? 'ОПТИМАЛЬНО' : survivalPercentage >= 60 ? 'ПРИЕМЛЕМО' : 'КРИТИЧНО';
  
  // Расчет оптимальности запасов (зависит от количества людей)
  const suppliesMonths = extractMonthsFromText(bunker.foodText);
  const optimalSuppliesMonths = Math.max(6, 12 - (currentLoad - 1) * 1.5); // уменьшается с ростом людей
  const suppliesPercentage = Math.min(100, Math.round((suppliesMonths / optimalSuppliesMonths) * 100));
  const suppliesIsOptimal = suppliesPercentage >= 80;
  const suppliesStatus = suppliesIsOptimal ? 'ОПТИМАЛЬНО' : suppliesPercentage >= 60 ? 'ПРИЕМЛЕМО' : 'КРИТИЧНО';
  
  return {
    area: {
      percentage: areaPercentage,
      isOptimal: areaIsOptimal,
      status: areaStatus
    },
    survival: {
      percentage: survivalPercentage,
      isOptimal: survivalIsOptimal,
      status: survivalStatus
    },
    supplies: {
      percentage: suppliesPercentage,
      isOptimal: suppliesIsOptimal,
      status: suppliesStatus
    }
  };
};

// 👇 Вспомогательная функция для извлечения месяцев из текста
const extractMonthsFromText = (text: string): number => {
  const monthsMatch = text.match(/(\d+)\s*(месяц|мес|month)/i);
  if (monthsMatch) {
    return parseInt(monthsMatch[1]);
  }
  
  const yearsMatch = text.match(/(\d+)\s*(год|лет|year)/i);
  if (yearsMatch) {
    return parseInt(yearsMatch[1]) * 12;
  }
  
  return 12; // значение по умолчанию
};

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const [cataclysm, setCataclysm] = useState<Cataclysm | null>(null); // в¬…пёЏ РќРћР'РћР•

  // 👇 новое состояние: панелька под шестерёнкой

  const [showTopMenu, setShowTopMenu] = useState(false);
const [portalReady, setPortalReady] = useState(false);


  const [lastVote, setLastVote] = useState<LastVoteResult | null>(null);

  // хост и редактор

  const isHost = useMemo(() => hostId === getClientId(), [hostId]);

  const [editorEnabled, setEditorEnabled] = useState(false);

  const [showAllReveals, setShowAllReveals] = useState(false);

  const [showHostReveals, setShowHostReveals] = useState(false);

  const [hostHands, setHostHands] = useState<Record<string, Partial<Hand>>>({});

  const [paused, setPaused] = useState(false);

  const PAUSE_TEXT = {

    overlayTitle: decodeURIComponent('%D0%98%D0%B3%D1%80%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%B0%D1%83%D0%B7%D0%B5'),

    hostHint: decodeURIComponent('%D0%92%D1%8B%20%D0%BC%D0%BE%D0%B6%D0%B5%D1%82%D0%B5%20%D0%BF%D1%80%D0%BE%D0%B4%D0%BE%D0%BB%D0%B6%D0%B8%D1%82%D1%8C%20%D0%B8%D0%B3%D1%80%D1%83%20%D0%B2%20%D0%BB%D1%8E%D0%B1%D0%BE%D0%B9%20%D0%BC%D0%BE%D0%BC%D0%B5%D0%BD%D1%82.'),

    playerHint: decodeURIComponent('%D0%9E%D0%B6%D0%B8%D0%B4%D0%B0%D0%B5%D0%BC%20%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D1%8F%20%D1%85%D0%BE%D1%81%D1%82%D0%B0.%20%D0%98%D0%B3%D1%80%D0%B0%20%D0%B2%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D0%BE%20%D0%BE%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B0.'),

    resumeBtn: decodeURIComponent('%D0%9F%D1%80%D0%BE%D0%B4%D0%BE%D0%BB%D0%B6%D0%B8%D1%82%D1%8C%20%D0%B8%D0%B3%D1%80%D1%83'),

    pauseBtn: decodeURIComponent('%D0%9E%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%B8%D1%82%D1%8C%20%D0%B8%D0%B3%D1%83'),

    resumeTitle: decodeURIComponent('%D0%9F%D1%80%D0%BE%D0%B4%D0%BE%D0%BB%D0%B6%D0%B8%D1%82%D1%8C%20%D1%85%D0%BE%D0%B4%20%D0%B8%D0%B3%D1%80%D1%8B'),

    pauseTitle: decodeURIComponent('%D0%9F%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%B8%D0%B3%D1%83%20%D0%BD%D0%B0%20%D0%BF%D0%B0%D1%83%D0%B7%D1%83'),

  };
  const REVEAL_ALL_TEXT = {
    label: decodeURIComponent('%D0%92%D1%81%D0%B5%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
    enable: decodeURIComponent('%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D0%B2%D1%81%D0%B5%D0%BC%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
    disable: decodeURIComponent('%D0%A1%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D1%83%20%D0%B2%D1%81%D0%B5%D1%85%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
    tooltip: decodeURIComponent('%D0%92%D0%BA%D0%BB%D1%8E%D1%87%D0%B8%D1%82%D1%8C/%D0%B2%D1%8B%D0%BA%D0%BB%D1%8E%D1%87%D0%B8%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BA%D0%B0%D0%B7%20%D0%B2%D1%81%D0%B5%D1%85%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%20%D0%B8%D0%B3%D1%80%D0%BE%D0%BA%D0%BE%D0%B2'),
  };

  const REVEAL_HOST_TEXT = {
    label: decodeURIComponent('%D0%A5%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8%20%D0%B4%D0%BB%D1%8F%20%D1%85%D0%BE%D1%81%D1%82%D0%B0'),
    enable: decodeURIComponent('%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
    disable: decodeURIComponent('%D0%A1%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
    tooltip: decodeURIComponent('%D0%9F%D0%BE%D0%BA%D0%B0%D0%B7%D0%B0%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BA%D1%80%D1%8B%D1%82%D1%8B%D0%B5%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8%20%D1%82%D0%BE%D0%BB%D1%8C%D0%BA%D0%BE%20%D1%85%D0%BE%D1%81%D1%82%D1%83%20%28%D0%BE%D1%81%D1%82%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5%20%D0%B8%D0%B3%D1%80%D0%BE%D0%BA%D0%B8%20%D0%BD%D0%B5%20%D1%83%D0%B2%D0%B8%D0%B4%D1%8F%D1%82%29'),
  };

  const HOST_PANEL_TEXT = {
    editorLabel: decodeURIComponent('%D0%A0%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%BE%D1%80%20%D0%B8%D0%B3%D1%8B'),
    editorTooltip: decodeURIComponent('%D0%92%D0%BA%D0%BB%D1%8E%D1%87%D0%B8%D1%82%D1%8C/%D0%B2%D1%8B%D0%BA%D0%BB%D1%8E%D1%87%D0%B8%D1%82%D1%8C%20%D1%80%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%BE%D1%80%20%D0%B8%D0%B3%D1%8B'),
    editorEnabled: decodeURIComponent('%D0%92%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD'),
    editorDisabled: decodeURIComponent('%D0%92%D1%8B%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD'),
    hostBadge: decodeURIComponent('%D1%82%D0%BE%D0%BB%D1%8C%D0%BA%D0%BE%20%D0%B4%D0%BB%D1%8F%20%D1%85%D0%BE%D1%81%D1%82%D0%B0'),
  };

  const REROLL_TEXT = {
    title: decodeURIComponent('%D0%9F%D0%B5%D1%80%D0%B5%D0%B1%D1%80%D0%BE%D1%81%D0%B8%D1%82%D1%8C%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D1%83'),
    aria: decodeURIComponent('%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0%20%D0%B4%D0%BB%D1%8F%20%D0%BF%D0%B5%D1%80%D0%B5%D0%B1%D1%80%D0%BE%D1%81%D0%B0%20%D1%85%D0%B0%D1%80%D0%B0%D0%BA%D1%82%D0%B5%D1%80%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B8'),
  };

  const HIDDEN_TEXT = decodeURIComponent('%D0%A1%D0%BA%D1%80%D1%8B%D1%82%D0%BE');

  const HOST_PANEL_STYLES = {
    card: 'mt-4 rounded-xl bunker-panel metal-texture hover-glow px-4 py-4 flex flex-col gap-4 shadow-sm min-w-0 transition-shadow',
    header: 'text-xs uppercase tracking-[0.32em] text-muted-foreground select-none',
    controlRow: 'flex flex-col gap-3 items-stretch',
    label: 'text-sm font-semibold text-foreground select-none leading-tight text-left',
    buttonBase: 'inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-center leading-tight whitespace-normal transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    buttonOn: 'bg-emerald-600 text-emerald-50 hover:bg-emerald-500 focus-visible:outline-emerald-300',
    buttonOff: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-300',
  } as const;


  
useEffect(() => {
  setPortalReady(true);
  return () => setPortalReady(false);
}, []);

useEffect(() => {
    setShowAllReveals(false);
    setShowHostReveals(false);
    setHostHands({});
  }, [roomId]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isHost && showHostReveals) {
      setShowHostReveals(false);
      setHostHands({});
      socketRef.current?.emit('game:revealAll:host', { roomId, enabled: false });
    }
  }, [isHost, showHostReveals, roomId]);

  useEffect(() => {
    if (showAllReveals && showHostReveals) {
      setShowHostReveals(false);
      setHostHands({});
      socketRef.current?.emit('game:revealAll:host', { roomId, enabled: false });
    }
  }, [showAllReveals, showHostReveals, roomId]);

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

const togglePause = useCallback(() => {

  if (!started) return;

  const next = !paused;

  setPaused(next);

  socketRef.current?.emit('game:pause', { roomId, paused: next });

  requestGameSync();

}, [paused, roomId, started, requestGameSync]);

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

  

  const myClientId = getClientId();

  /* === Тема: циклический переключатель + загрузка/сохранение === */

  const [theme, setTheme] = useState<ThemeName>('amber'); // 👈 дефолт — lobby

  // 🔁 Если ник появился уже после подключения — дожимаем join/sync

useEffect(() => {

  if (!nick) return;

  const s = socketRef.current;

  if (!s || !s.connected) return;

  try {
    const av = typeof window !== 'undefined' ? window.localStorage.getItem('bunker:avatar') : null;
    s.emit('joinRoom', { roomId, nick, clientId: getClientId(), avatarUrl: av || undefined });
  } catch {
    s.emit('joinRoom', { roomId, nick, clientId: getClientId() });
  }

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

  try {
    const av = typeof window !== 'undefined' ? window.localStorage.getItem('bunker:avatar') : null;
    s.emit('joinRoom', { roomId, nick: joinNick, clientId: myClientId, avatarUrl: av || undefined });
  } catch {
    s.emit('joinRoom', { roomId, nick: joinNick, clientId: myClientId });
  }

      s.emit('room:getState', { roomId });

      s.emit('game:sync', { roomId });

      s.emit('game:editorState', { roomId });

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

      if (typeof p.started === 'boolean') setStarted(p.started);

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

      if (typeof p.editorEnabled === 'boolean') {

        setEditorEnabled(p.editorEnabled);

      }

      if (typeof p.paused === 'boolean') {

        setPaused(p.paused);

      }

      if (typeof p.revealAll === 'boolean') {

        setShowAllReveals(p.revealAll);

        if (p.revealAll) {

          setShowHostReveals(false);
          setHostHands({});

        }

      }

      setGameOver(!!p.gameOver);

      if (typeof p.started === 'boolean') setStarted(p.started);

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

    

    const onHostHands = (payload: { roomId: string | number; hands?: Record<string, Partial<Hand>> }) => {

      if (String(payload.roomId) !== String(roomId)) return;

      if (showAllReveals) {
        setHostHands({});
        setShowHostReveals(false);
        return;
      }

      const incoming = payload.hands ?? {};
      setHostHands(incoming);
      setShowHostReveals(Object.keys(incoming).length > 0);

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

const onEditorState = (p: { roomId: string | number; enabled: boolean }) => {

  if (String(p.roomId) !== String(roomId)) return;

  setEditorEnabled(!!p.enabled);

};

const onGameOver = (p: { roomId: string; winners: string[]; cleanupAt?: number }) => {

  if (String(p.roomId) !== String(roomId)) return;

  setGameOver(true);

  setWinners(Array.isArray(p.winners) ? p.winners : []);

  setPaused(false);

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

    s.on('game:editorState', onEditorState);

    s.on('game:revealAll:host', onHostHands);

    s.emit('vote:getState', { roomId }); // спросим актуальное состояние

    s.emit('game:editorState', { roomId }); // спросим текущий флаг редактора

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

      s.off('game:editorState', onEditorState);

      s.off('game:revealAll:host', onHostHands);

      s.off('room:error', onRoomError)

      if (syncDebounceRef.current) {

  clearTimeout(syncDebounceRef.current);

  syncDebounceRef.current = null;

}

    };

  }, [roomId, nick, myClientId, onSkipSuccess, requestGameSync, router, showAllReveals]);

  const revealKey = (key: keyof Hand) =>

    socketRef.current?.emit('game:revealKey', { roomId, key });

  const backToLobby = () => {

  try { window.localStorage.setItem(LS_STAY_LOBBY, '1'); } catch {}

  router.push('/lobby');

};

  const BTN_BASE = 'inline-flex items-center justify-center h-8 px-3 rounded text-[12px] whitespace-nowrap self-start max-w-full leading-tight';

  const BTN_ACTIVE = 'themed-btn text-[color:var(--btn-text)]';

  const BTN_DISABLED = 'bg-[color:rgba(120,120,120,.28)] text-[color:#9ca3af] cursor-not-allowed border border-[color:rgba(255,255,255,.08)]';

  const BTN_OPENED   = 'bg-[color:#16a34a] text-white cursor-default border border-[color:rgba(255,255,255,.12)]';

  const containerCls = 'relative flex h-full min-h-[96px] flex-col gap-2 whitespace-normal break-words min-w-0 overflow-hidden';

  // refs для корректного определения «был именно пропуск»

const serverTurnSecondsRef = useRef(0);

const hideNoticeRef = useRef<number | null>(null);

const startVoteSpeeches = () => socketRef.current?.emit('vote:start', { roomId });

const castVote = (targetId: string) => socketRef.current?.emit('vote:cast', { roomId, targetId });

  /* 👇 turns — локальное состояние оставляем (НЕ удаляю) */

  const [turnIdx, setTurnIdx] = useState<number>(0);

  // 👇 ограничение: за свой ход можно открыть только одну обычную характеристику

const [hasOpenedThisTurn, setHasOpenedThisTurn] = useState(false);

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

    // РЇ РєРёРєРЅСѓС'?

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

  // 🔹 Мини-кнопка «рандом» для редактора

const renderRerollBtn = (targetId: string, key: keyof Hand) => {

  if (!(editorEnabled && isHost) || gameOver) return null;

  return (

    <button

      type="button"

      onClick={() => {

        socketRef.current?.emit('game:reroll', { roomId, targetId, key });

        requestGameSync();

      }}

      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs opacity-80 transition hover:opacity-100"

      style={{ backgroundColor: 'var(--c-card)', borderColor: 'var(--c-border)' }}

      title={REROLL_TEXT.title}

      aria-label={REROLL_TEXT.aria}

    >

      {/* Grid icon */}

      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>

        <rect x="3" y="3" width="18" height="18" rx="3" ry="3" fill="currentColor" />

        <circle cx="8" cy="8" r="1.6" fill="var(--c-bg)" />

        <circle cx="16" cy="8" r="1.6" fill="var(--c-bg)" />

        <circle cx="12" cy="12" r="1.6" fill="var(--c-bg)" />

        <circle cx="8" cy="16" r="1.6" fill="var(--c-bg)" />

        <circle cx="16" cy="16" r="1.6" fill="var(--c-bg)" />

      </svg>

    </button>

  );

};

  const renderCell = (p: PublicPlayer, key: keyof Hand) => {

  const isSelf = p.id === myClientId;

  const rerollBtn = renderRerollBtn(p.id, key);

  const bottomRow = (actionNode: ReactNode) => (

    <div className="mt-auto flex w-full items-center gap-2 pt-2">

      {actionNode}

      {rerollBtn ? <div className="ml-auto">{rerollBtn}</div> : null}

    </div>

  );

  if (isSelf && myHand) {

    const ability = isAbilityKey(key);

    const isHiddenForever = ability ? false : key === hiddenKey;

    const isRevealed = revealedKeys.includes(key);

    const isMyTurn = myClientId === currentPlayerId;

    const canOpen = !gameOver && !paused && (

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

    let actionNode: ReactNode;

    if (isRevealed) {

      actionNode = (

        <button disabled className={`${BTN_BASE} ${BTN_OPENED}`} title="Уже открыто">

          Открыто

        </button>

      );

    } else if (canOpen) {

      actionNode = (

        <button

          type="button"

          onClick={() => {

            if (!canOpen) return;

            setRevealedKeys(prev => (prev.includes(key) ? prev : [...prev, key]));

            revealKey(key);

            if (!ability) {

              setHasOpenedThisTurn(true);

              socketRef.current?.emit('game:nextTurn', { roomId });

            }

          }}

          className={`${BTN_BASE} ${BTN_ACTIVE}`}

          title={

            ability

              ? 'Спецвозможность: не считается в лимит раунда'

              : !hasRoundQuota

                ? `Лимит: ${myRevealedThisRound}/${round.quota}`

                : (mustRevealProfessionFirst && key !== 'profession')

                  ? 'На первом круге сначала открываем профессию'

                  : 'Открыть позицию'

          }

        >

          Открыть

        </button>

      );

    } else {

      actionNode = <div className={`${BTN_BASE} opacity-0 pointer-events-none`} aria-hidden />;

    }

    return (

      <div className={containerCls}>

        <div className="font-semibold break-words">{myHand[key]}</div>

        {bottomRow(actionNode)}

      </div>

    );

  }

  const revealedValue = p.revealed?.[key];

  const hostValue = hostHands[p.id]?.[key];
  const fullValue = p.hand?.[key];

  const shouldRevealForHost = showHostReveals && isHost;
  const displayValue = showAllReveals
    ? (fullValue ?? hostValue ?? revealedValue)
    : shouldRevealForHost
      ? (hostValue ?? revealedValue)
      : revealedValue;

  const hostOnlyHint = shouldRevealForHost && !showAllReveals && !revealedValue && hostValue;

  const actionPlaceholder = (

    <div className={`${BTN_BASE} ${BTN_DISABLED} opacity-0 pointer-events-none`} aria-hidden />

  );

  return (

    <div className={containerCls}>

      <span className={displayValue ? 'font-semibold' : 'text-gray-400'}>

        {displayValue ?? HIDDEN_TEXT}

      </span>

      {hostOnlyHint ? (
        <span className="mt-1 text-[11px] font-medium text-amber-300 select-none">{HOST_PANEL_TEXT.hostBadge}</span>
      ) : null}

      {bottomRow(actionPlaceholder)}

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

      className="modern-theme min-h-screen px-4 py-6 sm:px-6 lg:px-10 max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1760px] mx-auto space-y-10"


      style={{ color: 'var(--c-text)' }}

    >

      {/* ── Шапка: заголовок + шестерёнка + Вернуться в лобби ── */}

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10 bunker-panel metal-texture hover-glow p-6">

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-yellow-500">BUNKER</span>
          <span className="text-muted-foreground mx-2">—</span>
          <span className="text-foreground">Игра</span>
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-secondary/30 rounded-full floating-badge">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-yellow-500 font-semibold tracking-normal text-sm">{activeCount}</span>
            <span className="tracking-normal opacity-70">/</span>
            <span className="tracking-normal text-sm">{totalInLobby}</span>
            <span className="tracking-normal">игроков</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-secondary/30 rounded-full countdown-timer">
            <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2 1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="tracking-normal">
              {serverTurnSeconds > 0 ? `${serverTurnSeconds} сек` : 'без таймера'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-secondary/30 rounded-full">
            <span className="tracking-normal">Раунд</span>
            <span className="tracking-normal text-yellow-500 font-semibold">#{round.number}</span>
            {typeof round.quota === "number" && round.quota > 0 && (
              <span className="tracking-normal opacity-70">/ {round.quota}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* Шестерёнка: открывает панель */}

          <button

            onClick={() => setShowTopMenu(v => !v)}

            aria-label="Настройки"

            className="w-10 h-10 rounded bg-secondary/50 border border-border flex items-center justify-center transition-all duration-200 hover:bg-secondary/80"

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

            className="px-4 py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-lg transition-all duration-200"

          >

            Вернуться в лобби

          </button>

        </div>

      </div>

      {/* Боковая панель справа */}
      {portalReady && showTopMenu && createPortal(
        (
          <div className="fixed inset-0 z-[1040]">
            <button
              type="button"
              aria-label="Закрыть настройки"
              onClick={() => setShowTopMenu(false)}
              className="absolute inset-0 w-full h-full bg-black/45 backdrop-blur-sm"
            />
            <aside
              className="absolute inset-y-0 right-0 z-[1050] h-full w-full max-w-sm rust-panel bunker-panel metal-texture shadow-xl flex flex-col p-5 overflow-y-auto space-y-4"
              style={{ backgroundColor: 'var(--c-card)', borderLeft: '1px solid var(--c-border)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Настройки</h3>
                <button
                  onClick={() => setShowTopMenu(false)}
                  className="themed-btn w-8 h-8 flex items-center justify-center"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>

              <div className="text-sm space-y-2">
                <div>
                  Лобби: <b>{roomId}</b>
                </div>

                {hostId && (
                  <div>
                    Хост: <code className="text-xs">{hostId}</code>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push(`/game/${roomId}/intro?preview=1`)}
                className="w-full px-3 py-2 mb-2 rounded themed-btn"
              >
                Посмотреть интро
              </button>

              <button
                onClick={nextTheme}
                className="w-full px-3 py-2 rounded bg-secondary/40 hover:bg-secondary/70 transition-colors duration-200 themed-btn"
                title={`Сменить тему (текущая: ${theme})`}
              >
                Сменить тему
              </button>

              {hostId === myClientId && !gameOver && (
                <div className="mt-4 border-t border-[color:var(--c-border)] pt-4 space-y-4">
                  <h4 className="text-sm font-semibold opacity-80">Хост</h4>

                  <button
                    onClick={togglePause}
                    className="w-full px-3 py-2 rounded bg-secondary/40 hover:bg-secondary/70 transition-colors duration-200 themed-btn mt-2 disabled:opacity-60"
                    style={paused ? { backgroundColor: '#f59e0b', color: '#0b0b0f' } : undefined}
                    disabled={!started}
                    title={paused ? PAUSE_TEXT.resumeTitle : PAUSE_TEXT.pauseTitle}
                  >
                    {paused ? PAUSE_TEXT.resumeBtn : PAUSE_TEXT.pauseBtn}
                  </button>

                  {vote.phase === 'idle' && (
                    <button
                      onClick={() => { if (paused) return; startVoteSpeeches(); }}
                      className="w-full px-3 py-2 rounded bg-secondary/40 hover:bg-secondary/70 transition-colors duration-200 themed-btn mt-2 disabled:opacity-60"
                      title="Начать голосование: спичи → голосование"
                    >
                      Начать голосование
                    </button>
                  )}

                  <div className={HOST_PANEL_STYLES.card}>
                    <span className={HOST_PANEL_STYLES.header}>Настройки показа</span>

                    <div className={HOST_PANEL_STYLES.controlRow}>
                      <span className={HOST_PANEL_STYLES.label}>{REVEAL_HOST_TEXT.label}</span>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !showHostReveals;
                          setShowHostReveals(next);
                          if (!next) {
                            setHostHands({});
                          }
                          socketRef.current?.emit('game:revealAll:host', {
                            roomId,
                            enabled: next,
                          });
                        }}
                        className={`${HOST_PANEL_STYLES.buttonBase} ${showHostReveals ? HOST_PANEL_STYLES.buttonOn : HOST_PANEL_STYLES.buttonOff}`}
                        title={REVEAL_HOST_TEXT.tooltip}
                      >
                        {showHostReveals ? REVEAL_HOST_TEXT.disable : REVEAL_HOST_TEXT.enable}
                      </button>
                    </div>

                    <div className={HOST_PANEL_STYLES.controlRow}>
                      <span className={HOST_PANEL_STYLES.label}>{REVEAL_ALL_TEXT.label}</span>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !showAllReveals;
                          setShowAllReveals(next);
                          if (next) {
                            setShowHostReveals(false);
                            setHostHands({});
                          }
                          socketRef.current?.emit('game:revealAll:toggle', {
                            roomId,
                            enabled: next,
                          });
                        }}
                        className={`${HOST_PANEL_STYLES.buttonBase} ${showAllReveals ? HOST_PANEL_STYLES.buttonOn : HOST_PANEL_STYLES.buttonOff}`}
                        title={REVEAL_ALL_TEXT.tooltip}
                      >
                        {showAllReveals ? REVEAL_ALL_TEXT.disable : REVEAL_ALL_TEXT.enable}
                      </button>
                    </div>

                    <div className={HOST_PANEL_STYLES.controlRow}>
                      <span className={HOST_PANEL_STYLES.label}>{HOST_PANEL_TEXT.editorLabel}</span>

                      <button
                        type="button"
                        onClick={() =>
                          socketRef.current?.emit('game:editor:toggle', {
                            roomId,
                            enabled: !editorEnabled,
                          })
                        }
                        className={`${HOST_PANEL_STYLES.buttonBase} ${editorEnabled ? HOST_PANEL_STYLES.buttonOn : HOST_PANEL_STYLES.buttonOff}`}
                        title={HOST_PANEL_TEXT.editorTooltip}
                      >
                        {editorEnabled ? HOST_PANEL_TEXT.editorEnabled : HOST_PANEL_TEXT.editorDisabled}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        ),
        document.body,
      )}

      {cataclysm && (

        <section className="mb-10 relative overflow-hidden rounded-2xl border-2 border-red-800/50">
          {/* Кнопка "УГРОЗА" для перехода в превью интро */}
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={() => router.push(`/game/${roomId}/intro?preview=1`)}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold tracking-wide"
              title="Посмотреть интро"
            >
              УГРОЗА
            </button>
          </div>

          {/* Фоновое изображение без фильтров */}
          <div aria-hidden className="absolute inset-0 -z-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${cataclysm.image}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </div>

          {/* Текст поверх с тенью для читаемости */}
          <div className="px-6 md:px-10 lg:px-16 xl:px-24 py-10 text-center max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-5 text-red-500" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              {cataclysm.image.includes('outbreak') ? 'Пандемия' :
               cataclysm.image.includes('winter') ? 'Ядерная зима' :
               cataclysm.image.includes('biocloud') ? 'Биологическая угроза' :
               cataclysm.image.includes('nuclear-war') ? 'Ядерная война' :
               cataclysm.image.includes('meteor-impact') ? 'Падение метеорита' :
               cataclysm.image.includes('global-flood') ? 'Всемирный потоп' :
               cataclysm.image.includes('ai-rebellion') ? 'Восстание машин' :
               cataclysm.image.includes('solar-storm') ? 'Солнечная буря' :
               cataclysm.image.includes('deadly-virus') ? 'Смертельный вирус' :
               cataclysm.image.includes('alien-attack') ? 'Вторжение пришельцев' :
               cataclysm.image.includes('mega-quake') ? 'Мегаземлетрясение' :
               cataclysm.image.includes('super-volcano') ? 'Супервулкан' :
               cataclysm.image.includes('sun-expansion') ? 'Расширение Солнца' :
               cataclysm.image.includes('reality-glitch') ? 'Сбой реальности' :
               cataclysm.image.includes('grey-goo') ? 'Серая слизь' :
               cataclysm.image.includes('meme-apocalypse') ? 'Мем-апокалипсис' :
               cataclysm.image.includes('elder-gods') ? 'Пробуждение древних богов' :
               cataclysm.title}
            </h2>
            <p className="text-base md:text-lg leading-7 text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              {cataclysm.text}
            </p>
          </div>

          {/* Тонкая светящаяся линия сверху */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-600/0 via-red-600/50 to-red-600/0"></div>
        </section>

      )}

      {/* ===== Блок «Бункер» ===== */}

      {bunker && (
        <section
          className={`mb-12 bunker-panel metal-texture relative overflow-hidden ${bunkerCollapsed ? "p-6" : "p-8"}`}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 border border-yellow-500/20 rounded-full animate-pulse"></div>
            <div className="absolute bottom-8 left-8 w-24 h-24 border border-yellow-500/10 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-yellow-500/15 rounded-full animate-pulse delay-500"></div>
          </div>

          <div
            onClick={toggleBunker}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleBunker()}
            role="button"
            tabIndex={0}
            aria-expanded={!bunkerCollapsed}
            aria-controls="bunker-content"
            className="cursor-pointer select-none -m-2 p-2 rounded hover:bg-secondary/50 transition-all duration-300 relative z-10"
          >
            <h2 className="text-center text-4xl md:text-5xl font-extrabold mb-0 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 104 0 2 2 0 00-4 0zm6 0a2 2 0 104 0 2 2 0 00-4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-yellow-500 tracking-wider">БУНКЕР</span>
              </div>
              <span className="text-muted-foreground tracking-wider">КОМПЛЕКС</span>
              <span
                className={`transition-all duration-500 text-yellow-500 hover:scale-110 ${bunkerCollapsed ? "rotate-0" : "rotate-180"}`}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </h2>
          </div>

          {!bunkerCollapsed && (
            <div id="bunker-content" className="mt-8 relative z-10">
              <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-bold text-sm">СИСТЕМЫ АКТИВНЫ</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                  <span className="text-blue-400 font-bold text-sm">ЗАЩИТА ВКЛЮЧЕНА</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-700"></div>
                  <span className="text-yellow-400 font-bold text-sm">ГОТОВ К ЗАСЕЛЕНИЮ</span>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bunker-panel p-6 bg-gradient-to-r from-secondary/50 to-secondary/30 border-l-4 border-yellow-500">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-yellow-500">ОПИСАНИЕ КОМПЛЕКСА</h3>
                    </div>
                    <p className="text-lg leading-relaxed font-medium text-muted-foreground">
                      {bunker.description}
                    </p>
                  </div>

                  <div className="bunker-panel p-6 concrete-texture relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-500/10 to-transparent rounded-bl-full"></div>
                    <h3 className="text-lg font-semibold mb-6 text-yellow-500 flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      ОБОРУДОВАНИЕ БУНКЕРА
                      <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 font-bold">ОНЛАЙН</span>
                      </div>
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {bunker.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all duration-200 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30 group-hover:border-green-500/50 transition-colors">
                            <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg group-hover:animate-pulse"></div>
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-foreground group-hover:text-green-400 transition-colors">
                              {item}
                            </span>
                            <div className="text-xs text-muted-foreground mt-1">Статус: Активно</div>
                          </div>
                          <div className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center bunker-panel p-8 bg-gradient-to-br from-secondary/50 via-secondary/30 to-secondary/50 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5"></div>
                    <div className="relative z-10">
                      <div className="mb-4">
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                          <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                          <span className="text-yellow-500 font-bold">МАКСИМАЛЬНАЯ ВМЕСТИМОСТЬ</span>
                        </div>
                      </div>
                      <div className="text-6xl md:text-8xl font-extrabold mb-2">
                        <span className="text-yellow-500 animate-pulse">{bunker.places ?? 0}</span>
                      </div>
                      <div className="text-2xl text-muted-foreground font-bold tracking-wider">ЧЕЛОВЕК</div>
                      <div className="mt-4 text-sm text-muted-foreground">
                        Оптимальные условия для долгосрочного выживания
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const optimality = calculateBunkerOptimality(bunker, activePlayers.length);
                    return [
                      {
                        icon: "📐",
                        label: "Площадь бункера",
                        value: `${bunker.sizeM2} м²`,
                        color: optimality.area.isOptimal ? "text-green-400" : optimality.area.percentage >= 60 ? "text-yellow-400" : "text-red-400",
                        progress: optimality.area.percentage,
                        description: "Просторные помещения",
                        status: optimality.area.status,
                        isOptimal: optimality.area.isOptimal,
                      },
                      {
                        icon: "⏱️",
                        label: "Время выживания",
                        value: bunker.stayText,
                        color: optimality.survival.isOptimal ? "text-green-400" : optimality.survival.percentage >= 60 ? "text-yellow-400" : "text-red-400",
                        progress: optimality.survival.percentage,
                        description: "Автономное существование",
                        status: optimality.survival.status,
                        isOptimal: optimality.survival.isOptimal,
                      },
                      {
                        icon: "🍽️",
                        label: "Запасы провизии",
                        value: bunker.foodText,
                        color: optimality.supplies.isOptimal ? "text-green-400" : optimality.supplies.percentage >= 60 ? "text-yellow-400" : "text-red-400",
                        progress: optimality.supplies.percentage,
                        description: "Полноценное питание",
                        status: optimality.supplies.status,
                        isOptimal: optimality.supplies.isOptimal,
                      },
                    ];
                  })().map((stat, i) => (
                    <div
                      key={i}
                      className="bunker-panel p-6 metal-texture hover:scale-105 transition-all duration-300 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/80 flex items-center justify-center text-2xl border border-border group-hover:border-yellow-500/30 transition-colors shadow-lg">
                            {stat.icon}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-muted-foreground font-mono uppercase tracking-wide">
                              {stat.label}
                            </div>
                            <div
                              className={`font-bold text-xl ${stat.color} group-hover:text-yellow-400 transition-colors`}
                            >
                              {stat.value}
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted-foreground">{stat.description}</span>
                            <span className="text-xs font-bold text-yellow-500">{stat.progress}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                stat.isOptimal 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                  : stat.progress >= 60 
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                                    : 'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${stat.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full animate-pulse ${
                            stat.isOptimal 
                              ? 'bg-green-500' 
                              : stat.progress >= 60 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                          }`}></div>
                          <span className={`font-semibold ${
                            stat.isOptimal 
                              ? 'text-green-400' 
                              : stat.progress >= 60 
                                ? 'text-yellow-400' 
                                : 'text-red-400'
                          }`}>{stat.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="bunker-panel p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 hover:border-green-500/40 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-7 h-7 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L10 9.586 7.707 7.293a1 1 0 00-1.414 1.414L8.586 11l-2.293 2.293a1 1 0 101.414 1.414L10 12.414l2.293 2.293a1 1 0 001.414-1.414L11.414 11l2.293-2.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-green-500 mb-1">СИСТЕМА БЕЗОПАСНОСТИ</h4>
                        <p className="text-sm text-muted-foreground">Многоуровневая защита от внешних угроз</p>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 font-bold">АКТИВНА</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Радиационная защита</span>
                        <span className="text-green-400 font-bold">100%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Биологическая защита</span>
                        <span className="text-green-400 font-bold">100%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Химическая защита</span>
                        <span className="text-green-400 font-bold">100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mb-8 text-center bunker-panel p-6 metal-texture hover-glow rounded-lg border border-[color:var(--c-border)]">
        <h3 className="text-3xl md:text-4xl font-extrabold mb-2">
          <span className="text-white">Желающие попасть в бункер:</span>{" "}
          <span className="text-yellow-500 text-5xl font-bold">{activeCount}</span>
          <span className="text-white">/{totalInLobby}</span>
        </h3>
        <div className="text-sm text-white font-mono mt-2">
          Раунд {round.number}. Открыто вами: {round.quota === 0 ? myRevealedThisRound : `${myRevealedThisRound}/${round.quota}`}
        </div>
      </div>

{/* ===== Баннер голосования (показывается, если идёт голосование) ===== */}

{!gameOver && vote.phase !== 'idle' && (
    <div className="space-y-4">
      {vote.phase === 'speeches' && (
        <div className="mb-8 bunker-panel p-6 metal-texture danger-glow rounded-lg border border-[color:var(--c-border)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/90 border border-red-400 rounded text-xs font-bold text-white">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                АКТИВНЫЕ СПИЧИ
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 font-mono">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {Math.floor(speechSecondsLeft / 60)}:{(speechSecondsLeft % 60).toString().padStart(2, "0")}
            </div>
          </div>

          <div className="space-y-3">
            {(() => {
              const curId = vote.speechOrder?.[vote.speakingIdx ?? -1];
              const currentSpeaker = publicPlayers.find(p => p.id === curId);
              
              if (!currentSpeaker) return null;

              return (
                <div className="bunker-panel p-4 metal-texture hover-glow transition-all duration-200 rounded-lg border border-[color:var(--c-border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-2 border-[color:var(--c-border)] bg-[color:var(--c-card)] flex items-center justify-center overflow-hidden">
                          {currentSpeaker.avatarUrl ? (
                            <Image
                              src={currentSpeaker.avatarUrl}
                              alt={currentSpeaker.nick}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[color:var(--c-card)] border-2 border-[color:var(--c-border)] rounded-full flex items-center justify-center text-xs">
                          {currentSpeaker.revealed?.profession ? getProfessionIcon(currentSpeaker, currentSpeaker.revealed?.profession) : '?'}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`font-bold text-lg ${currentSpeaker.kicked ? 'line-through text-gray-400' : (winners.includes(currentSpeaker.id) ? 'text-emerald-400' : 'text-[color:var(--c-text)]')}`}>
                            {currentSpeaker.nick}
                            {currentSpeaker.id === myClientId ? " (вы)" : ""}
                          </div>
                        </div>

                        <div className="text-sm text-[color:var(--c-text)] opacity-80 mb-2">
                          {currentSpeaker.revealed?.profession || 'Профессия скрыта'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {speakingId === myClientId ? (
                        <button
                          onClick={() => socketRef.current?.emit('vote:speech:finish', { roomId })}
                          className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-semibold transition-all duration-200 hover:scale-105"
                        >
                          Закончить спич
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    {vote.phase === 'ballot' && (
        <div className="mb-8 bunker-panel p-6 metal-texture danger-glow rounded-lg border border-[color:var(--c-border)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/90 border border-red-400 rounded text-xs font-bold text-white">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                АКТИВНОЕ ГОЛОСОВАНИЕ
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 font-mono">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {Math.floor(ballotSecondsLeft / 60)}:{(ballotSecondsLeft % 60).toString().padStart(2, "0")}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {publicPlayers
              .filter(p => !p.kicked)
              .filter(p => {
                const allowed = Array.isArray(vote.allowedTargets) && vote.allowedTargets.length > 0
                  ? new Set(vote.allowedTargets)
                  : null;
                return !allowed || allowed.has(p.id);
              })
              .map(player => {
                const votes = vote.votes?.[player.id] ?? 0;
                const totalVoters = getKickTotalVoters(vote, publicPlayers.filter(u => !u.kicked).length);
                const percentage = totalVoters > 0 ? (votes / totalVoters) * 100 : 0;
                const hasVoted = Array.isArray(vote.votedBy) ? vote.votedBy.includes(myClientId) : false;
                const isCurrentUser = player.id === myClientId;

                return (
                  <div key={player.id} className="bunker-panel p-4 metal-texture hover-glow transition-all duration-200 rounded-lg border border-[color:var(--c-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-2 border-[color:var(--c-border)] bg-[color:var(--c-card)] flex items-center justify-center overflow-hidden">
                            {player.avatarUrl ? (
                              <Image
                                src={player.avatarUrl}
                                alt={player.nick}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[color:var(--c-card)] border-2 border-[color:var(--c-border)] rounded-full flex items-center justify-center text-xs">
                            {player.revealed?.profession ? getProfessionIcon(player, player.revealed?.profession) : '?'}
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`font-bold text-lg ${player.kicked ? 'line-through text-gray-400' : (winners.includes(player.id) ? 'text-emerald-400' : 'text-[color:var(--c-text)]')}`}>
                              {player.nick}
                              {isCurrentUser ? " (вы)" : ""}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs">
                              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-yellow-400 font-bold">{votes}</span>
                            </div>
                          </div>

                          <div className="text-sm text-[color:var(--c-text)] opacity-80 mb-2">
                            {player.revealed?.profession || 'Профессия скрыта'}
                          </div>

                          <div className="max-w-xs">
                            <div className="h-2 bg-[color:var(--c-card)] rounded-full overflow-hidden border border-[color:var(--c-border)]">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-xs text-[color:var(--c-text)] opacity-80 mt-1">{percentage.toFixed(0)}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isCurrentUser || hasVoted || meKicked ? (
                          <button
                            disabled
                            className="bg-[color:var(--c-card)] text-[color:var(--c-text)] opacity-60 px-4 py-2 rounded font-semibold cursor-not-allowed"
                          >
                            {isCurrentUser ? 'Нельзя' : hasVoted ? 'Голос учтён' : 'Исключён'}
                          </button>
                        ) : (
                          <button
                            onClick={() => castVote(player.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-semibold transition-all duration-200 hover:scale-105"
                          >
                            Голосовать
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="text-center text-sm text-[color:var(--c-text)] opacity-80">
            До завершения: {Math.floor(ballotSecondsLeft / 60)}:{(ballotSecondsLeft % 60).toString().padStart(2, "0")}s
          </div>
        </div>
      )}

  </div>

)}

    {/* ===== Финальный хот-бар: показывается после завершения игры ===== */}

{gameOver && (

  <div className="mb-8 relative overflow-hidden">
    {/* Анимированный фон */}
    <div className={`absolute inset-0 animate-pulse ${
      winners.includes(myClientId) 
        ? "bg-gradient-to-r from-green-900/20 via-emerald-800/30 to-green-900/20" 
        : "bg-gradient-to-r from-red-900/20 via-red-800/30 to-red-900/20"
    }`}></div>
    <div className={`absolute inset-0 ${
      winners.includes(myClientId)
        ? "bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_70%)]"
        : "bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent_70%)]"
    }`}></div>
    
    {/* Основной контент */}
    <div className={`relative bg-secondary/40 backdrop-blur-sm rounded-xl p-8 shadow-2xl ${
      winners.includes(myClientId) 
        ? "border border-green-500/30" 
        : "border border-red-500/30"
    }`}>
      {/* Заголовок с иконкой */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            {winners.includes(myClientId) ? (
              <>
                <svg className="w-8 h-8 text-green-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="absolute inset-0 bg-green-400/20 rounded-full blur-xl"></div>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-red-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <div className="absolute inset-0 bg-red-400/20 rounded-full blur-xl"></div>
              </>
            )}
          </div>
          <div>
            <h2 className={`text-2xl font-bold bg-clip-text text-transparent ${
              winners.includes(myClientId)
                ? "bg-gradient-to-r from-green-400 to-emerald-300"
                : "bg-gradient-to-r from-red-400 to-red-300"
            }`}>
              {winners.includes(myClientId) ? "Вы прошли в бункер!" : "Вы не прошли в бункер"}
            </h2>
            <p className={`text-sm font-medium ${
              winners.includes(myClientId) ? "text-green-300/80" : "text-red-300/80"
            }`}>{publicPlayers.find(p => p.id === myClientId)?.nick ?? nick}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground font-mono mb-1">Статус игры</div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
            winners.includes(myClientId)
              ? "bg-green-500/20 border border-green-500/30"
              : "bg-red-500/20 border border-red-500/30"
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              winners.includes(myClientId) ? "bg-green-400" : "bg-red-400"
            }`}></div>
            <span className={`text-sm font-semibold ${
              winners.includes(myClientId) ? "text-green-300" : "text-red-300"
            }`}>Игра завершена</span>
          </div>
        </div>
      </div>

      {/* Центральная секция с достижением */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 mb-4 relative ${
          winners.includes(myClientId)
            ? "bg-gradient-to-br from-green-400/20 to-emerald-500/20 border-green-400/30"
            : "bg-gradient-to-br from-red-400/20 to-red-500/20 border-red-400/30"
        }`}>
          {winners.includes(myClientId) ? (
            <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-12 h-12 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          <div className={`absolute inset-0 rounded-full animate-ping ${
            winners.includes(myClientId) ? "bg-green-400/10" : "bg-red-400/10"
          }`}></div>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          {winners.includes(myClientId) ? "Поздравляем с победой!" : "К сожалению, вы проиграли"}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {winners.includes(myClientId) 
            ? "Вы успешно прошли все испытания и заслужили место в бункере. Ваша стратегия и решения привели к победе!"
            : "Вы не смогли пройти все испытания. Другие игроки оказались более убедительными в своих аргументах."
          }
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-secondary/30 rounded-lg border border-border">
          {winners.includes(myClientId) ? (
            <svg className="w-6 h-6 text-yellow-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM8 15a1 1 0 11-2 0 1 1 0 012 0zm4 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          <div className="text-lg font-bold text-foreground">
            {winners.includes(myClientId) ? "Победитель" : "Проигравший"}
          </div>
          <div className="text-sm text-muted-foreground">Статус</div>
        </div>
        <div className="text-center p-4 bg-secondary/30 rounded-lg border border-border">
          {winners.includes(myClientId) ? (
            <svg className="w-6 h-6 text-blue-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-muted-foreground mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
          <div className="text-lg font-bold text-foreground">
            {winners.includes(myClientId) ? "Выжил" : "Исключен"}
          </div>
          <div className="text-sm text-muted-foreground">Результат</div>
        </div>
        <div className="text-center p-4 bg-secondary/30 rounded-lg border border-border">
          {winners.includes(myClientId) ? (
            <svg className="w-6 h-6 text-green-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L10 9.586 7.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          <div className="text-lg font-bold text-foreground">
            {winners.includes(myClientId) ? "В бункере" : "Вне бункера"}
          </div>
          <div className="text-sm text-muted-foreground">Местоположение</div>
        </div>
      </div>

      {/* Список победителей */}
      {!winners.includes(myClientId) && winners.length > 0 && (
        <div className="mt-8 p-4 bg-secondary/20 rounded-lg border border-border">
          <h4 className="text-lg font-semibold text-emerald-400 mb-3 text-center">
            В бункер успешно прошли:
          </h4>
          <div className="flex flex-wrap justify-center gap-2">
            {publicPlayers
              .filter(p => winners.includes(p.id))
              .map(p => (
                <span key={p.id} className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-sm font-medium">
                  {p.nick}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  </div>

)}

      {/* ===== Голосование за пропуск — панель/уведомление (вставляется только при видимости) ===== */}

 {!gameOver && vote.phase === 'idle' && currentPlayerId && isSkipPanelVisible && (
  <div className="mb-6 bunker-panel p-6 metal-texture hover-glow rounded-lg border border-[color:var(--c-border)]">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex-1">
        {showSkipNotice ? (
          <div className="w-full text-center font-semibold">
            {skipNoticeText}
          </div>
        ) : (
          <>
            <div className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-[color:var(--c-text)] opacity-80">ЭКСТРЕННЫЙ ПРОПУСК ХОДА:</span>
              <span className="text-yellow-500 font-bold">{currentTurnNick || '—'}</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-yellow-500 font-bold text-lg">{voteSkip.votes}</span>
              <span className="text-[color:var(--c-text)] opacity-80">из</span>
              <span className="text-[color:var(--c-text)] font-bold">{voteSkip.total}</span>
              <span className="text-[color:var(--c-text)] opacity-80">•</span>
              <span className="text-[color:var(--c-text)] opacity-80">требуется:</span>
              <span className="text-yellow-500 font-bold">{voteSkip.needed}</span>
            </div>
            <div className="h-3 bg-[color:var(--c-card)] rounded-full overflow-hidden border border-[color:var(--c-border)]">
              <div
                className="h-full bg-yellow-600 transition-all duration-500 rounded-full"
                style={{
                  width: voteSkip.total > 0
                    ? `${Math.min(100, Math.round((voteSkip.votes / voteSkip.total) * 100))}%`
                    : '0%'
                }}
              />
            </div>
          </>
        )}
      </div>
      {!showSkipNotice && (
        <div className="shrink-0">
          {isMyTurnNow || meKicked || paused ? (
            <div className="text-sm opacity-70 select-none">
              {meKicked ? 'Исключённые не голосуют' : 
               paused ? 'Игра на паузе' : 
               'Игрок на ходу не голосует'}
            </div>
          ) : (
            <button
              onClick={() => {
                const wantVote = !voteSkip.voters.includes(myClientId);
                setVoteSkip(prev => {
                  const nextVoters = wantVote
                    ? [...prev.voters, myClientId]
                    : prev.voters.filter(v => v !== myClientId);
                  return { ...prev, voters: nextVoters, votes: nextVoters.length };
                });
                socketRef.current?.emit('game:voteSkip', { roomId, vote: wantVote });
              }}
              className={`
                px-6 py-3 rounded font-bold transition-all duration-200 whitespace-nowrap hover:scale-105
                ${voteSkip.voters.includes(myClientId)
                  ? 'bg-yellow-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-black'}
              `}
            >
              {voteSkip.voters.includes(myClientId) ? 'ОТМЕНИТЬ ГОЛОС' : 'ГОЛОСОВАТЬ ЗА ПРОПУСК'}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
)}

      {/* Таблица */}

<div className="bunker-panel overflow-hidden mb-8 metal-texture">
  <div className="bg-secondary/50 px-6 py-4 border-b border-border">
    <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
      УЧАСТНИКИ БУНКЕРА
    </h3>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-border bg-secondary/30">
          <th className="text-left p-4 font-semibold text-yellow-500">Игрок</th>
          {COLS.map((col) => (
            <th key={col.key} className="text-left p-4 font-semibold text-yellow-500">
              {col.title}
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
          [...publicPlayers]
            .sort((a, b) => {
              // Кикнутые игроки внизу
              if (a.kicked && !b.kicked) return 1;
              if (!a.kicked && b.kicked) return -1;
              // Победители вверху среди активных
              if (gameOver) {
                const aIsWinner = winners.includes(a.id);
                const bIsWinner = winners.includes(b.id);
                if (aIsWinner && !bIsWinner) return -1;
                if (!aIsWinner && bIsWinner) return 1;
              }
              return 0;
            })
            .map((p) => {
            const isWinner = gameOver && winners.includes(p.id);

            return (
              <tr
                key={p.id}
                className={`border-b border-border hover-glow transition-all duration-200 ${
                  p.kicked ? "opacity-60 bg-gray-500/10" :
                  (vote.phase === 'idle' && p.id === currentPlayerId) ? "bg-yellow-500/10 border-yellow-500/30" :
                  (vote.phase !== 'idle' && speakingId === p.id ? "bg-blue-500/10 border-blue-500/30" : "")
                }`}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center overflow-hidden" style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}>
                        {p.avatarUrl ? (
                          <Image
                            src={p.avatarUrl}
                            alt={p.nick}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>👤</span>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary border-2 border-background rounded-full flex items-center justify-center text-xs">
                        {getProfessionIcon(p, p.revealed?.profession)}
                      </div>
                    </div>
                    <div>
                      <div className={`font-semibold ${p.kicked ? 'line-through text-gray-400' : (isWinner ? 'text-emerald-400' : 'text-foreground')}`}>
                        {p.nick}
                        {p.id === hostId ? ' 👑' : ''}
                      </div>
                      {p.id === currentPlayerId && vote.phase === 'idle' && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span className="text-yellow-500 font-bold">АКТИВЕН</span>
                          <span className="text-muted-foreground">({serverTurnSeconds}s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {COLS.map((col) => (
                  <td key={col.key} className="p-4 text-sm">
                    {renderCell(p, col.key)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
</div>

      {/* 👇 NEW: подпись «кто ходит» под основной таблицей */}

      <div className="text-center mt-3 text-sm opacity-90 hidden" aria-hidden>

        Ходит ={' '}

        <b>{publicPlayers.find(u => u.id === currentPlayerId)?.nick ?? '—'}</b>

      </div>
      

{/* ===== Заголовок «Результат последнего голосования» как у «Спец возможности» ===== */}

{lastVote && Object.keys(lastVote.totals || {}).length > 0 && (

  <>

    <div className="bunker-panel overflow-hidden mb-8 metal-texture">
      <div
        onClick={toggleLastVote}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleLastVote()}
        role="button"
        tabIndex={0}
        aria-controls="lastvote-panel"
        aria-expanded={!lastVoteCollapsed}
        className="bg-secondary/50 px-6 py-4 border-b border-border cursor-pointer hover:bg-secondary/70 transition-colors"
      >
        <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              clipRule="evenodd"
            />
          </svg>
          ИТОГИ ПОСЛЕДНЕГО ГОЛОСОВАНИЯ
          <span className={`ml-auto transition-transform duration-300 ${lastVoteCollapsed ? "" : "rotate-180"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </h3>
      </div>

      {!lastVoteCollapsed && (
        <div id="lastvote-panel" className="p-6">
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
                  <div key={playerId} className="bg-secondary/30 border border-border rounded-lg p-4 hover:bg-secondary/50 transition-all duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-foreground text-lg">{nick}</span>
                      <span className="text-2xl font-bold text-yellow-500">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-4 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-orange-500 to-yellow-500"
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between items-center text-sm text-muted-foreground">
                      <span>{Number(count)} голос{Number(count) === 1 ? '' : Number(count) < 5 ? 'а' : 'ов'}</span>
                      {votersList && <span className="text-xs opacity-70">{votersList}</span>}
                    </div>
                  </div>
                );
              })}
          </div>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Всего проголосовало: {Object.values(lastVote.totals).reduce((x, y) => (x as number) + (y as number), 0)} участников
          </div>
        </div>
      )}
    </div>

  </>

)}

      {/* ===== Спец возможности — кнопка управления вплотную к таблице ===== */}

{/* ===== Заголовок «Спец возможности» с обводкой как у таблицы ===== */}

<div className="bunker-panel overflow-hidden mb-8 concrete-texture">
        <div
          onClick={toggleAbilities}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleAbilities()}
          role="button"
          tabIndex={0}
          aria-controls="abilities-table"
          aria-expanded={!abilitiesCollapsed}
          className="bg-secondary/50 px-6 py-4 border-b border-border cursor-pointer hover:bg-secondary/70 transition-colors"
        >
          <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            СПОСОБНОСТИ УЧАСТНИКОВ
            <span className={`ml-auto transition-transform duration-300 ${abilitiesCollapsed ? "" : "rotate-180"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </h3>
        </div>

        {!abilitiesCollapsed && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 font-semibold text-yellow-500">Игрок</th>
                  {COLS_ABILITIES.map((col) => (
                    <th key={col.key} className="text-left p-4 font-semibold text-yellow-500">
                      {col.title}
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
                  publicPlayers.map((player) => (
                    <tr key={player.id} className="border-b border-border hover-glow transition-all duration-200">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full border-2 border-border flex items-center justify-center overflow-hidden ${player.kicked ? 'opacity-60 grayscale' : ''}`} style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-card)' }}>
                              {player.avatarUrl ? (
                                <Image
                                  src={player.avatarUrl}
                                  alt={player.nick}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>👤</span>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary border-2 border-background rounded-full flex items-center justify-center text-xs">
                              {getProfessionIcon(player, player.revealed?.profession)}
                            </div>
                          </div>
                          <div>
                            <div className={`font-semibold ${player.kicked ? 'line-through text-gray-400' : (gameOver && winners.includes(player.id) ? 'text-emerald-400' : 'text-foreground')}`}>
                              {player.nick}
                              {player.id === hostId ? ' 👑' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      {COLS_ABILITIES.map((col) => (
                        <td key={col.key} className="p-4 text-sm">
                          {renderCell(player, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

{paused && !gameOver && (

  <div

    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 sm:px-8 py-5 sm:py-6 rounded-xl border shadow-xl text-amber-50"

    style={{

      background: 'linear-gradient(140deg, rgba(120, 53, 15, 0.92), rgba(69, 26, 3, 0.92))',

      borderColor: 'var(--c-border)'

    }}

    role="status"

    aria-live="polite"

  >

    <div className="text-center space-y-3">

      <div className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-amber-200">

        {PAUSE_TEXT.overlayTitle}

      </div>

      <div className="text-sm sm:text-base font-medium opacity-90 leading-relaxed">

        {isHost ? PAUSE_TEXT.hostHint : PAUSE_TEXT.playerHint}

      </div>

      {isHost && (

        <button

          type="button"

          onClick={togglePause}

          className="inline-flex items-center justify-center rounded-lg themed-btn px-5 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

          aria-label={PAUSE_TEXT.resumeTitle}

        >

          {PAUSE_TEXT.resumeBtn}

        </button>

      )}

    </div>

  </div>

)}

{gameOver && cleanupAt && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 duration-500 mx-4 w-full max-w-md sm:max-w-lg">
            {/* Анимированный фон */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 via-red-800/30 to-orange-900/20 animate-pulse rounded-xl"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.1),transparent_70%)] rounded-xl"></div>
            
            {/* Основной контент */}
            <div className="relative bg-secondary/90 backdrop-blur-md rounded-xl border border-orange-500/40 shadow-2xl px-8 sm:px-12 py-5 sm:py-6">
              {/* Свечение вокруг виджета */}
              <div className="absolute inset-0 bg-orange-400/5 rounded-xl blur-xl"></div>
              
              <div className="relative text-center">
                {/* Иконка и заголовок */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="relative">
                    <svg className="w-6 h-6 text-orange-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-md"></div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400">
                    Игра завершена
                  </div>
                </div>
                
                {/* Таймер */}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <svg className="w-4 h-4 text-orange-300/80" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <div className="text-base sm:text-lg text-orange-200/90">
                    Автовыход в лобби через
                  </div>
                </div>
                
                {/* Большой таймер */}
                <div className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/30 rounded-lg mb-3">
                  <span className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-orange-300 animate-pulse">
                    {String(Math.floor((cleanupLeft ?? 0) / 60)).padStart(2, '0')}:
                    {String((cleanupLeft ?? 0) % 60).padStart(2, '0')}
                  </span>
                </div>
                
                {/* Прогресс бар */}
                <div className="w-full bg-secondary/50 rounded-full h-3 mb-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000 ease-linear animate-pulse"
                    style={{ width: `${((120 - (cleanupLeft ?? 0)) / 120) * 100}%` }}
                  ></div>
                </div>
                
                {/* Дополнительная информация */}
                <div className="text-sm text-orange-300/60 font-medium">
                  Подготовка к возврату в главное меню...
                </div>
              </div>
              
              {/* Декоративные элементы */}
              <div className="absolute top-2 right-2 w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
              <div className="absolute bottom-2 left-2 w-1 h-1 bg-red-400 rounded-full animate-pulse"></div>
            </div>
          </div>

  )}

    </main>

  );

}












