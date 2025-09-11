(function () {
  // 检查 WorldBookKit 是否加载
  if (!window.WorldBookKit) {
    console.error('[WorldBook] WorldBookKit not found! Ensure ./public/worldbook/index.iife.js is loaded correctly');
    return;
  }
  
  const { WorldBookEngine, WorldBookImporter } = window.WorldBookKit;
  console.log('[WorldBook] loaded engine');

  const WB = {
    engine: new WorldBookEngine({ seed: 42 }),
    book: null,
    loadedInfo: '未加载',
    
    async load(url = './public/worldbook/samples/travel.worldbook.json') {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.book = WorldBookImporter?.import ? WorldBookImporter.import(data) : data;
        const n = this.book?.entries?.length ?? 0;
        this.loadedInfo = `${this.book?.name || 'WorldBook'}（${n} 条目）`;
        console.log('[WorldBook] loaded:', this.loadedInfo);
        this.updateUIBadge();
      } catch (e) {
        console.warn('[WorldBook] fetch failed, creating local load button:', e);
        this.createLocalLoadButton();
        this.loadedInfo = '点击加载本地文件';
        this.updateUIBadge();
      }
    },
    
    createLocalLoadButton() {
      const btn = document.createElement('button');
      btn.textContent = '加载世界书（本地）';
      btn.style.cssText = `
        position: fixed; top: 50px; right: 10px; z-index: 1001;
        padding: 8px 12px; background: #4CAF50; color: white;
        border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
      `;
      btn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const data = JSON.parse(event.target.result);
                this.book = WorldBookImporter?.import ? WorldBookImporter.import(data) : data;
                const n = this.book?.entries?.length ?? 0;
                this.loadedInfo = `${this.book?.name || 'WorldBook'}（${n} 条目）`;
                this.updateUIBadge();
                btn.remove();
                console.log('[WorldBook] loaded from local file:', this.loadedInfo);
              } catch (err) {
                console.error('[WorldBook] JSON parse error:', err);
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      };
      document.body.appendChild(btn);
    },
    
    updateUIBadge() {
      let badge = document.querySelector('#worldbook-status-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'worldbook-status-badge';
        badge.style.cssText = `
          position: fixed; top: 10px; right: 10px; z-index: 1000;
          background: rgba(0,0,0,0.7); color: white; padding: 5px 10px;
          border-radius: 15px; font-size: 12px; pointer-events: none;
        `;
        document.body.appendChild(badge);
      }
      badge.textContent = `WorldBook: ${this.loadedInfo}`;
    },
    
    async build(scanText, chatHistory = []) {
      if (!this.book) return { slots: [], loreText: '' };
      const result = this.engine.process(this.book, scanText);
      return { slots: result.slots, loreText: result.finalPrompt || '' };
    }
  };

  window.WorldBook = WB;

  // 启动加载
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => WB.load(), 100);
  });

  // 接入发送流程
  function hookSendPipeline() {
    setTimeout(() => {
      // 监听聊天表单提交
      const form = document.querySelector('#chat-input-form');
      const input = document.querySelector('#chat-input');
      
      if (form && input) {
        form.addEventListener('submit', async (ev) => {
          const text = input.value.trim();
          if (!text || !WB.book) return;
          
          try {
            const messages = document.querySelectorAll('.message');
            const history = Array.from(messages).map(m => m.textContent || '');
            const { loreText } = await WB.build(text, history);
            
            if (loreText && window.AIModule) {
              const originalSystem = window.AIModule.systemPrompt || '';
              window.AIModule.systemPrompt = `[World Info]\n${loreText}\n\n${originalSystem}`;
              console.log('[WorldBook] hooked: injected lore into system prompt');
              
              setTimeout(() => {
                window.AIModule.systemPrompt = originalSystem;
              }, 100);
            }
          } catch (e) {
            console.warn('[WorldBook] hook error:', e);
          }
        }, { capture: true });
        
        console.log('[WorldBook] hooked chat form');
      }
    }, 1000);
  }

  hookSendPipeline();
})();