// SVG Scene Engine - LLM Client
// Unified LLM API interface with structured output support
// No external config dependency — configure directly via LLMClient.configure()

const LLMClient = {
  _endpoint: '',
  _apiKey: '',
  _model: '',
  _temperature: 0.4,
  _maxTokens: 2048,

  /**
   * Configure the LLM client.
   * @param {Object} config - { endpoint, apiKey, model, temperature?, maxTokens? }
   */
  configure(config) {
    this._endpoint = config.endpoint || '';
    this._apiKey = config.apiKey || '';
    this._model = config.model || 'gpt-4o-mini';
    if (config.temperature !== undefined) this._temperature = config.temperature;
    if (config.maxTokens !== undefined) this._maxTokens = config.maxTokens;
  },

  /**
   * Load config from localStorage.
   */
  loadConfig() {
    const saved = localStorage.getItem('svg-scene-engine-config');
    if (saved) {
      try {
        this.configure(JSON.parse(saved));
      } catch (e) { /* ignore */ }
    }
  },

  /**
   * Save config to localStorage.
   */
  saveConfig() {
    localStorage.setItem('svg-scene-engine-config', JSON.stringify({
      endpoint: this._endpoint,
      apiKey: this._apiKey,
      model: this._model,
      temperature: this._temperature,
      maxTokens: this._maxTokens
    }));
  },

  isReady() {
    return !!(this._endpoint && this._apiKey);
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this._apiKey}`
    };
  },

  // Basic chat completion
  async chat(messages, options = {}) {
    const model = options.model || this._model;
    const body = {
      model,
      messages,
      temperature: options.temperature || this._temperature,
      max_tokens: options.max_tokens || this._maxTokens
    };

    if (options.response_format) {
      body.response_format = options.response_format;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 60000);

    try {
      const response = await fetch(`${this._endpoint}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return data.choices[0].message;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('LLM request timed out');
      throw err;
    }
  },

  // Chat with structured JSON output + fallback parsing
  async chatStructured(messages, schema = null) {
    const structuredMessages = messages.map(m => ({ ...m }));

    // Ensure JSON instruction is in system prompt
    const sysIdx = structuredMessages.findIndex(m => m.role === 'system');
    if (sysIdx >= 0) {
      structuredMessages[sysIdx] = {
        ...structuredMessages[sysIdx],
        content: structuredMessages[sysIdx].content +
          '\n\n你必须以纯JSON格式回复，不要包含markdown代码块标记。'
      };
    }

    const options = {
      response_format: { type: 'json_object' },
      temperature: 0.3
    };

    const result = await this.chat(structuredMessages, options);
    const rawContent = result.content;

    // Try to parse as JSON
    let parsed = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      // Fallback: strip markdown fences
      try {
        const stripped = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(stripped);
      } catch (e2) {
        console.warn('[LLMClient] JSON parse failed, wrapping as narration.');
      }
    }

    if (parsed) {
      if (!parsed.narration) {
        parsed.narration = parsed.text || parsed.content || rawContent;
      }
      return parsed;
    }

    // Final fallback
    return {
      narration: rawContent,
      scene_update: null,
      choices: null
    };
  },

  // Simple text completion
  async complete(prompt, systemPrompt = null) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const result = await this.chat(messages);
    return result.content;
  }
};
