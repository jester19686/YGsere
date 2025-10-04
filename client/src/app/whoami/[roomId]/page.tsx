'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { getSocket, getClientId } from '@/lib/socket'; // 👈 добавили getClientId

type Hand = {
  gender: string;
  body: string;
  trait: string;        // 👈 показываем только это поле
  profession: string;
  health: string;
  hobby: string;
  phobia: string;
  bigItem: string;
  backpack: string;
  extra: string;
};
type GameYou = { hand: Hand; hiddenKey: keyof Hand | null; revealedKeys: (keyof Hand)[] };
type PublicPlayer = { id: string; nick: string; avatarUrl?: string | null; revealed: Partial<Hand> };
type GameStatePayload = { roomId: string; phase: 'reveal'; players: PublicPlayer[] };

type PresencePlayer = { id: string; nick: string };
type RoomStatePayload = {
  roomId: string;
  hostId: string | null;
  started: boolean;
  maxPlayers: number;
  players: PresencePlayer[];
};

const LS_NICK = 'bunker:nick';
const LS_ROOM = 'bunker:lastRoom';
const LS_STAY_LOBBY = 'bunker:stayInLobby';

export default function WhoAmIPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();

  const [nick, setNick] = useState<string>('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [started, setStarted] = useState<boolean>(false);

  const [myHand, setMyHand] = useState<Hand | null>(null);
  const [hiddenKey, setHiddenKey] = useState<keyof Hand | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<(keyof Hand)[]>([]);
  const [publicPlayers, setPublicPlayers] = useState<PublicPlayer[]>([]);

  const socketRef = useRef<Socket | null>(null);
  // const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

  // ник
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LS_NICK) : null;
    if (!saved) { router.replace('/'); return; }
    setNick(saved);
  }, [router]);

  // запоминаем код лобби
  useEffect(() => {
    try { window.localStorage.setItem(LS_ROOM, String(roomId)); } catch {}
  }, [roomId]);

  // подключение и синхронизация
  useEffect(() => {
    if (!nick) return;

    const s = getSocket();
    socketRef.current = s;

    const joinAndSync = () => {
      try {
        const av = typeof window !== 'undefined' ? window.localStorage.getItem('bunker:avatar') : null;
        s.emit('joinRoom', { roomId, nick, clientId: getClientId(), avatarUrl: av || undefined }); // 👈 передаём clientId + avatar
      } catch {
        s.emit('joinRoom', { roomId, nick, clientId: getClientId() });
      }
      s.emit('room:getState', { roomId });
      s.emit('game:sync', { roomId });
    };

    const onConnect = () => { joinAndSync(); };

    const onRoomState = (p: RoomStatePayload) => {
      setHostId(p.hostId);
      setStarted(p.started);
    };

    const onGameState = (p: GameStatePayload) => {
      setPublicPlayers(p.players);
    };

    const onGameYou = (p: GameYou) => {
      setMyHand(p.hand);
      setHiddenKey(p.hiddenKey ?? null);
      setRevealedKeys(p.revealedKeys);
    };

    s.on('connect', onConnect);
    s.on('room:state', onRoomState);
    s.on('game:state', onGameState);
    s.on('game:you', onGameYou);

    if (s.connected) joinAndSync();

    return () => {
      s.off('connect', onConnect);
      s.off('room:state', onRoomState);
      s.off('game:state', onGameState);
      s.off('game:you', onGameYou);
    };
  }, [roomId, nick]);

  // открыть только одну характеристику (trait)
  const revealTrait = () =>
    socketRef.current?.emit('game:revealKey', { roomId, key: 'trait' as const });

  // назад в лобби
  const backToLobby = () => {
    try { window.localStorage.setItem(LS_STAY_LOBBY, '1'); } catch {}
    router.push('/');
  };

  // кнопки
  const BTN_BASE = 'h-8 w-full max-w-full text-[12px] rounded transition-colors';
  const BTN_ACTIVE = 'bg-indigo-600 text-white hover:bg-indigo-500';
  const BTN_DISABLED = 'bg-gray-700 text-gray-400 cursor-not-allowed';
  const BTN_OPENED = 'bg-emerald-600 text-white cursor-default';

  const renderRow = (p: PublicPlayer) => {
    const selfId = socketRef.current?.id;
    const isSelf = !!selfId && p.id === selfId;
    const cellWrap = 'min-h-[88px] flex flex-col justify-between whitespace-normal break-words min-w-0 overflow-hidden';

    if (isSelf && myHand) {
      const isRevealed = revealedKeys.includes('trait');
      const isHiddenForever = hiddenKey === 'trait';
      const canOpen = started && !isHiddenForever && !isRevealed;

      return (
        <tr key={p.id} className="border-t border-gray-800 align-top">
          <td className="px-4 py-4">
            <div className="font-medium">{p.nick}{p.id === hostId ? ' 👑' : ''}</div>
            <div className="text-xs text-gray-500 break-words">id: {p.id}</div>
          </td>
          <td className="px-4 py-4">
            <div className={cellWrap}>
              <div className="font-semibold">{myHand.trait}</div>
              <button
                onClick={revealTrait}
                disabled={!canOpen}
                className={`${BTN_BASE} ${isRevealed ? BTN_OPENED : (canOpen ? BTN_ACTIVE : BTN_DISABLED)}`}
              >
                {isRevealed ? 'Открыто' : 'Открыть для всех'}
              </button>
            </div>
          </td>
        </tr>
      );
    }

    const val = p.revealed?.trait;
    return (
      <tr key={p.id} className="border-t border-gray-800 align-top">
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex items-center justify-center">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt={p.nick} className="w-full h-full object-cover" />
              ) : (
                <span>👤</span>
              )}
            </div>
            <div className="font-medium">{p.nick}{p.id === hostId ? ' 👑' : ''}</div>
          </div>
          <div className="text-xs text-gray-500 break-words">id: {p.id}</div>
        </td>
        <td className="px-4 py-4">
          <div className={cellWrap}>
            <span className={val ? 'font-semibold' : 'text-gray-400'}>
              {val ?? 'закрыто'}
            </span>
            <div className={`${BTN_BASE} ${BTN_DISABLED} opacity-0 pointer-events-none`} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen p-6 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl font-bold">Кто я? — игра</h1>
        <div className="text-right">
          <div className="text-sm">
            Лобби: <b>{roomId}</b>{hostId ? <> · Хост: <code className="text-xs">{hostId}</code></> : null}
          </div>
          <button onClick={backToLobby} className="mt-2 px-3 py-2 rounded bg-gray-700 text-white">
            Вернуться в лобби
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-700 overflow-x-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-900/60">
            <tr className="text-left">
              <th className="px-4 py-3 w-[220px]">Имя</th>
              <th className="px-4 py-3">Характеристика</th>
            </tr>
          </thead>
        <tbody>
          {publicPlayers.length === 0 ? (
            <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Пока пусто.</td></tr>
          ) : (
            publicPlayers.map(renderRow)
          )}
        </tbody>
        </table>
      </div>
    </main>
  );
}
