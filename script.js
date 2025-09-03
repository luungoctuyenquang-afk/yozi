document.addEventListener('DOMContentLoaded', () => {
    
    // --- 0. 数据库 (Data) ---
    const db = new Dexie('myVirtualWorldDB');
    db.version(1).stores({
        general: '&id', player: '&id', ai: '&id',
        chatHistory: '++id', worldBook: '&id', events: '&id',
        apiConfig: '&id', chatSettings: '&id' 
    });

    // --- 数据常量 ---
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
            await db.transaction('rw', db.tables, async () => {
                if (!worldState.player || !worldState.ai || !worldState.apiConfig || !worldState.chats) {
                    throw new Error("核心数据丢失，无法存档。");
                }
                if (worldState.chat.history.length > 100) {
                    worldState.chat.history = worldState.chat.history.slice(-50);
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

    async function getAiResponse(messageContent) {
        const activePresetId = worldState.apiConfig.activePresetId;
        const config = worldState.apiConfig.presets.find(p => p.id === activePresetId);
        if (!config || !config.apiKey || !config.model) { return '（系统提示：请在“API设置”里选择一个有效的API预设并填入密钥和模型。）'; }
        const activeChat = worldState.chats[worldState.activeChatId];
        if (!activeChat) return '（系统错误：找不到聊天信息。）';

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
                rawResponseText = data.candidates[0]?.content?.parts[0]?.text || ''; 
            } else { 
                rawResponseText = data.choices[0]?.message?.content || ''; 
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
                return rawResponseText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
            }

            return rawResponseText.trim();

        } catch (error) { console.error("API 调用失败:", error); if (error.name === 'AbortError') { return '（抱歉，AI思考超时了……）'; } return `【调试信息】请求失败: ${error.name} - ${error.message}`; }
    }
    
    function buildOpenAiMessages(currentUserInputParts, activeChat, recentHistory) {
        const parts = Array.isArray(currentUserInputParts)
            ? currentUserInputParts
            : [{ text: String(currentUserInputParts ?? '') }];

        const aiPersona = activeChat.settings.aiPersona || `你是AI伴侣'零'。`;
        const userPersona = activeChat.settings.myPersona || `我是一个正在和AI聊天的人类。`;
        const linkedBooks = worldState.worldBook.filter(rule => 
            activeChat.settings.linkedWorldBookIds && activeChat.settings.linkedWorldBookIds.includes(rule.id)
        );
        const now = new Date();
        const timeInfo = {
            currentTime: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
            dayOfWeek: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()],
            date: `${now.getMonth() + 1}月${now.getDate()}日`
        };
        const dynamicEvents = [];
        if (worldState.session.minutesAway > 0) {
            dynamicEvents.push({
                type: '用户刚回来',
                detail: `用户离开了${worldState.session.minutesAway}分钟，期间你赚了${worldState.session.moneyEarned}金币。请根据你的性格决定如何欢迎他。`
            });
        }
        const importantItems = ['电影票', '咖啡', '书本', '盆栽'];
        const itemsInBackpack = worldState.player.inventory.filter(item => importantItems.includes(item));
        if (itemsInBackpack.length > 0) {
            dynamicEvents.push({
                type: '背包物品',
                detail: `用户背包里有：${itemsInBackpack.join('、')}。请根据你的性格和当前对话气氛，决定是否要提及此事。`
            });
        }
        const stateForPrompt = {
            时间状态: timeInfo,
            玩家: { 名字: worldState.player.name, 金币: worldState.player.money, 背包: worldState.player.inventory },
            AI状态: { 名字: worldState.ai.name, 心情: worldState.ai.mood, 金币: worldState.ai.money, 物品: worldState.ai.inventory },
            世界规则: linkedBooks,
            当前重要事件: dynamicEvents.length > 0 ? dynamicEvents : "无特殊事件"
        };
        const systemPrompt = `你正在一个虚拟手机模拟器中扮演AI伴侣'零'。
# 你的核心设定: ${aiPersona}
# 用户的虚拟形象: ${userPersona}
# 当前世界状态 (JSON格式, 供你参考):
${JSON.stringify(stateForPrompt, null, 2)}
# 你的任务
1. 严格按照你的角色设定进行回复。
2. **绝对不要**复述或解释上面的JSON状态信息，要自然地将这些信息融入你的对话中。
3. **针对“当前重要事件”**: 如果有事件发生（比如用户刚回来，或背包里有特殊物品），请根据你的性格，自然地对此作出反应，而不是生硬地播报。
4. 你的回复必须是纯文本。
${activeChat.settings.enableChainOfThought ? '5. **[思维链已开启]** 在最终回复前，请用""标签包裹思考过程。' : ''}
`;
        const messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...recentHistory);
        const userMessageContent = parts.map(part => { 
            if (part.inline_data) { return { type: 'image_url', image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }; } 
            return { type: 'text', text: part.text || '' }; 
        }).filter(p => (p.text && p.text.trim() !== '') || p.image_url);
        if (userMessageContent.length > 0) { messages.push({ role: 'user', content: userMessageContent }); }
        return messages;
    }
    
    function buildMultimodalHistory(history, provider) {
        const formattedHistory = [];
        (history || []).forEach(msg => {
            const role = msg.sender === 'user' ? 'user' : (provider === 'gemini' ? 'model' : 'assistant');
            const contentParts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content || '') }];
            if (provider === 'gemini') { 
                formattedHistory.push({ role, parts: contentParts }); 
            } else { 
                const openAiContent = contentParts.map(part => { 
                    if (part.inline_data) { 
                        return { type: 'image_url', image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }; 
                    } 
                    return { type: 'text', text: part.text || '' }; 
                }).filter(p => (p.text && p.text.trim() !== '') || p.image_url); 
                if (openAiContent.length > 0) { 
                    formattedHistory.push({ role, content: openAiContent }); 
                } 
            }
        });
        return formattedHistory;
    }

    function updateClock() { const now = new Date(); const hours = String(now.getHours()).padStart(2, '0'); const minutes = String(now.getMinutes()).padStart(2, '0'); if(timeDisplay) timeDisplay.textContent = `${hours}:${minutes}`; }
    function showScreen(screenId) { if(screens) screens.forEach(s => { s.style.display = s.id === screenId ? (['lock-screen', 'chat-screen', 'wallet-screen', 'store-screen', 'backpack-screen', 'world-book-screen', 'settings-screen', 'general-settings-screen'].includes(s.id) ? 'flex' : 'block') : 'none'; }); }
    function renderHomeScreen() { if(aiNameDisplay && worldState.ai) aiNameDisplay.textContent = worldState.ai.name; }

    function renderChatScreen() {
        worldState.activeChatId = 'chat_default';
        const activeChat = worldState.chats[worldState.activeChatId];
        if (!activeChat || !activeChat.settings || !worldState.chat) { console.error("无法渲染聊天，核心数据丢失"); return; }
        const aiNameInTitle = activeChat.settings.aiPersona.split('。')[0].replace("你是AI伴侣'", "").replace("'", "") || worldState.ai?.name || '零';
        if(chatHeaderTitle) chatHeaderTitle.textContent = `与 ${aiNameInTitle} 的聊天`;
        if(messageContainer) {
            messageContainer.innerHTML = '';
            (worldState.chat.history || []).forEach(msg => {
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`;
                const contentParts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content || '') }];
                contentParts.forEach(part => {
                    if (part.text && part.text.trim() !== '') {
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
                if(bubble.hasChildNodes()) { messageContainer.appendChild(bubble); }
            });
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    }
    
    async function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64String = reader.result.split(',')[1];
            const userMessage = { sender: 'user', content: [ { text: chatInput.value.trim() }, { inline_data: { mime_type: file.type, data: base64String } } ], timestamp: Date.now() };
            worldState.chat.history.push(userMessage);
            renderChatScreen();
            chatInput.value = '';
            await saveWorldState();
            const aiReplyText = await getAiResponse(userMessage.content);
            const aiMessage = { sender: 'ai', content: [{ text: aiReplyText }], timestamp: Date.now() };
            worldState.chat.history.push(aiMessage);
            renderChatScreen();
            await saveWorldState();
        };
        event.target.value = null; 
    }

    function renderGeneralSettingsScreen() {
        const activeChat = worldState.chats['chat_default'];
        if (!activeChat || !activeChat.settings) return;
        if(aiPersonaTextarea) aiPersonaTextarea.value = activeChat.settings.aiPersona;
        if(myPersonaTextarea) myPersonaTextarea.value = activeChat.settings.myPersona;
        if(chainOfThoughtSwitch) chainOfThoughtSwitch.checked = activeChat.settings.enableChainOfThought;
        if(showThoughtAlertSwitch) {
            showThoughtAlertSwitch.checked = activeChat.settings.showThoughtAsAlert;
            showThoughtAlertSwitch.disabled = !chainOfThoughtSwitch.checked;
        }
        if(worldBookLinkingContainer) {
            worldBookLinkingContainer.innerHTML = '';
            if (worldState.worldBook && worldState.worldBook.length > 0) {
                worldState.worldBook.forEach(rule => {
                    const isChecked = activeChat.settings.linkedWorldBookIds && activeChat.settings.linkedWorldBookIds.includes(rule.id);
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = rule.id;
                    checkbox.checked = isChecked;
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${rule.key} (${rule.category})`));
                    worldBookLinkingContainer.appendChild(label);
                });
            } else {
                worldBookLinkingContainer.innerHTML = '<p style="color: #888; font-size: 14px;">还没有创建任何世界书规则。</p>';
            }
        }
    }

    function renderWalletScreen() { if(playerMoneyDisplay) playerMoneyDisplay.textContent = worldState.player.money; if(aiMoneyDisplay) aiMoneyDisplay.textContent = worldState.ai.money; if(aiNameWalletDisplay) aiNameWalletDisplay.textContent = worldState.ai.name; }
    function renderStoreScreen() { if(storePlayerMoneyDisplay) storePlayerMoneyDisplay.textContent = worldState.player.money; if(itemListContainer) { itemListContainer.innerHTML = ''; storeItems.forEach(item => { const itemCard = document.createElement('div'); itemCard.className = 'item-card'; itemCard.innerHTML = `<h3>${item.name}</h3><p>${item.price} 金币</p><button class="buy-btn" data-item-id="${item.id}">购买</button>`; itemListContainer.appendChild(itemCard); }); } }
    async function buyItem(itemId) { const item = storeItems.find(i => i.id === itemId); if (!item) return; if (worldState.player.money >= item.price) { worldState.player.money -= item.price; worldState.player.inventory.push(item.name); await saveWorldState(); renderStoreScreen(); renderWalletScreen(); alert(`购买“${item.name}”成功！`); } else { alert('金币不足！'); } }
    function renderBackpackScreen() { if(inventoryListContainer) { inventoryListContainer.innerHTML = ''; if (worldState.player.inventory.length === 0) { inventoryListContainer.innerHTML = `<p class="inventory-empty-msg">你的背包是空的...</p>`; return; } worldState.player.inventory.forEach(itemName => { const itemDiv = document.createElement('div'); itemDiv.className = 'inventory-item'; const nameSpan = document.createElement('span'); nameSpan.textContent = itemName; itemDiv.appendChild(nameSpan); if (itemEffects[itemName]) { const useButton = document.createElement('button'); useButton.className = 'use-btn'; useButton.textContent = '使用'; useButton.dataset.itemName = itemName; itemDiv.appendChild(useButton); } inventoryListContainer.appendChild(itemDiv); }); } }
    async function useItem(itemName) { const itemEffect = itemEffects[itemName]; if (!itemEffect) return; const itemIndex = worldState.player.inventory.findIndex(item => item === itemName); if (itemIndex === -1) return; const resultMessage = itemEffect.effect(worldState); worldState.player.inventory.splice(itemIndex, 1); await saveWorldState(); renderBackpackScreen(); alert(resultMessage); }
    
    function renderWorldBookScreen(editingRuleId = null) { 
        if(!ruleListContainer) return;
        ruleListContainer.innerHTML = '';
        const addNewBtn = document.createElement('button');
        addNewBtn.className = 'form-button';
        addNewBtn.style.marginBottom = '10px';
        addNewBtn.textContent = '+ 添加新规则';
        addNewBtn.onclick = async () => {
            const category = prompt('规则分类（如：物品、经济、事件）：', '自定义');
            if (category === null) return;
            const key = prompt('规则名称：', '新规则');
            if (key === null) return;
            const value = prompt('规则值或描述：');
            if (value === null) return;
            const newRule = { id: `rule_${Date.now()}`, category: category || '自定义', key: key || '新规则', value: value || '', description: '' };
            if (newRule.key) {
                worldState.worldBook.push(newRule);
                await saveWorldState();
                renderWorldBookScreen();
            }
        };
        ruleListContainer.appendChild(addNewBtn);
        const toolBar = document.createElement('div');
        toolBar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px;';
        const exportBtn = document.createElement('button');
        exportBtn.className = 'form-button-secondary';
        exportBtn.textContent = '导出规则';
        exportBtn.onclick = () => {
            const dataStr = JSON.stringify(worldState.worldBook, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `虚拟手机-世界书规则-${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        };
        const importBtn = document.createElement('button');
        importBtn.className = 'form-button-secondary';
        importBtn.textContent = '导入规则';
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    try {
                        const rules = JSON.parse(text);
                        if (Array.isArray(rules)) {
                            worldState.worldBook = rules;
                            await saveWorldState();
                            renderWorldBookScreen();
                            alert('规则导入成功！');
                        } else {
                            alert('导入失败：文件内容不是有效的规则数组。');
                        }
                    } catch (err) {
                        alert('导入失败：文件格式错误');
                    }
                }
            };
            input.click();
        };
        toolBar.appendChild(exportBtn);
        toolBar.appendChild(importBtn);
        ruleListContainer.appendChild(toolBar);
        worldState.worldBook.forEach(rule => {
            const ruleCard = document.createElement('div');
            ruleCard.className = 'rule-card';
            const ruleValue = document.createElement('p');
            ruleValue.className = 'rule-value';
            ruleValue.textContent = rule.value;
            const ruleKeySpan = document.createElement('span');
            ruleKeySpan.className = 'rule-key';
            ruleKeySpan.textContent = rule.key;
            const ruleCategorySpan = document.createElement('span');
            ruleCategorySpan.className = 'rule-category';
            ruleCategorySpan.textContent = rule.category;
            if (rule.id === editingRuleId) {
                ruleCard.innerHTML = `<div class="rule-card-header"></div> <div class="rule-body"> <input type="text" class="rule-edit-input" style="width:100%" id="edit-input-${rule.id}" value=""> <div class="rule-actions"> <button class="save-btn" data-rule-id="${rule.id}">保存</button> <button class="cancel-btn" data-rule-id="${rule.id}">取消</button> </div> </div>`;
                ruleCard.querySelector('.rule-card-header').appendChild(ruleKeySpan);
                ruleCard.querySelector('.rule-card-header').appendChild(ruleCategorySpan);
                ruleCard.querySelector(`#edit-input-${rule.id}`).value = rule.value;
            } else {
                ruleCard.innerHTML = `<div class="rule-card-header"></div> <div class="rule-body"></div>`;
                ruleCard.querySelector('.rule-card-header').appendChild(ruleKeySpan);
                ruleCard.querySelector('.rule-card-header').appendChild(ruleCategorySpan);
                ruleCard.querySelector('.rule-body').appendChild(ruleValue);
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'rule-actions';
                actionsDiv.innerHTML = `<button class="edit-btn" data-rule-id="${rule.id}">编辑</button>`;
                ruleCard.querySelector('.rule-body').appendChild(actionsDiv);
            }
            ruleListContainer.appendChild(ruleCard);
        });
    }

    function renderSettingsScreen() { 
        if(!apiPresetSelect) return;
        apiPresetSelect.innerHTML = ''; 
        worldState.apiConfig.presets.forEach(preset => { 
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            apiPresetSelect.appendChild(option);
        });
        apiPresetSelect.value = worldState.apiConfig.activePresetId;
        const activePreset = worldState.apiConfig.presets.find(p => p.id === worldState.apiConfig.activePresetId);
        if (activePreset) {
            presetNameInput.value = activePreset.name;
            apiProviderSelect.value = activePreset.provider;
            apiEndpointInput.value = activePreset.endpoint;
            apiKeyInput.value = activePreset.apiKey;
            apiModelInput.value = activePreset.model;
            if(apiModelsList) apiModelsList.innerHTML = `<option value="${activePreset.model}"></option>`;
        }
    }

    function selectPreset() { 
        worldState.apiConfig.activePresetId = apiPresetSelect.value; 
        renderSettingsScreen(); 
    }

    async function saveCurrentPreset() {
        const preset = worldState.apiConfig.presets.find(p => p.id === worldState.apiConfig.activePresetId);
        if (preset) {
            preset.name = presetNameInput.value.trim() || '未命名预设';
            preset.provider = apiProviderSelect.value;
            preset.endpoint = apiEndpointInput.value.trim();
            preset.apiKey = apiKeyInput.value.trim();
            preset.model = apiModelInput.value.trim();
            worldState.apiConfig.presets = worldState.apiConfig.presets.map(p => p.id === preset.id ? preset : p);
            await saveWorldState();
            renderSettingsScreen();
            alert('当前预设已保存！');
        }
    }

    async function createNewPreset() {
        const newId = `preset_${Date.now()}`;
        const newPreset = { id: newId, name: '新预设', provider: 'gemini', endpoint: '', apiKey: '', model: 'gemini-1.5-flash-latest' };
        worldState.apiConfig.presets.push(newPreset);
        worldState.apiConfig.activePresetId = newId;
        await saveWorldState();
        renderSettingsScreen();
    }

    async function deleteCurrentPreset() {
        if (worldState.apiConfig.presets.length <= 1) { 
            alert('这是最后一个预设，不能删除！'); 
            return; 
        }
        if (confirm('确定要删除当前预设吗？')) {
            const activeId = worldState.apiConfig.activePresetId;
            worldState.apiConfig.presets = worldState.apiConfig.presets.filter(p => p.id !== activeId);
            worldState.apiConfig.activePresetId = worldState.apiConfig.presets[0].id;
            await saveWorldState();
            renderSettingsScreen();
        }
    }

    async function fetchModels() {
        const indicator = apiStatusIndicator;
        indicator.textContent = '拉取中...';
        indicator.className = '';
        const provider = apiProviderSelect.value;
        let endpoint = apiEndpointInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            indicator.textContent = '失败: 请先填写API密钥。';
            indicator.className = 'error';
            return;
        }
        let fetchUrl;
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'gemini') {
            fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        } else {
            if (endpoint.endsWith('/chat/completions')) { endpoint = endpoint.replace('/chat/completions', ''); }
            if (!endpoint.endsWith('/v1')) { endpoint = endpoint.replace(/\/$/, '') + '/v1'; }
            fetchUrl = `${endpoint}/models`;
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        try {
            const response = await fetch(fetchUrl, { headers: headers });
            if (!response.ok) { throw new Error(`服务器错误: ${response.status}`); }
            const data = await response.json();
            apiModelsList.innerHTML = '';
            const models = provider === 'gemini' ? data.models : data.data;
            models.forEach(model => {
                const modelId = provider === 'gemini' ? model.name.replace('models/', '') : model.id;
                if (provider === 'gemini' && !model.supportedGenerationMethods.includes('generateContent')) { return; }
                const option = document.createElement('option');
                option.value = modelId;
                apiModelsList.appendChild(option);
            });
            indicator.textContent = `✅ 成功拉取模型！`;
            indicator.className = 'success';
        } catch (error) {
            indicator.textContent = `❌ 拉取失败: ${error.message}`;
            indicator.className = 'error';
        }
    }

    async function testApiConnection() {
        const indicator = apiStatusIndicator;
        indicator.textContent = '测试中...';
        indicator.className = '';
        const config = { provider: apiProviderSelect.value, endpoint: apiEndpointInput.value.trim(), apiKey: apiKeyInput.value.trim(), model: apiModelInput.value };
        if (!config.apiKey) {
            indicator.textContent = '失败: 密钥不能为空。';
            indicator.className = 'error';
            return;
        }
        let testUrl, testBody, testHeaders;
        const testUserInput = "你好，这是一个连接测试。";
        if (config.provider === 'gemini') {
            testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            testHeaders = { 'Content-Type': 'application/json' };
            testBody = { contents: [{ parts: [{ text: testUserInput }] }] };
        } else {
            testUrl = config.endpoint;
            if (!testUrl.endsWith('/chat/completions')) { testUrl = testUrl.replace(/\/$/, '') + '/chat/completions'; }
            testHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
            testBody = { model: config.model, messages: [{ role: 'user', content: testUserInput }] };
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(testUrl, { method: 'POST', headers: testHeaders, body: JSON.stringify(testBody), signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error?.message || `HTTP ${response.status}`); }
            indicator.textContent = '✅ 连接成功！';
            indicator.className = 'success';
        } catch (error) {
            indicator.textContent = `❌ 连接失败: ${error.message}`;
            indicator.className = 'error';
        }
    }

    function exportData() {
        const dataToSave = {};
        for (const key in worldState) {
            if (typeof worldState[key] !== 'function') { dataToSave[key] = worldState[key]; }
        }
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `虚拟手机备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    async function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const confirmed = confirm('警告：导入备份将覆盖所有当前数据，此操作不可撤销！确定要继续吗？');
        if (!confirmed) return;
        try {
            const text = await file.text();
            const importedData = JSON.parse(text);
            await Promise.all(db.tables.map(table => table.clear()));
            if (importedData.player) await db.player.put({ id: 'main', ...importedData.player });
            if (importedData.ai) await db.ai.put({ id: 'main', ...importedData.ai });
            if (importedData.chat && importedData.chat.history) await db.chatHistory.bulkAdd(importedData.chat.history);
            if (importedData.worldBook) await db.worldBook.bulkPut(importedData.worldBook);
            if (importedData.events) await db.events.put({ id: 'main', ...importedData.events });
            if (importedData.apiConfig) await db.apiConfig.put({ id: 'main', ...importedData.apiConfig });
            if (importedData.chats) {
                 for (const chatId in importedData.chats) {
                    if(importedData.chats[chatId].settings) {
                       await db.chatSettings.put({ id: chatId, settings: importedData.chats[chatId].settings });
                    }
                }
            }
            alert('数据导入成功！页面即将刷新以应用更改。');
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            alert('导入失败：文件格式错误或已损坏。');
            console.error("导入错误:", e);
        } finally {
            event.target.value = '';
        }
    }

    // --- 5. 交互逻辑绑定 ---
    const safeBind = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    safeBind(lockScreen, 'click', async () => { 
        showScreen('home-screen'); 
        renderHomeScreen(); 
        await saveWorldState(); 
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.navigator.standalone === true;
        const lastInstallPrompt = localStorage.getItem('lastInstallPrompt');
        const now = Date.now();
        if (isIOS && !isStandalone && (!lastInstallPrompt || now - parseInt(lastInstallPrompt) > 86400000 * 3)) {
            setTimeout(() => {
                alert('💡 重要提示：将本应用添加到主屏幕可以永久保存您的数据！\n\n请点击Safari底部的“分享”按钮，然后选择“添加到主屏幕”。\n\n否则您的所有聊天记录和设置可能会在7天后被iOS系统自动清除。');
                localStorage.setItem('lastInstallPrompt', now.toString());
            }, 2000);
        }
    });
    
    safeBind(openChatAppButton, 'click', async () => {
        showScreen('chat-screen');
        renderChatScreen();
        if (worldState.session.minutesAway > 0) {
            const aiGreeting = await getAiResponse([{text: ''}]);
            if (aiGreeting) {
                worldState.chat.history.push({ sender: 'ai', content: [{text: aiGreeting}], timestamp: Date.now() });
                renderChatScreen();
                worldState.session.minutesAway = 0;
                worldState.session.moneyEarned = 0;
                await saveWorldState();
            }
        }
    });

    safeBind(chatInputForm, 'submit', async (event) => {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (userInput === '') return;
        const userMessage = { sender: 'user', content: [{ text: userInput }], timestamp: Date.now() };
        worldState.chat.history.push(userMessage);
        renderChatScreen();
        chatInput.value = '';
        await saveWorldState();
        const aiReplyText = await getAiResponse(userMessage.content);
        if (worldState.session.minutesAway > 0) {
            worldState.session.minutesAway = 0;
            worldState.session.moneyEarned = 0;
        }
        const aiMessage = { sender: 'ai', content: [{ text: aiReplyText }], timestamp: Date.now() };
        worldState.chat.history.push(aiMessage);
        renderChatScreen();
        await saveWorldState();
    });
    
    safeBind(sendImageButton, 'click', () => imageInput.click());
    safeBind(imageInput, 'change', handleImageUpload);
    safeBind(backToHomeButton, 'click', () => showScreen('home-screen'));
    safeBind(openWalletAppButton, 'click', () => { showScreen('wallet-screen'); renderWalletScreen(); });
    safeBind(walletBackButton, 'click', () => showScreen('home-screen'));
    safeBind(openStoreAppButton, 'click', () => { showScreen('store-screen'); renderStoreScreen(); });
    safeBind(storeBackButton, 'click', () => showScreen('home-screen'));
    safeBind(itemListContainer, 'click', (event) => { if (event.target.classList.contains('buy-btn')) { const itemId = event.target.dataset.itemId; buyItem(itemId); } });
    safeBind(openBackpackAppButton, 'click', () => { showScreen('backpack-screen'); renderBackpackScreen(); });
    safeBind(backpackBackButton, 'click', () => showScreen('home-screen'));
    safeBind(inventoryListContainer, 'click', (event) => { if (event.target.classList.contains('use-btn')) { const itemName = event.target.dataset.itemName; useItem(itemName); } });
    safeBind(openWorldBookAppButton, 'click', () => { showScreen('world-book-screen'); renderWorldBookScreen(); });
    safeBind(worldBookBackButton, 'click', () => showScreen('home-screen'));
    safeBind(ruleListContainer, 'click', async (event) => { const target = event.target; const ruleId = target.dataset.ruleId; if (target.classList.contains('edit-btn')) { renderWorldBookScreen(ruleId); } if (target.classList.contains('cancel-btn')) { renderWorldBookScreen(); } if (target.classList.contains('save-btn')) { const inputElement = document.getElementById(`edit-input-${ruleId}`); const newValue = inputElement.value; const ruleToUpdate = worldState.worldBook.find(rule => rule.id === ruleId); if (ruleToUpdate) { ruleToUpdate.value = isNaN(parseFloat(newValue)) ? newValue : parseFloat(newValue); await saveWorldState(); renderWorldBookScreen(); } } });
    safeBind(openSettingsAppButton, 'click', () => { showScreen('settings-screen'); renderSettingsScreen(); });
    safeBind(settingsBackButton, 'click', () => showScreen('home-screen'));
    safeBind(saveSettingsButton, 'click', async () => { saveSettingsButton.textContent = '保存中...'; saveSettingsButton.disabled = true; try { await saveCurrentPreset(); } finally { saveSettingsButton.textContent = '保存当前预设'; saveSettingsButton.disabled = false; } });
    safeBind(testApiButton, 'click', testApiConnection);
    safeBind(apiPresetSelect, 'change', selectPreset);
    safeBind(newPresetButton, 'click', createNewPreset);
    safeBind(deletePresetButton, 'click', deleteCurrentPreset);
    safeBind(fetchModelsButton, 'click', fetchModels);
    safeBind(openGeneralSettingsAppButton, 'click', () => { showScreen('general-settings-screen'); renderGeneralSettingsScreen(); });
    safeBind(generalSettingsBackButton, 'click', () => showScreen('home-screen'));
    safeBind(saveGeneralSettingsButton, 'click', async () => { saveGeneralSettingsButton.textContent = '保存中...'; saveGeneralSettingsButton.disabled = true; try { const activeChat = worldState.chats['chat_default']; if (!activeChat) return; activeChat.settings.aiPersona = aiPersonaTextarea.value; activeChat.settings.myPersona = myPersonaTextarea.value; activeChat.settings.enableChainOfThought = chainOfThoughtSwitch.checked; activeChat.settings.showThoughtAsAlert = showThoughtAlertSwitch.checked; const selectedBookIds = []; const checkboxes = worldBookLinkingContainer.querySelectorAll('input[type="checkbox"]:checked'); checkboxes.forEach(cb => selectedBookIds.push(cb.value)); activeChat.settings.linkedWorldBookIds = selectedBookIds; await saveWorldState(); alert('通用设置已保存！'); } finally { saveGeneralSettingsButton.textContent = '保存通用设置'; saveGeneralSettingsButton.disabled = false; } });
    safeBind(chainOfThoughtSwitch, 'change', () => { showThoughtAlertSwitch.disabled = !chainOfThoughtSwitch.checked; if (!chainOfThoughtSwitch.checked) { showThoughtAlertSwitch.checked = false; } });
    safeBind(exportDataBtn, 'click', exportData);
    safeBind(importDataBtn, 'click', () => importFileInput.click());
    safeBind(importFileInput, 'change', importData);

    // --- 6. 程序入口 ---
    async function main() {
        await loadWorldState();
        updateClock();
        setInterval(updateClock, 30000);
        showScreen('lock-screen');
        renderHomeScreen();
    }

    main();
});
