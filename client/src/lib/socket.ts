
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  if (typeof window === 'undefined') {
    throw new Error('getSocket() должен вызываться только в браузере');
  }
  socket = io(WS_URL, {
    path: '/socket.io',           // матчит nginx location /socket.io/
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    auth: { clientId: getClientId() },
  });
  return socket;
}

export function closeSocket() {
  if (socket) { socket.close(); socket = null; }
}


const LS_CLIENT_ID = 'bunker:clientId';
export function getClientId(): string {
  if (typeof window === 'undefined') return 'srv';
  try {
    const cached = localStorage.getItem(LS_CLIENT_ID);
    if (cached) return cached;
    const id = createClientId();
    localStorage.setItem(LS_CLIENT_ID, id);
    return id;
  } catch {
    const id = createClientId();
    try { localStorage.setItem(LS_CLIENT_ID, id); } catch {}
    return id;
  }
}



// Авто-детект адреса WebSocket: env → текущий origin → localhost:4000
const WS_URL: string = (() => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    const { protocol, hostname, host, port } = window.location;
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    // dev-удобство: если фронт на 3000 (localhost), сокеты — на 4000
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && (port === '' || port === '3000')) {
      return `${wsProto}//${hostname}:4000`;
    }
    return `${wsProto}//${host}`;
  }
  // SSR: не создаём URL для клиента — вернём dev-порт по умолчанию
  return 'ws://localhost:4000';
})();

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

if (typeof window !== 'undefined') {
   // единая точка создания с auth: { clientId }
   try { getSocket(); } catch {}
 }
function getCryptoLike(): CryptoLike | undefined {
  try {
    const c = (globalThis as unknown as { crypto?: unknown }).crypto;
    if (c && typeof c === 'object') {
      const maybe = c as CryptoLike;
      return maybe;
    }
  } catch {
    /* noop */
  }
  return undefined;
}

/** Сгенерировать стабильный id (UUID-подобный) */
function createClientId(): string {
  const c = getCryptoLike();

  // 1) Нативный UUID, если есть
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* fallback ниже */
    }
  }

  // 2) Байты из crypto.getRandomValues (или из Math.random) → UUID v4-подобная строка
  try {
    const bytes: number[] = (() => {
      if (c && typeof c.getRandomValues === 'function') {
        const u = new Uint8Array(16);
        c.getRandomValues(u);
        return Array.from(u);
      }
      return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    })();

    // Установим версию и вариант как у UUID v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const hex = bytes.map(toHex).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  } catch {
    // 3) Простой фолбэк
    return Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  }
}







export function hardDisconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
