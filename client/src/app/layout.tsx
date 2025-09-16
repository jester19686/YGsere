import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@/styles/themes.css';
import Script from "next/script"; // 👈 ДОБАВЛЕНО

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});



const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Bunker',
  description: 'Онлайн-игра',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  // важно для мобилки
  viewport:
    'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
};

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
