// AI Tavern - UI System
// Renders all panels: character sheet, inventory, dialogue, modals, toasts

const UI = {
  elements: {},

  init() {
    // Cache DOM elements
    this.elements = {
      sideTabs: document.getElementById('side-tabs'),
      sideContent: document.getElementById('side-content'),
      dmNarration: document.getElementById('dm-narration'),
      playerInput: document.getElementById('player-input'),
      daynight: document.getElementById('daynight-indicator'),
      location: document.getElementById('location-label'),
      loading: document.getElementById('loading-screen'),
      app: document.getElementById('app')
    };
    
    // Initialize tab switching
    this.setupTabs();
    
    // Input handler
    this.setupInput();
  },

  setupTabs() {
    const tabs = this.elements.sideTabs.querySelectorAll('button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        const contents = this.elements.sideContent.querySelectorAll('.tab-content');
        contents.forEach(c => c.classList.remove('active'));
        const active = document.getElementById(`tab-${target}`);
        if (active) active.classList.add('active');
        if (target === 'character') this.renderCharacterSheet();
        if (target === 'inventory') this.renderInventory();
        if (target === 'quests') this.renderQuests();
      });
    });
  },

  setupInput() {
    this.elements.playerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = this.elements.playerInput.value.trim();
        if (text) {
          this.elements.playerInput.value = '';
          Game.handlePlayerAction(text);
        }
      }
    });
  },

  // ---- Narration Panel ----
  addNarration(text, type = 'dm', speaker = null) {
    const div = document.createElement('div');
    div.className = `narr-entry ${type}`;
    
    if (speaker) {
      const sp = document.createElement('div');
      sp.className = 'narr-speaker';
      sp.textContent = speaker;
      div.appendChild(sp);
    }
    
    const content = document.createElement('div');
    content.textContent = text;
    div.appendChild(content);
    
    this.elements.dmNarration.appendChild(div);
    this.elements.dmNarration.scrollTop = this.elements.dmNarration.scrollHeight;
  },

  // ---- Character Sheet ----
  renderCharacterSheet() {
    const container = document.getElementById('tab-character');
    if (!container) return;
    
    const p = Player;
    const cls = p.getClassInfo();
    const race = p.getRaceInfo();
    
    container.innerHTML = `
      <div class="char-header">
        <div class="char-name">${p.name || '未命名'}</div>
        <div class="char-class">${race?.name || ''} ${cls?.name || ''}</div>
        <div class="char-level">等级 ${p.level}</div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-dim)">
          HP: ${p.hp}/${p.maxHp} | AC: ${p.ac} | XP: ${p.xp}/${p.xpToNext}
        </div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${(p.hp/p.maxHp)*100}%;background:var(--danger);transition:width 0.3s"></div>
        </div>
      </div>
      
      <div class="section-title">属性</div>
      <div class="stat-grid">
        ${this.renderStat('💪', '力量', 'str')}
        ${this.renderStat('🎯', '敏捷', 'dex')}
        ${this.renderStat('❤️', '体质', 'con')}
        ${this.renderStat('🧠', '智力', 'int')}
        ${this.renderStat('👁️', '感知', 'wis')}
        ${this.renderStat('💬', '魅力', 'cha')}
      </div>
      
      <div class="section-title">技能</div>
      ${(cls?.skills || []).map(s => `<div style="padding:4px 8px;margin:2px 0;background:var(--bg-card);border-radius:4px;font-size:13px">✨ ${s}</div>`).join('')}
      
      <div class="section-title">武器</div>
      <div style="font-size:13px;padding:4px 8px;background:var(--bg-card);border-radius:4px">⚔️ ${cls?.weapon || '拳头'}</div>
    `;
  },

  renderStat(emoji, label, stat) {
    const val = Player.stats[stat];
    const mod = Player.getModifier(stat);
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const modClass = mod >= 0 ? 'pos' : 'neg';
    return `
      <div class="stat-box">
        <div style="font-size:14px">${emoji}</div>
        <div class="stat-value">${val}</div>
        <div class="stat-label">${label}</div>
        <div class="stat-mod ${modClass}">${modStr}</div>
      </div>
    `;
  },

  // ---- Inventory ----
  renderInventory() {
    const container = document.getElementById('tab-inventory');
    if (!container) return;
    
    container.innerHTML = `
      <div class="section-title">金币：🪙 ${Player.gold}</div>
      <div class="section-title">物品</div>
      ${Player.inventory.length === 0 ? '<div style="color:var(--text-dim);font-size:13px">空空如也...</div>' : 
        Player.inventory.map(item => `
          <div class="item-slot">
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-qty">x${item.qty}</div>
          </div>
        `).join('')}
    `;
  },

  // ---- Quests ----
  renderQuests() {
    const container = document.getElementById('tab-quests');
    if (!container) return;
    
    const active = DM.worldState.activeQuests || [];
    const completed = DM.worldState.completedQuests || [];
    
    container.innerHTML = `
      <div class="section-title">进行中 (${active.length})</div>
      ${active.length === 0 ? '<div style="color:var(--text-dim);font-size:13px">暂无任务</div>' :
        active.map(q => `
          <div style="padding:8px;margin:4px 0;background:var(--bg-card);border-radius:6px;border-left:3px solid var(--gold)">
            <div style="font-size:13px;font-weight:bold;color:var(--gold)">${q.title || '任务'}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${q.desc || ''}</div>
          </div>
        `).join('')}
      
      <div class="section-title">已完成 (${completed.length})</div>
      ${completed.length === 0 ? '<div style="color:var(--text-dim);font-size:13px">还没有完成任何任务</div>' :
        completed.slice(-5).map(q => `
          <div style="padding:4px 8px;margin:2px 0;font-size:12px;color:var(--text-dim)">✅ ${q.title || '任务'}</div>
        `).join('')}
    `;
  },

  // Update HUD elements
  updateHUD() {
    // Day/Night indicator
    const phaseIcons = { day: '☀️', dusk: '🌅', dawn: '🌄', night: '🌙' };
    const phaseNames = { day: '白天', dusk: '黄昏', dawn: '黎明', night: '深夜' };
    const hour = Math.floor(Map.timeOfDay);
    const minute = Math.floor((Map.timeOfDay - hour) * 60);
    this.elements.daynight.textContent = `${phaseIcons[Map.dayPhase]} ${phaseNames[Map.dayPhase]} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} | 第${DM.worldState.day}天`;
    
    // Location label
    const nearLoc = Map.getNearbyLocation(2.5);
    if (nearLoc) {
      this.elements.location.textContent = `${nearLoc.location.icon} ${nearLoc.location.name}`;
    } else {
      this.elements.location.textContent = '🌿 旷野';
    }
    
    // Update character sheet if visible
    const charTab = document.getElementById('tab-character');
    if (charTab && charTab.classList.contains('active')) {
      this.renderCharacterSheet();
    }
  },

  // ---- Modals ----
  showModal(title, content, buttons = []) {
    // Remove existing modal
    this.closeModal();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    
    const btnHtml = buttons.map(b => 
      `<button class="${b.cls || ''}" id="modal-btn-${b.id}">${b.text}</button>`
    ).join('');
    
    overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <div>${content}</div>
        <div style="display:flex;gap:8px">${btnHtml}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Bind buttons
    buttons.forEach(b => {
      const el = document.getElementById(`modal-btn-${b.id}`);
      if (el) {
        el.addEventListener('click', () => {
          if (b.callback) b.callback();
          this.closeModal();
        });
      }
    });
    
    return overlay;
  },

  closeModal() {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();
  },

  // ---- Character Creation Modal ----
  showCharacterCreation() {
    let selectedRace = 'human';
    let selectedClass = 'fighter';
    let charName = '';
    
    const updatePreview = () => {
      const cls = CLASSES[selectedClass];
      const race = RACES[selectedRace];
      const preview = document.getElementById('char-preview');
      if (preview) {
        preview.innerHTML = `
          <div style="text-align:center;padding:12px;background:var(--bg-dark);border-radius:8px">
            <div style="font-size:32px">${cls?.name === '战士' ? '⚔️' : cls?.name === '盗贼' ? '🗡️' : cls?.name === '法师' ? '🔮' : cls?.name === '游侠' ? '🏹' : cls?.name === '牧师' ? '✝️' : '🎵'}</div>
            <div style="font-size:16px;color:var(--gold);margin-top:4px">${charName || '???'}</div>
            <div style="font-size:12px;color:var(--text-dim)">${race?.name} ${cls?.name}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${cls?.desc}</div>
          </div>
        `;
      }
    };
    
    const content = `
      <label>角色名字</label>
      <input id="create-name" placeholder="输入你的名字..." value="" oninput="document._charName=this.value;document._updatePreview()">
      
      <label>种族</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">
        ${Object.entries(RACES).map(([id, race]) => `
          <div class="race-option" data-race="${id}" style="padding:8px;background:var(--bg-card);border:2px solid ${id===selectedRace?'var(--gold)':'var(--border)'};border-radius:8px;cursor:pointer;text-align:center;font-size:12px;transition:all 0.2s" onclick="document._selectRace('${id}')">
            ${race.name}
          </div>
        `).join('')}
      </div>
      
      <label>职业</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px">
        ${Object.entries(CLASSES).map(([id, cls]) => `
          <div class="class-option" data-class="${id}" style="padding:10px;background:var(--bg-card);border:2px solid ${id===selectedClass?'var(--gold)':'var(--border)'};border-radius:8px;cursor:pointer;text-align:center;transition:all 0.2s" onclick="document._selectClass('${id}')">
            <div style="font-size:14px;font-weight:bold">${cls.name}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${cls.desc}</div>
          </div>
        `).join('')}
      </div>
      
      <div id="char-preview"></div>
    `;
    
    // Setup global handlers
    document._charName = charName;
    document._selectedRace = selectedRace;
    document._selectedClass = selectedClass;
    
    document._selectRace = (id) => {
      document._selectedRace = id;
      document.querySelectorAll('.race-option').forEach(el => {
        el.style.borderColor = el.dataset.race === id ? 'var(--gold)' : 'var(--border)';
      });
      document._updatePreview();
    };
    
    document._selectClass = (id) => {
      document._selectedClass = id;
      document.querySelectorAll('.class-option').forEach(el => {
        el.style.borderColor = el.dataset.class === id ? 'var(--gold)' : 'var(--border)';
      });
      document._updatePreview();
    };
    
    document._updatePreview = () => {
      document._charName = document.getElementById('create-name')?.value || '';
      updatePreview();
    };
    
    this.showModal('创建你的角色', content, [
      {
        id: 'create',
        text: '开始冒险！',
        cls: '',
        callback: () => {
          const name = document.getElementById('create-name')?.value?.trim();
          if (!name) {
            this.showToast('请输入角色名字');
            return;
          }
          Player.init(name, document._selectedRace, document._selectedClass);
          Game.onCharacterCreated();
        }
      }
    ]);
    
    // Initial update
    setTimeout(updatePreview, 100);
  },

  // ---- API Config Modal ----
  showAPIConfig() {
    const cfg = Config.getAll();
    
    const content = `
      <label>API提供商</label>
      <select id="cfg-endpoint">
        <option value="https://api.deepseek.com/v1" ${cfg.apiEndpoint.includes('deepseek')?'selected':''}>DeepSeek</option>
        <option value="https://api.openai.com/v1" ${cfg.apiEndpoint.includes('openai')?'selected':''}>OpenAI</option>
        <option value="https://api.moonshot.cn/v1" ${cfg.apiEndpoint.includes('moonshot')?'selected':''}>Moonshot</option>
        <option value="custom">自定义...</option>
      </select>
      <input id="cfg-custom-endpoint" placeholder="自定义API地址" value="${cfg.apiEndpoint}" style="display:none">
      
      <label>API密钥</label>
      <input id="cfg-key" type="password" placeholder="sk-..." value="${cfg.apiKey}">
      
      <label>模型名称</label>
      <input id="cfg-model" placeholder="deepseek-chat" value="${cfg.model}">
      
      <label>Temperature (0-2)</label>
      <input id="cfg-temp" type="number" min="0" max="2" step="0.1" value="${cfg.temperature}">
      
      <div style="font-size:11px;color:var(--text-dim);margin-top:4px;text-align:center">
        API密钥仅保存在你的浏览器本地存储中
      </div>
    `;
    
    this.showModal('API设置', content, [
      {
        id: 'save',
        text: '保存',
        callback: () => {
          const endpoint = document.getElementById('cfg-endpoint');
          Config.set('apiEndpoint', endpoint.value === 'custom' ? 
            document.getElementById('cfg-custom-endpoint').value : endpoint.value);
          Config.set('apiKey', document.getElementById('cfg-key').value);
          Config.set('model', document.getElementById('cfg-model').value);
          Config.set('temperature', parseFloat(document.getElementById('cfg-temp').value));
          this.showToast('设置已保存！');
        }
      },
      {
        id: 'cancel',
        text: '取消',
        cls: 'action-btn',
        callback: () => {}
      }
    ]);
    
    // Toggle custom endpoint
    document.getElementById('cfg-endpoint').addEventListener('change', function() {
      const custom = document.getElementById('cfg-custom-endpoint');
      custom.style.display = this.value === 'custom' ? 'block' : 'none';
    });
  },

  // ---- Toast ----
  showToast(text, duration = 2500) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
  },

  // ---- Dice Roll Animation ----
  showDiceRoll(result, duration = 800) {
    const overlay = document.createElement('div');
    overlay.className = 'dice-roll-overlay';
    overlay.innerHTML = `<div class="dice-result">${result}</div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), duration);
  },

  // ---- Loading Screen ----
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.opacity = '0';
      this.elements.loading.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (this.elements.loading) this.elements.loading.remove();
      }, 500);
    }
    if (this.elements.app) {
      this.elements.app.style.display = 'grid';
    }
  },

  // Key binding hint
  showKeyHints() {
    this.showModal('操作指南', `
      <div style="line-height:2">
        <div>⌨️ <b>WASD / 方向键</b> — 移动角色</div>
        <div>🖱️ <b>点击NPC</b> — 对话</div>
        <div>🔤 <b>Enter</b> — 发送指令</div>
        <div>📋 <b>Tab</b> — 切换面板</div>
        <div>⚙️ <b>Esc</b> — 打开菜单</div>
        <div>🎲 <b>R</b> — 掷D20</div>
        <hr style="border-color:var(--border);margin:8px 0">
        <div style="font-size:12px;color:var(--text-dim)">你可以用自然语言做任何事！试试：</div>
        <div style="font-size:12px;color:var(--text-dim)">"我想和铁匠说话"</div>
        <div style="font-size:12px;color:var(--text-dim)">"我偷偷溜进镇长的宅邸"</div>
        <div style="font-size:12px;color:var(--text-dim)">"我要拔出剑准备战斗"</div>
      </div>
    `, [
      { id: 'ok', text: '知道了！', callback: () => {} }
    ]);
  }
};
