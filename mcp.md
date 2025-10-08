# 🔌 MCP Серверы проекта "Бункер"

**Model Context Protocol (MCP)** — серверы для расширения возможностей AI-ассистентов.

---

## 📋 Список активных MCP серверов

### 1. 🎭 **Playwright** (Браузерная автоматизация)

**Инструментов:** 25+

**Основные возможности:**
- 🌐 **Навигация:** открытие веб-страниц, переходы назад/вперед
- 🖱️ **Взаимодействие:** клики, заполнение форм, hover, drag & drop
- 📸 **Скриншоты:** полная страница или отдельные элементы
- 🎬 **Codegen:** запись действий и генерация тестов
- 🌐 **HTTP:** GET, POST, PUT, PATCH, DELETE запросы
- 📝 **Console logs:** чтение логов браузера
- 🎨 **JavaScript:** выполнение кода в браузере
- 📄 **PDF:** сохранение страниц в PDF

**Когда использовать:**
- ✅ Автоматизация веб-тестирования
- ✅ Скрейпинг динамических сайтов (с JavaScript)
- ✅ Создание E2E тестов
- ✅ Генерация скриншотов для документации
- ✅ Проверка UI/UX на разных разрешениях
- ✅ Отладка веб-приложения в браузере

**Примеры:**
```typescript
// Открыть страницу и сделать скриншот
playwright_navigate({ url: "https://bunker-zone.ru" })
playwright_screenshot({ name: "homepage", fullPage: true })

// Тестирование формы
playwright_fill({ selector: "#username", value: "testuser" })
playwright_click({ selector: "button[type='submit']" })
```

---

### 2. 🎨 **Aceternity UI** (UI компоненты)

**Инструментов:** 5

**Основные возможности:**
- 🔍 **Поиск компонентов** по имени/описанию/тегам
- 📖 **Информация** о компоненте (props, примеры)
- 📦 **Инструкции** по установке
- 📂 **Категории** компонентов
- 📋 **Список** всех компонентов

**Когда использовать:**
- ✅ Нужны красивые animated компоненты (Hero, Cards, Effects)
- ✅ Хочется wow-эффекты (parallax, 3D, particles)
- ✅ Создаём лендинги/маркетинговые страницы
- ✅ Нужны готовые шаблоны (pricing, testimonials, features)

**Примеры:**
```typescript
// Найти компонент кнопки
aceternity_search_components({ query: "button animated" })

// Получить код Hero секции
aceternity_get_component_info({ componentName: "hero-parallax" })
```

---

### 3. ✨ **Magic MCP** (21st.dev - Генерация UI)

**Инструментов:** 4

**Основные возможности:**
- 🏗️ **Builder:** создание UI компонентов по описанию
- 🔍 **Inspiration:** поиск примеров компонентов
- 🎨 **Refiner:** улучшение существующих компонентов
- 🎭 **Logo search:** поиск логотипов компаний (JSX/TSX/SVG)

**Когда использовать:**
- ✅ Нужен кастомный компонент (по текстовому описанию)
- ✅ Хочется улучшить UI существующего компонента
- ✅ Нужны логотипы популярных брендов (Discord, GitHub, Slack и т.д.)
- ✅ Ищем вдохновение для дизайна
- ✅ Быстрое прототипирование интерфейсов

**Примеры:**
```typescript
// Создать компонент
21st_magic_component_builder({
  message: "Создай карточку игрока с аватаром и статистикой",
  searchQuery: "player card stats",
  absolutePathToCurrentFile: "/path/to/file.tsx",
  absolutePathToProjectDirectory: "/project/root"
})

// Найти логотип
logo_search({ queries: ["discord", "github"], format: "TSX" })

// Улучшить компонент
21st_magic_component_refiner({
  userMessage: "Сделай карточку более минималистичной",
  absolutePathToRefiningFile: "/path/to/Card.tsx",
  context: "Убрать лишние тени и градиенты"
})
```

---

### 4. 🕷️ **Firecrawl** (Веб-скрейпинг и поиск)

**Инструментов:** 6

**Основные возможности:**
- 📄 **Scrape:** скрейпинг одной страницы (markdown/html)
- 🗺️ **Map:** карта всех URL на сайте
- 🔍 **Search:** веб-поиск с опциональным скрейпингом
- 🕸️ **Crawl:** полный краулинг сайта
- 📊 **Extract:** извлечение структурированных данных (JSON)
- ✅ **Check status:** проверка статуса краулинга

**Когда использовать:**
- ✅ Нужны данные с внешних сайтов
- ✅ Парсинг документации
- ✅ Сбор статистики/аналитики
- ✅ Мониторинг конкурентов
- ✅ Поиск информации в интернете
- ✅ Извлечение структурированных данных (цены, контакты и т.д.)

**Примеры:**
```typescript
// Скрейпинг одной страницы
firecrawl_scrape({ 
  url: "https://example.com", 
  formats: ["markdown"],
  maxAge: 172800000 // кэш на 2 дня
})

// Веб-поиск
firecrawl_search({ 
  query: "Next.js 15 features", 
  limit: 5,
  sources: [{ type: "web" }]
})

// Полный краулинг сайта
firecrawl_crawl({ 
  url: "https://example.com/blog/*",
  maxDiscoveryDepth: 2,
  limit: 20
})

// Извлечь структурированные данные
firecrawl_extract({
  urls: ["https://example.com/products"],
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      price: { type: "number" }
    }
  }
})
```

---

### 5. 🎨 **shadcn/ui** (UI компоненты v4)

**Инструментов:** 6

**Основные возможности:**
- 📦 **Get component:** исходный код компонента
- 🎬 **Get demo:** примеры использования
- 📋 **List components:** список всех компонентов
- 📊 **Metadata:** метаданные компонента
- 📂 **Directory structure:** структура репозитория
- 🧱 **Blocks:** готовые блоки (calendar, dashboard, login)

**Когда использовать:**
- ✅ Нужны стандартные UI компоненты (Button, Input, Dialog)
- ✅ Хочется следовать best practices
- ✅ Нужна доступность (a11y) из коробки
- ✅ Готовые блоки для админок/дашбордов
- ✅ Компоненты легко кастомизируются

**Примеры:**
```typescript
// Получить код кнопки
shadcn_get_component({ componentName: "button" })

// Получить пример использования
shadcn_get_component_demo({ componentName: "dialog" })

// Список всех компонентов
shadcn_list_components()

// Получить готовый блок
shadcn_get_block({ blockName: "dashboard-01" })
```

---

### 6. 📚 **Context7** (Документация библиотек)

**Инструментов:** 2

**Основные возможности:**
- 🔍 **Resolve library:** поиск библиотеки по названию
- 📖 **Get docs:** актуальная документация библиотеки

**Поддерживаемые библиотеки:**
- MongoDB, Next.js, Supabase, Vercel, React, Vue, Angular и др.

**Когда использовать:**
- ✅ Нужна свежая документация библиотеки
- ✅ Неизвестен API библиотеки
- ✅ Изучаем новую технологию
- ✅ Проверяем breaking changes в новой версии

**Примеры:**
```typescript
// Найти библиотеку
context7_resolve_library_id({ libraryName: "next.js" })
// Результат: "/vercel/next.js"

// Получить документацию
context7_get_library_docs({ 
  context7CompatibleLibraryID: "/vercel/next.js",
  topic: "app router",
  tokens: 5000
})
```

---

## 🎯 Матрица выбора MCP сервера

| Задача | Используй |
|--------|-----------|
| Создать UI компонент с нуля | **Magic MCP** (builder) |
| Улучшить существующий UI | **Magic MCP** (refiner) |
| Найти готовый компонент | **shadcn/ui** или **Aceternity UI** |
| Найти логотип компании | **Magic MCP** (logo_search) |
| Скрейпить веб-страницу | **Firecrawl** (scrape) |
| Веб-поиск | **Firecrawl** (search) |
| Автоматизировать браузер | **Playwright** |
| Сделать скриншот | **Playwright** |
| Создать E2E тест | **Playwright** |
| Получить документацию библиотеки | **Context7** |
| Парсить динамический сайт | **Playwright** (для JS) или **Firecrawl** |
| Извлечь структурированные данные | **Firecrawl** (extract) |
| Анимированные эффекты | **Aceternity UI** |
| Стандартные UI компоненты | **shadcn/ui** |

---

## 🚀 Best Practices

### Производительность:
- **Firecrawl:** Используй `maxAge` для кэширования (↑500% быстрее)
- **Playwright:** Закрывай браузер после использования (`playwright_close`)
- **MCP вызовы:** Делай параллельные вызовы когда возможно

### Безопасность:
- **Не скрейпь** localhost или приватные IP
- **Проверяй** данные перед использованием
- **Используй** rate limiting

### Документация:
- **Context7:** Всегда указывай нужный `topic` для экономии токенов
- **shadcn/ui:** Проверяй версию (v4) в документации

---

## 📊 Статистика использования

**Всего серверов:** 6  
**Всего инструментов:** ~48  
**Статус:** ✅ Все активны

**Самые популярные:**
1. 🥇 Firecrawl (универсальный скрейпинг)
2. 🥈 shadcn/ui (проверенные компоненты)
3. 🥉 Magic MCP (быстрое прототипирование)

---

## 🔗 Полезные ссылки

- [Playwright Docs](https://playwright.dev/)
- [Aceternity UI](https://ui.aceternity.com/)
- [21st.dev](https://21st.dev/)
- [Firecrawl](https://firecrawl.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Context7](https://context7.com/)

---

**Дата создания:** 05.01.2025  
**Последнее обновление:** 05.01.2025  
**Проект:** Бункер Онлайн (bunker-zone.ru)
