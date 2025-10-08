'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CataclysmsGlobe from '@/components/CataclysmsGlobe';

export default function CataclysmsPage() {

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(0deg, #0e4429 0%, #22ff44 100%)'
    }}>
      {/* Navigation */}
      <nav className="absolute top-0 left-0 z-20 p-4 md:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/30 hover:border-white/50 rounded-lg transition-all duration-200 text-white hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm md:text-base">На главную</span>
        </Link>
      </nav>

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">
          Карта Катаклизмов
        </h1>
        <p className="text-white/80 text-sm md:text-base max-w-2xl mx-auto">
          Исследуйте глобальные катастрофы, изменившие мир навсегда.
          <br />
          <span className="text-white/90">
            Нажмите на любую светящуюся точку, чтобы узнать подробности.
          </span>
        </p>
      </div>

      {/* Globe - на весь экран */}
      <div className="w-full h-screen">
        <CataclysmsGlobe />
      </div>
    </div>
  );
}
