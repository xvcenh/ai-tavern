// SVG Scene Engine - Core
// Lightweight engine for AI-driven SVG scene composition

const Engine = {
  ready: false,

  async init() {
    console.log('[Engine] Initializing SVG Scene Engine...');

    // Initialize shared modules
    EventBus.clear();
    LLMClient.loadConfig();

    // Load SVG assets into renderer
    await SVGRenderer.init();

    // Initialize scene manager
    SceneManager.init();

    this.ready = true;
    EventBus.emit('engine:ready');
    console.log('[Engine] Ready. ' + SVGRenderer.loadedCount + ' SVG assets loaded.');
  },

  /**
   * Streaming version of describeScene.
   * Yields incremental updates as the LLM generates tokens.
   *
   * @param {string} text - Natural language scene description
   * @param {Array} history - Optional conversation history
   * @yields {{ type: 'narration'|'scene'|'done', content: string, scene_update?: Object }}
   */
  async *describeSceneStream(text, history = []) {
    if (!LLMClient.isReady()) {
      throw new Error('LLM not configured. Call LLMClient.configure({ endpoint, apiKey, model }) first.');
    }

    const systemPrompt = SceneDSL.getSystemPrompt();
    const messages = [
      { role: 'system', content: systemPrompt + '\n\n你必须以纯JSON格式回复，不要包含markdown代码块标记。' },
      ...history.slice(-10),
      { role: 'user', content: text }
    ];

    let buffer = '';
    let narrationDone = false;
    let sceneApplied = false;

    // Streaming JSON extraction state
    let narrationText = '';

    for await (const chunk of LLMClient.chatStream(messages, { temperature: 0.3 })) {
      if (chunk.type === 'done') break;
      if (chunk.type !== 'token') continue;

      buffer += chunk.content;

      // ── Extract narration in real-time ──
      if (!narrationDone) {
        const extracted = this._extractNarrationStream(buffer);
        if (extracted.newText) {
          narrationText = extracted.full;
          yield { type: 'narration', content: extracted.newText };
        }
        if (extracted.done) narrationDone = true;
      }

      // ── Try to extract scene_update when narration is done ──
      if (narrationDone && !sceneApplied) {
        const sceneUpdate = this._extractSceneUpdate(buffer);
        if (sceneUpdate) {
          SceneManager.applyUpdate(sceneUpdate);
          sceneApplied = true;
          yield { type: 'scene', scene_update: sceneUpdate };
        }
      }
    }

    // ── Final fallback: try to parse entire buffer ──
    if (!sceneApplied) {
      try {
        const parsed = JSON.parse(buffer.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
        if (parsed.scene_update) {
          SceneManager.applyUpdate(parsed.scene_update);
          yield { type: 'scene', scene_update: parsed.scene_update };
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    }

    yield { type: 'done', content: '' };
  },

  /**
   * Extract narration text from partial JSON buffer.
   * Returns { full: string, newText: string, done: boolean }
   */
  _extractNarrationStream(buffer) {
    // Find narration value between quotes
    const match = buffer.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match) {
      return { full: match[1], newText: '', done: true };
    }

    // Partial narration — extract what we have so far
    const partialMatch = buffer.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (partialMatch) {
      const text = partialMatch[1];
      return { full: text, newText: text, done: false };
    }

    return { full: '', newText: '', done: false };
  },

  /**
   * Try to extract a complete scene_update object from the buffer.
   * Returns the parsed object or null.
   */
  _extractSceneUpdate(buffer) {
    // Find the scene_update portion
    const sceneIdx = buffer.indexOf('"scene_update"');
    if (sceneIdx < 0) return null;

    // Try to parse from scene_update to end
    const fromScene = '{' + buffer.substring(sceneIdx);

    // Try progressively: find matching closing brace
    let depth = 0;
    let endIdx = -1;
    for (let i = 0; i < fromScene.length; i++) {
      if (fromScene[i] === '{') depth++;
      else if (fromScene[i] === '}') {
        depth--;
        if (depth === 0) { endIdx = i + 1; break; }
      }
    }

    if (endIdx < 0) return null;

    try {
      const partial = fromScene.substring(0, endIdx);
      const parsed = JSON.parse(partial);
      return parsed.scene_update || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Send text to LLM and get structured scene update.
   * This is the main API: describe a scene in natural language,
   * and the engine will compose the matching SVG scene.
   *
   * @param {string} text - Natural language scene description or user message
   * @param {Array} history - Optional conversation history
   * @returns {Object} - { narration, scene_update, choices }
   */
  async describeScene(text, history = []) {
    if (!LLMClient.isReady()) {
      throw new Error('LLM not configured. Call LLMClient.configure({ endpoint, apiKey, model }) first.');
    }

    const systemPrompt = SceneDSL.getSystemPrompt();
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add recent history
    for (const entry of history.slice(-10)) {
      messages.push(entry);
    }

    messages.push({ role: 'user', content: text });

    const result = await LLMClient.chatStructured(messages);

    // Apply scene update if present
    if (result.scene_update) {
      SceneManager.applyUpdate(result.scene_update);
    }

    return result;
  },

  /**
   * Apply a scene update directly (without LLM).
   * Use this for programmatic scene control.
   */
  applyScene(update) {
    SceneManager.applyUpdate(update);
  },

  /**
   * Get current scene state (for persistence).
   */
  getState() {
    return SceneManager.getState();
  },

  /**
   * Restore scene state.
   */
  setState(state) {
    SceneManager.setState(state);
  }
};
