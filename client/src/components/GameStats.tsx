'use client';

import { Users, Clock, Trophy, Target } from 'lucide-react';

const GameStats = () => {
  const stats = [
    {
      icon: Users,
      label: 'Активных игроков',
      value: '1,247',
      change: '+12%',
      changeType: 'positive' as const
    },
    {
      icon: Clock,
      label: 'Игр сыграно',
      value: '8,934',
      change: '+8%',
      changeType: 'positive' as const
    },
    {
      icon: Trophy,
      label: 'Побед',
      value: '2,156',
      change: '+15%',
      changeType: 'positive' as const
    },
    {
      icon: Target,
      label: 'Точность',
      value: '87%',
      change: '+3%',
      changeType: 'positive' as const
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bunker-panel p-6 metal-texture hover:scale-105 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30 group-hover:border-yellow-500/50 transition-colors">
                <stat.icon className="w-6 h-6 text-yellow-500" />
              </div>
              <div className={`text-sm font-bold px-2 py-1 rounded-full ${
                stat.changeType === 'positive' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {stat.change}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground group-hover:text-yellow-400 transition-colors">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GameStats;

