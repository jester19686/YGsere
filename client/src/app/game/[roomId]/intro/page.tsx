'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { getSocket, getClientId } from '@/lib/socket';
import '@/styles/themes.css';

type BunkerInfo = {
  description: string;
  items: string[];
  sizeM2: number;
  stayText: string;
  foodText: string;
  places?: number;
};

type Cataclysm = { title: string; text: string; image: string };

type GameStatePayload = {
  roomId: string;
  phase: 'reveal';
  players: unknown[];     // без any
  bunker?: BunkerInfo;
  cataclysm?: Cataclysm;
};

const LS_THEME = 'bunker:theme';
const LS_INTRO_SHOWN = 'bunker:introShown';
const LS_STAY_LOBBY = 'bunker:stayInLobby';
const LS_AUTORUN_DONE = 'bunker:autoRedirectDone';
const LS_NICK = 'bunker:nick';
const LS_ROOM = 'bunker:lastRoom';





const THEMES = ['amber', 'lobby'] as const;
type ThemeName = typeof THEMES[number];
const isThemeName = (v: unknown): v is ThemeName =>
  (THEMES as readonly string[]).includes(String(v));

export default function GameIntroPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const isPreview = search.get('preview') === '1'; // режим предпросмотра пролога

  const [theme, setTheme] = useState<ThemeName>('lobby');
  const [cataclysm, setCataclysm] = useState<Cataclysm | null>(null);
  const [bunker, setBunker] = useState<BunkerInfo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);

  const [skipIntro, setSkipIntro] = useState<boolean>(false); // если уже смотрели — не показываем

  const socketRef = useRef<Socket | null>(null);
  // const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  const myClientId = getClientId();

  


  // Сохраняем комнату в LS, чтобы ре-джойн после F5 был гарантирован
useEffect(() => {
  try { localStorage.setItem(LS_ROOM, String(roomId)); } catch {}
}, [roomId]);


  // тема из LS + на body
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LS_THEME);
      if (isThemeName(saved)) setTheme(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      document.body.classList.add('theme-bg');
      document.body.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  // 👉 Проверка: если интро уже просмотрено — сразу в игру (НО не в preview-режиме)
  useEffect(() => {
    if (!roomId || isPreview) return;
    try {
      const introKey = `${LS_INTRO_SHOWN}:${roomId}`;
      const seen = window.localStorage.getItem(introKey);
      if (seen === '1') {
        setSkipIntro(true);
        router.replace(`/game/${roomId}`);
      }
    } catch {}
  }, [roomId, router, isPreview]);


  // ⛳ Зафиксировать, что автопереход отработал для этой комнаты, и снять "остаться в лобби"
useEffect(() => {
  if (!roomId) return;
  try {
    localStorage.setItem(`${LS_AUTORUN_DONE}:${roomId}`, '1');
    localStorage.removeItem(LS_STAY_LOBBY);
  } catch {}
}, [roomId]);


  // сокет: join + sync, забираем cataclysm/bunker (если интро показываем или preview)
  useEffect(() => {
    if (skipIntro) return;

    const s = getSocket();
    socketRef.current = s;

    const joinAndSync = () => {
   let savedNick = 'guest';
   try {
     const n = localStorage.getItem(LS_NICK);
     if (n && n.trim()) savedNick = n.trim();
   } catch {}
   try {
     const av = typeof window !== 'undefined' ? localStorage.getItem('bunker:avatar') : null;
     s.emit('joinRoom', { roomId, nick: savedNick, clientId: myClientId, avatarUrl: av || undefined });
   } catch {
     s.emit('joinRoom', { roomId, nick: savedNick, clientId: myClientId });
   }
   s.emit('room:getState', { roomId });
   s.emit('game:sync', { roomId });
 };

    const onGameState = (p: GameStatePayload) => {
      if (p.cataclysm) setCataclysm(p.cataclysm);
      if (p.bunker) setBunker(p.bunker);
    };

    s.on('game:state', onGameState);
    s.on('connect', joinAndSync);
    if (s.connected) joinAndSync();

    return () => {
      s.off('connect', joinAndSync);
    };
  }, [roomId, myClientId, skipIntro]);

  // таймер автоперехода (НЕ запускаем в preview-режиме)
  useEffect(() => {
    if (skipIntro || isPreview) return;

    const t = setInterval(() => setSecondsLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    const go = setTimeout(() => {
      try {
        const introKey = `${LS_INTRO_SHOWN}:${roomId}`;
        window.localStorage.setItem(introKey, '1');
      } catch {}
      router.push(`/game/${roomId}`);
    }, 60000);

    return () => {
      clearInterval(t);
      clearTimeout(go);
    };
  }, [router, roomId, skipIntro, isPreview]);

  const onContinue = () => {
    // В preview-режиме не пишем в LS и просто идём в игру
    if (isPreview) {
      router.push(`/game/${roomId}`);
      return;
    }
    try {
      const introKey = `${LS_INTRO_SHOWN}:${roomId}`;
      window.localStorage.setItem(introKey, '1'); // пометили как просмотренное
    } catch {}
    router.push(`/game/${roomId}`);
  };

  // Если интро пропускаем — ничего не рендерим (редирект уже выполняется)
  if (skipIntro) return null;

  // ======== Фуллскрин фон + оверлей контента (и для обычного, и для preview) ========
  return (
    <main
      data-theme={theme}
      className="relative h-[100dvh] w-full overflow-hidden"
      style={{ color: 'var(--c-text)' }}
    >
      {/* Фон-картинка на весь экран */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: cataclysm ? `url('${cataclysm.image}')` : 'none',
          filter: 'brightness(.8)',
        }}
      />
      {/* затемнение / виньетка + лёгкий blur */}
      <div className="absolute inset-0 bg-black/45" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,.7) 100%)',
        }}
      />
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      {/* Контент поверх (адаптивная колонка, центр по вертикали, с прокруткой, если не влезает) */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div className="w-full max-w-4xl mx-auto">
          {/* Заголовок */}
          <h1 className="text-center text-3xl md:text-4xl font-extrabold mb-4">
            Катаклизм{isPreview ? ' — предпросмотр' : ''}
          </h1>

          {/* Описание катаклизма */}
          <div className="rust-panel rounded-xl p-5 md:p-7 mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              {cataclysm?.title ?? '...'}
            </h2>
            <p className="text-base md:text-lg leading-7 whitespace-pre-line opacity-90">
              {cataclysm?.text ?? 'Загрузка описания катаклизма…'}
            </p>
          </div>

          {/* Краткий блок про бункер */}
          <div className="rust-panel rounded-xl p-5 md:p-6 mb-6">
            <div className="text-sm opacity-80 mb-1">Бункер</div>
            <div className="font-semibold mb-4">
              {bunker?.description ?? 'Описание бункера загружается…'}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="opacity-70">Площадь</div>
                <div className="font-semibold">{bunker?.sizeM2 ?? '—'} м²</div>
              </div>
              <div>
                <div className="opacity-70">Время</div>
                <div className="font-semibold">{bunker?.stayText ?? '—'}</div>
              </div>
              <div>
                <div className="opacity-70">Провизия</div>
                <div className="font-semibold">{bunker?.foodText ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Кнопка «Продолжить» по центру */}
          <div className="flex justify-center">
            <button
              onClick={onContinue}
              className="themed-btn px-6 py-3 rounded-lg text-[15px]"
              title={isPreview ? 'Перейти в игру (без записи)' : 'Перейти к игре'}
            >
              {isPreview
                ? 'В игру'
                : `Продолжить ${secondsLeft > 0 ? `(${secondsLeft})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
