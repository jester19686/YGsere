
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@/styles/themes.css';
import Script from "next/script"; // 👈 ДОБАВЛЕНО

import type { Metadata } from 'next'

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Бункер Онлайн - Дискуссионная игра о выживании в постапокалипсисе",
  description: "Браузерная онлайн-игра Бункер. 366 уникальных карт, 17 катаклизмов, от 4 до 16 игроков. Убеди других в своей ценности и попади в бункер! Играй бесплатно прямо в браузере.",
  keywords: ["бункер", "онлайн игра", "браузерная игра", "дискуссионная игра", "постапокалипсис", "выживание", "игра с друзьями", "bunker online"],
  authors: [{ name: "Bunker Online Team" }],
  creator: "Bunker Online",
  publisher: "Bunker Online",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://bunker-zone.ru'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://bunker-zone.ru',
    siteName: 'Бункер Онлайн',
    title: 'Бункер Онлайн - Дискуссионная игра о выживании',
    description: 'Браузерная онлайн-игра. 366 уникальных карт, 17 катаклизмов, от 4 до 16 игроков. Играй бесплатно!',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Бункер Онлайн - Игра о выживании',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Бункер Онлайн - Дискуссионная игра о выживании',
    description: 'Браузерная онлайн-игра. 366 уникальных карт, 17 катаклизмов. Играй бесплатно!',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
};


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});



const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`theme-bg ${geistSans.variable} ${geistMono.variable} antialiased`}
        data-theme="lobby"
        suppressHydrationWarning
      >
        {/* 👇 Скрипт: подхватываем тему из localStorage до рендера */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){
            try {
              var b = document.body;
              if (!b.classList.contains('theme-bg')) b.classList.add('theme-bg');
              var t = localStorage.getItem('bunker:theme') || 'lobby';
              b.setAttribute('data-theme', t);
            } catch(e){}
          })();`}
        </Script>

        {children}
      </body>
    </html>
  );
}
