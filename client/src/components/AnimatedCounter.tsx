'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export default function AnimatedCounter({ 
  value, 
  className = ''
}: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  
  const display = useTransform(motionValue, (current) => {
    return Math.floor(current).toLocaleString();
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.5,
      ease: 'easeOut',
    });

    return controls.stop;
  }, [motionValue, value]);

  return (
    <motion.span 
      ref={nodeRef}
      className={className}
    >
      {display}
    </motion.span>
  );
}
