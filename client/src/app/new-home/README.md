# 🎨 Новый дизайн главной страницы

## 📍 Доступ

Новая главная страница доступна по адресу: **`/new-home`**

Например:
- Локально: `http://localhost:3000/new-home`
- Продакшн: `https://yourdomain.com/new-home`

## ✨ Что было сделано

### Использованы MCP серверы:
- **Firecrawl** - для анализа дизайна https://shelter42.ru/
- **Анализ** текущей главной страницы проекта

### Ключевые особенности дизайна:

1. **Современный градиентный дизайн**
   - Темная цветовая схема с постапокалиптической атмосферой
   - Оранжево-красные акценты (от-orange-500 to-red-600)
   - Animated background с эффектами blur
   - Glassmorphism (backdrop-blur-xl)

2. **Полностью работающая статистика**
   - ✅ Сохранена вся функциональность из оригинальной страницы
   - ✅ Live обновление каждые 10 секунд
   - ✅ Игроков онлайн (activePlayers)
   - ✅ Активных игр (activeGames)
   - ✅ Завершенных игр (completedGames)

3. **Навигация**
   - Логотип с иконкой Shield
   - Меню: Главная, Лобби, Правила, Поддержка
   - Кнопка "Играть" с градиентом

4. **Hero секция**
   - Крупный заголовок "БУНКЕР ОНЛАЙН"
   - Описание игры
   - Две CTA кнопки: "Играть сейчас" и "Список комнат"
   - Бейдж "18+ • Браузерная онлайн-игра"

5. **Live Stats карточки**
   - Три карточки с real-time данными
   - Анимированные индикаторы (pulse, glow)
   - Градиентные фоны для каждой метрики

6. **Секция "Что такое Бункер Онлайн?"**
   - 3 карточки с features
   - Иконки: Users, Play, Zap
   - Hover эффекты с glow

7. **Секция "Почему интересно играть?"**
   - 6 карточек с преимуществами игры
   - Grid layout (3 колонки на desktop)
   - Анимация появления при скролле

8. **CTA секция**
   - Крупный call-to-action "Готов выжить?"
   - Две кнопки: "Начать играть" и "К правилам"

9. **Footer**
   - Copyright
   - Ссылки: Правила, Конфиденциальность, Поддержка

## 🎯 Вдохновение из shelter42.ru

Взяты лучшие элементы:
- Постапокалиптическая темная тема
- Акцент на real-time данные (активные игры)
- Карточная структура контента
- Градиентные акценты
- Четкая информационная архитектура
- Социальный proof (статистика)

## 🖼️ Изображения (которые нужно добавить)

### 📝 ПРОМПТЫ ДЛЯ ГЕНЕРАЦИИ ИЗОБРАЖЕНИЙ

Если вы хотите добавить изображения, используйте следующие промпты:

#### 1. Фоновое изображение для Hero секции
```
Промпт: "Dark post-apocalyptic bunker corridor with orange emergency lights, cinematic lighting, atmospheric fog, metallic textures, rust and decay, dramatic shadows, 4K, ultra detailed, moody atmosphere"

Размер: 1920x1080px
Формат: JPG/PNG
Путь: /public/images/hero-bg.jpg
```

#### 2. Иконка для карточки "От 4 до 16 игроков"
```
Промпт: "Group of diverse silhouettes standing together in post-apocalyptic setting, orange and red color scheme, minimalist icon style, survival theme"

Размер: 400x400px
Формат: PNG (прозрачный фон)
Путь: /public/images/feature-players.png
```

#### 3. Иконка для карточки "Играй без ограничений"
```
Промпт: "Modern computer screen with browser window glowing in orange light, futuristic gaming interface, minimal design, post-apocalyptic theme"

Размер: 400x400px
Формат: PNG (прозрачный фон)
Путь: /public/images/feature-browser.png
```

#### 4. Иконка для карточки "Живое общение"
```
Промпт: "Speech bubbles and communication symbols in orange and red flames, discussion and debate icons, dramatic lighting, survival theme"

Размер: 400x400px
Формат: PNG (прозрачный фон)
Путь: /public/images/feature-chat.png
```

#### 5. Скриншоты игрового процесса (опционально)
```
Промпт: "Screenshot of post-apocalyptic card game interface, dark UI with orange accents, character cards with stats and abilities, survival game aesthetic, cyberpunk meets fallout style"

Размер: 1200x800px
Формат: JPG/PNG
Путь: /public/images/gameplay-*.jpg
```

### Где разместить изображения после генерации:

```
CLIENT/
├── public/
│   └── images/
│       ├── hero-bg.jpg           ← Фон hero секции
│       ├── feature-players.png   ← Иконка "4-16 игроков"
│       ├── feature-browser.png   ← Иконка "Браузер"
│       ├── feature-chat.png      ← Иконка "Общение"
│       ├── gameplay-1.jpg        ← Скриншот игры
│       ├── gameplay-2.jpg        ← Скриншот игры
│       └── gameplay-3.jpg        ← Скриншот игры
```

После добавления изображений, раскомментируйте соответствующие строки в `page.tsx`:

```tsx
// Пример использования фонового изображения:
<div 
  className="absolute inset-0 bg-cover bg-center"
  style={{ 
    backgroundImage: 'url(/images/hero-bg.jpg)',
    filter: 'brightness(0.6)'
  }}
/>

// Пример для карточек:
<Image 
  src="/images/feature-players.png" 
  alt="Players" 
  width={400} 
  height={400}
  className="mb-6"
/>
```

## 🎬 Анимации

Использованы **Framer Motion** анимации:
- Fade in при загрузке страницы
- Scroll-triggered animations (появление при скролле)
- Hover эффекты с scale и glow
- Pulse анимации для Live индикаторов

## 🎨 Цветовая палитра

```css
Основные цвета:
- Фон: slate-950, slate-900
- Текст: white, gray-300, gray-400
- Акценты: orange-400 → red-500 (градиент)
- Зеленый (онлайн): green-400
- Синий (активность): blue-400
- Фиолетовый (статистика): purple-400

Градиенты:
- Hero: from-orange-400 via-red-500 to-orange-400
- Кнопки: from-orange-500 to-red-600
- Glow: orange-500/20, red-500/20
```

## 🚀 Как запустить

1. Перейдите в директорию клиента:
```bash
cd client
```

2. Убедитесь, что все зависимости установлены:
```bash
npm install
```

3. Запустите dev сервер:
```bash
npm run dev
```

4. Откройте браузер:
```
http://localhost:3000/new-home
```

## 📱 Responsive дизайн

Полностью адаптивная верстка:
- Mobile: < 768px (1 колонка)
- Tablet: 768px - 1024px (2 колонки)
- Desktop: > 1024px (3 колонки)

## ⚠️ Важно

**НЕ УДАЛЕНО:**
- ✅ Оригинальная главная страница `/` осталась без изменений
- ✅ Вся логика статистики работает
- ✅ Все ссылки ведут на существующие страницы

**СОЗДАНО НОВОЕ:**
- ✅ Отдельная страница `/new-home`
- ✅ Новый современный дизайн
- ✅ Все функции сохранены

## 🔗 Навигация между версиями

Вы можете добавить переключатель между версиями:

```tsx
// В оригинальной странице (client/src/app/page.tsx):
<Link href="/new-home" className="...">
  Посмотреть новый дизайн →
</Link>

// В новой странице (client/src/app/new-home/page.tsx):
<Link href="/" className="...">
  ← Вернуться к старому дизайну
</Link>
```

## 🎯 Следующие шаги (опционально)

1. **Добавить изображения** (см. промпты выше)
2. **Добавить секцию "Основы игры"** (аккордеон с этапами)
3. **Добавить секцию "Уникальные карты"** (карусель)
4. **Добавить FAQ** (аккордеон с вопросами)
5. **Добавить модальное окно приветствия** (как на shelter42.ru)

---

Разработано с использованием MCP серверов (Firecrawl) для анализа лучших практик дизайна.
