'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import createGlobe from 'cobe';
import { CATACLYSMS_DATA, CataclysmData } from '@/data/cataclysms';

interface CataclysmsGlobeProps {
  onMarkerClick?: (cataclysm: CataclysmData) => void;
}

export default function CataclysmsGlobe({ onMarkerClick }: CataclysmsGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const [currentPhi, setCurrentPhi] = useState(0);
  const [currentTheta, setCurrentTheta] = useState(0.3);
  const isHoveringRef = useRef(false);
  const [hoveredCataclysm, setHoveredCataclysm] = useState<CataclysmData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Упрощённая функция для проекции lat/lng на экран
  const projectToScreen = useCallback(
    (lat: number, lng: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const phi = ((lng + 180) * Math.PI) / 180 + currentPhi;
      const theta = ((90 - lat) * Math.PI) / 180;
      
      // 3D координаты на сфере
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      
      // Проверка видимости (точка на передней стороне глобуса)
      if (z < 0) return null;
      
      // Проекция на 2D экран
      const scale = rect.width / 2.2; // Увеличен scale для более точной проекции
      const screenX = rect.left + rect.width / 2 + x * scale;
      const screenY = rect.top + rect.height / 2 - y * scale;
      
      return { x: screenX, y: screenY };
    },
    [currentPhi]
  );

  // Обновление hover состояния при движении мыши
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current || !isHoveringRef.current) {
        if (hoveredCataclysm) setHoveredCataclysm(null);
        return;
      }

      setMousePos({ x: event.clientX, y: event.clientY });

      const hoverRadius = 80; // Радиус для индикатора hover
      let closestCataclysm: CataclysmData | null = null;
      let minDistance = Infinity;
      
      // Находим ближайший видимый маркер
      for (const cataclysm of CATACLYSMS_DATA) {
        const projected = projectToScreen(
          cataclysm.location[0],
          cataclysm.location[1],
          canvasRef.current
        );
        
        if (!projected) continue;
        
        const dx = projected.x - event.clientX;
        const dy = projected.y - event.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCataclysm = cataclysm;
        }
      }
      
      // Показываем индикатор если близко к точке
      if (closestCataclysm && minDistance <= hoverRadius) {
        setHoveredCataclysm(closestCataclysm);
      } else {
        setHoveredCataclysm(null);
      }
    },
    [projectToScreen, hoveredCataclysm]
  );

  // Обработчик клика по canvas
  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
      // Кликаем на подсвеченную точку
      if (hoveredCataclysm) {
        onMarkerClick?.(hoveredCataclysm);
      }
    },
    [hoveredCataclysm, onMarkerClick]
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    let phi = 0;
    let width = 0;
    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 1.2,
      diffuse: 1.5,
      mapSamples: 16000,
      mapBrightness: 4,
      baseColor: [0.15, 0.08, 0.03],
      markerColor: [1, 0.5, 0.2],
      glowColor: [1, 0.5, 0.1],
      markers: CATACLYSMS_DATA.map((cataclysm) => ({
        location: cataclysm.location,
        size: 0.12, // Увеличил размер точек для лучшей видимости
        color: cataclysm.color,
      })),
      onRender: (state) => {
        // Вращение продолжается только если мышка НЕ на глобусе
        if (!isHoveringRef.current) {
          phi += 0.005;
        }
        state.phi = phi;
        setCurrentPhi(state.phi);
        setCurrentTheta(state.theta);
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    globeRef.current = globe;

    // Обработчик кликов добавлен через onClick в JSX
    const canvas = canvasRef.current;
    canvas.style.cursor = 'default';

    return () => {
      window.removeEventListener('resize', onResize);
      globe.destroy();
    };
  }, []); // Убрал isHovering из dependencies - глобус создается только один раз!

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onClick={(e) => handleCanvasClick(e.nativeEvent)}
        onMouseMove={(e) => handleMouseMove(e.nativeEvent)}
        onPointerEnter={() => {
          isHoveringRef.current = true;
        }}
        onPointerLeave={() => {
          isHoveringRef.current = false;
          setHoveredCataclysm(null);
        }}
        className="w-full h-full max-w-[800px] max-h-[800px]"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 800,
          maxHeight: 800,
          aspectRatio: '1',
          cursor: hoveredCataclysm ? 'pointer' : 'default',
        }}
      />

      {/* Индикатор при наведении на точку */}
      {hoveredCataclysm && isHoveringRef.current && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Внешнее пульсирующее кольцо */}
          <div className="absolute inset-0 -m-8 rounded-full border-2 border-orange-400 animate-ping" />
          
          {/* Среднее кольцо */}
          <div className="absolute inset-0 -m-6 rounded-full border-2 border-orange-500 opacity-60 animate-pulse" />
          
          {/* Внутреннее яркое кольцо */}
          <div className="absolute inset-0 -m-4 rounded-full border-4 border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.8)]" />
          
          {/* Центральная точка */}
          <div className="absolute inset-0 -m-1 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(251,146,60,1)]" />
          
          {/* Название катастрофы */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <div className="px-3 py-1 bg-black/90 backdrop-blur-sm rounded-lg border border-orange-500/50 shadow-lg">
              <p className="text-orange-400 text-sm font-medium">{hoveredCataclysm.title}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Инструкция */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-orange-300/80 text-sm md:text-base font-medium px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-orange-500/30">
          {hoveredCataclysm ? '👆 Нажмите, чтобы узнать подробности' : '🌍 Наведите на точку и кликните'}
        </p>
      </div>
    </div>
  );
}
