'use client';

import { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export default function AnimatedCounter({ 
  value, 
  className = ''
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Простая анимация без framer-motion хуков
    const duration = 1500; // 1.5 секунды
    const steps = 60;
    const increment = (value - displayValue) / steps;
    const stepDuration = duration / steps;

    let current = displayValue;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      
      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, displayValue]);

  return (
    <span className={className}>
      {displayValue.toLocaleString()}
    </span>
  );
}
