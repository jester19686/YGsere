const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

class MonitoringServer {
  constructor(queueManager, metricsCollector = null, errorHandler = null, port = 3001) {
    this.queueManager = queueManager;
    this.metricsCollector = metricsCollector;
    this.errorHandler = errorHandler;
    this.port = port;
    this.app = express();
    this.server = null;
    
    // Настройка безопасности и производительности
    this.setupSecurity();
    this.setupMiddleware();
    this.setupBullBoard();
    this.setupRoutes();
    
    console.log('📊 MonitoringServer инициализирован с улучшениями');
  }

  /**
   * Настройка безопасности
   */
  setupSecurity() {
    // Helmet для базовой безопасности
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Rate limiting для API endpoints
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 100, // максимум 100 запросов с IP
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Более строгий лимит для Bull Board
    const adminLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: {
        error: 'Too many admin requests, please try again later.'
      }
    });

    this.app.use('/api', apiLimiter);
    this.app.use('/admin', adminLimiter);
  }

  /**
   * Настройка middleware
   */
  setupMiddleware() {
    // Compression для уменьшения размера ответов
    this.app.use(compression());
    
    // Парсинг JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Метрики HTTP запросов (если есть коллектор)
    if (this.metricsCollector) {
      this.app.use(this.metricsCollector.createHttpMiddleware());
    }
    
    // Trust proxy для корректной работы за reverse proxy
    this.app.set('trust proxy', true);
    
    // CORS с ограниченными origins для безопасности
    this.app.use((req, res, next) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
      
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Max-Age', '86400'); // 24 часа
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Настройка Bull Board с кастомизацией
   */
  setupBullBoard() {
    // Создание адаптера для Express
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
    
    // Создание Bull Board с адаптерами очередей
    const queues = this.queueManager.getAllQueues();
    const queueAdapters = Object.entries(queues).map(([name, queue]) => {
      const adapter = new BullMQAdapter(queue);
      
      // Кастомные форматеры для лучшего отображения
      adapter.setFormatter('name', (job) => `🔄 ${name} - ${job.name}`);
      adapter.setFormatter('data', (data) => {
        // Скрываем чувствительные данные
        if (data && typeof data === 'object') {
          const safeData = { ...data };
          if (safeData.password) safeData.password = '***';
          if (safeData.token) safeData.token = '***';
          if (safeData.apiKey) safeData.apiKey = '***';
          return safeData;
        }
        return data;
      });
      
      return adapter;
    });
    
    createBullBoard({
      queues: queueAdapters,
      serverAdapter: this.serverAdapter,
      options: {
        uiConfig: {
          boardTitle: '🤖 Telegram Bot Queue Monitor',
          boardLogo: {
            path: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjMDA3YmZmIi8+Cjwvc3ZnPgo=',
            width: '30px',
            height: '30px',
          },
          miscLinks: [
            { text: '📊 Metrics', url: '/api/metrics' },
            { text: '🏥 Health', url: '/api/health' },
            { text: '📈 Stats', url: '/api/stats' }
          ],
          favIcon: {
            default: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMUw4LjczIDUuNTFMMTMgNkw4LjczIDEwLjQ5TDggMTVMNy4yNyAxMC40OUwzIDZMNy4yNyA1LjUxTDggMVoiIGZpbGw9IiMwMDdiZmYiLz4KPC9zdmc+Cg==',
          },
        },
      },
    });
    
    console.log('📋 Bull Board настроен с кастомизацией');
  }

  setupRoutes() {
    // Bull Board admin interface
    this.app.use('/admin/queues', this.serverAdapter.getRouter());
    
    // Prometheus metrics endpoint
    if (this.metricsCollector) {
      this.app.get('/api/metrics', async (req, res) => {
        try {
          res.set('Content-Type', 'text/plain');
          res.send(await this.metricsCollector.getMetrics());
        } catch (error) {
          res.status(500).json({ error: 'Failed to get metrics' });
        }
      });
    }

    // Статическая страница с информацией
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Queue Monitoring Server</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            .card { background: #f9f9f9; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #007bff; }
            .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
            .button:hover { background: #0056b3; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
            .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
            .status { padding: 3px 8px; border-radius: 3px; font-size: 12px; }
            .status.running { background: #d4edda; color: #155724; }
            .status.stopped { background: #f8d7da; color: #721c24; }
          </style>
          <script>
            async function refreshStats() {
              try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                document.getElementById('stats-container').innerHTML = generateStatsHTML(stats);
              } catch (error) {
                console.error('Error refreshing stats:', error);
              }
            }
            
            function generateStatsHTML(stats) {
              let html = '';
              for (const [queueName, queueStats] of Object.entries(stats.queues)) {
                html += \`
                  <div class="stat">
                    <div class="stat-value">\${queueStats.total || 0}</div>
                    <div class="stat-label">\${queueName}<br>
                      Active: \${queueStats.active || 0} | 
                      Waiting: \${queueStats.waiting || 0}
                    </div>
                  </div>
                \`;
              }
              return html;
            }
            
            setInterval(refreshStats, 5000); // Обновление каждые 5 секунд
            window.onload = refreshStats;
          </script>
        </head>
        <body>
          <div class="container">
            <h1>🔧 Queue Monitoring Server</h1>
            
            <div class="card">
              <h3>📊 Система мониторинга очередей BullMQ</h3>
              <p>Этот сервер предоставляет веб-интерфейс для мониторинга и управления очередями Telegram бота.</p>
              <div class="status running">🟢 Сервер запущен</div>
            </div>

            <div class="card">
              <h3>📈 Быстрая статистика</h3>
              <div id="stats-container" class="stats">
                <div class="stat">
                  <div class="stat-value">...</div>
                  <div class="stat-label">Загрузка...</div>
                </div>
              </div>
            </div>

            <div class="card">
              <h3>🔗 Доступные интерфейсы</h3>
              <a href="/admin/queues" class="button">📋 Bull Board (Управление очередями)</a>
              <a href="/api/stats" class="button">📊 API Статистики</a>
              <a href="/api/health" class="button">💚 Проверка здоровья</a>
              <a href="/api/queues" class="button">⚙️ API Очередей</a>
            </div>

            <div class="card">
              <h3>ℹ️ Информация</h3>
              <p><strong>Порт:</strong> ${this.port}</p>
              <p><strong>Время запуска:</strong> ${new Date().toLocaleString('ru-RU')}</p>
              <p><strong>Версия:</strong> 1.0.0</p>
            </div>
          </div>
        </body>
        </html>
      `);
    });

    // API для получения расширенной статистики
    this.app.get('/api/stats', async (req, res) => {
      try {
        const queueStats = await this.queueManager.getQueueStats();
        
        const stats = {
          timestamp: new Date().toISOString(),
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            port: this.port,
            pid: process.pid,
          },
          queues: queueStats,
          redis: this.queueManager.connection ? {
            status: this.queueManager.connection.status,
            options: {
              host: this.queueManager.connection.options.host,
              port: this.queueManager.connection.options.port,
              db: this.queueManager.connection.options.db,
            }
          } : null,
        };
        
        res.json(stats);
      } catch (error) {
        console.error('Ошибка получения статистики:', error);
        this.handleApiError(res, error, 'Failed to get stats');
      }
    });

    // Health check endpoint
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.queueManager.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        console.error('Ошибка health check:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // API для управления очередями
    this.app.get('/api/queues', (req, res) => {
      const queues = this.queueManager.getAllQueues();
      const queueInfo = {};
      
      for (const [name, queue] of Object.entries(queues)) {
        queueInfo[name] = {
          name: queue.name,
          isPaused: queue.isPaused(),
        };
      }
      
      res.json(queueInfo);
    });

    // API для приостановки очереди
    this.app.post('/api/queues/:queueName/pause', async (req, res) => {
      try {
        const { queueName } = req.params;
        await this.queueManager.pauseQueue(queueName);
        res.json({ success: true, message: `Очередь ${queueName} приостановлена` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API для возобновления очереди
    this.app.post('/api/queues/:queueName/resume', async (req, res) => {
      try {
        const { queueName } = req.params;
        await this.queueManager.resumeQueue(queueName);
        res.json({ success: true, message: `Очередь ${queueName} возобновлена` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API для очистки очереди
    this.app.post('/api/queues/:queueName/clear', async (req, res) => {
      try {
        const { queueName } = req.params;
        const { state = 'completed' } = req.body;
        await this.queueManager.clearQueue(queueName, state);
        res.json({ success: true, message: `Очередь ${queueName} очищена (${state})` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Проверка здоровья системы
    this.app.get('/api/health', async (req, res) => {
      try {
        // Проверка подключения к Redis
        await this.queueManager.connection.ping();
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          redis: 'connected',
          queues: Object.keys(this.queueManager.getAllQueues()).length,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        };
        
        res.json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Подключение Bull Board
    this.app.use('/admin/queues', this.serverAdapter.getRouter());

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error in monitoring server:', err);
      this.handleApiError(res, err, 'Internal server error');
    });

    // 404 обработчик
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: [
          'GET /',
          'GET /admin/queues',
          'GET /api/stats',
          'GET /api/health', 
          'GET /api/metrics',
          'GET /api/queues',
          'POST /api/queues/:queueName/pause',
          'POST /api/queues/:queueName/resume',
          'POST /api/queues/:queueName/clear'
        ],
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ API routes настроены');
  }

  /**
   * Вспомогательный метод для обработки API ошибок
   */
  handleApiError(res, error, defaultMessage = 'Internal server error') {
    const statusCode = error.statusCode || error.httpCode || 500;
    const message = error.message || defaultMessage;
    
    // Логируем ошибку
    if (this.errorHandler) {
      this.errorHandler.recordError('api_error', 'monitoring_server');
    }
    
    const errorResponse = {
      success: false,
      error: {
        message,
        code: error.name || 'ERROR',
        timestamp: new Date().toISOString(),
      }
    };

    // В development показываем больше деталей
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = error.stack;
      errorResponse.error.details = error.details;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Запуск сервера с улучшенной обработкой ошибок
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, (err) => {
          if (err) {
            console.error('❌ Ошибка запуска monitoring server:', err);
            reject(err);
          } else {
            console.log(`🖥️  Monitoring server запущен на порту ${this.port}`);
            console.log(`📋 Bull Board: http://localhost:${this.port}/admin/queues`);
            console.log(`📊 API Stats: http://localhost:${this.port}/api/stats`);
            console.log(`🏥 Health Check: http://localhost:${this.port}/api/health`);
            
            if (this.metricsCollector) {
              console.log(`📈 Prometheus: http://localhost:${this.port}/api/metrics`);
            }
            
            resolve();
          }
        });

        // Обработка ошибок сервера
        this.server.on('error', (error) => {
          console.error('❌ Server error:', error);
          if (this.errorHandler) {
            this.errorHandler.recordError('server_error', 'monitoring_server');
          }
        });

        // Обработка неожиданного закрытия
        this.server.on('close', () => {
          console.log('📡 Monitoring server closed');
        });

      } catch (error) {
        console.error('❌ Failed to start monitoring server:', error);
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown сервера
   */
  async shutdown() {
    console.log('🛑 Начинаю graceful shutdown MonitoringServer...');
    
    return new Promise((resolve) => {
      if (this.server) {
        // Устанавливаем таймаут для принудительного закрытия
        const forceCloseTimer = setTimeout(() => {
          console.log('⚡ Принудительное закрытие monitoring server');
          this.server.destroy();
          resolve();
        }, 5000); // 5 секунд

        this.server.close((err) => {
          clearTimeout(forceCloseTimer);
          
          if (err) {
            console.error('❌ Ошибка при закрытии server:', err);
          } else {
            console.log('✅ Monitoring server корректно закрыт');
          }
          
          resolve();
        });

        // Закрываем все активные соединения
        this.server.getConnections((err, count) => {
          if (!err && count > 0) {
            console.log(`⏳ Закрытие ${count} активных соединений...`);
          }
        });

      } else {
        console.log('✅ Monitoring server уже закрыт');
        resolve();
      }
    });
  }

  /**
   * Алиас для обратной совместимости
   */
  async stop() {
    return await this.shutdown();
  }
}

module.exports = MonitoringServer;
