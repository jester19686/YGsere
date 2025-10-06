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
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  
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

  // Обработчик клика по canvas
  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current) return;

      const clickRadius = 120; // Радиус клика в пикселях
      let closestCataclysm: CataclysmData | null = null;
      let minDistance = Infinity;
      
      // Находим ближайший видимый маркер
      for (const cataclysm of CATACLYSMS_DATA) {
        const projected = projectToScreen(
          cataclysm.location[0],
          cataclysm.location[1],
          canvasRef.current
        );
        
        if (!projected) continue; // Точка на задней стороне глобуса
        
        const dx = projected.x - event.clientX;
        const dy = projected.y - event.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCataclysm = cataclysm;
        }
      }
      
      // Кликаем только если нашли точку в пределах радиуса
      if (closestCataclysm && minDistance <= clickRadius) {
        onMarkerClick?.(closestCataclysm);
      }
    },
    [projectToScreen, onMarkerClick]
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
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.2, 0.1, 0.05],
      markerColor: [1, 0.5, 0.2],
      glowColor: [1, 0.4, 0.1],
      markers: CATACLYSMS_DATA.map((cataclysm) => ({
        location: cataclysm.location,
        size: 0.08,
        color: cataclysm.color,
      })),
      onRender: (state) => {
        if (!pointerInteracting.current) {
          phi += 0.005;
        }
        state.phi = phi + pointerInteractionMovement.current;
        setCurrentPhi(state.phi);
        setCurrentTheta(state.theta);
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    globeRef.current = globe;

    // Обработчик кликов добавлен через onClick в JSX
    const canvas = canvasRef.current;

    // Обработчики для вращения мышью
    const onPointerDown = (e: PointerEvent) => {
      pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
      if (canvas) canvas.style.cursor = 'grabbing';
    };

    const onPointerUp = () => {
      pointerInteracting.current = null;
      if (canvas) canvas.style.cursor = 'grab';
    };

    const onPointerOut = () => {
      pointerInteracting.current = null;
      if (canvas) canvas.style.cursor = 'grab';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (pointerInteracting.current !== null) {
        const delta = e.clientX - pointerInteracting.current;
        pointerInteractionMovement.current = delta / 200;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && pointerInteracting.current !== null) {
        const delta = e.touches[0].clientX - pointerInteracting.current;
        pointerInteractionMovement.current = delta / 100;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerout', onPointerOut);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMove);

    canvas.style.cursor = 'grab';

    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerout', onPointerOut);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMove);
      globe.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onClick={(e) => handleCanvasClick(e.nativeEvent)}
        className="w-full h-full max-w-[800px] max-h-[800px]"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 800,
          maxHeight: 800,
          aspectRatio: '1',
        }}
      />
      
      {/* Инструкция */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-orange-300/80 text-sm md:text-base font-medium px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg border border-orange-500/30">
          🌍 Кликните на точку, чтобы узнать о катаклизме
        </p>
      </div>
    </div>
  );
}
