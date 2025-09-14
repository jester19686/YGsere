// client/next.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'cdn.example.com', // твои домены с аватарками
      'avatars.githubusercontent.com',
      't.me',
    ],
  },
  // Укажем корень воркспейса (на уровень выше client/),
  // чтобы убрать варнинг про "inferred workspace root":
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;





