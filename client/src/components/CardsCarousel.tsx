'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Heart, Brain, AlertCircle, Package, Shield } from 'lucide-react';

interface CardType {
  icon: any;
  title: string;
  count: number;
  color: string;
  iconColor: string;
  desc: string;
  examples: string[];
  backDesc: string;
}

const cardTypes: CardType[] = [
  { 
    icon: Briefcase, 
    title: 'Профессия', 
    count: 20, 
    color: 'from-blue-500/20 to-cyan-500/20', 
    iconColor: 'text-blue-400', 
    desc: 'От врача до программиста',
    examples: ['Врач', 'Инженер', 'Повар'],
    backDesc: 'Профессия определяет твои навыки и пользу для группы. От повара до хирурга — каждая профессия имеет значение в постапокалипсисе.'
  },
  { 
    icon: Heart, 
    title: 'Здоровье', 
    count: 70, 
    color: 'from-red-500/20 to-orange-500/20', 
    iconColor: 'text-red-400', 
    desc: 'От идеального до критического',
    examples: ['Здоров', 'Астма', 'Рак'],
    backDesc: 'Состояние здоровья влияет на выживаемость. От идеального здоровья до смертельных болезней — твоё физическое состояние критично.'
  },
  { 
    icon: Brain, 
    title: 'Хобби', 
    count: 70, 
    color: 'from-purple-500/20 to-pink-500/20', 
    iconColor: 'text-purple-400', 
    desc: 'От полезных до опасных',
    examples: ['Геймер', 'Выживание', 'Охота'],
    backDesc: 'Хобби может стать твоим главным преимуществом или недостатком. Навыки выживания ценятся выше коллекционирования марок.'
  },
  { 
    icon: AlertCircle, 
    title: 'Фобии', 
    count: 70, 
    color: 'from-yellow-500/20 to-amber-500/20', 
    iconColor: 'text-yellow-400', 
    desc: 'Страхи персонажа',
    examples: ['Темнота', 'Высота', 'Клаустрофобия'],
    backDesc: 'Фобии — твоя слабость. В закрытом бункере клаустрофобия может стать смертельным недостатком.'
  },
  { 
    icon: Package, 
    title: 'Большой багаж', 
    count: 50, 
    color: 'from-green-500/20 to-emerald-500/20', 
    iconColor: 'text-green-400', 
    desc: 'Крупные предметы',
    examples: ['Оружие', 'Инструменты', 'Электроника'],
    backDesc: 'Крупный багаж может спасти всю группу. Генератор или оружие — вещи, за которые готовы бороться.'
  },
  { 
    icon: Package, 
    title: 'Рюкзак', 
    count: 69, 
    color: 'from-cyan-500/20 to-blue-500/20', 
    iconColor: 'text-cyan-400', 
    desc: 'Мелкие предметы',
    examples: ['Аптечка', 'Еда', 'Документы'],
    backDesc: 'Содержимое рюкзака может быть жизненно важным. Лекарства, еда и документы — всё имеет ценность.'
  },
  { 
    icon: Shield, 
    title: 'Катаклизмы', 
    count: 17, 
    color: 'from-orange-500/20 to-red-500/20', 
    iconColor: 'text-orange-400', 
    desc: 'Разные сценарии конца света',
    examples: ['Зомби', 'Ядерная война', 'ИИ'],
    backDesc: 'Катаклизм определяет правила выживания. Зомби-апокалипсис требует других навыков, чем ядерная зима.'
  },
];

export default function CardsCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,          // Выключаем встроенный loop
    align: 'center',      // Центрирование активной карты
    skipSnaps: false,     // Останавливаться на каждой карте
    dragFree: false,      // Snap к позициям (не свободное перетаскивание)
    slidesToScroll: 1,    // Прокручивать по одной карте
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flippedCard, setFlippedCard] = useState<number | null>(null);

  // Дублируем карты для бесконечного loop: [...оригинал, ...оригинал, ...оригинал]
  const slides = [...cardTypes, ...cardTypes, ...cardTypes];
  const slideCount = cardTypes.length;

  const scrollTo = useCallback((index: number) => {
    if (!emblaApi) return;
    // Всегда прокручиваем к средней копии + нужный индекс
    emblaApi.scrollTo(slideCount + index);
  }, [emblaApi, slideCount]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const selected = emblaApi.selectedScrollSnap();
    
    // Определяем реальный индекс (без учёта дублей)
    const realIndex = selected % slideCount;
    setSelectedIndex(realIndex);
    setFlippedCard(null);
    
    // Если мы на первой или последней копии - переключаемся на среднюю
    if (selected < slideCount) {
      emblaApi.scrollTo(selected + slideCount, true); // jump to middle copy
    } else if (selected >= slideCount * 2) {
      emblaApi.scrollTo(selected - slideCount, true); // jump to middle copy
    }
  }, [emblaApi, slideCount]);

  useEffect(() => {
    if (!emblaApi) return;
    
    // Стартуем со средней копии
    emblaApi.scrollTo(slideCount, true);
    
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect, slideCount]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  return (
    <div className="relative w-full">
      {/* Embla Container - Drag to scroll */}
      <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
        <div className="flex gap-6 py-12">
          {slides.map((card, idx) => (
            <div key={idx} className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_80%] md:flex-[0_0_400px] px-4">
              <motion.div
                className="relative w-full h-96 [perspective:1000px] cursor-grab active:cursor-grabbing"
                onHoverStart={() => setFlippedCard(idx)}
                onHoverEnd={() => setFlippedCard(null)}
                onTap={() => setFlippedCard(flippedCard === idx ? null : idx)}
              >
                <motion.div
                  className="relative w-full h-full [transform-style:preserve-3d]"
                  animate={{ rotateY: flippedCard === idx ? 180 : 0 }}
                  transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
                >
                  {/* Front of Card */}
                  <div className="absolute inset-0 [backface-visibility:hidden]">
                    <div className="relative group h-full">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${card.color} rounded-3xl blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                      <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300 h-full flex flex-col shadow-2xl">
                        <div className="flex items-start justify-between mb-6">
                          <div className={`w-16 h-16 bg-gradient-to-br ${card.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                            <card.icon className={`w-8 h-8 ${card.iconColor}`} />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-black text-white">{card.count}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">карт</div>
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
                        <p className="text-gray-400 mb-4">{card.desc}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {card.examples.map((ex, i) => (
                            <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-500">
                              {ex}
                            </span>
                          ))}
                        </div>
                        <div className="mt-auto pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="flex-1 h-1.5 bg-slate-950/50 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${card.color.replace('/20', '/50')}`} style={{ width: `${(card.count / 144) * 100}%` }} />
                            </div>
                            <span>{card.count}</span>
                          </div>
                        </div>
                        <div className="mt-4 text-center text-xs text-gray-600">
                          Наведи для подробностей
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Back of Card */}
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="relative group h-full">
                      <div className={`absolute -inset-4 bg-gradient-to-r ${card.color} rounded-3xl blur-2xl opacity-100 transition-opacity duration-500`} />
                      <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8 h-full flex flex-col shadow-2xl">
                        <div className={`w-16 h-16 bg-gradient-to-br ${card.color} rounded-2xl flex items-center justify-center mb-6`}>
                          <card.icon className={`w-8 h-8 ${card.iconColor}`} />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{card.title}</h3>
                        <p className="text-gray-300 leading-relaxed mb-6 flex-1">
                          {card.backDesc}
                        </p>
                        <div className="space-y-3">
                          <div className="text-sm text-gray-400">
                            <span className="font-semibold text-white">Примеры карт:</span>
                          </div>
                          {card.examples.map((ex, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.color.replace('/20', '')}`} />
                              <span className="text-gray-300">{ex}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <div className="text-xs text-gray-500 text-center">
                            Всего {card.count} уникальных карт в этой категории
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Reduced Gradient Masks - Show Side Cards */}
      <div 
        className="absolute inset-y-0 left-0 w-[20%] pointer-events-none z-10" 
        style={{ 
          background: 'linear-gradient(to right, rgb(2, 6, 23) 0%, rgba(2, 6, 23, 0.8) 40%, rgba(2, 6, 23, 0.3) 70%, transparent 100%)' 
        }} 
      />
      <div 
        className="absolute inset-y-0 right-0 w-[20%] pointer-events-none z-10" 
        style={{ 
          background: 'linear-gradient(to left, rgb(2, 6, 23) 0%, rgba(2, 6, 23, 0.8) 40%, rgba(2, 6, 23, 0.3) 70%, transparent 100%)' 
        }} 
      />

      {/* Drag/Swipe Hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 opacity-60">
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-slate-900/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Перетащите или свайпните</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>

      {/* Navigation Dots - Clickable */}
      <div className="flex justify-center gap-2 mt-8">
        {cardTypes.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollTo(idx)}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              selectedIndex === idx
                ? 'bg-orange-500 w-8 h-2.5'
                : 'bg-slate-700 hover:bg-slate-600 w-2.5 h-2.5'
            }`}
            aria-label={`Слайд ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
