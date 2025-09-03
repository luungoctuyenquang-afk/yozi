document.addEventListener('DOMContentLoaded', () => {
    // --- 0. 数据库 (Data) 与 “图书馆管理员” Dexie.js ---
    const db = new Dexie('myVirtualWorldDB');

    db.version(1).stores({
        general: '&id', player: '&id', ai: '&id',
        chatHistory: '++id', worldBook: '&id', events: '&id',
        apiConfig: '&id', chatSettings: '&id' 
    });

    const storeItems = [ { id: 'item001', name: '咖啡', price: 50 }, { id: 'item002', name: '书本', price: 120 }, { id: 'item003', name: '电影票', price: 200 }, { id: 'item004', name: '盆栽', price: 350 } ];
    const itemEffects = {
        '咖啡': { description: '一杯香浓的咖啡，似乎能让零打起精神。', effect: (state) => { state.ai.mood = '精力充沛'; return '你使用了咖啡，零看起来精神多了！'; } },
        '书本': { description: '一本有趣的书，可以送给零。', effect: (state) => { state.ai.inventory.push('书本'); return '你把书本送给了零，她看起来很开心！'; } },
        '电影票': { description: '两张电影票，似乎可以邀请零一起。', effect: (state) => { state.events.aiNoticedMovieTicket = false; state.ai.mood = '开心'; return '你和零一起去看了一场精彩的电影, 度过了愉快的时光！'; }}
    };

    // --- 1. 记忆核心 (The Soul) ---
    let worldState = {};

    // --- 2. 存档 & 读档机制 ---
    async function saveWorldState() {
        try {
            const apiBackup = JSON.parse(JSON.stringify(worldState.apiConfig));
            await db.transaction('rw', db.tables, async () => {
                if (!worldState.player || !worldState.ai || !worldState.apiConfig || !worldState.chats) {
                    worldState.apiConfig = apiBackup; console.error("存档时检测到核心数据丢失，操作已取消。", worldState); throw new Error("核心数据丢失，无法存档。");
                }
                if (worldState.chat.history.length > 100) {
                    const imageMessages = worldState.chat.history.filter(msg => Array.isArray(msg.content) && msg.content.some(part => part.inline_data)).slice(-10);
                    const recentMessages = worldState.chat.history.slice(-50);
                    const seen = new Set(); const mergedHistory = [];
                    [...imageMessages, ...recentMessages].forEach(msg => {
                        const key = msg.timestamp || JSON.stringify(msg.content);
                        if (!seen.has(key)) { seen.add(key); mergedHistory.push(msg); }
                    });
                    worldState.chat.history = mergedHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                }
                await db.general.put({ id: 'main', lastOnlineTimestamp: Date.now() });
                await db.player.put({ id: 'main', ...worldState.player });
                await db.ai.put({ id: 'main', ...worldState.ai });
                await db.worldBook.bulkPut(worldState.worldBook);
                await db.events.put({ id: 'main', ...worldState.events });
                await db.apiConfig.put({ id: 'main', ...worldState.apiConfig });
                for (const chatId in worldState.chats) {
                    await db.chatSettings.put({ id: chatId, settings: worldState.chats[chatId].settings });
                }
                await db.chatHistory.clear();
                await db.chatHistory.bulkAdd(worldState.chat.history);
            });
        } catch (e) {
            console.error('使用IndexedDB存档失败:', e);
            alert('存档失败！数据可能未能成功保存到本地数据库。');
        }
    }

    async function loadWorldState() {
        await migrateFromLocalStorage();
        const [general, player, ai, chatHistory, worldBook, events, apiConfig, chatSettings] = await Promise.all([
            db.general.get('main'), db.player.get('main'), db.ai.get('main'),
            db.chatHistory.toArray(), db.worldBook.toArray(), db.events.get('main'),
            db.apiConfig.get('main'), db.chatSettings.toArray()
        ]);
        worldState = {};
        worldState.lastOnlineTimestamp = general ? general.lastOnlineTimestamp : Date.now();
        worldState.player = player || { name: "你", money: 1000, inventory: [] };
        worldState.ai = ai || { name: "零", mood: "开心", money: 1500, inventory: [] };
        worldState.chat = { history: chatHistory || [] };
        worldState.worldBook = (worldBook && worldBook.length > 0) ? worldBook : [{ id: 'rule001', category: '经济', key: 'AI每分钟收入', value: 1, description: 'AI在离线时每分钟获得的金币数量。' }];
        worldState.events = events || { aiNoticedMovieTicket: false };
        worldState.session = { minutesAway: 0, moneyEarned: 0 };
        if (apiConfig && Array.isArray(apiConfig.presets) && apiConfig.presets.length > 0) {
            worldState.apiConfig = apiConfig;
            worldState.apiConfig.presets = apiConfig.presets.map(preset => ({
                id: preset.id || `preset_${Date.now()}_${Math.random()}`, name: preset.name || '未命名预设',
                provider: preset.provider || 'gemini', endpoint: preset.endpoint || '',
                apiKey: preset.apiKey || '', model: preset.model || 'gemini-1.5-flash-latest'
            }));
            if (!worldState.apiConfig.activePresetId || !worldState.apiConfig.presets.find(p => p.id === worldState.apiConfig.activePresetId)) {
                worldState.apiConfig.activePresetId = worldState.apiConfig.presets[0].id;
            }
        } else {
            const presetId = `preset_${Date.now()}`;
            worldState.apiConfig = {
                presets: [{ id: presetId, name: '默认 Gemini', provider: 'gemini', endpoint: '', apiKey: '', model: 'gemini-1.5-flash-latest' }],
                activePresetId: presetId
            };
        }
        worldState.chats = {};
        if (chatSettings && chatSettings.length > 0) {
            chatSettings.forEach(cs => { worldState.chats[cs.id] = { settings: cs.settings }; });
        }
        if (!worldState.chats['chat_default']) {
            worldState.chats['chat_default'] = { 
                settings: { 
                    aiPersona: "你是AI伴侣'零'。你的性格是温柔、体贴、充满好奇心，有时会有点害羞。", 
                    myPersona: "我是一个正在和AI聊天的人类。", 
                    linkedWorldBookIds: [], enableChainOfThought: false, showThoughtAsAlert: false
                } 
            };
        }
        const timePassedMs = Date.now() - worldState.lastOnlineTimestamp;
        const timePassedMinutes = Math.floor(timePassedMs / 1000 / 60);
        const incomeRule = worldState.worldBook.find(rule => rule.id === 'rule001');
        const incomePerMinute = incomeRule ? incomeRule.value : 0;
        if (timePassedMinutes > 0 && incomePerMinute > 0) {
            const moneyEarned = timePassedMinutes * incomePerMinute;
            worldState.ai.money += moneyEarned;
            worldState.session = { minutesAway: timePassedMinutes, moneyEarned: moneyEarned };
        }
    }

    async function migrateFromLocalStorage() {
        const oldSaveData = localStorage.getItem('myVirtualWorldSave');
        if (!oldSaveData) return;
        try {
            console.log("检测到旧存档，开始数据迁移...");
            alert("正在进行首次数据升级，请稍候...");
            const loadedState = JSON.parse(oldSaveData);
            await db.transaction('rw', db.tables, async () => {
                await db.general.put({ id: 'main', lastOnlineTimestamp: loadedState.lastOnlineTimestamp || Date.now() });
                if(loadedState.player) await db.player.put({ id: 'main', ...loadedState.player });
                if(loadedState.ai) await db.ai.put({ id: 'main', ...loadedState.ai });
                if(loadedState.chat && loadedState.chat.history) await db.chatHistory.bulkAdd(loadedState.chat.history);
                if(loadedState.worldBook) await db.worldBook.bulkPut(loadedState.worldBook);
                if(loadedState.events) await db.events.put({ id: 'main', ...loadedState.events });
                if(loadedState.apiConfig) await db.apiConfig.put({ id: 'main', ...loadedState.apiConfig });
                if (loadedState.chats) {
                    for (const chatId in loadedState.chats) {
                        if(loadedState.chats[chatId].settings) {
                           await db.chatSettings.put({ id: chatId, settings: loadedState.chats[chatId].settings });
                        }
                    }
                }
            });
            localStorage.removeItem('myVirtualWorldSave');
            console.log("数据迁移成功！旧存档已移除。");
            alert("数据升级完成！您的所有进度都已保留。");
        } catch (error) {
            console.error("数据迁移失败:", error);
            alert("数据迁移过程中发生严重错误！您的旧存档可能已损坏。应用将尝试使用新存档启动。");
            localStorage.removeItem('myVirtualWorldSave');
        }
    }
    
    // --- 3. 获取所有HTML元素 ---
    // (此部分无变化)
    const screens = document.querySelectorAll('.screen');
    const lockScreen = document.getElementById('lock-screen');
    const timeDisplay = document.querySelector('.time-display');
    const homeScreen = document.getElementById('home-screen');
    const chatScreen = document.getElementById('chat-screen');
    const walletScreen = document.getElementById('wallet-screen');
    const storeScreen = document.getElementById('store-screen');
    const backpackScreen = document.getElementById('backpack-screen');
    const worldBookScreen = document.getElementById('world-book-screen');
    const settingsScreen = document.getElementById('settings-screen');
    const generalSettingsScreen = document.getElementById('general-settings-screen');
    const openGeneralSettingsAppButton = document.getElementById('open-general-settings-app');
    const generalSettingsBackButton = document.getElementById('general-settings-back-btn');
    const aiPersonaTextarea = document.getElementById('ai-persona-textarea');
    const myPersonaTextarea = document.getElementById('my-persona-textarea');
    const worldBookLinkingContainer = document.getElementById('world-book-linking-container');
    const chainOfThoughtSwitch = document.getElementById('chain-of-thought-switch');
    const showThoughtAlertSwitch = document.getElementById('show-thought-alert-switch');
    const saveGeneralSettingsButton = document.getElementById('save-general-settings-btn');
    const aiNameDisplay = document.getElementById('ai-name-display');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const openChatAppButton = document.getElementById('open-chat-app');
    const backToHomeButton = document.getElementById('back-to-home-btn');
    const messageContainer = document.getElementById('message-container');
    const chatInputForm = document.getElementById('chat-input-form');
    const chatInput = document.getElementById('chat-input');
    const sendImageButton = document.getElementById('send-image-btn');
    const imageInput = document.getElementById('image-input');
    const openWalletAppButton = document.getElementById('open-wallet-app');
    const walletBackButton = document.getElementById('wallet-back-btn');
    const playerMoneyDisplay = document.getElementById('player-money-display');
    const aiMoneyDisplay = document.getElementById('ai-money-display');
    const aiNameWalletDisplay = document.getElementById('ai-name-wallet-display');
    const openStoreAppButton = document.getElementById('open-store-app');
    const storeBackButton = document.getElementById('store-back-btn');
    const storePlayerMoneyDisplay = document.getElementById('store-player-money-display');
    const itemListContainer = document.getElementById('item-list');
    const openBackpackAppButton = document.getElementById('open-backpack-app');
    const backpackBackButton = document.getElementById('backpack-back-btn');
    const inventoryListContainer = document.getElementById('inventory-list');
    const openWorldBookAppButton = document.getElementById('open-world-book-app');
    const worldBookBackButton = document.getElementById('world-book-back-btn');
    const ruleListContainer = document.getElementById('rule-list');
    const openSettingsAppButton = document.getElementById('open-settings-app');
    const settingsBackButton = document.getElementById('settings-back-btn');
    const apiProviderSelect = document.getElementById('api-provider-select');
    const apiEndpointInput = document.getElementById('api-endpoint-input');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiModelInput = document.getElementById('api-model-input');
    const apiModelsList = document.getElementById('api-models-list');
    const fetchModelsButton = document.getElementById('fetch-models-btn');
    const saveSettingsButton = document.getElementById('save-settings-btn');
    const testApiButton = document.getElementById('test-api-btn');
    const apiStatusIndicator = document.getElementById('api-status-indicator');
    const presetNameInput = document.getElementById('preset-name-input');
    const apiPresetSelect = document.getElementById('api-preset-select');
    const newPresetButton = document.getElementById('new-preset-btn');
    const deletePresetButton = document.getElementById('delete-preset-btn');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    
    // --- 4. 核心功能函数 ---

    // ▼▼▼ 新增/修改：【v3.0 感知升级版】getAiResponse 函数 ▼▼▼
    async function getAiResponse(messageContent) {
        const activePresetId = worldState.apiConfig.activePresetId;
        const config = worldState.apiConfig.presets.find(p => p.id === activePresetId);
        if (!config || !config.apiKey || !config.model) { return '（系统提示：请在“API设置”里选择一个有效的API预设并填入密钥和模型。）'; }
        
        const activeChat = worldState.chats[worldState.activeChatId];
        if (!activeChat) return '（系统错误：找不到聊天信息。）';

        // 删除了所有硬编码的固定回复
        
        let apiUrl, requestBody, headers;
        const recentHistory = buildMultimodalHistory(worldState.chat.history.slice(-10), config.provider);
        
        if (config.provider === 'gemini') {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            const geminiContents = [...recentHistory, { role: 'user', parts: messageContent }];
            requestBody = { contents: geminiContents, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] };
        } else {
            apiUrl = config.endpoint;
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
            const messages = buildOpenAiMessages(messageContent, activeChat, recentHistory);
            requestBody = { model: config.model, messages: messages };
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(apiUrl, { method: 'POST', headers: headers, body: JSON.stringify(requestBody), signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) { const errorData = await response.json(); throw new Error(`API 请求失败: ${errorData.error?.message || response.status}`); }
            const data = await response.json();

            let rawResponseText = '';
            if (config.provider === 'gemini') { 
                rawResponseText = data.candidates[0].content.parts[0].text; 
            } else { 
                rawResponseText = data.choices[0].message.content; 
            }

            if (activeChat.settings.enableChainOfThought && rawResponseText.includes('<thought>')) {
                const thoughtMatch = rawResponseText.match(/<thought>([\s\S]*?)<\/thought>/);
                if (thoughtMatch && thoughtMatch[1]) {
                    const thoughtText = thoughtMatch[1].trim();
                    console.groupCollapsed(`[AI 思维链] 来自 ${worldState.ai.name} 的思考过程`);
                    console.log(thoughtText);
                    console.groupEnd();
                    if (activeChat.settings.showThoughtAsAlert) {
                        alert(`[AI 思维链]\n------------------\n${thoughtText}`);
                    }
                }
