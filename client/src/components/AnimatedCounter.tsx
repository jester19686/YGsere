'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
}

export default function AnimatedCounter({ 
  value, 
  className = ''
}: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  
  // Используем spring для плавной анимации
  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current) => {
    return Math.floor(current).toLocaleString();
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span 
      ref={nodeRef}
      className={className}
    >
      {display}
    </motion.span>
  );
}
