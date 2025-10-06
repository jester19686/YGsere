'use client';

import { useEffect } from 'react';
import { X, MapPin, Users } from 'lucide-react';
import { CataclysmData } from '@/data/cataclysms';

interface CataclysmModalProps {
  cataclysm: CataclysmData | null;
  onClose: () => void;
}

export default function CataclysmModal({ cataclysm, onClose }: CataclysmModalProps) {
  useEffect(() => {
    if (cataclysm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [cataclysm]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!cataclysm) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-gradient-to-br from-zinc-900 to-black border-2 border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/20 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full transition-all duration-200 border border-orange-500/30 hover:border-orange-500/50"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5 text-orange-400" />
        </button>

        {/* Image Section */}
        <div className="relative w-full h-64 md:h-80 bg-gradient-to-br from-orange-900/20 to-red-900/20">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          
          {/* Placeholder for image - you can add real images later */}
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-950 via-red-950 to-black">
            <div className="text-center space-y-4">
              <div className="text-6xl md:text-8xl animate-pulse">☢️</div>
              <p className="text-orange-400/60 text-sm">Изображение катаклизма</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-orange-400 drop-shadow-lg">
              {cataclysm.title}
            </h2>
            
            {/* Location Badge */}
            <div className="flex items-center gap-2 text-orange-300/80">
              <MapPin className="w-4 h-4" />
              <span className="text-sm md:text-base">{cataclysm.city}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            {cataclysm.description}
          </p>

          {/* Stats */}
          <div className="pt-4 border-t border-orange-500/20">
            <div className="flex items-center gap-3 text-orange-300">
              <Users className="w-5 h-5" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Пострадало
                </p>
                <p className="text-lg md:text-xl font-bold text-orange-400">
                  {cataclysm.population}
                </p>
              </div>
            </div>
          </div>

          {/* Footer with color indicator */}
          <div className="flex items-center gap-3 pt-4 border-t border-orange-500/20">
            <div
              className="w-6 h-6 rounded-full border-2 border-orange-500/50 shadow-lg"
              style={{
                backgroundColor: `rgb(${cataclysm.color[0] * 255}, ${cataclysm.color[1] * 255}, ${cataclysm.color[2] * 255})`,
                boxShadow: `0 0 15px rgba(${cataclysm.color[0] * 255}, ${cataclysm.color[1] * 255}, ${cataclysm.color[2] * 255}, 0.5)`,
              }}
            />
            <span className="text-xs text-gray-400">
              Маркер катаклизма на глобусе
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
