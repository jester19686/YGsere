/**
 * 📈 МОНИТОР ПРОИЗВОДИТЕЛЬНОСТИ ДЛЯ СТРЕСС-ТЕСТИРОВАНИЯ
 * 
 * Отслеживает детальные метрики производительности системы
 * во время нагрузочного тестирования
 */

const axios = require('axios');
const fs = require('fs').promises;

class PerformanceMonitor {
  constructor(monitoringPort = 3001, sampleInterval = 5000) {
    this.monitoringPort = monitoringPort;
    this.sampleInterval = sampleInterval;
    this.isMonitoring = false;
    
    // Собранные данные
    this.performanceData = {
      startTime: null,
      endTime: null,
      samples: [],
      alerts: [],
      summary: {}
    };
    
    // Пороги для алертов
    this.thresholds = {
      cpuUsage: 80,           // %
      memoryUsage: 85,        // %
      queueDepth: 100,        // количество задач
      responseTime: 1000,     // ms
      errorRate: 5,           // %
      redisLatency: 50        // ms
    };
    
    console.log('📈 PerformanceMonitor инициализирован');
  }

  /**
   * Начало мониторинга
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Мониторинг уже запущен');
      return;
    }
    
    this.isMonitoring = true;
    this.performanceData.startTime = Date.now();
    this.performanceData.samples = [];
    this.performanceData.alerts = [];
    
    console.log('🚀 Начинаю мониторинг производительности...');
    console.log(`📊 Интервал сбора данных: ${this.sampleInterval}ms`);
    
    // Запускаем циклический сбор метрик
    this.monitoringLoop();
  }

  /**
   * Остановка мониторинга
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️ Мониторинг не был запущен');
      return;
    }
    
    this.isMonitoring = false;
    this.performanceData.endTime = Date.now();
    
    console.log('🛑 Мониторинг остановлен');
    
    // Генерируем итоговый отчет
    await this.generatePerformanceReport();
  }

  /**
   * Основной цикл мониторинга
   */
  async monitoringLoop() {
    while (this.isMonitoring) {
      try {
        const sample = await this.collectPerformanceSample();
        this.performanceData.samples.push(sample);
        
        // Проверяем на превышение порогов
        await this.checkThresholds(sample);
        
        // Логируем важные метрики
        this.logCurrentMetrics(sample);
        
      } catch (error) {
        console.error('❌ Ошибка сбора метрик:', error.message);
      }
      
      await this.sleep(this.sampleInterval);
    }
  }

  /**
   * Сбор образца метрик производительности
   */
  async collectPerformanceSample() {
    const timestamp = Date.now();
    
    // Системные метрики Node.js
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Метрики от API мониторинга
    let queueStats = {};
    let systemHealth = {};
    
    try {
      // Получаем статистику очередей
      const statsResponse = await axios.get(`http://localhost:${this.monitoringPort}/api/stats`, {
        timeout: 5000
      });
      queueStats = statsResponse.data.queues || {};
      
      // Получаем health check
      const healthResponse = await axios.get(`http://localhost:${this.monitoringPort}/api/health`, {
        timeout: 5000
      });
      systemHealth = healthResponse.data;
      
    } catch (error) {
      console.warn('⚠️ Не удалось получить данные от API мониторинга:', error.message);
    }
    
    // Вычисляем производные метрики
    const totalQueueDepth = Object.values(queueStats).reduce((sum, q) => sum + (q.waiting || 0) + (q.active || 0), 0);
    const totalCompleted = Object.values(queueStats).reduce((sum, q) => sum + (q.completed || 0), 0);
    const totalFailed = Object.values(queueStats).reduce((sum, q) => sum + (q.failed || 0), 0);
    const errorRate = totalCompleted + totalFailed > 0 ? (totalFailed / (totalCompleted + totalFailed)) * 100 : 0;
    
    return {
      timestamp,
      relativeTime: this.performanceData.startTime ? timestamp - this.performanceData.startTime : 0,
      
      // Системные метрики
      system: {
        memoryUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        memoryTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        memoryUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        memoryExternal: Math.round(memUsage.external / 1024 / 1024), // MB
        cpuUser: cpuUsage.user,
        cpuSystem: cpuUsage.system,
        uptime: Math.round(process.uptime()),
        pid: process.pid
      },
      
      // Метрики очередей
      queues: {
        totalDepth: totalQueueDepth,
        totalCompleted: totalCompleted,
        totalFailed: totalFailed,
        errorRate: Math.round(errorRate * 100) / 100,
        details: queueStats
      },
      
      // Здоровье системы
      health: {
        overall: systemHealth.status || 'unknown',
        redis: systemHealth.redis?.connected || false,
        redisStatus: systemHealth.redis?.status || 'unknown'
      }
    };
  }

  /**
   * Проверка превышения порогов и генерация алертов
   */
  async checkThresholds(sample) {
    const alerts = [];
    
    // Проверка использования памяти
    if (sample.system.memoryUsagePercent > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'MEMORY_HIGH',
        severity: 'WARNING',
        message: `Высокое использование памяти: ${sample.system.memoryUsagePercent}%`,
        value: sample.system.memoryUsagePercent,
        threshold: this.thresholds.memoryUsage,
        timestamp: sample.timestamp
      });
    }
    
    // Проверка глубины очередей
    if (sample.queues.totalDepth > this.thresholds.queueDepth) {
      alerts.push({
        type: 'QUEUE_DEPTH_HIGH',
        severity: 'WARNING',
        message: `Большая глубина очередей: ${sample.queues.totalDepth} задач`,
        value: sample.queues.totalDepth,
        threshold: this.thresholds.queueDepth,
        timestamp: sample.timestamp
      });
    }
    
    // Проверка частоты ошибок
    if (sample.queues.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'ERROR_RATE_HIGH',
        severity: 'CRITICAL',
        message: `Высокая частота ошибок: ${sample.queues.errorRate}%`,
        value: sample.queues.errorRate,
        threshold: this.thresholds.errorRate,
        timestamp: sample.timestamp
      });
    }
    
    // Проверка состояния Redis
    if (!sample.health.redis) {
      alerts.push({
        type: 'REDIS_DISCONNECTED',
        severity: 'CRITICAL',
        message: 'Redis недоступен',
        timestamp: sample.timestamp
      });
    }
    
    // Добавляем алерты к общему списку
    this.performanceData.alerts.push(...alerts);
    
    // Выводим алерты в консоль
    for (const alert of alerts) {
      const icon = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
      console.log(`${icon} ${alert.type}: ${alert.message}`);
    }
  }

  /**
   * Логирование текущих метрик
   */
  logCurrentMetrics(sample) {
    const timeStr = this.formatDuration(sample.relativeTime);
    const memPercent = sample.system.memoryUsagePercent;
    const queueDepth = sample.queues.totalDepth;
    const errorRate = sample.queues.errorRate;
    const redisStatus = sample.health.redis ? '✅' : '❌';
    
    console.log(`📊 [${timeStr}] Mem: ${memPercent}% | Queue: ${queueDepth} | Errors: ${errorRate}% | Redis: ${redisStatus}`);
  }

  /**
   * Генерация детального отчета о производительности
   */
  async generatePerformanceReport() {
    console.log('\n📈 === ОТЧЕТ О ПРОИЗВОДИТЕЛЬНОСТИ ===');
    
    if (this.performanceData.samples.length === 0) {
      console.log('❌ Нет данных для анализа');
      return;
    }
    
    const duration = this.performanceData.endTime - this.performanceData.startTime;
    const samples = this.performanceData.samples;
    
    console.log(`⏱️ Продолжительность мониторинга: ${this.formatDuration(duration)}`);
    console.log(`📊 Собрано образцов: ${samples.length}`);
    console.log(`🔔 Всего алертов: ${this.performanceData.alerts.length}`);
    
    // Анализ памяти
    this.analyzeMemoryUsage(samples);
    
    // Анализ очередей
    this.analyzeQueuePerformance(samples);
    
    // Анализ алертов
    this.analyzeAlerts();
    
    // Рекомендации
    this.generateRecommendations(samples);
    
    // Сохранение отчета в файл
    await this.saveReportToFile();
  }

  /**
   * Анализ использования памяти
   */
  analyzeMemoryUsage(samples) {
    const memoryUsages = samples.map(s => s.system.memoryUsagePercent);
    const memoryAmounts = samples.map(s => s.system.memoryUsed);
    
    const avgMemoryPercent = this.average(memoryUsages);
    const maxMemoryPercent = Math.max(...memoryUsages);
    const avgMemoryMB = this.average(memoryAmounts);
    const maxMemoryMB = Math.max(...memoryAmounts);
    
    console.log('\n🧠 АНАЛИЗ ПАМЯТИ:');
    console.log(`   Среднее использование: ${avgMemoryPercent.toFixed(1)}%`);
    console.log(`   Пиковое использование: ${maxMemoryPercent}%`);
    console.log(`   Средний объем: ${avgMemoryMB.toFixed(1)}MB`);
    console.log(`   Пиковый объем: ${maxMemoryMB}MB`);
    
    // Проверка на утечки памяти
    if (samples.length > 10) {
      const firstHalf = memoryAmounts.slice(0, Math.floor(samples.length / 2));
      const secondHalf = memoryAmounts.slice(Math.floor(samples.length / 2));
      const firstHalfAvg = this.average(firstHalf);
      const secondHalfAvg = this.average(secondHalf);
      const growthPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      
      if (growthPercent > 20) {
        console.log(`   ⚠️ Возможная утечка памяти: рост на ${growthPercent.toFixed(1)}%`);
      }
    }
  }

  /**
   * Анализ производительности очередей
   */
  analyzeQueuePerformance(samples) {
    const queueDepths = samples.map(s => s.queues.totalDepth);
    const errorRates = samples.map(s => s.queues.errorRate);
    const completedCounts = samples.map(s => s.queues.totalCompleted);
    
    const avgQueueDepth = this.average(queueDepths);
    const maxQueueDepth = Math.max(...queueDepths);
    const avgErrorRate = this.average(errorRates);
    const maxErrorRate = Math.max(...errorRates);
    
    // Вычисляем throughput (задач в секунду)
    let throughput = 0;
    if (samples.length > 1) {
      const firstCompleted = completedCounts[0];
      const lastCompleted = completedCounts[completedCounts.length - 1];
      const timeSpan = (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000;
      throughput = (lastCompleted - firstCompleted) / timeSpan;
    }
    
    console.log('\n📋 АНАЛИЗ ОЧЕРЕДЕЙ:');
    console.log(`   Средняя глубина очередей: ${avgQueueDepth.toFixed(1)}`);
    console.log(`   Максимальная глубина: ${maxQueueDepth}`);
    console.log(`   Средняя частота ошибок: ${avgErrorRate.toFixed(2)}%`);
    console.log(`   Максимальная частота ошибок: ${maxErrorRate.toFixed(2)}%`);
    console.log(`   Пропускная способность: ${throughput.toFixed(2)} задач/сек`);
    
    // Анализ по типам очередей
    console.log('\n   📊 По типам очередей:');
    const queueTypes = ['textGeneration', 'imageProcessing', 'notification'];
    
    for (const queueType of queueTypes) {
      const queueSamples = samples
        .map(s => s.queues.details[queueType])
        .filter(q => q !== undefined);
      
      if (queueSamples.length > 0) {
        const avgWaiting = this.average(queueSamples.map(q => q.waiting || 0));
        const avgActive = this.average(queueSamples.map(q => q.active || 0));
        const totalCompleted = queueSamples[queueSamples.length - 1]?.completed || 0;
        const totalFailed = queueSamples[queueSamples.length - 1]?.failed || 0;
        
        console.log(`     ${queueType}:`);
        console.log(`       Среднее ожидание: ${avgWaiting.toFixed(1)}`);
        console.log(`       Среднее активных: ${avgActive.toFixed(1)}`);
        console.log(`       Завершено: ${totalCompleted}`);
        console.log(`       Ошибок: ${totalFailed}`);
      }
    }
  }

  /**
   * Анализ алертов
   */
  analyzeAlerts() {
    if (this.performanceData.alerts.length === 0) {
      console.log('\n🎉 АЛЕРТЫ: Критических проблем не обнаружено');
      return;
    }
    
    console.log('\n🚨 АНАЛИЗ АЛЕРТОВ:');
    
    // Группируем алерты по типам
    const alertsByType = {};
    for (const alert of this.performanceData.alerts) {
      if (!alertsByType[alert.type]) {
        alertsByType[alert.type] = [];
      }
      alertsByType[alert.type].push(alert);
    }
    
    for (const [type, alerts] of Object.entries(alertsByType)) {
      const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
      const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
      
      console.log(`   ${type}: ${alerts.length} раз`);
      if (criticalCount > 0) console.log(`     🚨 Критических: ${criticalCount}`);
      if (warningCount > 0) console.log(`     ⚠️ Предупреждений: ${warningCount}`);
    }
  }

  /**
   * Генерация рекомендаций по оптимизации
   */
  generateRecommendations(samples) {
    console.log('\n💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ:');
    
    const recommendations = [];
    
    // Анализ памяти
    const avgMemory = this.average(samples.map(s => s.system.memoryUsagePercent));
    const maxMemory = Math.max(...samples.map(s => s.system.memoryUsagePercent));
    
    if (maxMemory > 90) {
      recommendations.push('🚨 Критически высокое использование памяти. Рекомендуется увеличить лимиты Node.js или оптимизировать код');
    } else if (avgMemory > 70) {
      recommendations.push('⚠️ Высокое среднее использование памяти. Рекомендуется мониторинг утечек и оптимизация');
    }
    
    // Анализ очередей
    const avgQueueDepth = this.average(samples.map(s => s.queues.totalDepth));
    const maxQueueDepth = Math.max(...samples.map(s => s.queues.totalDepth));
    
    if (maxQueueDepth > 200) {
      recommendations.push('🚨 Критически большая глубина очередей. Рекомендуется увеличить количество воркеров или оптимизировать обработку');
    } else if (avgQueueDepth > 50) {
      recommendations.push('⚠️ Высокая средняя глубина очередей. Рекомендуется масштабирование воркеров');
    }
    
    // Анализ ошибок
    const avgErrorRate = this.average(samples.map(s => s.queues.errorRate));
    if (avgErrorRate > 5) {
      recommendations.push('🚨 Высокая частота ошибок. Требуется анализ логов и улучшение error handling');
    } else if (avgErrorRate > 1) {
      recommendations.push('⚠️ Умеренная частота ошибок. Рекомендуется мониторинг и профилактические меры');
    }
    
    // Анализ Redis
    const redisIssues = this.performanceData.alerts.filter(a => a.type === 'REDIS_DISCONNECTED').length;
    if (redisIssues > 0) {
      recommendations.push('🚨 Проблемы с подключением к Redis. Проверьте конфигурацию и стабильность сети');
    }
    
    if (recommendations.length === 0) {
      console.log('   ✅ Система работает оптимально! Рекомендаций по улучшению нет.');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Общие рекомендации по масштабированию
    console.log('\n🔧 ОБЩИЕ РЕКОМЕНДАЦИИ:');
    console.log('   • Регулярно мониторьте метрики в production');
    console.log('   • Настройте автоматические алерты для критических метрик');
    console.log('   • Рассмотрите горизонтальное масштабирование при высокой нагрузке');
    console.log('   • Проводите регулярные нагрузочные тесты');
  }

  /**
   * Сохранение отчета в файл
   */
  async saveReportToFile() {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        duration: this.performanceData.endTime - this.performanceData.startTime,
        samplesCount: this.performanceData.samples.length,
        alertsCount: this.performanceData.alerts.length
      },
      samples: this.performanceData.samples,
      alerts: this.performanceData.alerts,
      summary: this.calculateSummaryMetrics()
    };
    
    const filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    try {
      await fs.writeFile(filename, JSON.stringify(reportData, null, 2));
      console.log(`\n💾 Детальный отчет сохранен: ${filename}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения отчета:', error.message);
    }
  }

  /**
   * Вычисление итоговых метрик
   */
  calculateSummaryMetrics() {
    const samples = this.performanceData.samples;
    
    if (samples.length === 0) return {};
    
    return {
      memory: {
        average: this.average(samples.map(s => s.system.memoryUsagePercent)),
        peak: Math.max(...samples.map(s => s.system.memoryUsagePercent)),
        averageMB: this.average(samples.map(s => s.system.memoryUsed)),
        peakMB: Math.max(...samples.map(s => s.system.memoryUsed))
      },
      queues: {
        averageDepth: this.average(samples.map(s => s.queues.totalDepth)),
        peakDepth: Math.max(...samples.map(s => s.queues.totalDepth)),
        averageErrorRate: this.average(samples.map(s => s.queues.errorRate)),
        peakErrorRate: Math.max(...samples.map(s => s.queues.errorRate)),
        totalCompleted: samples[samples.length - 1]?.queues.totalCompleted || 0,
        totalFailed: samples[samples.length - 1]?.queues.totalFailed || 0
      },
      alerts: {
        total: this.performanceData.alerts.length,
        critical: this.performanceData.alerts.filter(a => a.severity === 'CRITICAL').length,
        warnings: this.performanceData.alerts.filter(a => a.severity === 'WARNING').length
      }
    };
  }

  /**
   * Вспомогательные методы
   */
  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceMonitor;
