// client/next.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 't.me',
      },
    ],
  },
  // Укажем корень воркспейса (на уровень выше client/),
  // чтобы убрать варнинг про "inferred workspace root":
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;





