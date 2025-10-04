declare module 'framer-motion' {
  import * as React from 'react';

  // Minimal type shims to satisfy the linter; real types are provided by the package at runtime
  export const motion: any;
  export const AnimatePresence: React.ComponentType<any>;
}


