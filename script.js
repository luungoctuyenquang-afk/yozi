document.addEventListener('DOMContentLoaded', () => {
    
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

    let worldState = {};

    async function saveWorldState() { /* ... (函数内容无变化) ... */ }
    async function loadWorldState() { /* ... (函数内容无变化) ... */ }
    async function migrateFromLocalStorage() { /* ... (函数内容无变化) ... */ }
    
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
    
    // ▼▼▼ 核心功能区：集成了您所有修复和改进 ▼▼▼

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
        const userMessageContent = currentUserInputParts.map(part => { if (part.inline_data) { return { type: 'image_url', image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }; } return { type: 'text', text: part.text || '' }; }).filter(p => (p.text && p.text.trim() !== '') || p.image_url);
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

    // (此后的所有函数都进行了恢复和安全检查)
    // ...

    // --- 5. 交互逻辑绑定 ---
    // ▼▼▼ 使用安全绑定，确保所有按钮都能正确工作 ▼▼▼

    const safeBind = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`尝试为一个不存在的元素绑定事件: ${event}`);
        }
    };

    safeBind(lockScreen, 'click', async () => { /* ... */ });
    safeBind(openChatAppButton, 'click', async () => { /* ... */ });
    safeBind(chatInputForm, 'submit', async (event) => { /* ... */ });
    // ... etc. ...
    
    // --- 6. 程序入口 ---
    async function main() {
        await loadWorldState();
        updateClock();
        setInterval(updateClock, 30000);
        showScreen('lock-screen');
        renderHomeScreen();
    }

    main();


    // ===================================================================
    // == 完整的函数和事件绑定实现 (确保没有任何遗漏) ==
    // ===================================================================

    // SAVE, LOAD, MIGRATE
    async function saveWorldState(){try{await db.transaction("rw",db.tables,async()=>{if(!worldState.player||!worldState.ai||!worldState.apiConfig||!worldState.chats)throw new Error("核心数据丢失，无法存档。");if(worldState.chat.history.length>100)worldState.chat.history=worldState.chat.history.slice(-50);await db.general.put({id:"main",lastOnlineTimestamp:Date.now()});await db.player.put({id:"main",...worldState.player});await db.ai.put({id:"main",...worldState.ai});await db.worldBook.bulkPut(worldState.worldBook);await db.events.put({id:"main",...worldState.events});await db.apiConfig.put({id:"main",...worldState.apiConfig});for(const e in worldState.chats)await db.chatSettings.put({id:e,settings:worldState.chats[e].settings});await db.chatHistory.clear();await db.chatHistory.bulkAdd(worldState.chat.history)})}catch(e){console.error("使用IndexedDB存档失败:",e);alert("存档失败！数据可能未能成功保存到本地数据库。")}}
    async function loadWorldState(){await migrateFromLocalStorage();const[e,t,a,i,o,l,n,s]=await Promise.all([db.general.get("main"),db.player.get("main"),db.ai.get("main"),db.chatHistory.toArray(),db.worldBook.toArray(),db.events.get("main"),db.apiConfig.get("main"),db.chatSettings.toArray()]);worldState={};worldState.lastOnlineTimestamp=e?e.lastOnlineTimestamp:Date.now();worldState.player=t||{name:"你",money:1e3,inventory:[]};worldState.ai=a||{name:"零",mood:"开心",money:1500,inventory:[]};worldState.chat={history:i||[]};worldState.worldBook=o&&o.length>0?o:[{id:"rule001",category:"经济",key:"AI每分钟收入",value:1,description:"AI在离线时每分钟获得的金币数量。"}];worldState.events=l||{aiNoticedMovieTicket:!1};worldState.session={minutesAway:0,moneyEarned:0};if(n&&Array.isArray(n.presets)&&n.presets.length>0){worldState.apiConfig=n;worldState.apiConfig.presets=n.presets.map(e=>({id:e.id||`preset_${Date.now()}_${Math.random()}`,name:e.name||"未命名预设",provider:e.provider||"gemini",endpoint:e.endpoint||"",apiKey:e.apiKey||"",model:e.model||"gemini-1.5-flash-latest"}));if(!worldState.apiConfig.activePresetId||!worldState.apiConfig.presets.find(e=>e.id===worldState.apiConfig.activePresetId))worldState.apiConfig.activePresetId=worldState.apiConfig.presets[0].id}else{const e=`preset_${Date.now()}`;worldState.apiConfig={presets:[{id:e,name:"默认 Gemini",provider:"gemini",endpoint:"",apiKey:"",model:"gemini-1.5-flash-latest"}],activePresetId:e}}worldState.chats={};if(s&&s.length>0)s.forEach(e=>{worldState.chats[e.id]={settings:e.settings}});if(!worldState.chats.chat_default)worldState.chats.chat_default={settings:{aiPersona:"你是AI伴侣'零'。你的性格是温柔、体贴、充满好奇心，有时会有点害羞。",myPersona:"我是一个正在和AI聊天的人类。",linkedWorldBookIds:[],enableChainOfThought:!1,showThoughtAsAlert:!1}};const r=Date.now()-worldState.lastOnlineTimestamp,d=Math.floor(r/1e3/60),c=worldState.worldBook.find(e=>"rule001"===e.id),u=c?c.value:0;if(d>0&&u>0){const e=d*u;worldState.ai.money+=e;worldState.session={minutesAway:d,moneyEarned:e}}}
    async function migrateFromLocalStorage(){const e=localStorage.getItem("myVirtualWorldSave");if(!e)return;try{console.log("检测到旧存档，开始数据迁移...");alert("正在进行首次数据升级，请稍候...");const t=JSON.parse(e);await db.transaction("rw",db.tables,async()=>{await db.general.put({id:"main",lastOnlineTimestamp:t.lastOnlineTimestamp||Date.now()});if(t.player)await db.player.put({id:"main",...t.player});if(t.ai)await db.ai.put({id:"main",...t.ai});if(t.chat&&t.chat.history)await db.chatHistory.bulkAdd(t.chat.history);if(t.worldBook)await db.worldBook.bulkPut(t.worldBook);if(t.events)await db.events.put({id:"main",...t.events});if(t.apiConfig)await db.apiConfig.put({id:"main",...t.apiConfig});if(t.chats)for(const e in t.chats)if(t.chats[e].settings)await db.chatSettings.put({id:e,settings:t.chats[e].settings})});localStorage.removeItem("myVirtualWorldSave");console.log("数据迁移成功！旧存档已移除。");alert("数据升级完成！您的所有进度都已保留。")}catch(e){console.error("数据迁移失败:",e);alert("数据迁移过程中发生严重错误！您的旧存档可能已损坏。应用将尝试使用新存档启动。");localStorage.removeItem("myVirtualWorldSave")}}
    
    // UI FUNCTIONS
    function updateClock(){const e=new Date,t=String(e.getHours()).padStart(2,"0"),a=String(e.getMinutes()).padStart(2,"0");timeDisplay.textContent=`${t}:${a}`}
    function showScreen(e){screens.forEach(t=>{t.id===e?t.style.display=["lock-screen","chat-screen","wallet-screen","store-screen","backpack-screen","world-book-screen","settings-screen","general-settings-screen"].includes(t.id)?"flex":"block":t.style.display="none"})}
    function renderHomeScreen(){aiNameDisplay.textContent=worldState.ai.name}
    function renderChatScreen(){worldState.activeChatId="chat_default";const e=worldState.chats[worldState.activeChatId];if(!e||!e.settings){console.error("无法渲染聊天，默认聊天设置丢失");return}const t=e.settings.aiPersona.split("。")[0].replace("你是AI伴侣'","").replace("'","")||worldState.ai.name||"零";chatHeaderTitle.textContent=`与 ${t} 的聊天`;messageContainer.innerHTML="";(worldState.chat.history||[]).forEach(e=>{const t=document.createElement("div");t.className=`message-bubble ${"user"===e.sender?"user-message":"ai-message"}`;const a=Array.isArray(e.content)?e.content:[{text:String(e.content||"")}];a.forEach(e=>{if(e.text&&e.text.trim()){const a=document.createElement("div");a.textContent=e.text;t.appendChild(a)}else if(e.inline_data){const a=document.createElement("img");a.className="chat-image";a.src=`data:${e.inline_data.mime_type};base64,${e.inline_data.data}`;t.appendChild(a)}});if(t.hasChildNodes())messageContainer.appendChild(t)});messageContainer.scrollTop=messageContainer.scrollHeight}
    async function handleImageUpload(e){const t=e.target.files[0];if(!t)return;const a=new FileReader;a.readAsDataURL(t);a.onload=async()=>{const i=a.result.split(",")[1],o={sender:"user",content:[{text:chatInput.value.trim()},{inline_data:{mime_type:t.type,data:i}}],timestamp:Date.now()};worldState.chat.history.push(o);renderChatScreen();chatInput.value="";await saveWorldState();const l=await getAiResponse(o.content),n={sender:"ai",content:[{text:l}],timestamp:Date.now()};worldState.chat.history.push(n);renderChatScreen();await saveWorldState()};e.target.value=null}
    function renderGeneralSettingsScreen(){const e=worldState.chats.chat_default;if(!e)return;aiPersonaTextarea.value=e.settings.aiPersona;myPersonaTextarea.value=e.settings.myPersona;chainOfThoughtSwitch.checked=e.settings.enableChainOfThought;showThoughtAlertSwitch.checked=e.settings.showThoughtAsAlert;showThoughtAlertSwitch.disabled=!chainOfThoughtSwitch.checked;worldBookLinkingContainer.innerHTML="";if(worldState.worldBook&&worldState.worldBook.length>0)worldState.worldBook.forEach(t=>{const a=e.settings.linkedWorldBookIds&&e.settings.linkedWorldBookIds.includes(t.id),i=document.createElement("label"),o=document.createElement("input");o.type="checkbox";o.value=t.id;o.checked=a;i.appendChild(o);i.appendChild(document.createTextNode(` ${t.key} (${t.category})`));worldBookLinkingContainer.appendChild(i)});else worldBookLinkingContainer.innerHTML='<p style="color: #888; font-size: 14px;">还没有创建任何世界书规则。</p>'}
    function renderWalletScreen(){playerMoneyDisplay.textContent=worldState.player.money;aiMoneyDisplay.textContent=worldState.ai.money;aiNameWalletDisplay.textContent=worldState.ai.name}
    function renderStoreScreen(){storePlayerMoneyDisplay.textContent=worldState.player.money;itemListContainer.innerHTML="";storeItems.forEach(e=>{const t=document.createElement("div");t.className="item-card";t.innerHTML=`<h3>${e.name}</h3><p>${e.price} 金币</p><button class="buy-btn" data-item-id="${e.id}">购买</button>`;itemListContainer.appendChild(t)})}
    async function buyItem(e){const t=storeItems.find(t=>t.id===e);if(!t)return;if(worldState.player.money>=t.price){worldState.player.money-=t.price;worldState.player.inventory.push(t.name);await saveWorldState();renderStoreScreen();renderWalletScreen();alert(`购买“${t.name}”成功！`)}else alert("金币不足！")}
    function renderBackpackScreen(){inventoryListContainer.innerHTML="";if(0===worldState.player.inventory.length){inventoryListContainer.innerHTML='<p class="inventory-empty-msg">你的背包是空的...</p>';return}worldState.player.inventory.forEach(e=>{const t=document.createElement("div");t.className="inventory-item";const a=document.createElement("span");a.textContent=e;t.appendChild(a);if(itemEffects[e]){const i=document.createElement("button");i.className="use-btn";i.textContent="使用";i.dataset.itemName=e;t.appendChild(i)}inventoryListContainer.appendChild(t)})}
    async function useItem(e){const t=itemEffects[e];if(!t)return;const a=worldState.player.inventory.findIndex(t=>t===e);if(-1===a)return;const i=t.effect(worldState);worldState.player.inventory.splice(a,1);await saveWorldState();renderBackpackScreen();alert(i)}
    function renderWorldBookScreen(e=null){ruleListContainer.innerHTML="";const t=document.createElement("button");t.className="form-button";t.style.marginBottom="10px";t.textContent="+ 添加新规则";t.onclick=async()=>{const e=prompt("规则分类（如：物品、经济、事件）：","自定义");if(null===e)return;const a=prompt("规则名称：","新规则");if(null===a)return;const i=prompt("规则值或描述：");if(null===i)return;const o={id:`rule_${Date.now()}`,category:e||"自定义",key:a||"新规则",value:i||"",description:""};if(o.key){worldState.worldBook.push(o);await saveWorldState();renderWorldBookScreen()}};ruleListContainer.appendChild(t);const a=document.createElement("div");a.style.cssText="display: flex; gap: 10px; margin-bottom: 20px;";const i=document.createElement("button");i.className="form-button-secondary";i.textContent="导出规则";i.onclick=()=>{const e=JSON.stringify(worldState.worldBook,null,2),t=new Blob([e],{type:"application/json"}),a=URL.createObjectURL(t),i=document.createElement("a");i.href=a;i.download=`虚拟手机-世界书规则-${(new Date).toLocaleDateString().replace(/\//g,"-")}.json`;i.click();URL.revokeObjectURL(i.href)};const o=document.createElement("button");o.className="form-button-secondary";o.textContent="导入规则";o.onclick=()=>{const e=document.createElement("input");e.type="file";e.accept=".json";e.onchange=async t=>{const a=t.target.files[0];if(a){const t=await a.text();try{const a=JSON.parse(t);if(Array.isArray(a)){worldState.worldBook=a;await saveWorldState();renderWorldBookScreen();alert("规则导入成功！")}else alert("导入失败：文件内容不是有效的规则数组。")}catch(e){alert("导入失败：文件格式错误")}}};e.click()};a.appendChild(i);a.appendChild(o);ruleListContainer.appendChild(a);worldState.worldBook.forEach(t=>{const a=document.createElement("div");a.className="rule-card";const i=document.createElement("p");i.className="rule-value";i.textContent=t.value;const o=document.createElement("span");o.className="rule-key";o.textContent=t.key;const l=document.createElement("span");l.className="rule-category";l.textContent=t.category;if(t.id===e){a.innerHTML='<div class="rule-card-header"></div> <div class="rule-body"> <input type="text" class="rule-edit-input" style="width:100%" id="edit-input-'+t.id+'" value=""> <div class="rule-actions"> <button class="save-btn" data-rule-id="'+t.id+'">保存</button> <button class="cancel-btn" data-rule-id="'+t.id+'">取消</button> </div> </div>';a.querySelector(".rule-card-header").appendChild(o);a.querySelector(".rule-card-header").appendChild(l);a.querySelector("#edit-input-"+t.id).value=t.value}else{a.innerHTML='<div class="rule-card-header"></div> <div class="rule-body"></div>';a.querySelector(".rule-card-header").appendChild(o);a.querySelector(".rule-card-header").appendChild(l);a.querySelector(".rule-body").appendChild(i);const e=document.createElement("div");e.className="rule-actions";e.innerHTML='<button class="edit-btn" data-rule-id="'+t.id+'">编辑</button>';a.querySelector(".rule-body").appendChild(e)}ruleListContainer.appendChild(a)})}
    function renderSettingsScreen(){apiPresetSelect.innerHTML="";worldState.apiConfig.presets.forEach(e=>{const t=document.createElement("option");t.value=e.id;t.textContent=e.name;apiPresetSelect.appendChild(t)});apiPresetSelect.value=worldState.apiConfig.activePresetId;const e=worldState.apiConfig.presets.find(e=>e.id===worldState.apiConfig.activePresetId);if(e){presetNameInput.value=e.name;apiProviderSelect.value=e.provider;apiEndpointInput.value=e.endpoint;apiKeyInput.value=e.apiKey;apiModelInput.value=e.model;apiModelsList.innerHTML=`<option value="${e.model}"></option>`}}
    function selectPreset(){worldState.apiConfig.activePresetId=apiPresetSelect.value;renderSettingsScreen()}
    async function saveCurrentPreset(){const e=worldState.apiConfig.presets.find(e=>e.id===worldState.apiConfig.activePresetId);if(e){e.name=presetNameInput.value.trim()||"未命名预设";e.provider=apiProviderSelect.value;e.endpoint=apiEndpointInput.value.trim();e.apiKey=apiKeyInput.value.trim();e.model=apiModelInput.value.trim();worldState.apiConfig.presets=worldState.apiConfig.presets.map(t=>t.id===e.id?e:t);await saveWorldState();renderSettingsScreen();alert("当前预设已保存！")}}
    async function createNewPreset(){const e=`preset_${Date.now()}`,t={id:e,name:"新预设",provider:"gemini",endpoint:"",apiKey:"",model:"gemini-1.5-flash-latest"};worldState.apiConfig.presets.push(t);worldState.apiConfig.activePresetId=e;await saveWorldState();renderSettingsScreen()}
    async function deleteCurrentPreset(){if(worldState.apiConfig.presets.length<=1){alert("这是最后一个预设，不能删除哦！");return}if(confirm("确定要删除当前预设吗？")){const e=worldState.apiConfig.activePresetId;worldState.apiConfig.presets=worldState.apiConfig.presets.filter(t=>t.id!==e);worldState.apiConfig.activePresetId=worldState.apiConfig.presets[0].id;await saveWorldState();renderSettingsScreen()}}
    async function fetchModels(){const e=document.getElementById("api-status-indicator");e.textContent="拉取中...";e.className="";const t=apiProviderSelect.value;let a=apiEndpointInput.value.trim();const i=apiKeyInput.value.trim();if(!i){e.textContent="失败: 请先填写API密钥。";e.className="error";return}let o,l={"Content-Type":"application/json"};if("gemini"===t)o=`https://generativelanguage.googleapis.com/v1beta/models?key=${i}`;else{if(a.endsWith("/chat/completions"))a=a.replace("/chat/completions","");if(!a.endsWith("/v1"))a=a.replace(/\/$/,"")+"/v1";o=`${a}/models`;l.Authorization=`Bearer ${i}`}try{const t=await fetch(o,{headers:l});if(!t.ok)throw new Error(`服务器错误: ${t.status}`);const a=await t.json();apiModelsList.innerHTML="";const i="gemini"===provider?a.models:a.data;i.forEach(e=>{const t="gemini"===provider?e.name.replace("models/",""):e.id;if("gemini"===provider&&!e.supportedGenerationMethods.includes("generateContent"))return;const a=document.createElement("option");a.value=t;apiModelsList.appendChild(a)});e.textContent="✅ 成功拉取模型！";e.className="success"}catch(t){e.textContent=`❌ 拉取失败: ${t.message}`;e.className="error"}}
    async function testApiConnection(){const e=document.getElementById("api-status-indicator");e.textContent="测试中...";e.className="";const t={provider:apiProviderSelect.value,endpoint:apiEndpointInput.value.trim(),apiKey:apiKeyInput.value.trim(),model:apiModelInput.value};if(!t.apiKey){e.textContent="失败: 密钥不能为空。";e.className="error";return}let a,i,o;const l="你好，这是一个连接测试。";if("gemini"===t.provider){a=`https://generativelanguage.googleapis.com/v1beta/models/${t.model}:generateContent?key=${t.apiKey}`;o={"Content-Type":"application/json"};i={contents:[{parts:[{text:l}]}]}}else{a=t.endpoint;if(!a.endsWith("/chat/completions"))a=a.replace(/\/$/,"")+"/chat/completions";o={"Content-Type":"application/json",Authorization:`Bearer ${t.apiKey}`};i={model:t.model,messages:[{role:"user",content:l}]}}try{const t=new AbortController,n=setTimeout(()=>t.abort(),15e3),s=await fetch(a,{method:"POST",headers:o,body:JSON.stringify(i),signal:t.signal});clearTimeout(n);if(!s.ok){const t=await s.json();throw new Error(t.error?.message||`HTTP ${s.status}`)}e.textContent="✅ 连接成功！";e.className="success"}catch(t){e.textContent=`❌ 连接失败: ${t.message}`;e.className="error"}}
    function exportData(){const e={};for(const t in worldState)"function"!=typeof worldState[t]&&(e[t]=worldState[t]);const t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),a=URL.createObjectURL(t),i=document.createElement("a");i.href=a;i.download=`虚拟手机备份_${(new Date).toLocaleDateString().replace(/\//g,"-")}.json`;document.body.appendChild(i);i.click();document.body.removeChild(i);URL.revokeObjectURL(a)}
    async function importData(e){const t=e.target.files[0];if(!t)return;if(!confirm("警告：导入备份将覆盖所有当前数据，此操作不可撤销！确定要继续吗？"))return;try{const a=await t.text(),i=JSON.parse(a);await Promise.all(db.tables.map(e=>e.clear()));if(i.player)await db.player.put({id:"main",...i.player});if(i.ai)await db.ai.put({id:"main",...i.ai});if(i.chat&&i.chat.history)await db.chatHistory.bulkAdd(i.chat.history);if(i.worldBook)await db.worldBook.bulkPut(i.worldBook);if(i.events)await db.events.put({id:"main",...i.events});if(i.apiConfig)await db.apiConfig.put({id:"main",...i.apiConfig});if(i.chats)for(const e in i.chats)if(i.chats[e].settings)await db.chatSettings.put({id:e,settings:i.chats[e].settings});alert("数据导入成功！页面即将刷新以应用更改。");setTimeout(()=>location.reload(),1e3)}catch(a){alert("导入失败：文件格式错误或已损坏。");console.error("导入错误:",a)}finally{e.target.value=""}}

    // EVENT LISTENERS
    safeBind(lockScreen, 'click', async () => { showScreen('home-screen'); renderHomeScreen(); await saveWorldState(); const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream; const isStandalone = window.navigator.standalone === true; const lastInstallPrompt = localStorage.getItem('lastInstallPrompt'); const now = Date.now(); if (isIOS && !isStandalone && (!lastInstallPrompt || now - parseInt(lastInstallPrompt) > 86400000 * 3)) { setTimeout(() => { alert('💡 重要提示：将本应用添加到主屏幕可以永久保存您的数据！\n\n请点击Safari底部的“分享”按钮，然后选择“添加到主屏幕”。\n\n否则您的所有聊天记录和设置可能会在7天后被iOS系统自动清除。'); localStorage.setItem('lastInstallPrompt', now.toString()); }, 2000); } });
    safeBind(openChatAppButton, 'click', async () => { showScreen('chat-screen'); renderChatScreen(); if (worldState.session.minutesAway > 0) { const aiGreeting = await getAiResponse([{text: ''}]); if (aiGreeting) { worldState.chat.history.push({ sender: 'ai', content: [{text: aiGreeting}], timestamp: Date.now() }); renderChatScreen(); worldState.session.minutesAway = 0; worldState.session.moneyEarned = 0; await saveWorldState(); } } });
    safeBind(chatInputForm, 'submit', async (event) => { event.preventDefault(); const userInput = chatInput.value.trim(); if (userInput === '') return; const userMessage = { sender: 'user', content: [{ text: userInput }], timestamp: Date.now() }; worldState.chat.history.push(userMessage); renderChatScreen(); chatInput.value = ''; await saveWorldState(); const aiReplyText = await getAiResponse(userMessage.content); if (worldState.session.minutesAway > 0) { worldState.session.minutesAway = 0; worldState.session.moneyEarned = 0; } const aiMessage = { sender: 'ai', content: [{ text: aiReplyText }], timestamp: Date.now() }; worldState.chat.history.push(aiMessage); renderChatScreen(); await saveWorldState(); });
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

});
