# 🚀 Инструкция по деплою на VPS сервер

## 📋 Что мы делаем

Разворачиваем полноценное веб-приложение "Бункер" на VPS сервере:
- **Backend (Node.js + Socket.IO)** - порт 4000
- **Frontend (Next.js)** - порт 3000
- **PM2** - автозапуск и управление процессами
- **Nginx** - reverse proxy и SSL

## 🎯 Текущий статус

- ✅ Код выгружен на GitHub: https://github.com/jester19686/YGsere
- ✅ Локальная версия работает (localhost:3000, localhost:4000)
- ✅ Исправлен порт frontend (3000)
- ⏳ Ожидается деплой на VPS

## 📝 Пошаговый план деплоя

### Шаг 1: Подготовка сервера

Проверить/установить необходимое ПО:
```bash
# Проверка версий
node --version    # Нужно 18+
npm --version
git --version
pm2 --version
nginx -v

# Если чего-то не хватает, установим
```

### Шаг 2: Клонирование репозитория

```bash
# Перейти в директорию для проектов
cd /srv

# Клонировать проект
sudo git clone https://github.com/jester19686/YGsere.git bunker
cd bunker
```

### Шаг 3: Установка зависимостей

```bash
# Backend зависимости
npm install

# Frontend зависимости
cd client
npm install
cd ..
```

### Шаг 4: Настройка переменных окружения

**Backend (.env):**
```bash
PORT=4000
NODE_ENV=production
FRONT_ORIGIN=https://ваш-домен.ru
TELEGRAM_BOT_TOKEN=ваш_токен
AUTH_RATE_WINDOW_MS=60000
AUTH_RATE_MAX=20
RATE_ROOMS_WINDOW_MS=60000
RATE_ROOMS_MAX=10
```

**Frontend (client/.env.production):**
```bash
NEXT_PUBLIC_API_URL=https://ваш-домен.ru
NEXT_PUBLIC_WS_URL=wss://ваш-домен.ru
```

### Шаг 5: Сборка frontend

```bash
cd client
npm run build
cd ..
```

### Шаг 6: Запуск через PM2

```bash
# Backend
pm2 start index.js --name bunker-backend -i 1

# Frontend
cd client
pm2 start npm --name bunker-frontend -- start
cd ..

# Сохранить конфигурацию
pm2 save
pm2 startup
```

### Шаг 7: Настройка Nginx

Создать конфиг: `/etc/nginx/sites-available/bunker`

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Backend API + WebSocket
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Активировать:
```bash
sudo ln -s /etc/nginx/sites-available/bunker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 8: SSL сертификат (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.ru
```

## 🔧 Полезные команды

### PM2
```bash
pm2 list                    # Список процессов
pm2 logs                    # Логи всех процессов
pm2 logs bunker-backend     # Логи backend
pm2 logs bunker-frontend    # Логи frontend
pm2 restart all             # Перезапуск всех
pm2 stop all                # Остановка всех
pm2 delete all              # Удаление всех
```

### Git обновления
```bash
cd /srv/bunker
git pull origin main
npm install
cd client && npm install && npm run build && cd ..
pm2 restart all
```

### Автоматический деплой (если deploy.sh настроен)
```bash
cd /srv/bunker
chmod +x deploy.sh
./deploy.sh all    # Backend + Frontend
./deploy.sh front  # Только Frontend
./deploy.sh back   # Только Backend
```

## 📊 Проверка работы

```bash
# Проверка портов
netstat -tulpn | grep -E '3000|4000'

# Проверка процессов
pm2 status

# Проверка Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверка логов
pm2 logs --lines 50
tail -f /var/log/nginx/error.log
```

## 🐛 Решение проблем

### Backend не запускается
```bash
# Проверить логи
pm2 logs bunker-backend

# Проверить порт
lsof -i :4000

# Убить процесс на порту
kill -9 $(lsof -t -i:4000)
```

### Frontend не запускается
```bash
# Пересобрать
cd /srv/bunker/client
rm -rf .next
npm run build

# Перезапустить
pm2 restart bunker-frontend
```

### WebSocket не подключается
- Проверить CORS в .env: `FRONT_ORIGIN`
- Проверить Nginx конфиг для /socket.io
- Проверить SSL (wss:// требует https://)

## 📦 Структура на сервере

```
/srv/bunker/
├── index.js              # Backend точка входа
├── package.json          # Backend зависимости
├── .env                  # Backend конфиг
├── game/                 # Игровая логика
├── lib/                  # Утилиты
├── routes/               # API маршруты
├── sockets/              # Socket.IO обработчики
├── data/                 # Игровые данные
├── deploy.sh             # Скрипт деплоя
└── client/               # Frontend приложение
    ├── package.json      # Frontend зависимости
    ├── .env.production   # Frontend конфиг
    ├── src/              # Исходники
    └── .next/            # Собранное приложение
```

## 🔐 Безопасность

- ✅ Не коммитить .env файлы в git
- ✅ Использовать SSL сертификат
- ✅ Настроить firewall (ufw)
- ✅ Регулярно обновлять зависимости
- ✅ Использовать rate limiting

## 📞 Следующие шаги

1. Открыть VS Code с SSH подключением к VPS
2. Открыть AI ассистента в новом терминале
3. Выполнить команды из этой инструкции
4. Проверить работу сайта

---

**Домен из deploy.sh:** bunker-zone.ru  
**GitHub:** https://github.com/jester19686/YGsere  
**Дата создания:** 2025-01-XX
