/**
 * MiMo API Client
 * 封装小米 MiMo 三模型调用（Omni/Pro/TTS）
 * 支持流式响应、TTS 语音合成、多模态输入
 */

const MIMO_API_BASE = process.env.MIMO_API_BASE || 'https://token-plan-cn.xiaomimimo.com/v1';
const MIMO_API_KEY = process.env.MIMO_API_KEY || '';

const MODELS = {
  OMNI: 'MiMo-V2-Omni',    // 多模态视觉理解
  PRO: 'MiMo-V2-Pro',      // 推理引擎
  TTS: 'MiMo-V2.5-TTS',    // 语音合成
  FLASH: 'MiMo-V2-Flash',  // 快速推理
};

class MiMoClient {
  constructor(apiKey = MIMO_API_KEY, baseUrl = MIMO_API_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.demoMode = !apiKey || apiKey === 'YOUR_KEY';
    this.stats = { totalTokens: 0, totalCalls: 0, byModel: {} };
  }

  /**
   * Chat Completions API（Omni/Pro/Flash 共用）
   */
  async chat(model, messages, options = {}) {
    if (this.demoMode) {
      return this._demoResponse(model, messages);
    }

    const body = {
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: options.stream || false,
    };

    if (options.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiMo API error ${res.status}: ${err}`);
    }

    if (options.stream) {
      return this._handleStream(res);
    }

    const data = await res.json();
    const usage = data.usage || {};
    this._trackUsage(model, usage.total_tokens || 0);

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      model: data.model,
    };
  }

  /**
   * 多模态调用（图片+文字）
   */
  async vision(model, imageUrl, prompt, options = {}) {
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }];
    return this.chat(model, messages, options);
  }

  /**
   * 文件内容识别（base64）
   */
  async recognizeFile(base64Data, mimeType, prompt, options = {}) {
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return this.vision(MODELS.OMNI, dataUrl, prompt, options);
  }

  /**
   * TTS 语音合成
   */
  async synthesize(text, options = {}) {
    if (this.demoMode) {
      return this._demoTTS();
    }

    const body = {
      model: MODELS.TTS,
      input: text,
      voice: options.voice || 'alloy',
      response_format: options.format || 'mp3',
      speed: options.speed || 1.0,
    };

    const res = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiMo TTS error ${res.status}: ${err}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    this._trackUsage(MODELS.TTS, Math.ceil(text.length / 2));

    return {
      audio: buffer,
      format: options.format || 'mp3',
      textLength: text.length,
    };
  }

  /**
   * 流式响应处理
   */
  async _handleStream(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const chunk = JSON.parse(json);
            const delta = chunk.choices?.[0]?.delta?.content || '';
            fullContent += delta;
          } catch {}
        }
      }
    }

    return { content: fullContent, stream: true };
  }

  /**
   * Demo 模式响应
   */
  _demoResponse(model, messages) {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const isImage = Array.isArray(lastMsg);

    let content;
    if (model === MODELS.OMNI && isImage) {
      content = JSON.stringify({
        documents: [{ type: '合同', confidence: 0.95, pages: 3 }],
        parties: [{ name: '甲方', role: '供应商' }, { name: '乙方', role: '采购方' }],
        keyTerms: ['合同期限: 2年', '付款方式: 月结30天', '违约金: 合同金额10%'],
        risks: ['违约金比例偏高', '付款周期较长'],
        summary: '标准采购合同，需关注违约条款和付款条件。',
      });
    } else {
      content = `[Demo] 基于 MiMo ${model} 的分析结果：\n\n收到您的请求，这是一个模拟响应。接入真实 API 后将返回完整的分析结果。\n\n关键发现：\n1. 文档包含标准商务条款\n2. 存在 3 个需要关注的风险点\n3. 建议在签约前进行进一步谈判`;
    }

    this._trackUsage(model, 500);
    return {
      content,
      usage: { promptTokens: 200, completionTokens: 300, totalTokens: 500 },
      model,
      demo: true,
    };
  }

  /**
   * Demo TTS
   */
  _demoTTS() {
    this._trackUsage(MODELS.TTS, 100);
    return {
      audio: Buffer.alloc(0),
      format: 'mp3',
      textLength: 0,
      demo: true,
    };
  }

  /**
   * 统计跟踪
   */
  _trackUsage(model, tokens) {
    this.stats.totalTokens += tokens;
    this.stats.totalCalls++;
    if (!this.stats.byModel[model]) {
      this.stats.byModel[model] = { calls: 0, tokens: 0 };
    }
    this.stats.byModel[model].calls++;
    this.stats.byModel[model].tokens += tokens;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { MiMoClient, MODELS };
