import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url(/bunker-corridor.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay для лучшей читаемости */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80 backdrop-blur-[1px]"></div>
      
      <div className="relative z-10">
        <Navigation />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* 404 Icon */}
          <div className="mb-8">
            <div className="relative inline-block">
              <div className="text-9xl md:text-[12rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 opacity-20">
                404
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                  <Search className="w-12 h-12 md:w-16 md:h-16 text-yellow-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
              Страница не найдена
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              К сожалению, запрашиваемая страница не существует или была перемещена. 
              Возможно, вы ищете что-то другое?
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="/"
              className="group relative px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-lg rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              На главную
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href="/lobby"
              className="px-8 py-4 border-2 border-yellow-500/50 text-yellow-500 font-bold text-lg rounded-xl hover:bg-yellow-500/10 transition-all duration-300 flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Найти игру
            </Link>
          </div>

          {/* Help Section */}
          <div className="bunker-panel p-8 metal-texture relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/10 to-red-500/5"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-6 text-foreground">
                Что делать дальше?
              </h2>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    Проверьте URL
                  </h3>
                  <p className="text-muted-foreground">
                    Убедитесь, что адрес введен правильно и не содержит опечаток.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-orange-500 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    Вернитесь назад
                  </h3>
                  <p className="text-muted-foreground">
                    Используйте кнопку "Назад" в браузере или перейдите на главную страницу.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Начните игру
                  </h3>
                  <p className="text-muted-foreground">
                    Перейдите в лобби и начните новую игру с друзьями.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
