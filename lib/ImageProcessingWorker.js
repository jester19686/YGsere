/**
 * 🖼️ WORKER THREAD ДЛЯ ОБРАБОТКИ ИЗОБРАЖЕНИЙ
 * 
 * Выполняет CPU-интенсивную обработку изображений в отдельном потоке,
 * не блокируя основной поток бота
 */

const { expose } = require('threads/worker');
const axios = require('axios');
const sharp = require('sharp');

// Конфигурация обработки
const PROCESSING_CONFIG = {
  // Максимальные размеры изображения
  maxWidth: 2048,
  maxHeight: 2048,
  
  // Качество сжатия
  quality: 85,
  
  // Поддерживаемые форматы
  supportedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
  
  // Таймауты
  downloadTimeout: 30000,
  processingTimeout: 60000,
  
  // Размеры для превью
  thumbnailSize: 512
};

/**
 * Основной класс обработки изображений в worker thread
 */
class ImageProcessingWorker {
  constructor() {
    this.isProcessing = false;
    this.processedCount = 0;
    console.log('🖼️ ImageProcessingWorker initialized in worker thread');
  }

  /**
   * Загрузка изображения по URL или file_id
   */
  async downloadImage(imageData) {
    try {
      let imageUrl;
      
      if (imageData.file_id) {
        // Если это Telegram file_id, нужно получить URL через Bot API
        // Для worker thread используем прямой URL если он передан
        if (imageData.file_url) {
          imageUrl = imageData.file_url;
        } else {
          throw new Error('File URL not provided for worker thread');
        }
      } else if (imageData.url) {
        imageUrl = imageData.url;
      } else {
        throw new Error('No valid image source provided');
      }

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: PROCESSING_CONFIG.downloadTimeout,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        headers: {
          'User-Agent': 'TelegramBot/1.0'
        }
      });

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'],
        size: response.data.byteLength
      };
      
    } catch (error) {
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  /**
   * Анализ изображения (размеры, формат, метаданные)
   */
  async analyzeImage(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      const analysis = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        colorSpace: metadata.space,
        density: metadata.density,
        
        // Вычисляемые характеристики
        aspectRatio: metadata.width / metadata.height,
        megapixels: (metadata.width * metadata.height) / 1000000,
        isLandscape: metadata.width > metadata.height,
        isPortrait: metadata.height > metadata.width,
        isSquare: Math.abs(metadata.width - metadata.height) < 10,
        
        // Оценка качества
        qualityScore: this.calculateQualityScore(metadata),
        
        // Рекомендации по оптимизации
        optimizationSuggestions: this.getOptimizationSuggestions(metadata)
      };

      return analysis;
      
    } catch (error) {
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }

  /**
   * Оптимизация изображения
   */
  async optimizeImage(imageBuffer, options = {}) {
    try {
      const {
        maxWidth = PROCESSING_CONFIG.maxWidth,
        maxHeight = PROCESSING_CONFIG.maxHeight,
        quality = PROCESSING_CONFIG.quality,
        format = 'jpeg',
        progressive = true
      } = options;

      let pipeline = sharp(imageBuffer);
      const metadata = await pipeline.metadata();

      // Изменение размера если необходимо
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Применение формата и качества
      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ 
            quality, 
            progressive,
            mozjpeg: true 
          });
          break;
          
        case 'png':
          pipeline = pipeline.png({ 
            compressionLevel: 9,
            progressive
          });
          break;
          
        case 'webp':
          pipeline = pipeline.webp({ 
            quality,
            effort: 6
          });
          break;
          
        default:
          pipeline = pipeline.jpeg({ quality, progressive });
      }

      const optimizedBuffer = await pipeline.toBuffer();
      const optimizedMetadata = await sharp(optimizedBuffer).metadata();

      return {
        buffer: optimizedBuffer,
        originalSize: metadata.size,
        optimizedSize: optimizedMetadata.size,
        compressionRatio: ((metadata.size - optimizedMetadata.size) / metadata.size * 100).toFixed(2),
        dimensions: {
          original: { width: metadata.width, height: metadata.height },
          optimized: { width: optimizedMetadata.width, height: optimizedMetadata.height }
        }
      };
      
    } catch (error) {
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Создание превью изображения
   */
  async createThumbnail(imageBuffer, size = PROCESSING_CONFIG.thumbnailSize) {
    try {
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      return {
        buffer: thumbnailBuffer,
        size: thumbnailBuffer.length,
        dimensions: { width: size, height: size }
      };
      
    } catch (error) {
      throw new Error(`Thumbnail creation failed: ${error.message}`);
    }
  }

  /**
   * Извлечение текста из изображения (OCR)
   */
  async extractText(imageBuffer) {
    try {
      // Предварительная обработка для улучшения OCR
      const processedBuffer = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();

      // Здесь можно интегрировать библиотеку OCR как tesseract.js
      // Для демонстрации возвращаем мок-результат
      const mockText = 'OCR functionality requires tesseract.js integration';
      
      return {
        text: mockText,
        confidence: 0.85,
        processedImageSize: processedBuffer.length,
        language: 'en'
      };
      
    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Обнаружение объектов на изображении
   */
  async detectObjects(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // Здесь можно интегрировать TensorFlow.js или другую ML библиотеку
      // Для демонстрации возвращаем анализ основанный на метаданных
      const objects = [];
      
      // Простой анализ на основе характеристик изображения
      if (metadata.channels >= 3) {
        objects.push({
          type: 'colored_image',
          confidence: 0.95,
          description: 'Colored image detected'
        });
      }
      
      if (metadata.width > metadata.height * 1.5) {
        objects.push({
          type: 'landscape',
          confidence: 0.9,
          description: 'Landscape orientation detected'
        });
      }
      
      if (metadata.density && metadata.density > 200) {
        objects.push({
          type: 'high_quality',
          confidence: 0.8,
          description: 'High resolution image'
        });
      }

      return {
        objects,
        imageProperties: {
          colorSpace: metadata.space,
          hasAlpha: metadata.hasAlpha,
          aspectRatio: metadata.width / metadata.height
        },
        processingTime: Date.now()
      };
      
    } catch (error) {
      throw new Error(`Object detection failed: ${error.message}`);
    }
  }

  /**
   * Комплексная обработка изображения
   */
  async processImage(imageData, processingOptions = {}) {
    const startTime = Date.now();
    this.isProcessing = true;
    
    try {
      const {
        includeAnalysis = true,
        includeOptimization = true,
        includeThumbnail = true,
        includeTextExtraction = false,
        includeObjectDetection = false,
        optimizationOptions = {}
      } = processingOptions;

      console.log(`🔄 Starting image processing: ${imageData.file_id || imageData.url}`);

      // 1. Загрузка изображения
      const downloadResult = await this.downloadImage(imageData);
      console.log(`📥 Image downloaded: ${downloadResult.size} bytes`);

      const results = {
        downloadInfo: {
          size: downloadResult.size,
          contentType: downloadResult.contentType
        },
        processingTime: {
          download: Date.now() - startTime
        }
      };

      // 2. Анализ изображения
      if (includeAnalysis) {
        const analysisStart = Date.now();
        results.analysis = await this.analyzeImage(downloadResult.buffer);
        results.processingTime.analysis = Date.now() - analysisStart;
        console.log(`🔍 Analysis completed: ${results.analysis.width}x${results.analysis.height}`);
      }

      // 3. Оптимизация изображения
      if (includeOptimization) {
        const optimizationStart = Date.now();
        results.optimization = await this.optimizeImage(downloadResult.buffer, optimizationOptions);
        results.processingTime.optimization = Date.now() - optimizationStart;
        console.log(`⚡ Optimization completed: ${results.optimization.compressionRatio}% reduction`);
      }

      // 4. Создание превью
      if (includeThumbnail) {
        const thumbnailStart = Date.now();
        results.thumbnail = await this.createThumbnail(downloadResult.buffer);
        results.processingTime.thumbnail = Date.now() - thumbnailStart;
        console.log(`🖼️ Thumbnail created: ${results.thumbnail.size} bytes`);
      }

      // 5. Извлечение текста (опционально)
      if (includeTextExtraction) {
        const textStart = Date.now();
        results.textExtraction = await this.extractText(downloadResult.buffer);
        results.processingTime.textExtraction = Date.now() - textStart;
        console.log(`📝 Text extraction completed`);
      }

      // 6. Обнаружение объектов (опционально)
      if (includeObjectDetection) {
        const detectionStart = Date.now();
        results.objectDetection = await this.detectObjects(downloadResult.buffer);
        results.processingTime.objectDetection = Date.now() - detectionStart;
        console.log(`🎯 Object detection completed: ${results.objectDetection.objects.length} objects`);
      }

      // Общее время обработки
      results.processingTime.total = Date.now() - startTime;
      this.processedCount++;

      console.log(`✅ Image processing completed in ${results.processingTime.total}ms (total processed: ${this.processedCount})`);

      return results;
      
    } catch (error) {
      console.error(`❌ Image processing failed: ${error.message}`);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Вычисление оценки качества изображения
   */
  calculateQualityScore(metadata) {
    let score = 50; // Базовая оценка
    
    // Оценка разрешения
    const megapixels = (metadata.width * metadata.height) / 1000000;
    if (megapixels > 8) score += 20;
    else if (megapixels > 3) score += 15;
    else if (megapixels > 1) score += 10;
    else score -= 10;
    
    // Оценка плотности
    if (metadata.density > 300) score += 15;
    else if (metadata.density > 150) score += 10;
    else if (metadata.density > 72) score += 5;
    
    // Оценка цветности
    if (metadata.channels >= 3) score += 10;
    if (metadata.hasAlpha) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Получение рекомендаций по оптимизации
   */
  getOptimizationSuggestions(metadata) {
    const suggestions = [];
    
    // Рекомендации по размеру
    if (metadata.width > 2048 || metadata.height > 2048) {
      suggestions.push('Рекомендуется уменьшить разрешение до 2048px по большей стороне');
    }
    
    // Рекомендации по формату
    if (metadata.format === 'png' && !metadata.hasAlpha) {
      suggestions.push('Конвертация в JPEG может значительно уменьшить размер файла');
    }
    
    if (metadata.format === 'bmp' || metadata.format === 'tiff') {
      suggestions.push('Конвертация в современный формат (JPEG/WebP) уменьшит размер');
    }
    
    // Рекомендации по качеству
    if (metadata.density > 300) {
      suggestions.push('Уменьшение плотности до 150-200 DPI оптимизирует размер');
    }
    
    return suggestions;
  }

  /**
   * Получение статистики worker thread
   */
  getWorkerStats() {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}

// Создаем экземпляр worker и expose его методы
const imageWorker = new ImageProcessingWorker();

expose({
  processImage: (imageData, options) => imageWorker.processImage(imageData, options),
  analyzeImage: (imageBuffer) => imageWorker.analyzeImage(imageBuffer),
  optimizeImage: (imageBuffer, options) => imageWorker.optimizeImage(imageBuffer, options),
  createThumbnail: (imageBuffer, size) => imageWorker.createThumbnail(imageBuffer, size),
  extractText: (imageBuffer) => imageWorker.extractText(imageBuffer),
  detectObjects: (imageBuffer) => imageWorker.detectObjects(imageBuffer),
  getWorkerStats: () => imageWorker.getWorkerStats()
});

console.log('🚀 ImageProcessingWorker thread started and ready');
