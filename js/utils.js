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
                            'general-settings-screen', 'mqtt-room-screen', 'ios-settings-minimal'];

        screens.forEach(s => {
            s.style.display = s.id === screenId
                ? (flexScreens.includes(s.id) ? 'flex' : 'block')
                : 'none';
        });

        // 动态主题色切换
        this.updateThemeColor(screenId);
    },

    // 更新主题色
    updateThemeColor(screenId) {
        // 获取用户设置的状态栏模式
        const statusBarMode = localStorage.getItem('statusbar-mode') || 'light';
        // 先尝试自动检测界面颜色
        const screen = document.getElementById(screenId);
        let theme = null;

        if (screen) {
            // 尝试从界面背景色自动提取
            const computedStyle = window.getComputedStyle(screen);
            const bgColor = computedStyle.backgroundColor;
            const bgImage = computedStyle.backgroundImage;

            // 如果有渐变背景，提取渐变色
            if (bgImage && bgImage.includes('gradient')) {
                const colors = this.extractGradientColors(bgImage);
                if (colors) {
                    theme = { primary: colors[0], secondary: colors[1] };
                }
            }
            // 如果是纯色背景
            else if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                theme = { primary: bgColor, secondary: this.darkenColor(bgColor, 20) };
            }

            // 特殊处理MQTT聊天室的暗黑模式
            if (screenId === 'mqtt-room-screen') {
                const mqttScreen = screen.querySelector('.mqtt-room-screen');
                if (mqttScreen) {
                    // 检查是否是暗黑模式（使用classList）
                    if (mqttScreen.classList.contains('dark-theme')) {
                        theme = { primary: '#1a1a2e', secondary: '#0f0f1e' };
                    } else if (mqttScreen.classList.contains('light-theme')) {
                        theme = { primary: '#26c6da', secondary: '#00acc1' };
                    }
                }
            }
        }

        // 如果自动检测失败，使用预设主题
        if (!theme) {
            const themeMap = {
                'lock-screen': { primary: '#667eea', secondary: '#764ba2' },
                'home-screen': { primary: '#f8f9fa', secondary: '#e9ecef' },
                'chat-screen': { primary: '#4a90e2', secondary: '#357abd' },
                'wallet-screen': { primary: '#ffd700', secondary: '#ffb347' },
                'store-screen': { primary: '#ff7043', secondary: '#ff5722' },
                'backpack-screen': { primary: '#66bb6a', secondary: '#4caf50' },
                'world-book-screen': { primary: '#5c6bc0', secondary: '#3f51b5' },
                'settings-screen': { primary: '#78909c', secondary: '#546e7a' },
                'general-settings-screen': { primary: '#78909c', secondary: '#546e7a' },
                'ios-settings-minimal': { primary: '#007aff', secondary: '#0051d5' },
                'mqtt-room-screen': { primary: '#26c6da', secondary: '#00acc1' }
            };

            theme = themeMap[screenId] || { primary: '#667eea', secondary: '#764ba2' };
        }

        // 更新CSS变量
        document.documentElement.style.setProperty('--theme-primary', theme.primary);
        document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
        document.documentElement.style.setProperty('--theme-gradient',
            `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`);

        // 更新状态栏颜色（使用固定的黑白模式）
        const themeColorMeta = document.getElementById('theme-color-meta');
        if (themeColorMeta) {
            // 只使用黑白两种颜色，根据用户设置
            themeColorMeta.setAttribute('content', statusBarMode === 'light' ? '#ffffff' : '#000000');
        }

        // 更新mobile-container的背景（仅在非PWA模式下）
        if (!window.matchMedia('(display-mode: standalone)').matches &&
            !window.matchMedia('(display-mode: fullscreen)').matches) {
            const container = document.querySelector('.mobile-container');
            if (container) {
                // 为容器添加渐变边框效果
                container.style.background = `linear-gradient(white, white) padding-box,
                                             linear-gradient(135deg, ${theme.primary}, ${theme.secondary}) border-box`;
                container.style.border = '2px solid transparent';
            }
        }
    },

    // 从渐变字符串提取颜色
    extractGradientColors(gradientStr) {
        const colorRegex = /#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g;
        const colors = gradientStr.match(colorRegex);
        if (colors && colors.length >= 2) {
            return [colors[0], colors[colors.length - 1]];
        }
        return null;
    },

    // 加深颜色
    darkenColor(color, percent) {
        // 如果是rgb/rgba格式
        if (color.startsWith('rgb')) {
            const values = color.match(/\d+/g);
            if (values) {
                const r = Math.max(0, parseInt(values[0]) - percent * 2.55);
                const g = Math.max(0, parseInt(values[1]) - percent * 2.55);
                const b = Math.max(0, parseInt(values[2]) - percent * 2.55);
                return `rgb(${r}, ${g}, ${b})`;
            }
        }
        // 如果是hex格式
        else if (color.startsWith('#')) {
            const num = parseInt(color.replace('#', ''), 16);
            const r = Math.max(0, (num >> 16) - percent * 2.55);
            const g = Math.max(0, ((num >> 8) & 0x00FF) - percent * 2.55);
            const b = Math.max(0, (num & 0x0000FF) - percent * 2.55);
            return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
        }
        return color;
    },
    
    // 安全绑定事件
    safeBind(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    },

    // 升级聊天记录格式
    upgradeChatHistory(records) {
        if (!Array.isArray(records)) return [];

        return records.map(record => {
            const newRecord = { ...record };

            if (!Array.isArray(record.content)) {
                if (typeof record.content === 'string') {
                    newRecord.content = [{ text: record.content }];
                } else if (record.text) {
                    newRecord.content = [{ text: record.text }];
                } else {
                    newRecord.content = [{ text: '' }];
                }
            } else {
                newRecord.content = record.content.map(part =>
                    typeof part === 'string' ? { text: part } : part
                );
            }

            if (record.sender === 'ai' && !record.thoughtText) {
                const contentText = newRecord.content
                    .filter(c => c.text)
                    .map(c => c.text)
                    .join('');

                const thoughtPatterns = [
                    /<thought>([\s\S]*?)<\/thought>/i,
                    /<thinking>([\s\S]*?)<\/thinking>/i
                ];

                for (const pattern of thoughtPatterns) {
                    const match = contentText.match(pattern);
                    if (match && match[1]) {
                        newRecord.thoughtText = match[1].trim();
                        newRecord.content = newRecord.content.map(c => {
                            if (c.text) {
                                c.text = c.text.replace(pattern, '').trim();
                            }
                            return c;
                        });
                        break;
                    }
                }
            }

            newRecord.thoughtText = newRecord.thoughtText || '';
            delete newRecord.text;
            return newRecord;
        });
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
                value: rule.value !== undefined ? rule.value : 1, // 保留原值或默认1
                comment: rule.description || ''
            };
        });
    }
};

// 暴露到全局
window.replaceVariables = Utils.replaceVariables.bind(Utils);
window.refreshVarsDemo = Utils.refreshVarsDemo.bind(Utils);
