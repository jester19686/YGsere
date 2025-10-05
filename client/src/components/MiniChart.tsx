'use client';

import React, { useMemo } from 'react';

interface MiniChartProps {
  data: number[];
  color: string;
}

const MiniChart: React.FC<MiniChartProps> = ({ data, color }) => {
  const { points, max, min } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: '', max: 0, min: 0 };
    }

    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal || 1;

    const width = 100;
    const height = 40;
    const padding = 2;

    const stepX = width / (data.length - 1);
    
    const pointsStr = data
      .map((value, index) => {
        const x = index * stepX;
        const y = height - padding - ((value - minVal) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

    return { points: pointsStr, max: maxVal, min: minVal };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-10 flex items-center justify-center">
        <span className="text-xs text-slate-600">Нет данных</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-10">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area under the line */}
        <polygon
          points={`0,40 ${points} 100,40`}
          fill={`url(#gradient-${color})`}
          className="transition-all duration-300"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300"
        />

        {/* Dots on data points */}
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 40 - 2 - ((value - min) / ((max - min) || 1)) * (40 - 4);
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>
    </div>
  );
};

export default MiniChart;
