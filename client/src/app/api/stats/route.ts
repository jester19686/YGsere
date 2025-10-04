import { NextResponse } from 'next/server';

// API endpoint для получения статистики с игрового сервера
export async function GET() {
  try {
    const response = await fetch('http://localhost:4000/api/stats');
    const stats = await response.json();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats from game server:', error);
    // Возвращаем значения по умолчанию если сервер недоступен
    return NextResponse.json({
      activePlayers: 0,
      activeGames: 0,
      completedGames: 0
    });
  }
}
