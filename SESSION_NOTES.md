# 📝 Состояние проекта "Бункер" на 04.10.2025

## ✅ Что было сделано в этой сессии

### 1. Деплой на VPS сервер
- **Сервер:** root@5652617-oy29376.tmweb.ru (IP: 147.45.185.152)
- **Домен:** bunker-zone.ru
- **Backend:** Запущен на порту 4000 через PM2 (процесс: bunker-backend)
- **Frontend:** Запущен на порту 3000 через PM2 (процесс: bunker-frontend)
- **SSL:** Сертификат уже установлен для домена
- **Автозапуск:** PM2 настроен на автозапуск при перезагрузке

#### Конфигурация на VPS:
```
/srv/bunker/
├── .env (backend config)
│   PORT=4000
│   NODE_ENV=production
│   FRONT_ORIGIN=https://bunker-zone.ru
│   TELEGRAM_BOT_TOKEN=
│
└── client/.env.production (frontend config)
    NEXT_PUBLIC_API_URL=https://bunker-zone.ru
    NEXT_PUBLIC_WS_URL=wss://bunker-zone.ru
    NEXT_PUBLIC_TG_BOT_USERNAME=BunkerAuthbot
```

### 2. Настройка Telegram авторизации
- **Бот:** @BunkerAuthbot (ID: 8215767715)
- **Домен привязан:** bunker-zone.ru через @BotFather (/setdomain)
- **Заглушка убрана:** client/src/components/AuthModal.tsx
- ⚠️ **ВАЖНО:** После изменений нужно пересобрать frontend на VPS!

### 3. Исправление игровой логики

#### Проблема 1: Вместо 3 ходов был только 1 ход
**Исправлено в:** `game/rounds.js`
- Раунд 1: quota = 3 (было 1)
- Раунд 2: quota = 2
- Раунд 3+: quota = 1

#### Проблема 2: Не было перехода между раундами
**Исправлено в:** `game/rounds.js`, `game/vote.js`, `index.js`
- Добавлена функция `advanceRound(room)`
- После каждого голосования вызывается переход к следующему раунду
- Квота меняется: 3 → 2 → 1

#### Проблема 3: Ошибка clearTurnTimer is not defined
**Исправлено в:** `index.js`
- Заменено `clearTurnTimer()` на `timers.clearTurnTimer()`

### 4. Коммиты в GitHub
```
d9f506c - fix: remove Telegram auth stub, enable real Telegram Login Widget
6a1676e - fix: implement proper round progression (3-2-1 moves) and game flow
9c895f0 - fix: resolve clearTurnTimer undefined error in checkGameOver
```

---

## 🔧 Как работает игра сейчас

### Механика раундов:
1. **Раунд 1:** Каждый игрок открывает 3 характеристики → Голосование → Исключают 1 игрока
2. **Раунд 2:** Каждый игрок открывает 2 характеристики → Голосование → Исключают 1 игрока
3. **Раунд 3+:** Каждый игрок открывает 1 характеристику → Голосование → Исключают 1 игрока
4. Раунды повторяются пока игроков не станет ≤ количества мест в бункере

### Количество мест в бункере:
- **2 игрока** → **1 место** (остаётся 1 победитель)
- **3-5 игроков** → **2 места** (остаются 2 победителя)
- **6+ игроков** → **половина** игроков

### Экран победы:
- Показывается когда игроков ≤ мест в бункере
- Отображаются победители
- Комната автоматически закрывается через 5 минут

---

## ⚠️ Текущие проблемы

### 1. Telegram авторизация не работает
**Причина:** Frontend не пересобран после удаления заглушки

**Решение:**
```bash
cd /srv/bunker/client
npm run build
cd ..
pm2 restart bunker-frontend
```

Затем открыть `https://bunker-zone.ru` с жёстким обновлением (Ctrl+Shift+R)

---

## 📚 Полезные команды для VPS

### SSH подключение:
```bash
ssh root@5652617-oy29376.tmweb.ru
```

### Управление PM2:
```bash
pm2 status                      # Статус процессов
pm2 logs bunker-backend         # Логи backend
pm2 logs bunker-frontend        # Логи frontend
pm2 restart bunker-backend      # Перезапуск backend
pm2 restart bunker-frontend     # Перезапуск frontend
pm2 restart all                 # Перезапуск всех
```

### Обновление с GitHub:
```bash
cd /srv/bunker
git pull origin main            # Скачать изменения

# Если изменился backend:
pm2 restart bunker-backend

# Если изменился frontend:
cd client
npm run build                   # Пересобрать (1-2 минуты)
cd ..
pm2 restart bunker-frontend
```

### Автоматический деплой (скрипт):
```bash
cd /srv/bunker
./deploy.sh all                 # Backend + Frontend
./deploy.sh front               # Только Frontend
./deploy.sh back                # Только Backend
```

---

## 🎯 Следующие шаги (TODO)

1. **Пересобрать frontend на VPS** (срочно!)
   ```bash
   cd /srv/bunker/client && npm run build && cd .. && pm2 restart bunker-frontend
   ```

2. **Протестировать Telegram авторизацию:**
   - Открыть https://bunker-zone.ru
   - Нажать "Войти через Telegram"
   - Должен появиться синий виджет Telegram Login
   - Авторизоваться через Telegram
   - Проверить что ник и аватар подтягиваются

3. **Протестировать игровую механику:**
   - Создать комнату на 2 игроков
   - Пройти все раунды:
     * Раунд 1: 3 хода → голосование
     * Раунд 2: 2 хода → голосование (если больше 1 места)
     * Раунд 3: 1 ход → голосование (если больше 1 места)
   - Проверить экран победы
   - Проверить таймер закрытия комнаты (5 минут)

4. **Проверить логику зависимости от количества игроков** (если нужно):
   - Уточнить у пользователя, какая именно логика должна зависеть от числа игроков
   - Текущая реализация: места в бункере = половина игроков (или 1-2 для малых партий)

---

## 📂 Структура проекта

```
/srv/bunker/
├── index.js                    # Главный файл backend (Express + Socket.IO)
├── .env                        # Backend конфиг (production)
├── package.json                # Backend зависимости
│
├── game/                       # Игровая логика
│   ├── rounds.js              # ✅ Логика раундов (3-2-1 ходов)
│   ├── vote.js                # ✅ Логика голосования
│   └── timers.js              # Таймеры
│
├── routes/                     # API роуты
│   ├── auth.js                # Telegram авторизация
│   └── rooms.js               # Создание/список комнат
│
├── sockets/                    # Socket.IO обработчики
│   └── game.js                # Игровые события
│
├── data/                       # Игровые данные
│   └── cards.js               # Генерация карт, бункера, катаклизма
│
└── client/                     # Next.js Frontend
    ├── .env.production        # Frontend конфиг (production)
    ├── package.json           # Frontend зависимости
    │
    └── src/
        ├── app/
        │   ├── game/[roomId]/ # Игровая комната
        │   └── lobby/         # Лобби
        │
        └── components/
            └── AuthModal.tsx  # ✅ Модалка авторизации (заглушка убрана)
```

---

## 🔑 Важные переменные окружения

### Backend (.env):
```env
PORT=4000
NODE_ENV=production
FRONT_ORIGIN=https://bunker-zone.ru
TELEGRAM_BOT_TOKEN=8215767715:AAE40zbwA0JJUShvczvRrg09wGbU4znOuNs
AUTH_RATE_WINDOW_MS=60000
AUTH_RATE_MAX=20
RATE_ROOMS_WINDOW_MS=60000
RATE_ROOMS_MAX=10
```

### Frontend (.env.production):
```env
NEXT_PUBLIC_API_URL=https://bunker-zone.ru
NEXT_PUBLIC_WS_URL=wss://bunker-zone.ru
NEXT_PUBLIC_TG_BOT_USERNAME=BunkerAuthbot
```

---

## 🐛 Известные баги (исправлены)

1. ~~Квота раунда = 1 вместо 3~~ ✅ Исправлено
2. ~~Нет перехода между раундами~~ ✅ Исправлено
3. ~~clearTurnTimer is not defined~~ ✅ Исправлено
4. ~~Telegram авторизация - заглушка~~ ✅ Код исправлен, нужно пересобрать frontend

---

## 📞 Контакты

- **GitHub:** https://github.com/jester19686/YGsere
- **Домен:** https://bunker-zone.ru
- **Telegram бот:** @BunkerAuthbot

---

**Дата создания:** 04.10.2025  
**Последнее обновление:** 04.10.2025 19:30 MSK
