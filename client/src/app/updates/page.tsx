'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Zap, Plus, Shield, Menu, X, ArrowLeft, Sparkles } from 'lucide-react';

export default function UpdatesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const updates = [
    {
      version: "v0.5.0",
      date: "3 октября 2025",
      type: "major",
      icon: Zap,
      title: "Крупное обновление: Полноценный выпуск",
      changes: [
        "Добавлен обновленный дизайн с современными анимациями",
        "Реализована полноценная система real-time статистики",
        "Добавлена таблица активных игр с фильтрацией",
        "Интеграция WebSocket для мгновенных обновлений",
        "Оптимизация производительности и скорости загрузки",
        "Адаптивный дизайн для всех устройств"
      ]
    },
    {
      version: "v0.1.0",
      date: "25 сентября 2025",
      type: "minor",
      icon: Plus,
      title: "Первая версия игры",
      changes: [
        "Добавлено лобби для создания и поиска игр",
        "Улучшен интерфейс создания игры",
        "Реализована система карт персонажей (366 уникальных карт)",
        "Добавлено 17 сценариев катаклизмов",
        "Telegram авторизация для игроков"
      ]
    },
  ];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "major":
        return {
          bg: "from-orange-500/20 to-red-500/20",
          border: "border-orange-500/50",
          text: "text-orange-400",
          label: "Крупное",
          glow: "bg-orange-500/20"
        };
      case "minor":
        return {
          bg: "from-blue-500/20 to-cyan-500/20",
          border: "border-blue-500/50",
          text: "text-blue-400",
          label: "Среднее",
          glow: "bg-blue-500/20"
        };
      case "patch":
        return {
          bg: "from-green-500/20 to-emerald-500/20",
          border: "border-green-500/50",
          text: "text-green-400",
          label: "Исправления",
          glow: "bg-green-500/20"
        };
      default:
        return {
          bg: "from-slate-500/20 to-slate-700/20",
          border: "border-slate-500/50",
          text: "text-slate-400",
          label: type,
          glow: "bg-slate-500/20"
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse delay-500" />
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
              <Link href="/" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Главная
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/#games" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Активные игры
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/#basics" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Основы
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/#cards" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                Карты
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/#faq" className="text-gray-300 hover:text-white transition-all duration-200 text-base font-medium relative group">
                FAQ
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="/updates" className="text-orange-400 hover:text-orange-300 transition-all duration-200 text-base font-medium relative group">
                Обновления
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-500 to-red-600"></span>
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
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
                  Главная
                </Link>
                <Link href="/#games" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
                  Активные игры
                </Link>
                <Link href="/#basics" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
                  Основы
                </Link>
                <Link href="/#cards" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
                  Карты
                </Link>
                <Link href="/#faq" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
                  FAQ
                </Link>
                <Link href="/updates" onClick={() => setMobileMenuOpen(false)} className="text-orange-400 hover:text-white transition-colors py-2 text-base font-medium">
                  Обновления
                </Link>
                <Link href="/lobby" onClick={() => setMobileMenuOpen(false)} className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-base font-bold text-center hover:scale-105 transition-transform">
                  Играть сейчас
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 pt-20">
        <main className="container mx-auto px-6 py-16">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors mb-8 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Назад на главную
              </Link>

              <div className="flex items-center justify-center gap-3 mb-6">
                <Sparkles className="w-10 h-10 text-orange-400" />
                <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-orange-400 via-red-400 to-orange-400 bg-clip-text text-transparent">
                  Обновления
                </h1>
              </div>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Следите за последними изменениями и улучшениями в Бункер Онлайн
              </p>
            </motion.div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500/50 via-red-500/50 to-transparent" />

              {/* Updates List */}
              <div className="space-y-12">
                {updates.map((update, index) => {
                  const styles = getTypeStyles(update.type);
                  const Icon = update.icon;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="relative pl-24"
                    >
                      {/* Timeline Dot */}
                      <div className="absolute left-0 top-0 group">
                        <div className={`relative w-16 h-16 bg-gradient-to-br ${styles.bg} border-2 ${styles.border} rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110`}>
                          <Icon className={`w-8 h-8 ${styles.text}`} />
                          <div className={`absolute inset-0 ${styles.glow} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className="relative group">
                        <div className={`absolute inset-0 bg-gradient-to-r ${styles.bg} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        
                        <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-2xl font-bold text-white">{update.title}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles.bg} border ${styles.border} ${styles.text}`}>
                                  {styles.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-gray-400">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span className="text-sm">{update.date}</span>
                                </div>
                                <span className={`font-mono text-sm ${styles.text} font-bold`}>
                                  {update.version}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Changes List */}
                          <div className="space-y-3">
                            {update.changes.map((change, changeIndex) => (
                              <motion.div
                                key={changeIndex}
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: changeIndex * 0.05 }}
                                viewport={{ once: true }}
                                className="flex items-start gap-3"
                              >
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${styles.text.replace('text-', 'bg-')}`} />
                                <p className="text-gray-300 leading-relaxed">{change}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer CTA */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mt-20"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 rounded-3xl blur-3xl" />
                <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/20 rounded-3xl p-12 text-center">
                  <h2 className="text-3xl font-black mb-4 text-white">
                    Остались вопросы?
                  </h2>
                  <p className="text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                    Если у вас есть вопросы по обновлениям или предложения по улучшению игры,
                    свяжитесь с нами через форму обратной связи.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      href="/lobby"
                      className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl shadow-orange-500/30"
                    >
                      Начать играть
                    </Link>
                    <Link
                      href="/"
                      className="px-8 py-4 bg-white/5 border-2 border-white/20 hover:border-white/40 rounded-xl font-bold text-lg transition-all duration-300"
                    >
                      На главную
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
