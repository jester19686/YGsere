'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ArrowLeft, Search, Shield, Menu, X, AlertTriangle, Play } from 'lucide-react';

export default function NotFound() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                <Link href="/updates" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors py-2 text-base font-medium">
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
          {/* 404 Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="relative inline-block mb-8">
              <div className="text-9xl md:text-[14rem] font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 opacity-20">
                404
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center border-2 border-orange-500/40 backdrop-blur-sm"
                >
                  <AlertTriangle className="w-14 h-14 md:w-20 md:h-20 text-orange-400" />
                </motion.div>
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              Страница не найдена
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              К сожалению, запрашиваемая страница не существует или была перемещена. 
              Возможно, вы потерялись в бункере?
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/"
                className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <Home className="w-5 h-5" />
                На главную
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform rotate-180" />
              </Link>
              
              <Link
                href="/lobby"
                className="px-8 py-4 bg-white/5 border-2 border-white/20 hover:border-orange-500/50 hover:bg-white/10 text-white font-bold text-lg rounded-xl transition-all duration-300 flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Найти игру
              </Link>
            </div>
          </motion.div>

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-300" />
            
            <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-white/20 rounded-3xl p-10">
              <h2 className="text-3xl font-black mb-8 text-center text-white">
                Что делать дальше?
              </h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="relative group/card"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-4">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-orange-400 mb-3">
                      Проверьте URL
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Убедитесь, что адрес введен правильно и не содержит опечаток.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="relative group/card"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
                      <ArrowLeft className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-red-400 mb-3">
                      Вернитесь назад
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Используйте кнопку браузера или перейдите на главную страницу.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="relative group/card"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-amber-400 mb-3">
                      Начните игру
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Перейдите в лобби и начните новую игру с друзьями.
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      </div>
    </div>
  );
}
