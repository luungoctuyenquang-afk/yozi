// 工具函数模块
const Utils = {
    // 变量替换系统
    replaceVariables(text) {
        if (text == null) return text;
        if (typeof text !== 'string') text = String(text);
        
        const state = StateManager.get();
        const now = new Date();
        const ctx = {
            // 世界主状态
            player: { ...(state.player || {}), inventory: state.player?.inventory || [] },
            ai: { ...(state.ai || {}), inventory: state.ai?.inventory || [] },
            chat: { count: state.chat?.history?.length || 0 },
            session: { ...(state.session || {}) },
            
            // 时间
            time: {
                now: now.toLocaleTimeString('zh-CN'),
                date: now.toLocaleDateString('zh-CN'),
                weekday: ['周日','周一','周二','周三','周四','周五','周六'][now.getDay()],
                hour: now.getHours(),
                minute: now.getMinutes(),
            },
            
            // 随机数
            random: {
                '100': Math.floor(Math.random() * 100),
                '10': Math.floor(Math.random() * 10),
            },
            
            // 世界书值
            worldBook: {}
        };
        
        // 暴露 worldBook.<id>.value
        (state.worldBook || []).forEach(rule => {
            if (!ctx.worldBook[rule.id]) ctx.worldBook[rule.id] = {};
            if ('value' in rule) ctx.worldBook[rule.id].value = rule.value;
        });
        
        // 通用路径读取
        const getByPath = (obj, path) => {
            const parts = path.split('.');
            let cur = obj;
            for (const p of parts) {
                if (cur == null) return undefined;
                cur = cur[p];
            }
            return cur;
        };
        
        return text.replace(/\{\{([^}:]+)(?::([^}]+))?\}\}/g, (_, rawName, defVal) => {
            const name = rawName.trim();
            let val = getByPath(ctx, name);
            
            // 兼容别名
            if (val === undefined && name === 'player.inventory.count') {
                val = getByPath(ctx, 'player.inventory.length');
            }
            
            if (val === undefined) {
                return (defVal !== undefined) ? defVal : `{{${rawName}${defVal ? ':' + defVal : ''}}}`;
            }
            if (Array.isArray(val)) val = val.join('、');
            return String(val);
        });
    },
    
    // 刷新变量演示
    refreshVarsDemo() {
        const el = document.getElementById('vars-demo-result');
        if (!el) return;
        
        const state = StateManager.get();
        if (!state || !state.ai || !state.player) return;
        
        const tpl = `现在是 {{time.hour}}:{{time.minute}}，{{ai.name}} 心情 {{ai.mood}}。
你有 {{player.inventory.length:0}} 件物品，聊天条数：{{chat.count}}，
离线收益/分：{{worldBook.rule001.value:1}}，随机数：{{random.10}}`;
        
        el.textContent = this.replaceVariables(tpl);
    },
    
    // 更新时钟
    updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeDisplay = document.querySelector('.time-display');
        if (timeDisplay) timeDisplay.textContent = `${hours}:${minutes}`;
    },
    
    // 显示屏幕
    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        const flexScreens = ['lock-screen', 'chat-screen', 'wallet-screen', 'store-screen', 
                            'backpack-screen', 'world-book-screen', 'settings-screen', 
                            'general-settings-screen'];
        
        screens.forEach(s => {
            s.style.display = s.id === screenId 
                ? (flexScreens.includes(s.id) ? 'flex' : 'block') 
                : 'none';
        });
    },
    
    // 安全绑定事件
    safeBind(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    },
    
    // 升级世界书格式
    upgradeWorldBook(oldBook) {
        return oldBook.map(rule => {
            if (rule.triggers) return rule; // 已经是新格式
            return {
                id: rule.id,
                name: rule.key || '未命名规则',
                category: rule.category || '通用',
                triggers: [rule.key || ''],
                content: String(rule.value || rule.description || ''),
                enabled: true,
                constant: false,
                position: 'after',
                priority: 100,
                variables: true,
                value: rule.value || 1,
                comment: rule.description || ''
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
New File at js · 508862940/yoyo 

            };
        });
    }
};

// 暴露到全局
window.replaceVariables = Utils.replaceVariables.bind(Utils);
window.refreshVarsDemo = Utils.refreshVarsDemo.bind(Utils);
