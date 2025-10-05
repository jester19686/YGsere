import Navigation from '@/components/Navigation';
import { Calendar, Zap, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const Updates = () => {
  const updates = [
    {
      version: "v0.9.0",
      date: "3 октября 2025",
      type: "major",
      icon: Zap,
      title: "Крупное обновление: Полноценый выпуск",
      changes: [
        "Добавлен обновленный дизайн",
        "Оптимизация производительности"
      ]
    },
    {
      version: "v2.0.5",
      date: "25 сентября 2025", 
      type: "minor",
      icon: Plus,
      title: "Первая версия игры",
      changes: [
        "Добавлено лобби",
        "Улучшен интерфейс создания игры",
      ]
    },
    
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "major": return "bg-primary text-primary-foreground";
      case "minor": return "bg-bunker-warning text-primary-foreground";
      case "patch": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "major": return "Крупное";
      case "minor": return "Среднее";
      case "patch": return "Исправления";
      default: return type;
    }
  };

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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-yellow-500 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад на главную
            </Link>
            
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Обновления игры
            </h1>
            <p className="text-xl text-muted-foreground">
              Следите за последними изменениями и улучшениями в Бункер Онлайн
            </p>
          </div>

          {/* Updates List */}
          <div className="space-y-8">
            {updates.map((update, index) => (
              <div key={index} className="bunker-panel p-8 metal-texture hover:shadow-glow transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
                      <update.icon className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-2xl font-bold text-foreground">{update.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getTypeColor(update.type)}`}>
                          {getTypeLabel(update.type)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{update.date}</span>
                        </div>
                        <span className="font-mono text-yellow-500">{update.version}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {update.changes.map((change, changeIndex) => (
                    <div key={changeIndex} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-foreground">{change}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center mt-16">
            <div className="bunker-panel p-8 metal-texture relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/10 to-red-500/5"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-4 text-foreground">
                  Остались вопросы?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Если у вас есть вопросы по обновлениям или предложения по улучшению игры, 
                  свяжитесь с нами через форму обратной связи.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all duration-300 transform hover:scale-105"
                >
                  Вернуться к игре
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default Updates;
