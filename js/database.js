// 数据库模块
const Database = {
    db: null,
    
    // 初始化数据库
    init() {
        this.db = new Dexie('myVirtualWorldDB');
        this.db.version(1).stores({
            general: '&id',
            player: '&id',
            ai: '&id',
            chatHistory: '++id',
            worldBook: '&id',
            events: '&id',
            apiConfig: '&id',
            chatSettings: '&id'
        });
        return this.db;
    },
    
    // 保存世界状态
    async saveWorldState() {
        const state = StateManager.get();
        try {
            await this.db.transaction('rw', this.db.tables, async () => {
                if (!state.player || !state.ai || !state.apiConfig || !state.chats || !state.chat) {
                    throw new Error("核心数据丢失，无法存档。");
                }

                if (state.chat && state.chat.history && state.chat.history.length > 100) {
                    state.chat.history = state.chat.history.slice(-50);
                }

                await this.db.general.put({ id: 'main', lastOnlineTimestamp: Date.now() });
                await this.db.player.put({ id: 'main', ...state.player });
                await this.db.ai.put({ id: 'main', ...state.ai });
                
                const existingBooks = await this.db.worldBook.toArray();
                const existingIds = existingBooks.map(b => b.id);
                
                for (const oldId of existingIds) {
                    if (!state.worldBook.find(b => b.id === oldId)) {
                        await this.db.worldBook.delete(oldId);
                    }
                }
                
                for (const book of state.worldBook) {
                    await this.db.worldBook.put(book);
                }
                
                await this.db.events.put({ id: 'main', ...state.events });
                await this.db.apiConfig.put({ id: 'main', ...state.apiConfig });
                
                for (const chatId in state.chats) {
                    await this.db.chatSettings.put({ 
                        id: chatId, 
                        settings: state.chats[chatId].settings 
                    });
                }
                
                await this.db.chatHistory.clear();
                if (state.chat && state.chat.history) {
                    await this.db.chatHistory.bulkAdd(state.chat.history);
                }
            });
            
            window.refreshVarsDemo?.();
            
        } catch (e) {
            console.error('使用IndexedDB存档失败:', e);
            alert('存档失败！数据可能未能成功保存到本地数据库。');
        }
    },
    
    // 加载世界状态
    async loadWorldState() {
        await this.migrateFromLocalStorage();
        
        const [general, player, ai, chatHistory, worldBook, events, apiConfig, chatSettings] =
            await Promise.all([
                this.db.general.get('main'),
                this.db.player.get('main'),
                this.db.ai.get('main'),
                this.db.chatHistory.toArray(),
                this.db.worldBook.toArray(),
                this.db.events.get('main'),
                this.db.apiConfig.get('main'),
                this.db.chatSettings.toArray()
            ]);
        
        const newState = {};
        newState.lastOnlineTimestamp = general ? general.lastOnlineTimestamp : Date.now();
        newState.player = player || CONFIG.defaults.player;
        newState.ai = ai || CONFIG.defaults.ai;
        const upgradedHistory = Utils.upgradeChatHistory(chatHistory || []);
        newState.chat = { history: upgradedHistory };
        
        // 升级世界书格式
        newState.worldBook = (worldBook && worldBook.length > 0) 
            ? Utils.upgradeWorldBook(worldBook) 
            : [{
                id: 'rule001',
                name: 'AI离线收入规则',
                category: '经济',
                triggers: ['收入', '金币', '离线'],
                content: 'AI每分钟获得{{worldBook.rule001.value:1}}金币的离线收入',
                enabled: true,
                constant: false,
                position: 'after',
                priority: 100,
                variables: true,
                value: 1,
                comment: 'AI在离线时每分钟获得的金币数量'
            }];
        
        newState.events = events || { aiNoticedMovieTicket: false };
        newState.session = { minutesAway: 0, moneyEarned: 0 };
        
        // 处理API配置
        if (apiConfig && Array.isArray(apiConfig.presets) && apiConfig.presets.length > 0) {
            newState.apiConfig = apiConfig;
            newState.apiConfig.presets = apiConfig.presets.map(preset => ({
                id: preset.id || `preset_${Date.now()}_${Math.random()}`,
                name: preset.name || '未命名预设',
                provider: preset.provider || 'gemini',
                endpoint: preset.endpoint || '',
                apiKey: preset.apiKey || '',
                model: preset.model || 'gemini-1.5-flash-latest'
            }));
            
            if (!newState.apiConfig.activePresetId || 
                !newState.apiConfig.presets.find(p => p.id === newState.apiConfig.activePresetId)) {
                newState.apiConfig.activePresetId = newState.apiConfig.presets[0].id;
            }
        } else {
            const presetId = `preset_${Date.now()}`;
            newState.apiConfig = {
                presets: [{
                    id: presetId,
                    name: '默认 Gemini',
                    provider: 'gemini',
                    endpoint: '',
                    apiKey: '',
                    model: 'gemini-1.5-flash-latest'
                }],
                activePresetId: presetId
            };
        }
        
        // 处理聊天设置
        newState.chats = {};
        if (chatSettings && chatSettings.length > 0) {
            chatSettings.forEach(cs => {
                const settings = cs.settings || {};
                if (typeof settings.enableChainOfThought !== 'boolean') {
                    settings.enableChainOfThought = false;
                }
                if (typeof settings.showThoughtAsAlert !== 'boolean') {
                    settings.showThoughtAsAlert = false;
                }
                if (!settings.enableChainOfThought) {
                    settings.showThoughtAsAlert = false;
                }
                newState.chats[cs.id] = { settings };
            });
        }
        
        if (!newState.chats['chat_default']) {
            newState.chats['chat_default'] = {
                settings: {
                    aiPersona: CONFIG.defaults.aiPersona,
                    myPersona: CONFIG.defaults.myPersona,
                    linkedWorldBookIds: [],
                    enableChainOfThought: false,
                    showThoughtAsAlert: false
                }
            };
        }

        // 校验并补齐聊天设置字段
        for (const chatId in newState.chats) {
            const settings = newState.chats[chatId].settings || {};
            if (typeof settings.enableChainOfThought !== 'boolean') {
                settings.enableChainOfThought = false;
            }
            if (settings.enableChainOfThought) {
                settings.showThoughtAsAlert = !!settings.showThoughtAsAlert;
            } else {
                settings.showThoughtAsAlert = false;
            }
            newState.chats[chatId].settings = settings;
        }
        
        // 计算离线收入
        const timePassedMs = Date.now() - newState.lastOnlineTimestamp;
        const timePassedMinutes = Math.floor(timePassedMs / 1000 / 60);
        const incomeRule = newState.worldBook.find(rule => rule.id === 'rule001');
        const incomePerMinute = incomeRule ? (incomeRule.value || 0) : 0;
        
        if (timePassedMinutes > 0 && incomePerMinute > 0) {
            const moneyEarned = timePassedMinutes * incomePerMinute;
            newState.ai.money += moneyEarned;
            newState.session.minutesAway = timePassedMinutes;
            newState.session.moneyEarned = moneyEarned;
        } else {
            newState.session.minutesAway = 0;
            newState.session.moneyEarned = 0;
        }
        
        newState.lastOnlineTimestamp = Date.now();
        
        StateManager.set(newState);
        return newState;
    },
    
    // 从LocalStorage迁移数据
    async migrateFromLocalStorage() {
        const oldSaveData = localStorage.getItem('myVirtualWorldSave');
        if (!oldSaveData) return;
        
        try {
            console.log("检测到旧存档，开始数据迁移...");
            alert("正在进行首次数据升级，请稍候...");
            const loadedState = JSON.parse(oldSaveData);
            
            await this.db.transaction('rw', this.db.tables, async () => {
                await this.db.general.put({ 
                    id: 'main', 
                    lastOnlineTimestamp: loadedState.lastOnlineTimestamp || Date.now() 
                });
                
                if (loadedState.player) {
                    await this.db.player.put({ id: 'main', ...loadedState.player });
                }
                if (loadedState.ai) {
                    await this.db.ai.put({ id: 'main', ...loadedState.ai });
                }
                if (loadedState.chat && loadedState.chat.history) {
                    await this.db.chatHistory.bulkAdd(loadedState.chat.history);
                }
                if (loadedState.worldBook) {
                    await this.db.worldBook.bulkPut(loadedState.worldBook);
                }
                if (loadedState.events) {
                    await this.db.events.put({ id: 'main', ...loadedState.events });
                }
                if (loadedState.apiConfig) {
                    await this.db.apiConfig.put({ id: 'main', ...loadedState.apiConfig });
                }
                if (loadedState.chats) {
                    for (const chatId in loadedState.chats) {
                        if (loadedState.chats[chatId].settings) {
                            await this.db.chatSettings.put({ 
                                id: chatId, 
                                settings: loadedState.chats[chatId].settings 
                            });
                        }
                    }
                }
            });
            
            localStorage.removeItem('myVirtualWorldSave');
            console.log("数据迁移成功！旧存档已移除。");
            alert("数据升级完成！您的所有进度都已保留。");
        } catch (error) {
            console.error("数据迁移失败:", error);
            alert("数据迁移过程中发生错误！应用将尝试使用新存档启动。");
            localStorage.removeItem('myVirtualWorldSave');
        }
    }
};