import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold">Bunker</h1>
        <p className="opacity-80">Добро пожаловать. Готовы начать?</p>
        <Link
          href="/lobby"
          className="themed-btn px-6 py-3 rounded-lg text-[color:var(--btn-text)] inline-block"
        >
          Играть
        </Link>
      </div>
    </main>
  );
}
// База для REST API сервера: env или текущий хост
// const API_BASE = process.env.NEXT_PUBLIC_API_URL
//   || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');
// const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';