declare module 'framer-motion' {
  import * as React from 'react';

  // Minimal type shims to satisfy the linter; real types are provided by the package at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const motion: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AnimatePresence: React.ComponentType<any>;
}


