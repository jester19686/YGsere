# 🎮 Bunker Online - Multiplayer Game

Онлайн-игра "Бункер" с реалтайм-взаимодействием через WebSocket. Современный стек технологий: Next.js 15, React 19, Socket.IO.

## 📋 Содержание

- [Особенности](#особенности)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [Деплой](#деплой)
- [Конфигурация](#конфигурация)
- [API и WebSocket события](#api-и-websocket-события)

## ✨ Особенности

- 🎯 **Реалтайм геймплей** - мгновенная синхронизация через Socket.IO
- 🎨 **Современный UI** - Tailwind CSS + Framer Motion
- 🔐 **Гибкая авторизация** - Поддержка Telegram Auth
- 📱 **Адаптивный дизайн** - Mobile-first подход
- 🎭 **Динамические темы** - Переключение тем для разных игровых режимов
- ⚡ **Оптимизированная производительность** - SSR, автореконнект, graceful degradation
- 🔄 **Система раундов и голосований** - Полная игровая механика

## 🛠 Технологический стек

### Frontend
- **Next.js 15.5.2** - React метафреймворк с App Router
- **React 19.1.0** - UI библиотека
- **TypeScript 5** - Строгая типизация
- **Tailwind CSS 4.1.13** - Utility-first CSS
- **Framer Motion 11.8** - Анимации
- **Socket.IO Client 4.8.1** - Реалтайм коммуникация

### Backend
- **Node.js + Express 4.19.2** - REST API сервер
- **Socket.IO 4.8.1** - WebSocket сервер
- **Telegraf 4.16.3** - Telegram Bot API (опционально)

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ и npm
- Git

### Установка и запуск

1. **Клонируйте репозиторий**
```bash
git clone <your-repo-url>
cd SERVER
```

2. **Установите зависимости**
```bash
# Серверные зависимости
npm install

# Клиентские зависимости
cd client
npm install
cd ..
```

3. **Настройте переменные окружения**
```bash
# Корневая директория - серверные переменные
cp env.example .env

# Клиентская директория - фронтенд переменные
cp client/env.example client/.env.local
```

4. **Запустите сервер и клиент**

В отдельных терминалах:

```bash
# Терминал 1: Backend сервер (порт 4000)
npm run dev

# Терминал 2: Frontend клиент (порт 3000)
cd client
npm run dev
```

5. **Откройте браузер**
```
http://localhost:3000
```

## 📁 Структура проекта

```
SERVER/
├── client/                    # Next.js фронтенд приложение
│   ├── src/
│   │   ├── app/              # App Router страницы
│   │   │   ├── auth/         # Авторизация
│   │   │   ├── game/         # Игровые страницы
│   │   │   ├── lobby/        # Лобби
│   │   │   └── whoami/       # Альтернативный режим
│   │   ├── components/       # React компоненты
│   │   ├── lib/              # Утилиты (socket, helpers)
│   │   └── styles/           # Глобальные стили и темы
│   └── public/               # Статические файлы
│
├── data/                     # Игровые данные
│   ├── cards.js             # Карточки характеристик
│   └── users.json           # Профили пользователей
│
├── game/                     # Игровая логика
│   ├── rounds.js            # Система раундов
│   ├── timers.js            # Таймеры ходов
│   └── vote.js              # Система голосования
│
├── lib/                      # Серверные утилиты
│   ├── cors.js              # CORS настройки
│   ├── QueueManager.js      # Менеджер очередей
│   └── workers/             # Worker процессы
│
├── routes/                   # Express маршруты
│   ├── auth.js              # Авторизация
│   └── rooms.js             # Управление комнатами
│
├── sockets/                  # Socket.IO обработчики
│   └── game.js              # Игровые события
│
├── server-bot/               # Telegram бот (опционально)
│   ├── index.js             # Основной бот
│   └── QueuedBot.js         # Бот с очередями
│
└── index.js                  # Главный серверный файл
```

## 🌐 Деплой

### Вариант 1: VPS/Dedicated Server (PM2)

1. **Подготовка сервера**
```bash
# Установка Node.js и PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. **Клонирование и установка**
```bash
git clone <your-repo-url>
cd SERVER
npm install
cd client && npm install && npm run build && cd ..
```

3. **Настройка переменных окружения**
```bash
# Создайте .env файл с production настройками
nano .env
```

Пример `.env` для production:
```bash
PORT=4000
NODE_ENV=production
FRONT_ORIGIN=https://yourdomain.com
```

4. **Запуск с PM2**
```bash
# Запуск backend
pm2 start index.js --name bunker-server

# Запуск frontend
cd client
pm2 start npm --name bunker-client -- start

# Сохранение конфигурации PM2
pm2 save
pm2 startup
```

5. **Nginx конфигурация**
```nginx
# Backend (API + WebSocket)
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Вариант 2: Docker

```dockerfile
# Dockerfile для backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - FRONT_ORIGIN=https://yourdomain.com
    restart: unless-stopped

  frontend:
    build: ./client
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
      - NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
    restart: unless-stopped
```

### Вариант 3: Vercel (только фронтенд)

Frontend можно задеплоить на Vercel:

```bash
cd client
vercel --prod
```

Backend нужно разместить отдельно (VPS, Railway, Render и т.д.)

## ⚙️ Конфигурация

### Серверные переменные (.env)

```bash
# Основные настройки
PORT=4000                      # Порт сервера
NODE_ENV=production            # Режим работы

# CORS
FRONT_ORIGIN=https://yourdomain.com  # Разрешенные origin'ы (через запятую)

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=            # Токен бота
APP_BASE_URL=                  # URL приложения

# Rate Limiting
RATE_ROOMS_WINDOW_MS=60000     # Окно для лимита создания комнат (мс)
RATE_ROOMS_MAX=10              # Макс. комнат за окно
AUTH_RATE_WINDOW_MS=60000      # Окно для auth запросов
AUTH_RATE_MAX=20               # Макс. auth запросов за окно
```

### Клиентские переменные (.env.local)

```bash
# API URLs (авто-детект если не указаны)
NEXT_PUBLIC_API_URL=           # Backend API URL
NEXT_PUBLIC_WS_URL=            # WebSocket URL

# Telegram Auth
NEXT_PUBLIC_TG_BOT_USERNAME=BunkerAuthbot
```

## 📡 API и WebSocket события

### REST API

```
GET  /health                   - Health check
GET  /api/stats               - Статистика игры
POST /rooms                   - Создать комнату
GET  /rooms                   - Список активных комнат
POST /api/auth/telegram/verify - Telegram авторизация
```

### WebSocket события (Socket.IO)

#### Клиент → Сервер
```javascript
// Управление комнатами
socket.emit('joinRoom', { roomId, nick, clientId, avatarUrl })
socket.emit('leaveRoom', { roomId, clientId })
socket.emit('room:start', { roomId })

// Игровой процесс
socket.emit('game:reveal', { roomId })
socket.emit('game:revealKey', { roomId, key })
socket.emit('game:nextTurn', { roomId })
socket.emit('game:voteSkip', { roomId, vote })

// Голосование
socket.emit('vote:start', { roomId, clientId })
socket.emit('vote:cast', { roomId, clientId, targetId })
socket.emit('vote:forceClose', { roomId, clientId })
```

#### Сервер → Клиент
```javascript
// Состояние комнаты
socket.on('room:state', (payload) => {})
socket.on('presence', (payload) => {})
socket.on('rooms:update', ({ rooms }) => {})

// Игровое состояние
socket.on('game:state', (payload) => {})
socket.on('game:you', ({ hand, hiddenKey, revealedKeys }) => {})
socket.on('game:turn', ({ roomId, currentTurnId }) => {})
socket.on('game:over', ({ roomId, winners }) => {})

// Голосование
socket.on('vote:state', (payload) => {})
socket.on('vote:result', ({ roomId, lastVote }) => {})
```

## 🧪 Тестирование

Проект включает инструменты для стресс-тестирования:

```bash
# Быстрый тест
npm run test:quick

# Симуляция игры
npm run test:sim

# Стресс-тесты
npm run stress:quick
npm run stress:medium
npm run stress:intensive
```

## 📚 Дополнительная документация

- [AUTH_SETUP.md](./AUTH_SETUP.md) - Настройка Telegram авторизации
- [QUEUE_SYSTEM_README.md](./QUEUE_SYSTEM_README.md) - Система очередей
- [SIMULATOR_README.md](./SIMULATOR_README.md) - Игровой симулятор
- [STRESS_TESTING_GUIDE.md](./STRESS_TESTING_GUIDE.md) - Стресс-тестирование
- [project.md](./project.md) - Детальный анализ архитектуры

## 🤝 Contributing

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

ISC License

## 👥 Авторы

Разработано с ❤️ командой Bunker Online

## 🐛 Известные проблемы и решения

### WebSocket не подключается

Убедитесь, что:
- Backend запущен на правильном порту
- CORS настроен корректно
- Firewall не блокирует WebSocket соединения
- В production используется wss:// (не ws://)

### Ошибки авторизации через Telegram

Проверьте:
- TELEGRAM_BOT_TOKEN корректен
- В BotFather настроен `/setdomain`
- Домен использует HTTPS

### Проблемы с производительностью

- Включите production mode (`NODE_ENV=production`)
- Используйте PM2 для автореконнекта
- Настройте rate limiting
- Проверьте логи: `server.log`, `client.log`

## 📞 Поддержка

Для вопросов и предложений создавайте Issues в GitHub репозитории.

---

**Приятной игры! 🎮**

