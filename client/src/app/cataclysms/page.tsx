'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CataclysmsGlobe from '@/components/CataclysmsGlobe';
import CataclysmModal from '@/components/CataclysmModal';
import { CataclysmData } from '@/data/cataclysms';

export default function CataclysmsPage() {
  const [selectedCataclysm, setSelectedCataclysm] = useState<CataclysmData | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

      {/* Navigation */}
      <nav className="relative z-10 p-4 md:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-orange-500/30 hover:border-orange-500/50 rounded-lg transition-all duration-200 text-orange-400 hover:text-orange-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm md:text-base">На главную</span>
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-12 pt-4 md:pt-8">
        {/* Title Section */}
        <div className="text-center space-y-4 mb-8 md:mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 drop-shadow-lg animate-pulse">
            Карта Катаклизмов
          </h1>
          <p className="text-gray-400 text-sm md:text-lg max-w-2xl mx-auto">
            Исследуйте глобальные катастрофы, изменившие мир навсегда.
            <br />
            <span className="text-orange-400/80">
              Нажмите на любую светящуюся точку, чтобы узнать подробности.
            </span>
          </p>
        </div>

        {/* Globe Container */}
        <div className="w-full max-w-4xl h-[60vh] md:h-[70vh] relative">
          <CataclysmsGlobe onMarkerClick={setSelectedCataclysm} />
        </div>

        {/* Stats */}
        <div className="mt-8 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl px-4">
          <div className="bg-black/50 backdrop-blur-sm border border-orange-500/30 rounded-lg p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-orange-400">17</div>
            <div className="text-xs md:text-sm text-gray-400 mt-1">Катаклизмов</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm border border-orange-500/30 rounded-lg p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-red-400">~8B</div>
            <div className="text-xs md:text-sm text-gray-400 mt-1">Пострадавших</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm border border-orange-500/30 rounded-lg p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-yellow-400">100%</div>
            <div className="text-xs md:text-sm text-gray-400 mt-1">Охват планеты</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm border border-orange-500/30 rounded-lg p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-purple-400">∞</div>
            <div className="text-xs md:text-sm text-gray-400 mt-1">Выживших</div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-8 md:mt-12 max-w-2xl mx-auto text-center px-4">
          <p className="text-gray-400 text-sm md:text-base leading-relaxed">
            Каждая точка на глобусе представляет катастрофическое событие, 
            навсегда изменившее судьбу человечества. От природных катаклизмов 
            до техногенных катастроф — все они стали частью нашей истории выживания 
            в новом постапокалиптическом мире.
          </p>
        </div>
      </main>

      {/* Modal */}
      <CataclysmModal
        cataclysm={selectedCataclysm}
        onClose={() => setSelectedCataclysm(null)}
      />

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
    </div>
  );
}
