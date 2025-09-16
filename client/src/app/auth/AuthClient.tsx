'use client';

import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [nickInput, setNickInput] = useState('');

  // Подтянуть ник из LS при маунте
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bunker:nick');
      if (saved) setNickInput(saved);
    } catch {}
  }, []);

  // Если нужен токен/next из query — они доступны здесь
  const nextPath = sp.get('next') || '/lobby';
  // const token = sp.get('token'); // если используется — разкомментируй

  const confirmNick = () => {
    const v = nickInput.trim();
    if (!v) return;
    try { localStorage.setItem('bunker:nick', v); } catch {}
    router.replace(nextPath);
  };

  return (
    <main
      className="min-h-[100dvh] relative flex items-center justify-center
                 bg-gradient-to-b from-[#0d0d1a] via-[#111133] to-black
                 bg-radial-glow bg-vignette"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/bg_waves.png')]
                   bg-cover bg-center opacity-40"
      />
      <div className="relative z-10 w-full max-w-md mx-auto px-6 animate-fade-in">
        <h1 className="text-2xl font-bold mb-4 text-center">Авторизация</h1>

        <div className="border rounded p-4 glass">
          <label className="text-sm text-gray-300">Ваш ник</label>

          <input
            className="border p-2 rounded w-full mt-1 mb-3 bg-transparent
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Введите ник"
            value={nickInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNickInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') confirmNick();
            }}
            autoFocus
          />

          <button
            onClick={confirmNick}
            disabled={!nickInput.trim()}
            className={`btn-primary w-full transition ${
              !nickInput.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'
            }`}
          >
            Продолжить
          </button>
        </div>
      </div>
    </main>
  );
}
