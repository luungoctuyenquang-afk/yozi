(function () {
  if (window.__WB_HIDE_UI === true) return; // 全局强制隐藏
  const IS_HTTP = location.protocol.startsWith('http');
  const IS_DEV  = ['localhost','127.0.0.1'].includes(location.hostname);
  const WB_DEBUG = IS_DEV || localStorage.getItem('WB_DEBUG') === '1';
  if (!window.WorldBookKit) {
    console.error('[WorldBook] 引擎未加载：检查 <script src="./public/worldbook/index.iife.js"> 路径与顺序');
    return;
  }
  const { WorldBookEngine, WorldBookImporter } = window.WorldBookKit;

  const WB = window.WorldBook || (window.WorldBook = {
    engine: new WorldBookEngine({ seed: 42 }),
    book: null,
    loadedInfo: '未加载'
  });

  WB.setBook = function (data, {isST=true}={}) {
    const { WorldBookImporter } = window.WorldBookKit;
    WB.book = (isST && WorldBookImporter?.import) ? WorldBookImporter.import(data) : data;
    const n = WB.book?.entries?.length ?? 0;
    WB.loadedInfo = `${WB.book?.name || 'WorldBook'}（${n} 条目）`;
    console.log('[WorldBook] setBook:', WB.loadedInfo);
  };
  WB.reset = function () {
    const { WorldBookEngine } = window.WorldBookKit;
    WB.engine = new WorldBookEngine({ seed: 42 });
  };
  window.addEventListener('worldbook:updated', e => WB.setBook(e.detail));

  function updateBadge() {
    if (!WB_DEBUG) return;
    let el = document.querySelector('[data-wb-badge]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-wb-badge','1');
      el.style.cssText = 'position:fixed;top:8px;right:160px;z-index:9998;background:rgba(0,0,0,.6);color:#fff;padding:4px 8px;border-radius:8px;padding:4px 8px;font-size:12px;';
      document.body.appendChild(el);
    }
    el.textContent = 'WorldBook: ' + (WB.loadedInfo || '未加载');
  }

  async function loadDefaultBook() {
    if (!IS_HTTP) { injectLocalLoadButton(); return; }
    try {
      const res = await fetch('public/worldbook/samples/travel.worldbook.json');
      const json = await res.json();
      WB.book = WorldBookImporter?.import ? WorldBookImporter.import(json) : json;
      const n = WB.book?.entries?.length ?? 0;
      WB.loadedInfo = `${WB.book?.name || 'WorldBook'}（${n} 条目）`;
      console.log('[WorldBook] loaded:', WB.loadedInfo);
      updateBadge();
    } catch (e) {
      console.warn('[WorldBook] fetch failed, fallback to local button', e);
      injectLocalLoadButton();
    }
  }

  function injectLocalLoadButton() {
    if (!WB_DEBUG) return; // 仅调试时出现
    if (document.querySelector('[data-wb-local]')) return;
    const btn = document.createElement('button');
    btn.textContent = '加载世界书（本地）';
    btn.setAttribute('data-wb-local','1');
    btn.style.cssText = 'position:fixed;top:8px;right:12px;z-index:9999';
    btn.onclick = async () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json';
      input.onchange = async () => {
        const f = input.files?.[0]; if (!f) return;
        try {
          const json = JSON.parse(await f.text());
          WB.book = WorldBookImporter?.import ? WorldBookImporter.import(json) : json;
          const n = WB.book?.entries?.length ?? 0;
          WB.loadedInfo = `${WB.book?.name || 'WorldBook'}（${n} 条目）`;
          console.log('[WorldBook] loaded(local):', WB.loadedInfo);
          updateBadge();
          btn.remove(); // 加载成功后隐藏按钮
        } catch (err) { console.error('[WorldBook] local json parse error', err); }
      };
      input.click();
    };
    document.body.appendChild(btn);
  }

  window.addEventListener('load', () => { if (WB_DEBUG) updateBadge(); loadDefaultBook(); });

  // 保持原有的 hook 发送流程
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
            const result = WB.engine ? WB.engine.process(WB.book, text) : { finalPrompt: '' };
            const loreText = result.finalPrompt || '';
            
            if (loreText && window.AIModule) {
              const originalSystem = window.AIModule.systemPrompt || '';
              window.AIModule.systemPrompt = `[World Info]\n${loreText}\n\n${originalSystem}`;
              console.log('[WorldBook] hooked: 已注入世界书信息到系统提示');
              
              setTimeout(() => {
                window.AIModule.systemPrompt = originalSystem;
              }, 100);
            }
          } catch (e) {
            console.warn('[WorldBook] hook error:', e);
          }
        }, { capture: true });
        
        console.log('[WorldBook] hooked: 聊天表单已接入');
      }
    }, 1000);
  }

  hookSendPipeline();
})();