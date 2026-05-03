// AI Tavern - Configuration & API Settings
// All config is stored in localStorage for persistence

const DEFAULT_CONFIG = {
  apiEndpoint: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 1000,
  playerName: 'Adventurer',
  playerClass: 'fighter',
  playerRace: 'human'
};

const Config = {
  _data: null,

  init() {
    const saved = localStorage.getItem('ai-tavern-config');
    this._data = saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    return this;
  },

  get(key) {
    return this._data[key];
  },

  set(key, value) {
    this._data[key] = value;
    this.save();
  },

  getAll() {
    return { ...this._data };
  },

  save() {
    localStorage.setItem('ai-tavern-config', JSON.stringify(this._data));
  },

  reset() {
    this._data = { ...DEFAULT_CONFIG };
    this.save();
  },

  isConfigured() {
    return this._data.apiKey && this._data.apiKey.length > 0;
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this._data.apiKey}`
    };
  }
};
