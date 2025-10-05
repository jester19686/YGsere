'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Users, Shield, Zap, Trophy, Clock, Flame, Target, ChevronDown, ChevronRight, User, Maximize, MessageCircle, Vote, Crown, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CardsCarousel from '@/components/CardsCarousel';
import AnimatedCounter from '@/components/AnimatedCounter';

type Stats = { activePlayers: number; activeGames: number; completedGames: number };

export default function NewHomePage() {
  const [stats, setStats] = useState<Stats>({ activePlayers: 0, activeGames: 0, completedGames: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [gameBasicsOpen, setGameBasicsOpen] = useState<number | null>(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      
      setScrollProgress(progress);
      setShowScrollTop(scrollTop > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-slate-800/50 z-[100]">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
          >
            <ChevronDown className="w-6 h-6 rotate-180 group-hover:translate-y-[-2px] transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse delay-500" />
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-orange-400/8 rounded-full blur-[100px] animate-pulse delay-700" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-red-400/8 rounded-full blur-[100px] animate-pulse delay-300" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-xl bg-black/40">
        <div className="max-w-[1600px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7" />
              </div>
              <span className="text-2xl md:text-3xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                БУНКЕР ОНЛАЙН
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-8">
              <a href="#hero" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Главная
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#games" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Активные игры
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#basics" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Основы
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#cards" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Карты
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </a>
              <a href="#faq" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                FAQ
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </a>
              <Link href="/updates" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Обновления
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/lobby" className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-base font-bold hover:scale-105 hover:shadow-xl shadow-orange-500/50 transition-all duration-200">
                Играть сейчас
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden border-t border-white/10 bg-black/50 backdrop-blur-xl overflow-hidden"
            >
              <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col space-y-4">
                <a 
                  href="#hero" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  Главная
                </a>
                <a 
                  href="#games" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  Активные игры
                </a>
                <a 
                  href="#basics" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  Основы
                </a>
                <a 
                  href="#cards" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  Карты
                </a>
                <a 
                  href="#faq" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  FAQ
                </a>
                <Link 
                  href="/updates" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium"
                >
                  Обновления
                </Link>
                <Link 
                  href="/lobby" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-base font-bold text-center hover:scale-105 transition-transform"
                >
                  Играть сейчас
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="relative z-10 pt-20">
        {/* Hero Section with Bunker Background */}
        <section 
          id="hero"
          className="relative min-h-screen flex items-center"
          style={{
            backgroundImage: 'url(/bunker-corridor.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Overlay для затемнения и читаемости */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 via-40% to-transparent"></div>
          
          {/* Размытие нижней части изображения */}
          <div className="absolute bottom-0 left-0 right-0 h-96 backdrop-blur-[2px]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-64 backdrop-blur-[8px]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-32 backdrop-blur-[20px]"></div>
          
          {/* Многослойный плавный переход к темному фону */}
          <div className="absolute bottom-0 left-0 right-0 h-[500px] bg-gradient-to-b from-transparent via-slate-950/60 via-50% to-slate-950"></div>
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-b from-transparent to-slate-950"></div>
          
          <div className="max-w-[1600px] mx-auto px-6 py-20 md:py-32 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-5xl mx-auto"
            >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-6 px-6 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full"
            >
              <span className="text-orange-400 font-semibold text-sm uppercase tracking-wider">
                18+ • Браузерная онлайн-игра
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-transparent">
                БУНКЕР
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 bg-clip-text text-transparent">
                ОНЛАЙН
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Дискуссионная онлайн-игра о выживании в постапокалипсисе. С 366 уникальными картами, 17 катаклизмами и бесконечным разнообразием сценариев — каждая игра уникальна!
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/lobby"
                className="group relative px-12 py-5 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl font-bold text-xl shadow-2xl shadow-orange-500/50 hover:shadow-orange-500/70 transition-all duration-300 transform hover:scale-105 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-3">
                  <Play className="w-6 h-6" />
                  Играть сейчас
                </span>
              </Link>
              
              <Link
                href="/lobby"
                className="px-12 py-5 bg-white/5 backdrop-blur-sm border-2 border-white/20 hover:border-white/40 rounded-xl font-bold text-xl transition-all duration-300 transform hover:scale-105"
              >
                <span className="flex items-center gap-3">
                  <Users className="w-6 h-6" />
                  Список комнат
                </span>
              </Link>
            </div>
          </motion.div>
          </div>
        </section>

        {/* Live Stats Bar - Minimalist */}
        <section className="max-w-[1600px] mx-auto px-6 py-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Игроков онлайн */}
            <motion.div 
              className="relative group"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 bg-green-500/5 rounded-xl blur-xl group-hover:bg-green-500/10 transition-all duration-300" />
              
              <div className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-5 hover:border-green-500/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-[10px] text-green-400 font-medium uppercase tracking-wide">Online</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-white">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <AnimatedCounter value={stats.activePlayers} />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">Игроков сейчас</div>
                </div>
              </div>
            </motion.div>

            {/* Активных игр */}
            <motion.div 
              className="relative group"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 bg-orange-500/5 rounded-xl blur-xl group-hover:bg-orange-500/10 transition-all duration-300" />
              
              <div className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-5 hover:border-orange-500/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3 h-3 text-orange-400 animate-pulse" />
                      <span className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">Active</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-white">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <AnimatedCounter value={stats.activeGames} />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">Игр идёт</div>
                </div>
              </div>
            </motion.div>

            {/* Завершено игр */}
            <motion.div 
              className="relative group"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 bg-slate-500/5 rounded-xl blur-xl group-hover:bg-slate-500/10 transition-all duration-300" />
              
              <div className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-5 hover:border-slate-600/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700/30 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-white">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <AnimatedCounter value={stats.completedGames} />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">Завершено</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Active Games Table */}
        <section id="games" className="container mx-auto px-6 py-20 scroll-mt-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Активные игры
            </h2>
            <p className="text-lg text-gray-400">
              Присоединяйся к игре прямо сейчас или создай свою собственную
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-800/20 to-slate-700/20 rounded-2xl blur-xl" />
            <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 p-6 border-b border-white/10 bg-slate-950/50">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Создатель</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Статус</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Игроков</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Стадия игры</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center">Действие</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-12 text-center text-gray-500">
                    <div className="inline-block w-8 h-8 border-4 border-gray-700 border-t-orange-500 rounded-full animate-spin mb-4" />
                    <p>Загрузка активных игр...</p>
                  </div>
                ) : stats.activeGames === 0 ? (
                  <div className="p-12 text-center">
                    <Shield className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-4">Нет активных игр</p>
                    <p className="text-gray-600 text-sm">Будь первым, кто создаст игру!</p>
                  </div>
                ) : (
                  <>
                    {[...Array(Math.min(5, stats.activeGames))].map((_, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: idx * 0.1 }}
                        viewport={{ once: true }}
                        className="grid grid-cols-5 gap-4 p-6 hover:bg-white/5 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-300">Игрок_{idx + 1}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Открыта
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-300 font-medium">{Math.floor(Math.random() * 8) + 4}/16</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400">Ожидание игроков</span>
                        </div>
                        <div className="flex items-center justify-center">
                          <Link
                            href="/lobby"
                            className="px-6 py-2 bg-gradient-to-r from-orange-500/80 to-red-600/80 hover:from-orange-500 hover:to-red-600 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105"
                          >
                            Подключиться
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>

              {/* View All Button */}
              {!loading && stats.activeGames > 0 && (
                <div className="p-6 bg-slate-950/50 border-t border-white/10">
                  <Link
                    href="/lobby"
                    className="w-full block text-center py-3 text-gray-400 hover:text-white transition-colors duration-200 font-medium"
                  >
                    Посмотреть все игры →
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* About Game Section */}
        <section className="max-w-[1600px] mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Что такое Бункер Онлайн?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Захватывающая браузерная игра, которая объединяет друзей онлайн. 
              Каждый раунд — новый виток драмы, стратегии и эмоций!
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300" />
              <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 hover:border-orange-500/50 transition-all duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">от 4 до 16 игроков</h3>
                <p className="text-gray-400 leading-relaxed">
                  Масштабный и захватывающий игровой процесс. Большое количество участников создает множество неожиданных поворотов и интриг.
                </p>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300" />
              <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 hover:border-blue-500/50 transition-all duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Играй без ограничений</h3>
                <p className="text-gray-400 leading-relaxed">
                  Ничего не нужно скачивать! Всё, что нужно — компьютер и интернет. Играй в браузере на любом устройстве.
                </p>
              </div>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300" />
              <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 hover:border-purple-500/50 transition-all duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Живое общение</h3>
                <p className="text-gray-400 leading-relaxed">
                  Переговоры, убеждение и манипуляции — твоё оружие. Каждое слово может решить исход игры!
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Game Basics Section */}
        <section id="basics" className="container mx-auto px-6 py-20 scroll-mt-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Основы игры
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Пять простых этапов от начала до победы
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto space-y-4">
            {[
              {
                id: 0,
                icon: Users,
                number: '01',
                title: 'Комната ожидания',
                desc: 'Создатель игры настраивает параметры и ждёт, пока соберётся нужное количество участников. Здесь можно пообщаться перед началом игры.',
                color: 'from-blue-500/20 to-cyan-500/20',
                iconColor: 'text-blue-400',
                borderColor: 'border-blue-500/50'
              },
              {
                id: 1,
                icon: Maximize,
                number: '02',
                title: 'Игровой стол',
                desc: 'Игра начинается! Каждый игрок получает набор случайных карт, формирующих уникального персонажа: профессию, здоровье, хобби, багаж и другие характеристики.',
                color: 'from-purple-500/20 to-pink-500/20',
                iconColor: 'text-purple-400',
                borderColor: 'border-purple-500/50'
              },
              {
                id: 2,
                icon: MessageCircle,
                number: '03',
                title: 'Обсуждение',
                desc: 'Самый важный этап! Игроки представляют своих персонажей, обсуждают их полезность для выживания в бункере, заключают союзы и пытаются убедить остальных.',
                color: 'from-green-500/20 to-emerald-500/20',
                iconColor: 'text-green-400',
                borderColor: 'border-green-500/50'
              },
              {
                id: 3,
                icon: Vote,
                number: '04',
                title: 'Голосование',
                desc: 'Время принять решение! Каждый игрок тайно голосует за того, кто, по его мнению, должен покинуть бункер. Игрок с наибольшим количеством голосов выбывает.',
                color: 'from-orange-500/20 to-red-500/20',
                iconColor: 'text-orange-400',
                borderColor: 'border-orange-500/50'
              },
              {
                id: 4,
                icon: Crown,
                number: '05',
                title: 'Финал',
                desc: 'Раунды повторяются, пока в бункере не останется ровно столько игроков, сколько в нём мест. Оставшиеся игроки — победители! Они смогли убедить остальных в своей ценности.',
                color: 'from-yellow-500/20 to-amber-500/20',
                iconColor: 'text-yellow-400',
                borderColor: 'border-yellow-500/50'
              },
            ].map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300">
                  <button
                    onClick={() => setGameBasicsOpen(gameBasicsOpen === step.id ? null : step.id)}
                    className="w-full p-6 flex items-center gap-6 text-left"
                  >
                    <div className={`flex-shrink-0 w-16 h-16 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center relative`}>
                      <step.icon className={`w-8 h-8 ${step.iconColor} relative z-10`} />
                      <div className="absolute top-1 right-1 text-xs font-bold text-white/30">{step.number}</div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-1 flex items-center gap-3">
                        {step.title}
                        <span className="text-sm font-normal text-gray-500">Этап {step.number}</span>
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {gameBasicsOpen === step.id ? step.desc : step.desc.slice(0, 80) + '...'}
                      </p>
                    </div>
                    <motion.div
                      animate={{ rotate: gameBasicsOpen === step.id ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className="w-6 h-6 text-gray-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {gameBasicsOpen === step.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 border-t border-white/10">
                          <div className="pt-6 flex gap-6">
                            <div className="flex-1">
                              <p className="text-gray-300 leading-relaxed mb-4">{step.desc}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock className="w-4 h-4" />
                                <span>Длительность зависит от настроек игры</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 w-64 h-40 bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-center">
                              <div className="text-center text-gray-600">
                                <step.icon className={`w-12 h-12 ${step.iconColor} mx-auto mb-2 opacity-30`} />
                                <p className="text-xs">Скриншот этапа</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Statistics Overview */}
        <section className="max-w-[1600px] mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-black mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Бесконечное разнообразие
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-12">
              Каждая игра уникальна благодаря огромному количеству комбинаций
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { value: '366', label: 'Уникальных карт', icon: Target },
              { value: '17', label: 'Катаклизмов', icon: Flame },
              { value: '20+', label: 'Типов бункеров', icon: Shield },
              { value: '∞', label: 'Комбинаций', icon: Zap },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:border-orange-500/50 transition-all duration-300">
                  <stat.icon className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                  <div className="text-4xl font-black text-white mb-2">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Play Section */}
        <section className="max-w-[1600px] mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-orange-400 via-red-400 to-orange-400 bg-clip-text text-transparent">
              Почему в это интересно играть?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Анализируй других игроков, строй стратегии, заключай союзы и принимай непростые решения
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'Разнообразие персонажей', desc: 'Твой герой всегда уникален благодаря случайным картам профессии, хобби, здоровья и другим характеристикам' },
              { icon: Users, title: 'Социальные механики', desc: 'Игра сочетает элементы психологии, блефа и дипломатии, создавая уникальный опыт!' },
              { icon: Target, title: 'Тактические голосования', desc: 'Доверие и предательство в реальном времени' },
              { icon: Zap, title: 'Неожиданные повороты', desc: 'Уникальные карты, способные изменить ход игры' },
              { icon: Trophy, title: 'Справедливый баланс', desc: 'Даже слабый персонаж может стать ключевым' },
              { icon: Clock, title: 'Динамичный геймплей', desc: 'Каждый раунд проходит под давлением таймера' },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-orange-500/50 transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <item.icon className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Unique Cards Section - Full Width */}
        <section id="cards" className="w-full py-20 scroll-mt-20 relative">
          {/* Matching Background Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/5 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] animate-pulse delay-1000" />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16 relative z-10 px-6"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-orange-400 via-red-400 to-orange-400 bg-clip-text text-transparent">
              Уникальные карты
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              366 уникальных карт создают бесконечное разнообразие персонажей и сценариев
            </p>
          </motion.div>

          {/* New Carousel Component - Full Width */}
          <CardsCarousel />
        </section>

        {/* FAQ Section */}
        <section id="faq" className="container mx-auto px-6 py-20 scroll-mt-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Часто задаваемые вопросы
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Ответы на популярные вопросы о игре
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-4">
            {[
              {
                q: 'Сколько игроков может участвовать в одной игре?',
                a: 'От 4 до 16 игроков. Оптимальное количество для комфортной игры — 6-12 человек.'
              },
              {
                q: 'Нужно ли что-то скачивать или устанавливать?',
                a: 'Нет! Игра полностью браузерная. Достаточно иметь интернет и современный браузер.'
              },
              {
                q: 'Сколько длится одна игра?',
                a: 'В среднем 30-60 минут, в зависимости от количества игроков и настроек таймеров.'
              },
              {
                q: 'Можно ли играть с телефона или планшета?',
                a: 'Да! Игра адаптирована для мобильных устройств и планшетов.'
              },
              {
                q: 'Игра бесплатная?',
                a: 'Да, игра полностью бесплатная для всех игроков. Мы развиваем проект за счёт добровольных пожертвований.'
              },
              {
                q: 'Как создать свою игру?',
                a: 'Нажмите "Создать игру" на главной странице, настройте параметры и поделитесь ссылкой с друзьями.'
              },
              {
                q: 'Что такое "Особое условие" и "Факт"?',
                a: 'Это карты, которые переворачиваются в процессе игры и могут кардинально изменить ситуацию. Факт раскрывает тайну о вашем персонаже, а Особое условие добавляет уникальную ситуацию.'
              },
              {
                q: 'Можно ли играть с незнакомыми людьми?',
                a: 'Да! Вы можете присоединиться к любой открытой игре в списке активных комнат.'
              },
              {
                q: 'Есть ли голосовой чат в игре?',
                a: 'Пока нет встроенного голосового чата, но вы можете использовать Discord, Zoom или любой другой сервис для общения с игроками.'
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-800/10 to-slate-700/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300">
                  <button
                    onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                    className="w-full p-6 flex items-start gap-4 text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg flex items-center justify-center mt-1">
                      <span className="text-orange-400 font-bold text-sm">{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2 pr-8">{item.q}</h3>
                      <AnimatePresence>
                        {faqOpen === idx && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-gray-400 leading-relaxed overflow-hidden"
                          >
                            {item.a}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <motion.div
                      animate={{ rotate: faqOpen === idx ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </motion.div>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Additional Help */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-gray-400 mb-4">Не нашли ответ на свой вопрос?</p>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200"
            >
              <MessageCircle className="w-5 h-5" />
              Связаться с поддержкой
            </Link>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="max-w-[1600px] mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/20 rounded-3xl p-16 text-center">
              <h2 className="text-4xl md:text-6xl font-black mb-6">
                Готов выжить?
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                Создай игру или присоединись к существующей. Битва за место в бункере начинается прямо сейчас!
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link
                  href="/lobby"
                  className="px-12 py-5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 rounded-xl font-bold text-xl shadow-2xl shadow-orange-500/50 transition-all duration-300 transform hover:scale-105"
                >
                  <span className="flex items-center justify-center gap-3">
                    <Play className="w-6 h-6" />
                    Начать играть
                  </span>
                </Link>
                <Link
                  href="/rules"
                  className="px-12 py-5 bg-white/5 border-2 border-white/20 hover:border-white/40 rounded-xl font-bold text-xl transition-all duration-300"
                >
                  К правилам
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-12">
            <div className="text-center text-gray-400">
              <p className="mb-4">© 2025 Бункер Онлайн. Все права защищены.</p>
              <div className="flex justify-center gap-6 text-sm">
                <Link href="/rules" className="hover:text-white transition-colors">Правила</Link>
                <Link href="/privacy" className="hover:text-white transition-colors">Конфиденциальность</Link>
                <Link href="/support" className="hover:text-white transition-colors">Поддержка</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
