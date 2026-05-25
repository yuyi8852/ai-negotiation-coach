/**
 * Validators - 输入验证和数据校验工具集
 * 提供请求验证、数据清洗、格式校验等能力
 */

class Validators {
  /**
   * 验证分析请求
   */
  static validateAnalysisRequest(body) {
    const errors = [];
    const warnings = [];

    if (!body) {
      errors.push({ field: 'body', message: 'Request body is required' });
      return { valid: false, errors, warnings };
    }

    // 文档内容验证
    if (!body.document) {
      errors.push({ field: 'document', message: 'Document content is required' });
    } else {
      if (typeof body.document === 'string' && body.document.trim().length < 10) {
        errors.push({ field: 'document', message: 'Document content too short (min 10 chars)' });
      }
      if (typeof body.document === 'string' && body.document.length > 100000) {
        warnings.push({ field: 'document', message: 'Document content very long, may be truncated' });
      }
    }

    // 行业验证
    const validIndustries = ['tech', 'manufacturing', 'finance', 'retail', 'construction', 'healthcare', 'education', 'energy', 'automotive', 'real-estate'];
    if (body.industry && !validIndustries.includes(body.industry)) {
      warnings.push({
        field: 'industry',
        message: `Unknown industry: ${body.industry}. Supported: ${validIndustries.join(', ')}`,
      });
    }

    // 文件上传大小验证
    if (body.fileSize) {
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (body.fileSize > maxSize) {
        errors.push({ field: 'fileSize', message: `File too large: ${body.fileSize} bytes (max: ${maxSize})` });
      }
    }

    // 图片 MIME 类型验证
    if (body.mimeType) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];
      if (!allowedTypes.includes(body.mimeType)) {
        errors.push({ field: 'mimeType', message: `Unsupported file type: ${body.mimeType}` });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: Validators.sanitize(body),
    };
  }

  /**
   * 验证上传文件
   */
  static validateFileUpload(file) {
    const errors = [];

    if (!file) {
      errors.push({ field: 'file', message: 'No file provided' });
      return { valid: false, errors };
    }

    // 文件名验证
    if (file.originalname) {
      const dangerousPatterns = [
        /\.\.\//,
        /^[\/]/,
        /[<>:"|?*]/,
        /\.(exe|bat|cmd|sh|ps1|vbs|js|jar)$/i,
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(file.originalname)) {
          errors.push({ field: 'filename', message: 'Potentially dangerous filename detected' });
          break;
        }
      }
    }

    // 文件大小验证
    const limits = {
      image: 10 * 1024 * 1024,   // 10MB for images
      document: 20 * 1024 * 1024, // 20MB for documents
      audio: 15 * 1024 * 1024,    // 15MB for audio
    };

    const fileType = Validators._getFileType(file.mimetype || file.originalname);
    const maxSize = limits[fileType] || limits.document;

    if (file.size && file.size > maxSize) {
      errors.push({
        field: 'fileSize',
        message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max: ${(maxSize / 1024 / 1024).toFixed(0)}MB for ${fileType})`,
      });
    }

    // 空文件检查
    if (file.size === 0) {
      errors.push({ field: 'fileSize', message: 'File is empty' });
    }

    return { valid: errors.length === 0, errors, fileType };
  }

  /**
   * 验证会话 ID
   */
  static validateSessionId(id) {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'Session ID must be a non-empty string' };
    }
    // UUID 或时间戳格式
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const timestampPattern = /^\d{13,}$/;
    if (!uuidPattern.test(id) && !timestampPattern.test(id)) {
      return { valid: false, error: 'Invalid session ID format' };
    }
    return { valid: true };
  }

  /**
   * 验证 API 请求参数
   */
  static validateParams(params, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = params[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type && typeof value !== rules.type) {
        errors.push({ field, message: `${field} must be of type ${rules.type}` });
        continue;
      }

      if (rules.minLength && String(value).length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      }

      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      }

      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push({ field, message: `${field} must be >= ${rules.min}` });
      }

      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push({ field, message: `${field} must be <= ${rules.max}` });
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
      }

      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push({ field, message: `${field} format is invalid` });
      }

      if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value);
        if (customError) {
          errors.push({ field, message: customError });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 清洗文本输入（防注入）
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * 清洗对象中的所有字符串字段
   */
  static sanitize(obj) {
    if (typeof obj === 'string') return Validators.sanitizeText(obj);
    if (Array.isArray(obj)) return obj.map(item => Validators.sanitize(item));
    if (obj && typeof obj === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = Validators.sanitize(value);
      }
      return cleaned;
    }
    return obj;
  }

  /**
   * 验证 JSON 结构
   */
  static validateJSON(text, expectedSchema = null) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { valid: false, error: `JSON parse error: ${e.message}` };
    }

    if (!expectedSchema) return { valid: true, data: parsed };

    // 简单 schema 验证
    const errors = [];
    for (const [key, type] of Object.entries(expectedSchema)) {
      if (type === 'required' && !(key in parsed)) {
        errors.push({ field: key, message: 'Required field missing' });
      } else if (typeof type === 'string' && typeof parsed[key] !== type) {
        errors.push({ field: key, message: `Expected type ${type}` });
      }
    }

    return { valid: errors.length === 0, errors, data: parsed };
  }

  /**
   * 限制字符串长度
   */
  static truncate(text, maxLength, suffix = '...') {
    if (!text || typeof text !== 'string') return text;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 检测文本语言
   */
  static detectLanguage(text) {
    if (!text) return 'unknown';
    const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;
    const japaneseRatio = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length / text.length;
    const koreanRatio = (text.match(/[\uac00-\ud7af]/g) || []).length / text.length;

    if (chineseRatio > 0.3) return 'zh';
    if (japaneseRatio > 0.1) return 'ja';
    if (koreanRatio > 0.1) return 'ko';
    return 'en';
  }

  // ---- 内部方法 ----

  static _getFileType(mimeType) {
    if (!mimeType) return 'document';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}

module.exports = { Validators };
