(function () {
  if (!window.WorldBookKit) {
    console.warn('[WorldBook] WorldBookKit not found: /worldbook/index.global.js not loaded');
    return;
  }
  const { WorldBookEngine, WorldBookImporter } = window.WorldBookKit;

  const WB = {
    engine: new WorldBookEngine({ seed: 42 }), // 固定随机，便于复现；删掉 seed 可更随机
    book: null,
    loadedInfo: '未加载',
    async load(url = 'public/worldbook/samples/travel.worldbook.json') {
      try {
        const res = await fetch(url);
        const data = await res.json();
        this.book = WorldBookImporter?.import ? WorldBookImporter.import(data) : data;
        const n = this.book?.entries?.length ?? 0;
        this.loadedInfo = `${this.book?.name || 'WorldBook'}（${n} 条目）`;
        console.log('[WorldBook] loaded:', this.loadedInfo);
        this.updateUIBadge();
      } catch (e) {
        console.error('[WorldBook] load failed', e);
        this.loadedInfo = '加载失败';
        this.updateUIBadge();
      }
    },
    updateUIBadge() {
      // 更新界面角标显示
      const badge = document.querySelector('#worldbook-status-badge');
      if (badge) {
        badge.textContent = `WorldBook: ${this.loadedInfo}`;
      }
    },
    async build(scanText, chatHistory, opts = {}) {
      if (!this.book) return { slots: [], loreText: '' };
      // 使用新的 process API
      const result = this.engine.process(this.book, scanText);
      const loreText = result.finalPrompt || '';
      return { slots: result.slots, loreText };
    },
    // 简单的拼接策略：把世界书放进 Author's Note（若无则前置到系统提示）
    mergePrompt({ originalSystem = '', originalUser = '', originalAN = '' }, loreText) {
      if (!loreText) return { system: originalSystem, user: originalUser, an: originalAN };
      // 优先贴到 A/N；如果没有 A/N，就前置到 system
      if (typeof originalAN === 'string' && originalAN.length >= 0) {
        return { system: originalSystem, user: originalUser, an: `\n[World Info]\n${loreText}\n${originalAN}` };
      }
      return { system: `\n[World Info]\n${loreText}\n${originalSystem}`, user: originalUser, an: originalAN };
    }
  };

  // 暴露到 window，便于调试与手动调用
  window.WorldBook = WB;

  // 启动时尝试加载示例世界书（你也可以改成配置项 / localStorage）
  window.addEventListener('load', () => {
    // 延迟加载以确保 DOM 已准备好
    setTimeout(() => {
      WB.load().catch(err => {
        console.warn('[WorldBook] Auto-load failed, will retry on first use', err);
      });
    }, 500);
  });

  /**
   * 接入发送流程（两种策略：找到现有发送函数 or 包裹发送按钮）
   */
  function hookSendPipeline() {
    // 等待主应用初始化完成
    setTimeout(() => {
      // 1) 尝试找到聊天发送函数
      if (window.ChatModule && typeof window.ChatModule.sendMessage === 'function') {
        const original = window.ChatModule.sendMessage;
        window.ChatModule.sendMessage = async function (text, ...rest) {
          try {
            // 获取聊天历史
            const messages = window.StateManager?.get?.()?.messages || [];
            const history = messages.map(m => m.text || m.content || '');
            const { loreText } = await WB.build(text, history);
            
            // 如果有世界书内容，合并到系统提示词
            if (loreText && window.AIModule) {
              const originalSystem = window.AIModule.systemPrompt || '';
              window.AIModule.systemPrompt = `${loreText}\n\n${originalSystem}`;
              console.log('[WorldBook] Injected lore into system prompt');
            }
            
            return await original.call(this, text, ...rest);
          } catch (e) {
            console.warn('[WorldBook] hookSendPipeline error, fallback to original', e);
            return await original.call(this, text, ...rest);
          }
        };
        console.log('[WorldBook] hooked: ChatModule.sendMessage');
        return;
      }
      
      // 2) 退化：监听发送按钮和表单提交
      const form = document.querySelector('#chat-input-form');
      const input = document.querySelector('#chat-input');
      
      if (form && input) {
        form.addEventListener('submit', async (ev) => {
          // 不阻止默认提交，只是在提交前注入世界书内容
          const text = input.value.trim();
          if (!text || !WB.book) return;
          
          try {
            // 获取聊天历史
            const messages = document.querySelectorAll('.message');
            const history = Array.from(messages).map(m => m.textContent || '');
            const { loreText } = await WB.build(text, history);
            
            if (loreText) {
              // 尝试注入到 AI 系统提示词
              if (window.AIModule && window.AIModule.systemPrompt !== undefined) {
                const originalSystem = window.AIModule.systemPrompt || '';
                // 临时修改系统提示词
                window.AIModule.systemPrompt = `[World Info]\n${loreText}\n\n${originalSystem}`;
                console.log('[WorldBook] Injected lore into system prompt via form hook');
                
                // 在消息发送后恢复原始系统提示词
                setTimeout(() => {
                  window.AIModule.systemPrompt = originalSystem;
                }, 100);
              }
            }
          } catch (e) {
            console.warn('[WorldBook] Form hook error:', e);
          }
        }, { capture: true });
        
        console.log('[WorldBook] hooked DOM form submission');
      } else {
        console.warn('[WorldBook] Cannot find chat form or input; integration may not work properly.');
      }
    }, 1000);
  }

  // 添加 UI 角标到页面
  function addUIBadge() {
    // 在主页添加状态显示
    const homeScreen = document.querySelector('#home-screen');
    if (homeScreen) {
      const badge = document.createElement('div');
      badge.id = 'worldbook-status-badge';
      badge.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
      `;
      badge.textContent = `WorldBook: ${WB.loadedInfo}`;
      document.body.appendChild(badge);
    }
  }

  // 初始化
  hookSendPipeline();
  addUIBadge();
})();