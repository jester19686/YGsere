import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/game/', '/whoami/'], // Игровые комнаты - не индексируем
      },
      {
        userAgent: 'Yandex',
        allow: '/',
        disallow: ['/game/', '/whoami/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/game/', '/whoami/'],
      },
    ],
    sitemap: 'https://bunker-zone.ru/sitemap.xml',
  };
}
