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
                if (!state.player || !state.ai || !state.apiConfig || !state.chats) {
                    throw new Error("核心数据丢失，无法存档。");
                }
                
                // 限制聊天历史长度
                if (state.chat.history.length > 100) {
                    state.chat.history = state.chat.history.slice(-50);
                }
                
                // 保存各个数据
                await this.db.general.put({ id: 'main', lastOnlineTimestamp: Date.now() });
                await this.db.player.put({ id: 'main', ...state.player });
                await this.db.ai.put({ id: 'main', ...state.ai });
                
                // 智能保存世界书
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
                    await this.db.chatSettings.put({ id: chatId, settings: state.chats[chatId].settings });
                }
                
                await this.db.chatHistory.clear();
                await this.db.chatHistory.bulkAdd(state.chat.history);
            });
            
            window.refreshVarsDemo?.();
            
        } catch (e) {
            console.error('使用IndexedDB存档失败:', e);
            alert('存档失败！数据可能未能成功保存到本地数据库。');
        }
    },
    
    // 加载世界状态（这个函数比较长，我简化一下关键部分）
    async loadWorldState() {
        // 先检查是否需要迁移旧数据
        await this.migrateFromLocalStorage();
        
        // 从数据库加载所有数据
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
        
        // 构建世界状态
        const newState = {
            lastOnlineTimestamp: general ? general.lastOnlineTimestamp : Date.now(),
            player: player || CONFIG.defaults.player,
            ai: ai || CONFIG.defaults.ai,
            chat: { history: chatHistory || [] },
            worldBook: worldBook || [],
            events: events || { aiNoticedMovieTicket: false },
            session: { minutesAway: 0, moneyEarned: 0 },
            apiConfig: apiConfig || this.getDefaultApiConfig(),
            chats: this.buildChatsFromSettings(chatSettings)
        };
        
        // 计算离线收入
        this.calculateOfflineIncome(newState);
        
        StateManager.set(newState);
        return newState;
    },
    
    // 其他辅助函数...
    migrateFromLocalStorage() {
        // 迁移旧数据的代码
    },
    
    getDefaultApiConfig() {
        // 默认API配置
    },
    
    buildChatsFromSettings(chatSettings) {
        // 构建聊天设置
    },
    
    calculateOfflineIncome(state) {
        // 计算离线收入
    }
};