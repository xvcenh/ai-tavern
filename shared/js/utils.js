// SVG Scene Engine - Utility Functions
// Shared helpers

const Utils = {
  // Deep clone an object
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Generate a unique ID
  uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Clamp a number between min and max
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  // Lerp (linear interpolation)
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  // Distance between two points
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  // Debounce function
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // Throttle function
  throttle(fn, limit = 100) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Fetch with timeout
  async fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeout}ms`);
      throw err;
    }
  },

  // Load a JS file dynamically
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  },

  // Load a CSS file dynamically
  loadCSS(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = () => reject(new Error(`Failed to load: ${href}`));
      document.head.appendChild(link);
    });
  },

  // Simple template engine: replace {{key}} with values
  template(str, data) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] !== undefined ? data[key] : '');
  },

  // Parse scene tags from text (e.g., [SCENE:crossroad] or [ADD:sheep])
  parseTags(text, tag) {
    const regex = new RegExp(`\\[${tag}:([^\\]]+)\\]`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  },

  // Remove tags from text
  stripTags(text) {
    return text.replace(/\[[\w:]+\]/g, '').trim();
  }
};
