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
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  
  // Конвертация lat/lng в радианы для COBE
  const locationToAngles = (lat: number, lng: number) => {
    return [
      Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
      (lat * Math.PI) / 180,
    ];
  };

  // Функция для определения расстояния между двумя точками на сфере
  const getDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => {
    const [phi1, theta1] = locationToAngles(lat1, lng1);
    const [phi2, theta2] = locationToAngles(lat2, lng2);

    // Формула гаверсинусов для расстояния на сфере
    const dPhi = phi2 - phi1;
    const dTheta = theta2 - theta1;
    const a =
      Math.sin(dTheta / 2) * Math.sin(dTheta / 2) +
      Math.cos(theta1) *
        Math.cos(theta2) *
        Math.sin(dPhi / 2) *
        Math.sin(dPhi / 2);
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Конвертация координат клика в lat/lng на глобусе
  const getLatLngFromClick = useCallback(
    (x: number, y: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const canvasX = x - rect.left;
      const canvasY = y - rect.top;

      // Нормализация координат к центру canvas
      const normalizedX = (canvasX / rect.width) * 2 - 1;
      const normalizedY = -((canvasY / rect.height) * 2 - 1);

      // Проверка, что клик внутри круга (радиус ~1)
      const distanceFromCenter = Math.sqrt(
        normalizedX * normalizedX + normalizedY * normalizedY
      );
      if (distanceFromCenter > 0.95) return null; // Клик вне глобуса

      // Конвертация в 3D координаты на сфере с учетом текущего вращения
      const theta = Math.asin(normalizedY);
      const phi = Math.atan2(normalizedX, Math.sqrt(1 - normalizedY * normalizedY));

      // Конвертация обратно в lat/lng с учетом вращения глобуса
      const lat = (theta * 180) / Math.PI;
      const lng = ((phi - currentPhi) * 180) / Math.PI;

      return { lat, lng };
    },
    [currentPhi]
  );

  // Обработчик клика по canvas
  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current) return;

      const clickCoords = getLatLngFromClick(
        event.clientX,
        event.clientY,
        canvasRef.current
      );

      if (!clickCoords) return;

      // Проверяем, кликнул ли пользователь рядом с каким-то маркером
      const threshold = 0.3; // Радиус клика (чувствительность)
      
      for (const cataclysm of CATACLYSMS_DATA) {
        const distance = getDistance(
          clickCoords.lat,
          clickCoords.lng,
          cataclysm.location[0],
          cataclysm.location[1]
        );

        if (distance < threshold) {
          onMarkerClick?.(cataclysm);
          return;
        }
      }
    },
    [getLatLngFromClick, getDistance, onMarkerClick]
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
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    globeRef.current = globe;

    // Добавляем обработчик кликов
    const canvas = canvasRef.current;
    canvas.addEventListener('click', handleCanvasClick);

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
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerout', onPointerOut);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMove);
      globe.destroy();
    };
  }, [handleCanvasClick]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
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
