'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Home, Info } from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-black/80 backdrop-blur-md border-b border-yellow-500/30 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center border-2 border-white">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-white">БУНКЕР ОНЛАЙН</span>
          </Link>

          {/* Десктопное меню */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              href="/" 
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Главная
            </Link>
            <Link 
              href="/updates" 
              className="text-white hover:text-orange-400 transition-colors duration-200 flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              Обновления
            </Link>
          </div>

          {/* Мобильное меню кнопка */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Открыть меню"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Мобильное меню */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-yellow-500/30">
            <div className="flex flex-col space-y-4">
              <Link 
                href="/" 
                className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                onClick={() => setIsOpen(false)}
              >
                <Home className="w-4 h-4" />
                Главная
              </Link>
              <Link 
                href="/updates" 
                className="text-white hover:text-orange-400 transition-colors duration-200 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-700/50"
                onClick={() => setIsOpen(false)}
              >
                <Info className="w-4 h-4" />
                Обновления
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
