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
