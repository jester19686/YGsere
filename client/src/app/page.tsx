'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useEffect, useState } from 'react';
import { Play, Users, Shield, Zap } from 'lucide-react';

type Stats = { activePlayers: number; activeGames: number; completedGames: number };

export default function Home() {
  const [stats, setStats] = useState<Stats>({ activePlayers: 0, activeGames: 0, completedGames: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        const base =
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== 'undefined'
            ? `${window.location.protocol}//${window.location.hostname}:4000`
            : 'http://localhost:4000');
        const API_BASE = base.replace(/\/+$/, '');
        const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
        const js = await res.json().catch(() => null);
        if (!canceled && js && typeof js === 'object') {
          setStats({
            activePlayers: Number(js.activePlayers || 0),
            activeGames: Number(js.activeGames || 0),
            completedGames: Number(js.completedGames || 0),
          });
          setLoading(false);
        }
      } catch {
        if (!canceled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      canceled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url(/bunker-corridor.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay для лучшей читаемости */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80 backdrop-blur-[1px]"></div>
      
      {/* Декоративные элементы для атмосферы */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-500/30 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-orange-500/40 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-red-500/20 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-yellow-400/50 rounded-full animate-ping delay-500"></div>
      </div>
      
      <div className="relative z-10">
        <Navigation />
      
      <main className="min-h-screen">
        {/* Hero Section - Поверх фонового изображения */}
        <div className="min-h-screen flex items-center justify-center px-4 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-8xl font-extrabold mb-8">
              <span className="text-white">БУНКЕР</span><br />
              <span className="text-orange-500">ОНЛАЙН</span>
            </h1>
            <p className="text-xl md:text-2xl text-white mb-12 max-w-3xl mx-auto leading-relaxed">
              Социальная игра на выживание. Убедите других, что именно вы достойны места в бункере после апокалипсиса.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/lobby"
                className="group relative px-10 py-5 bg-orange-500 text-white font-bold text-xl rounded-lg hover:bg-orange-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-3"
              >
                <Play className="w-6 h-6" />
                Играть сейчас
              </Link>
              
              <Link
                href="/lobby"
                className="px-10 py-5 bg-gray-700/80 text-white font-bold text-xl rounded-lg hover:bg-gray-600/80 transition-all duration-300 flex items-center gap-3"
              >
                <Users className="w-6 h-6" />
                Создать лобби
              </Link>
            </div>
          </div>
        </div>

        {/* Combined Stats and Features Section */}
        <section className="bg-card/50 py-16">
          <div className="container mx-auto px-4">
            {/* Game Stats */}
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? '...' : stats.activePlayers.toLocaleString()}
                  </div>
                  <div className="text-lg text-gray-300 mb-2">Игроков онлайн</div>
                  <div className="text-green-400 text-sm font-bold">
                    {stats.activePlayers > 0 ? '🟢 Онлайн' : '⚫ Офлайн'}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? '...' : stats.activeGames.toLocaleString()}
                  </div>
                  <div className="text-lg text-gray-300 mb-2">Активных игр</div>
                  <div className="text-blue-400 text-sm font-bold">
                    {stats.activeGames > 0 ? '🎮 Играют' : '⏸️ Ожидание'}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? '...' : stats.completedGames.toLocaleString()}
                  </div>
                  <div className="text-lg text-gray-300 mb-2">Завершено игр</div>
                  <div className="text-purple-400 text-sm font-bold">🏆 Всего</div>
                </div>
              </div>
            </div>

            {/* Features Section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-foreground mb-4">Особенности игры</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Погрузитесь в мир постапокалиптического выживания
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-lg mb-6">
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Многопользовательская игра</h3>
                <p className="text-muted-foreground">Играйте с друзьями или случайными игроками онлайн</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-lg mb-6">
                  <Shield className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Уникальные роли</h3>
                <p className="text-muted-foreground">Каждый игрок получает уникальную специальность и характеристики</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 text-center hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 border border-gray-700">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-lg mb-6">
                  <Zap className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Быстрые матчи</h3>
                <p className="text-muted-foreground">Игры длятся 15-30 минут, идеально для любого расписания</p>
              </div>
            </div>
          </div>
        </section>

        {/* How to Play Section */}
        <section className="bg-card/50 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-foreground mb-8">Как играть</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary-foreground font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Получите роль</h3>
                      <p className="text-muted-foreground">Каждый игрок получает уникальную специальность, возраст, пол и особенности.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary-foreground font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Обсуждение</h3>
                      <p className="text-muted-foreground">Убедите других игроков в своей полезности для выживания в бункере.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary-foreground font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Голосование</h3>
                      <p className="text-muted-foreground">Каждый раунд игроки голосуют за исключение одного участника.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary-foreground font-bold">4</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Победа</h3>
                      <p className="text-muted-foreground">Выживите до конца и займите место в бункере!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}
// База для REST API сервера: env или текущий хост
// const API_BASE = process.env.NEXT_PUBLIC_API_URL
//   || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');
// const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';