// Mock data utilities for metrics

export interface Metrics {
  online: number;
  active: number;
  completed: number;
}

export interface ChartData {
  online: number[];
  active: number[];
  completed: number[];
}

/**
 * Генерирует случайные метрики для демонстрации
 */
export const getMockMetrics = (): Metrics => {
  return {
    online: Math.floor(Math.random() * 50) + 10,
    active: Math.floor(Math.random() * 15) + 3,
    completed: Math.floor(Math.random() * 500) + 100,
  };
};

/**
 * Генерирует данные для графиков за последние 24 часа
 */
export const getMock24HourData = (): ChartData => {
  const hours = 24;
  
  const generateArray = (base: number, variance: number) => {
    return Array.from({ length: hours }, () => 
      Math.max(0, base + Math.floor(Math.random() * variance) - variance / 2)
    );
  };

  return {
    online: generateArray(30, 20),
    active: generateArray(10, 8),
    completed: generateArray(300, 100),
  };
};

/**
 * Генерирует реалистичные данные с трендом
 */
export const getMockTrendData = (baseValue: number, trend: 'up' | 'down' | 'stable' = 'stable'): number[] => {
  const hours = 24;
  const data: number[] = [];
  let currentValue = baseValue;

  for (let i = 0; i < hours; i++) {
    const randomChange = (Math.random() - 0.5) * 10;
    const trendChange = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
    
    currentValue = Math.max(0, currentValue + randomChange + trendChange);
    data.push(Math.round(currentValue));
  }

  return data;
};
