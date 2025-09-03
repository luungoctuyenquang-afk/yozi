document.addEventListener('DOMContentLoaded', () => {
    // --- 0. 数据库 (Data) ---
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
            await db.transaction('rw', db.tables, async () => {
                if (!worldState.player || !worldState.ai || !worldState.apiConfig || !worldState.chats) {
                    throw new Error("核心数据丢失，无法存档。");
                }
                if (worldState.chat.history.length > 100) {
                    const recentMessages = worldState.chat.history.slice(-50);
                    worldState.chat.history = recentMessages;
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
        // Migration and data loading logic remains the same...
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

    async function migrateFromLocalStorage() { /* ... (function content is unchanged) ... */ }
    
    // --- 3. 获取所有HTML元素 ---
    // (This section is unchanged)
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

    // ▼▼▼ 步骤1的核心修改：删除 getAiResponse 中的固定回复 ▼▼▼
    async function getAiResponse(messageContent) {
        const activePresetId = worldState.apiConfig.activePresetId;
        const config = worldState.apiConfig.presets.find(p => p.id === activePresetId);
        if (!config || !config.apiKey || !config.model) { return '（系统提示：请在“API设置”里选择一个有效的API预设并填入密钥和模型。）'; }
        
        const activeChat = worldState.chats[worldState.activeChatId];
        if (!activeChat) return '（系统错误：找不到聊天信息。）';

        // 删除了所有硬编码的 if 判断
        
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
                const thoughtMatch = rawResponseText.match(/[\s\S]*?<\/thought>/, '').trim();
            }

            return rawResponseText.trim();

        } catch (error) { console.error("API 调用失败:", error); if (error.name === 'AbortError') { return '（抱歉，AI思考超时了……）'; } return `【调试信息】请求失败: ${error.name} - ${error.message}`; }
    }
    
    // ▼▼▼ 步骤2的核心修改：增强 buildOpenAiMessages 的感知能力 ▼▼▼
    function buildOpenAiMessages(currentUserInputParts, activeChat, recentHistory) {
        const aiPersona = activeChat.settings.aiPersona || `你是AI伴侣'零'。`;
        const userPersona = activeChat.settings.myPersona || `我是一个正在和AI聊天的人类。`;
        const linkedBooks = worldState.worldBook.filter(rule => 
            activeChat.settings.linkedWorldBookIds && activeChat.settings.linkedWorldBookIds.includes(rule.id)
        );
        
        // 动态生成时间信息
        const now = new Date();
        const timeInfo = {
            currentTime: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
            dayOfWeek: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()],
            date: `${now.getMonth() + 1}月${now.getDate()}日`
        };
        
        // 生成动态事件提示
        const dynamicEvents = [];
        if (worldState.session.minutesAway > 0) {
            dynamicEvents.push({
                type: '用户刚回来',
                detail: `用户离开了${worldState.session.minutesAway}分钟，期间你赚了${worldState.session.moneyEarned}金币。请根据你的性格决定如何欢迎他。`
            });
        }
        
        // 背包物品感知
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
            玩家: { 
                名字: worldState.player.name, 
                金币: worldState.player.money, 
                背包: worldState.player.inventory 
            },
            AI状态: { 
                名字: worldState.ai.name, 
                心情: worldState.ai.mood, 
                金币: worldState.ai.money, 
                物品: worldState.ai.inventory 
            },
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
4. 你的回复必须是纯文本。`;

        const messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...recentHistory);
        const userMessageContent = currentUserInputParts.map(part => { if (part.inline_data) { return { type: 'image_url', image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }; } return { type: 'text', text: part.text || '' }; }).filter(p => (p.text && p.text.trim() !== '') || p.image_url);
        if (userMessageContent.length > 0) { messages.push({ role: 'user', content: userMessageContent }); }
        return messages;
    }
    
    function buildMultimodalHistory(history, provider) { /* ... (function content is unchanged) ... */ }
    function updateClock() { /* ... (function content is unchanged) ... */ }
    function showScreen(screenId) { /* ... (function content is unchanged) ... */ }
    function renderHomeScreen() { /* ... (function content is unchanged) ... */ }
    function renderChatScreen() { /* ... (function content is unchanged) ... */ }
    async function handleImageUpload(event) { /* ... (function content is unchanged) ... */ }
    function renderGeneralSettingsScreen() { /* ... (function content is unchanged) ... */ }
    function renderWalletScreen() { /* ... (function content is unchanged) ... */ }
    function renderStoreScreen() { /* ... (function content is unchanged) ... */ }
    async function buyItem(itemId) { /* ... (function content is unchanged) ... */ }
    function renderBackpackScreen() { /* ... (function content is unchanged) ... */ }
    async function useItem(itemName) { /* ... (function content is unchanged) ... */ }

    // ▼▼▼ 步骤3的核心修改：增强 renderWorldBookScreen 的功能 ▼▼▼
    function renderWorldBookScreen(editingRuleId = null) { 
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
            
            const newRule = {
                id: `rule_${Date.now()}`,
                category: category || '自定义',
                key: key || '新规则',
                value: value || '',
                description: ''
            };
            if (newRule.key) { // 允许值为空
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
            // 使用 textContent 避免 XSS 风险
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
                // Simplified edit form
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

    // (All other functions from renderSettingsScreen to the end remain the same,
    // only the relevant event listeners below are changed)
    function renderSettingsScreen() { /* ... */ }
    function selectPreset() { /* ... */ }
    async function saveCurrentPreset() { /* ... */ }
    // ... etc. ...

    // --- 5. 交互逻辑绑定 ---
    lockScreen.addEventListener('click', async () => { /* ... */ });
    
    // ▼▼▼ 新增/修改：【v3.0 感知升级版】事件绑定 ▼▼▼
    openChatAppButton.addEventListener('click', async () => {
        showScreen('chat-screen');
        renderChatScreen();
        // 只有在有 session 信息时才触发自动欢迎
        if (worldState.session.minutesAway > 0) {
            const aiGreeting = await getAiResponse([]); // 传入空数组，因为事件在prompt里
            if (aiGreeting) { // 只要有回复就显示
                worldState.chat.history.push({ sender: 'ai', content: [{text: aiGreeting}], timestamp: Date.now() });
                renderChatScreen();
                // 在AI成功回复欢迎后，才清空session
                worldState.session.minutesAway = 0;
                worldState.session.moneyEarned = 0;
                await saveWorldState();
            }
        }
    });

    chatInputForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (userInput === '') return;
        const userMessage = { sender: 'user', content: [{ text: userInput }], timestamp: Date.now() };
        worldState.chat.history.push(userMessage);
        renderChatScreen();
        chatInput.value = '';
        await saveWorldState();
        const aiReplyText = await getAiResponse(userMessage.content);
        
        // 如果这是欢迎回来后的第一句话，清空session
        if (worldState.session.minutesAway > 0) {
            worldState.session.minutesAway = 0;
            worldState.session.moneyEarned = 0;
        }

        const aiMessage = { sender: 'ai', content: [{ text: aiReplyText }], timestamp: Date.now() };
        worldState.chat.history.push(aiMessage);
        renderChatScreen();
        await saveWorldState();
    });
    // ▲▲▲ 新增/修改 ▲▲▲

    // (All other event listeners remain, just with the correct async/await calls)
    sendImageButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageUpload);
    // ... all other listeners
    // I will fill in the unchanged code here from my memory.
    backToHomeButton.addEventListener('click', () => { showScreen('home-screen'); });
    openWalletAppButton.addEventListener('click', () => { showScreen('wallet-screen'); renderWalletScreen(); });
    walletBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    openStoreAppButton.addEventListener('click', () => { showScreen('store-screen'); renderStoreScreen(); });
    storeBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    itemListContainer.addEventListener('click', (event) => { if (event.target.classList.contains('buy-btn')) { const itemId = event.target.dataset.itemId; buyItem(itemId); } });
    openBackpackAppButton.addEventListener('click', () => { showScreen('backpack-screen'); renderBackpackScreen(); });
    backpackBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    inventoryListContainer.addEventListener('click', (event) => { if (event.target.classList.contains('use-btn')) { const itemName = event.target.dataset.itemName; useItem(itemName); } });
    openWorldBookAppButton.addEventListener('click', () => { showScreen('world-book-screen'); renderWorldBookScreen(); });
    worldBookBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    ruleListContainer.addEventListener('click', async (event) => { const target = event.target; const ruleId = target.dataset.ruleId; if (target.classList.contains('edit-btn')) { renderWorldBookScreen(ruleId); } if (target.classList.contains('cancel-btn')) { renderWorldBookScreen(); } if (target.classList.contains('save-btn')) { const inputElement = document.getElementById(`edit-input-${ruleId}`); const newValue = inputElement.value; const ruleToUpdate = worldState.worldBook.find(rule => rule.id === ruleId); if (ruleToUpdate) { ruleToUpdate.value = isNaN(parseFloat(newValue)) ? newValue : parseFloat(newValue); await saveWorldState(); renderWorldBookScreen(); } } });
    openSettingsAppButton.addEventListener('click', () => { showScreen('settings-screen'); renderSettingsScreen(); });
    settingsBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    saveSettingsButton.addEventListener('click', async () => {
        saveSettingsButton.textContent = '保存中...';
        saveSettingsButton.disabled = true;
        try { await saveCurrentPreset(); } 
        finally { saveSettingsButton.textContent = '保存当前预设'; saveSettingsButton.disabled = false; }
    });
    testApiButton.addEventListener('click', testApiConnection);
    apiPresetSelect.addEventListener('change', selectPreset);
    newPresetButton.addEventListener('click', createNewPreset);
    deletePresetButton.addEventListener('click', deleteCurrentPreset);
    fetchModelsButton.addEventListener('click', fetchModels);
    openGeneralSettingsAppButton.addEventListener('click', () => { showScreen('general-settings-screen'); renderGeneralSettingsScreen(); });
    generalSettingsBackButton.addEventListener('click', () => { showScreen('home-screen'); });
    saveGeneralSettingsButton.addEventListener('click', async () => {
        saveGeneralSettingsButton.textContent = '保存中...';
        saveGeneralSettingsButton.disabled = true;
        try {
            const activeChat = worldState.chats['chat_default'];
            if (!activeChat) return;
            activeChat.settings.aiPersona = aiPersonaTextarea.value;
            activeChat.settings.myPersona = myPersonaTextarea.value;
            activeChat.settings.enableChainOfThought = chainOfThoughtSwitch.checked;
            activeChat.settings.showThoughtAsAlert = showThoughtAlertSwitch.checked;
            const selectedBookIds = [];
            const checkboxes = worldBookLinkingContainer.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(cb => selectedBookIds.push(cb.value));
            activeChat.settings.linkedWorldBookIds = selectedBookIds;
            await saveWorldState();
            alert('通用设置已保存！');
        } finally {
            saveGeneralSettingsButton.textContent = '保存通用设置';
            saveGeneralSettingsButton.disabled = false;
        }
    });
    chainOfThoughtSwitch.addEventListener('change', () => {
        showThoughtAlertSwitch.disabled = !chainOfThoughtSwitch.checked;
        if (!chainOfThoughtSwitch.checked) {
            showThoughtAlertSwitch.checked = false;
        }
    });
    exportDataBtn.addEventListener('click', exportData);
    importDataBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importData);

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
