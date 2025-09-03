document.addEventListener('DOMContentLoaded', () => {
    // --- 0. 数据库初始化 ---
    const db = new Dexie('myVirtualWorldDB');
    db.version(1).stores({
        general: '&id',
        player: '&id',
        ai: '&id',
        chatHistory: '++id',
        worldBook: '&id',
        events: '&id',
        apiConfig: '&id',
        chatSettings: '&id'
    });

    // --- 1. 商店数据 ---
    const storeItems = [
        { id: 'item001', name: '咖啡', price: 50 },
        { id: 'item002', name: '书本', price: 120 },
        { id: 'item003', name: '电影票', price: 200 },
        { id: 'item004', name: '盆栽', price: 350 }
    ];
    
    const itemEffects = {
        '咖啡': { 
            description: '一杯香浓的咖啡，似乎能让零打起精神。', 
            effect: (state) => { 
                state.ai.mood = '精力充沛'; 
                return '你使用了咖啡，零看起来精神多了！'; 
            } 
        },
        '书本': { 
            description: '一本有趣的书，可以送给零。', 
            effect: (state) => { 
                state.ai.inventory.push('书本'); 
                return '你把书本送给了零，她看起来很开心！'; 
            } 
        },
        '电影票': { 
            description: '两张电影票，似乎可以邀请零一起。', 
            effect: (state) => { 
                state.events.aiNoticedMovieTicket = false; 
                state.ai.mood = '开心'; 
                return '你和零一起去看了一场精彩的电影，度过了愉快的时光！'; 
            }
        }
    };

    // --- 2. 全局状态 ---
    let worldState = {};

    // --- 3. 安全的DOM元素获取 ---
    const $ = (id) => document.getElementById(id);
    const bind = (el, type, handler) => { 
        if (el) el.addEventListener(type, handler); 
    };

    // 获取所有HTML元素（只声明一次，且做null检查）
    const screens = document.querySelectorAll('.screen');
    const lockScreen = $('lock-screen');
    const timeDisplay = document.querySelector('.time-display');
    const homeScreen = $('home-screen');
    const chatScreen = $('chat-screen');
    const walletScreen = $('wallet-screen');
    const storeScreen = $('store-screen');
    const backpackScreen = $('backpack-screen');
    const worldBookScreen = $('world-book-screen');
    const settingsScreen = $('settings-screen');
    
    // 基础元素
    const aiNameDisplay = $('ai-name-display');
    const chatHeaderTitle = $('chat-header-title');
    const openChatAppButton = $('open-chat-app');
    const backToHomeButton = $('back-to-home-btn');
    const messageContainer = $('message-container');
    const chatInputForm = $('chat-input-form');
    const chatInput = $('chat-input');
    const sendImageButton = $('send-image-btn');
    const imageInput = $('image-input');
    
    // 钱包相关
    const openWalletAppButton = $('open-wallet-app');
    const walletBackButton = $('wallet-back-btn');
    const playerMoneyDisplay = $('player-money-display');
    const aiMoneyDisplay = $('ai-money-display');
    const aiNameWalletDisplay = $('ai-name-wallet-display');
    
    // 商店相关
    const openStoreAppButton = $('open-store-app');
    const storeBackButton = $('store-back-btn');
    const storePlayerMoneyDisplay = $('store-player-money-display');
    const itemListContainer = $('item-list');
    
    // 背包相关
    const openBackpackAppButton = $('open-backpack-app');
    const backpackBackButton = $('backpack-back-btn');
    const inventoryListContainer = $('inventory-list');
    
    // 世界书相关
    const openWorldBookAppButton = $('open-world-book-app');
    const worldBookBackButton = $('world-book-back-btn');
    const ruleListContainer = $('rule-list');
    
    // 设置相关
    const openSettingsAppButton = $('open-settings-app');
    const settingsBackButton = $('settings-back-btn');
    const apiProviderSelect = $('api-provider-select');
    const apiEndpointInput = $('api-endpoint-input');
    const apiKeyInput = $('api-key-input');
    const apiModelInput = $('api-model-input');
    const saveSettingsButton = $('save-settings-btn');
    const apiPresetSelect = $('api-preset-select');
    const presetNameInput = $('preset-name-input');
    const newPresetButton = $('new-preset-btn');
    const deletePresetButton = $('delete-preset-btn');

    // --- 4. 存档和读档函数 ---
    async function saveWorldState() {
        try {
            await db.transaction('rw', db.tables, async () => {
                if (!worldState.player || !worldState.ai || !worldState.apiConfig || !worldState.chats) {
                    throw new Error("核心数据丢失，无法存档。");
                }
                
                // 限制聊天历史长度
                if (worldState.chat && worldState.chat.history && worldState.chat.history.length > 100) {
                    worldState.chat.history = worldState.chat.history.slice(-50);
                }
                
                await db.general.put({ id: 'main', lastOnlineTimestamp: Date.now() });
                await db.player.put({ id: 'main', ...worldState.player });
                await db.ai.put({ id: 'main', ...worldState.ai });
                await db.worldBook.bulkPut(worldState.worldBook || []);
                await db.events.put({ id: 'main', ...worldState.events });
                await db.apiConfig.put({ id: 'main', ...worldState.apiConfig });
                
                for (const chatId in worldState.chats) {
                    await db.chatSettings.put({ id: chatId, settings: worldState.chats[chatId].settings });
                }
                
                await db.chatHistory.clear();
                if (worldState.chat && worldState.chat.history) {
                    await db.chatHistory.bulkAdd(worldState.chat.history);
                }
            });
        } catch (e) {
            console.error('存档失败:', e);
        }
    }

    async function loadWorldState() {
        const [general, player, ai, chatHistory, worldBook, events, apiConfig, chatSettings] = await Promise.all([
            db.general.get('main'),
            db.player.get('main'),
            db.ai.get('main'),
            db.chatHistory.toArray(),
            db.worldBook.toArray(),
            db.events.get('main'),
            db.apiConfig.get('main'),
            db.chatSettings.toArray()
        ]);

        // 初始化worldState
        worldState = {
            lastOnlineTimestamp: general ? general.lastOnlineTimestamp : Date.now(),
            player: player || { name: "你", money: 1000, inventory: [] },
            ai: ai || { name: "零", mood: "开心", money: 1500, inventory: [] },
            chat: { history: chatHistory || [] },
            worldBook: (worldBook && worldBook.length > 0) ? worldBook : [
                { id: 'rule001', category: '经济', key: 'AI每分钟收入', value: 1, description: 'AI在离线时每分钟获得的金币数量。' }
            ],
            events: events || { aiNoticedMovieTicket: false },
            session: { minutesAway: 0, moneyEarned: 0 },
            chats: {}
        };

        // 处理API配置
        if (apiConfig && Array.isArray(apiConfig.presets) && apiConfig.presets.length > 0) {
            worldState.apiConfig = apiConfig;
        } else {
            const presetId = `preset_${Date.now()}`;
            worldState.apiConfig = {
                presets: [{ id: presetId, name: '默认 Gemini', provider: 'gemini', endpoint: '', apiKey: '', model: 'gemini-1.5-flash-latest' }],
                activePresetId: presetId
            };
        }

        // 处理聊天设置
        if (chatSettings && chatSettings.length > 0) {
            chatSettings.forEach(cs => {
                worldState.chats[cs.id] = { settings: cs.settings };
            });
        }
        
        // 确保有默认聊天
        if (!worldState.chats['chat_default']) {
            worldState.chats['chat_default'] = {
                settings: {
                    aiPersona: "你是AI伴侣'零'。你的性格是温柔、体贴、充满好奇心，有时会有点害羞。",
                    myPersona: "我是一个正在和AI聊天的人类。",
                    linkedWorldBookIds: []
                }
            };
        }

        // 计算离线收益
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

    // --- 5. 核心功能函数（修复版） ---
    async function getAiResponse(messageContent) {
        const activePresetId = worldState.apiConfig.activePresetId;
        const config = worldState.apiConfig.presets.find(p => p.id === activePresetId);
        if (!config || !config.apiKey || !config.model) {
            return '（系统提示：请在"设置"里配置API密钥。）';
        }

        const activeChat = worldState.chats[worldState.activeChatId || 'chat_default'];
        if (!activeChat) return '（系统错误：找不到聊天信息。）';

        // 处理字符串输入的兼容性
        const parts = typeof messageContent === 'string' 
            ? [{ text: messageContent }]
            : Array.isArray(messageContent) ? messageContent : [{ text: '' }];

        let apiUrl, requestBody, headers;
        const recentHistory = buildMultimodalHistory(worldState.chat.history.slice(-10), config.provider);

        if (config.provider === 'gemini') {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            const geminiContents = [...recentHistory, { role: 'user', parts: parts }];
            requestBody = {
                contents: geminiContents,
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };
        } else {
            apiUrl = config.endpoint;
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
            const messages = buildOpenAiMessages(parts, activeChat, recentHistory);
            requestBody = { model: config.model, messages: messages };
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API请求失败: ${errorData.error?.message || response.status}`);
            }
            
            const data = await response.json();
            
            if (config.provider === 'gemini') {
                return data.candidates[0]?.content?.parts[0]?.text || '';
            } else {
                return data.choices[0]?.message?.content || '';
            }
        } catch (error) {
            console.error("API调用失败:", error);
            return `（API调用失败：${error.message}）`;
        }
    }

    function buildOpenAiMessages(currentUserInputParts, activeChat, recentHistory) {
        // 确保输入是数组格式
        const parts = Array.isArray(currentUserInputParts)
            ? currentUserInputParts
            : [{ text: String(currentUserInputParts || '') }];

        const aiPersona = activeChat.settings.aiPersona || "你是AI伴侣'零'。";
        const userPersona = activeChat.settings.myPersona || "我是一个正在和AI聊天的人类。";

        // 构建系统提示
        const systemPrompt = `${aiPersona}\n用户设定：${userPersona}`;
        
        const messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...recentHistory);
        
        const userContent = parts.map(part => {
            if (part.inline_data) {
                return {
                    type: 'image_url',
                    image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` }
                };
            }
            return { type: 'text', text: part.text || '' };
        }).filter(p => p.text || p.image_url);
        
        if (userContent.length > 0) {
            messages.push({ role: 'user', content: userContent });
        }
        
        return messages;
    }

    function buildMultimodalHistory(history, provider) {
        const formattedHistory = [];
        history.forEach(msg => {
            const role = msg.sender === 'user' ? 'user' : (provider === 'gemini' ? 'model' : 'assistant');
            const contentParts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content || '') }];
            
            if (provider === 'gemini') {
                formattedHistory.push({ role, parts: contentParts });
            } else {
                const openAiContent = contentParts.map(part => {
                    if (part.inline_data) {
                        return {
                            type: 'image_url',
                            image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` }
                        };
                    }
                    return { type: 'text', text: part.text || '' };
                }).filter(p => p.text || p.image_url);
                
                if (openAiContent.length > 0) {
                    formattedHistory.push({ role, content: openAiContent });
                }
            }
        });
        return formattedHistory;
    }

    // --- 6. UI渲染函数 ---
    function updateClock() {
        if (!timeDisplay) return;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}`;
    }

    function showScreen(screenId) {
        screens.forEach(s => {
            s.style.display = (s.id === screenId) ? 
                (['lock-screen', 'chat-screen', 'wallet-screen', 'store-screen', 'backpack-screen', 'world-book-screen', 'settings-screen'].includes(s.id) ? 'flex' : 'block') 
                : 'none';
        });
    }

    function renderHomeScreen() {
        if (aiNameDisplay) {
            aiNameDisplay.textContent = worldState.ai.name;
        }
    }

    function renderChatScreen() {
        worldState.activeChatId = 'chat_default';
        const activeChat = worldState.chats[worldState.activeChatId];
        if (!activeChat || !messageContainer) return;

        const aiName = worldState.ai.name || '零';
        if (chatHeaderTitle) {
            chatHeaderTitle.textContent = `与${aiName}的聊天`;
        }

        messageContainer.innerHTML = '';
        (worldState.chat.history || []).forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`;
            
            const contentParts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content || '') }];
            contentParts.forEach(part => {
                if (part.text) {
                    const textNode = document.createElement('div');
                    textNode.textContent = part.text;
                    bubble.appendChild(textNode);
                } else if (part.inline_data) {
                    const imgNode = document.createElement('img');
                    imgNode.className = 'chat-image';
                    imgNode.src = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                    bubble.appendChild(imgNode);
                }
            });
            
            if (bubble.hasChildNodes()) {
                messageContainer.appendChild(bubble);
            }
        });
        
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    // 其他渲染函数类似处理...

    // --- 7. 事件绑定（使用bind安全绑定） ---
    bind(lockScreen, 'click', async () => {
        showScreen('home-screen');
        renderHomeScreen();
        await saveWorldState();
    });

    bind(openChatAppButton, 'click', async () => {
        showScreen('chat-screen');
        renderChatScreen();
        
        // 发送欢迎消息（修复参数类型）
        const aiGreeting = await getAiResponse('');
        if (aiGreeting && !aiGreeting.includes('系统提示') && !aiGreeting.includes('API')) {
            worldState.chat.history.push({
                sender: 'ai',
                content: [{ text: aiGreeting }],
                timestamp: Date.now()
            });
            renderChatScreen();
            await saveWorldState();
        }
    });

    bind(chatInputForm, 'submit', async (event) => {
        event.preventDefault();
        if (!chatInput) return;
        
        const userInput = chatInput.value.trim();
        if (userInput === '') return;
        
        const userMessage = {
            sender: 'user',
            content: [{ text: userInput }],
            timestamp: Date.now()
        };
        
        worldState.chat.history.push(userMessage);
        renderChatScreen();
        chatInput.value = '';
        await saveWorldState();
        
        const aiReplyText = await getAiResponse(userInput);
        const aiMessage = {
            sender: 'ai',
            content: [{ text: aiReplyText }],
            timestamp: Date.now()
        };
        
        worldState.chat.history.push(aiMessage);
        renderChatScreen();
        await saveWorldState();
    });

    // 其他事件绑定...
    bind(backToHomeButton, 'click', () => showScreen('home-screen'));
    bind(openWalletAppButton, 'click', () => showScreen('wallet-screen'));
    bind(walletBackButton, 'click', () => showScreen('home-screen'));
    bind(openStoreAppButton, 'click', () => showScreen('store-screen'));
    bind(storeBackButton, 'click', () => showScreen('home-screen'));
    bind(openBackpackAppButton, 'click', () => showScreen('backpack-screen'));
    bind(backpackBackButton, 'click', () => showScreen('home-screen'));
    bind(openWorldBookAppButton, 'click', () => showScreen('world-book-screen'));
    bind(worldBookBackButton, 'click', () => showScreen('home-screen'));
    bind(openSettingsAppButton, 'click', () => showScreen('settings-screen'));
    bind(settingsBackButton, 'click', () => showScreen('home-screen'));

    // --- 8. 初始化 ---
    async function main() {
        await loadWorldState();
        updateClock();
        setInterval(updateClock, 30000);
        showScreen('lock-screen');
        renderHomeScreen();
    }

    main();
});
