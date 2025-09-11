// MQTT聊天室模块
/**
 * 创建 MQTT 聊天室应用
 * @param {Object} config 配置对象
 * @param {HTMLElement} config.mountEl 挂载的容器元素
 * @param {Function} config.getPlayerName 获取玩家昵称的函数
 * @param {string} config.brokerUrl MQTT Broker地址，默认 wss://test.mosquitto.org:8081/mqtt
 * @returns {Object} 返回控制接口 { connect, leave, sendText }
 */
function createMqttRoomApp({ mountEl, getPlayerName, brokerUrl = 'wss://test.mosquitto.org:8081/mqtt' }) {
    
    // 内部状态
    let client = null;
    let isConnected = false;
    let roomId = '';
    let nickname = '';
    let messageTopic = '';
    let presenceTopic = '';
    let currentBrokerIndex = 0;
    let currentTheme = 'auto'; // auto, light, dark
    let emojiPickerVisible = false; // 表情选择器状态
    let privateChats = new Map(); // 私聊会话 Map<userId, messages[]>
    let currentChatType = 'room'; // 'room' | 'private'
    let currentPrivateUser = null; // 当前私聊对象
    let heartbeatInterval = null; // 心跳定时器
    let isRoomAdmin = false; // 是否为房间管理员
    let roomConfig = null; // 当前房间配置
    
    // 在线用户管理
    let onlineUsers = new Set(); // 在线用户集合
    let userJoinTimes = new Map(); // 用户加入时间记录
    
    // 全局房间列表管理
    let globalRoomList = new Map(); // 全局房间列表 Map<roomId, roomInfo>
    let globalRoomsTopic = 'game/global/rooms'; // 全局房间列表主题
    let roomListClient = null; // 用于订阅全局房间列表的客户端
    
    // 房间历史记录管理
    let roomHistory = []; // 房间历史记录数组
    const MAX_HISTORY_SIZE = 10; // 最大历史记录数量
    
    // 聊天记录管理
    let chatHistory = new Map(); // 聊天记录 Map<roomId, messages[]>
    const MAX_CHAT_MESSAGES = 100; // 每个房间最大聊天记录数量
    
    // 备选MQTT Broker列表
    const brokerUrls = [
        'wss://test.mosquitto.org:8081/mqtt',
        'wss://broker.hivemq.com:8884/mqtt'
    ];
    
    // 表情包数据
    const emojiData = {
        smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶'],
        gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💪', '🖕', '✍️', '🙏', '👏', '🙌', '🤝', '👐', '🤲', '🤜', '🤛'],
        people: ['👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '🧔', '👱‍♂️', '👱‍♀️', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦲', '👩‍🦲', '👨‍🦳', '👩‍🦳'],
        animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝'],
        food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🍝'],
        activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂'],
        objects: ['💡', '🔦', '🕯', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '⛓', '🔫', '💣', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '💈', '⚗️', '🔭', '🔬', '🕳', '💊', '💉', '🌡', '🚽', '🚰', '🚿', '🛁'],
        symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳']
    };
    
    // 表情快捷码映射
    const emojiShortcuts = {
        ':)': '😊',
        ':-)': '😊',
        ':(': '😢',
        ':-(': '😢',
        ':D': '😃',
        ':-D': '😃',
        ':P': '😛',
        ':-P': '😛',
        ':p': '😛',
        ':-p': '😛',
        ';)': '😉',
        ';-)': '😉',
        ':o': '😮',
        ':-o': '😮',
        ':|': '😐',
        ':-|': '😐',
        ':*': '😘',
        ':-*': '😘',
        '<3': '❤️',
        '</3': '💔',
        ':heart:': '❤️',
        ':love:': '😍',
        ':laugh:': '😂',
        ':cry:': '😭',
        ':sad:': '😢',
        ':happy:': '😊',
        ':angry:': '😠',
        ':mad:': '😡',
        ':cool:': '😎',
        ':thumbup:': '👍',
        ':thumbdown:': '👎',
        ':ok:': '👌',
        ':fire:': '🔥',
        ':star:': '⭐',
        ':sun:': '☀️',
        ':moon:': '🌙',
        ':rainbow:': '🌈'
    };
    
    // 默认房间配置
    const defaultRoomConfig = {
        maxUsers: 20,              // 最大用户数
        password: '',              // 房间密码
        isPrivate: false,          // 是否私密房间
        category: 'chat',          // 房间分类: chat, game, ai, private
        adminUsers: [],            // 管理员用户列表
        features: {
            voiceChat: false,      // 语音聊天
            fileShare: false,      // 文件分享
            encryption: false,     // 消息加密
            aiBot: true,          // AI机器人
            games: false          // 游戏功能
        },
        restrictions: {
            mutedUsers: [],       // 禁言用户列表
            bannedUsers: [],      // 封禁用户列表
            messageRateLimit: 10, // 消息发送频率限制(每分钟)
            maxMessageLength: 500 // 最大消息长度
        },
        createdAt: Date.now(),
        createdBy: null
    };
    
    // UI 元素引用
    let elements = {};
    
    // HTML转义函数，防止XSS攻击
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 显示用户友好的提示信息
    function showAlert(message) {
        // 使用浏览器原生alert，也可以改为自定义弹窗
        alert(message);
    }
    
    // 加载房间历史记录
    function loadRoomHistory() {
        try {
            const saved = localStorage.getItem('mqtt_room_history');
            if (saved) {
                roomHistory = JSON.parse(saved);
                // 确保历史记录不超过最大数量
                if (roomHistory.length > MAX_HISTORY_SIZE) {
                    roomHistory = roomHistory.slice(0, MAX_HISTORY_SIZE);
                }
            }
        } catch (error) {
            console.warn('加载房间历史记录失败:', error);
            roomHistory = [];
        }
    }
    
    // 保存房间历史记录
    function saveRoomHistory() {
        try {
            localStorage.setItem('mqtt_room_history', JSON.stringify(roomHistory));
        } catch (error) {
            console.warn('保存房间历史记录失败:', error);
        }
    }
    
    // 加载聊天记录
    function loadChatHistory() {
        try {
            const saved = localStorage.getItem('mqtt_chat_history');
            if (saved) {
                const data = JSON.parse(saved);
                chatHistory = new Map(data);
            }
        } catch (error) {
            console.warn('加载聊天记录失败:', error);
            chatHistory = new Map();
        }
    }
    
    // 保存聊天记录
    function saveChatHistory() {
        try {
            const data = Array.from(chatHistory.entries());
            localStorage.setItem('mqtt_chat_history', JSON.stringify(data));
        } catch (error) {
            console.warn('保存聊天记录失败:', error);
        }
    }
    
    // 添加聊天消息到历史记录
    function addToChatHistory(roomId, message) {
        if (!roomId || !message) return;
        
        if (!chatHistory.has(roomId)) {
            chatHistory.set(roomId, []);
        }
        
        const messages = chatHistory.get(roomId);
        messages.push(message);
        
        // 限制消息数量
        if (messages.length > MAX_CHAT_MESSAGES) {
            messages.splice(0, messages.length - MAX_CHAT_MESSAGES);
        }
        
        saveChatHistory();
    }
    
    // 获取房间的聊天记录
    function getChatHistory(roomId) {
        return chatHistory.get(roomId) || [];
    }
    
    // 清空房间的聊天记录
    function clearChatHistory(roomId) {
        if (roomId) {
            chatHistory.delete(roomId);
        } else {
            chatHistory.clear();
        }
        saveChatHistory();
    }
    
    // 导出房间历史记录
    function exportRoomHistory() {
        try {
            const exportData = {
                roomHistory: roomHistory,
                chatHistory: Array.from(chatHistory.entries()),
                exportTime: new Date().toISOString(),
                version: '1.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mqtt-room-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log('system', '✅ 历史记录导出成功');
        } catch (error) {
            console.error('导出失败:', error);
            log('system', '❌ 导出失败: ' + error.message);
        }
    }
    
    // 导入房间历史记录
    function importRoomHistory(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (importData.version !== '1.0') {
                    throw new Error('不支持的文件格式版本');
                }
                
                // 合并房间历史记录
                if (importData.roomHistory && Array.isArray(importData.roomHistory)) {
                    const existingRoomIds = new Set(roomHistory.map(item => item.roomId));
                    const newRooms = importData.roomHistory.filter(item => !existingRoomIds.has(item.roomId));
                    roomHistory = [...newRooms, ...roomHistory];
                    
                    // 限制数量
                    if (roomHistory.length > MAX_HISTORY_SIZE) {
                        roomHistory = roomHistory.slice(0, MAX_HISTORY_SIZE);
                    }
                    
                    saveRoomHistory();
                }
                
                // 合并聊天记录
                if (importData.chatHistory && Array.isArray(importData.chatHistory)) {
                    importData.chatHistory.forEach(([roomId, messages]) => {
                        if (!chatHistory.has(roomId)) {
                            chatHistory.set(roomId, []);
                        }
                        
                        const existingMessages = chatHistory.get(roomId);
                        const existingTimestamps = new Set(existingMessages.map(msg => msg.timestamp));
                        const newMessages = messages.filter(msg => !existingTimestamps.has(msg.timestamp));
                        
                        existingMessages.push(...newMessages);
                        
                        // 限制消息数量
                        if (existingMessages.length > MAX_CHAT_MESSAGES) {
                            existingMessages.splice(0, existingMessages.length - MAX_CHAT_MESSAGES);
                        }
                    });
                    
                    saveChatHistory();
                }
                
                updateRoomHistoryDisplay();
                log('system', `✅ 成功导入 ${importData.roomHistory?.length || 0} 个房间的历史记录`);
                
            } catch (error) {
                console.error('导入失败:', error);
                log('system', '❌ 导入失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    
    // 加载历史聊天记录到UI
    function loadChatHistoryToUI(roomId) {
        const messages = getChatHistory(roomId);
        if (messages.length === 0) return;
        
        // 清空当前消息显示
        clearMessages();
        
        // 显示历史记录提示
        log('system', `📚 加载了 ${messages.length} 条历史消息`);
        
        // 加载历史消息
        messages.forEach(msg => {
            addChatMessage(msg.user, msg.text, msg.timestamp, msg.isOwnMessage);
        });
    }
    
    // 添加房间到历史记录
    function addToRoomHistory(roomId, nickname, category = 'recent') {
        if (!roomId || !nickname) return;
        
        const historyItem = {
            roomId: roomId,
            nickname: nickname,
            timestamp: Date.now(),
            lastUsed: Date.now(),
            category: category,
            tags: []
        };
        
        // 移除已存在的相同房间记录
        roomHistory = roomHistory.filter(item => item.roomId !== roomId);
        
        // 添加到开头
        roomHistory.unshift(historyItem);
        
        // 限制历史记录数量
        if (roomHistory.length > MAX_HISTORY_SIZE) {
            roomHistory = roomHistory.slice(0, MAX_HISTORY_SIZE);
        }
        
        saveRoomHistory();
        updateRoomHistoryDisplay();
    }
    
    // 更新房间历史记录显示
    function updateRoomHistoryDisplay(searchTerm = '') {
        const historyContainer = elements.roomHistoryContainer;
        if (!historyContainer) return;
        
        if (roomHistory.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }
        
        historyContainer.style.display = 'block';
        const historyList = elements.roomHistoryList;
        historyList.innerHTML = '';
        
        // 过滤历史记录
        const filteredHistory = roomHistory.filter(item => {
            if (!searchTerm) return true;
            return item.roomId.toLowerCase().includes(searchTerm) || 
                   item.nickname.toLowerCase().includes(searchTerm);
        });
        
        if (filteredHistory.length === 0 && searchTerm) {
            historyList.innerHTML = '<div class="no-results">没有找到匹配的房间</div>';
            return;
        }
        
        filteredHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const timeAgo = getTimeAgo(item.lastUsed);
            historyItem.innerHTML = `
                <span class="history-room">${escapeHtml(item.roomId)}</span>
                <span class="history-nickname">@ ${escapeHtml(item.nickname)}</span>
                <span class="history-time">${timeAgo}</span>
                <button class="history-remove" title="删除记录">×</button>
            `;
            
            // 点击历史记录项快速填充
            historyItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-remove')) {
                    elements.roomInput.value = item.roomId;
                    elements.nicknameInput.value = item.nickname;
                    // 更新最后使用时间
                    item.lastUsed = Date.now();
                    saveRoomHistory();
                    updateRoomHistoryDisplay(searchTerm);
                }
            });
            
            // 删除历史记录
            const removeBtn = historyItem.querySelector('.history-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const originalIndex = roomHistory.findIndex(originalItem => originalItem.roomId === item.roomId);
                if (originalIndex !== -1) {
                    roomHistory.splice(originalIndex, 1);
                    saveRoomHistory();
                    updateRoomHistoryDisplay(searchTerm);
                }
            });
            
            historyList.appendChild(historyItem);
        });
    }
    
    // 获取相对时间显示
    function getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        return `${days}天前`;
    }
    
    // 主题管理功能
    function loadTheme() {
        try {
            const savedTheme = localStorage.getItem('mqtt_room_theme') || 'auto';
            currentTheme = savedTheme;
            applyTheme(savedTheme);
        } catch (error) {
            console.warn('加载主题设置失败:', error);
            currentTheme = 'auto';
            applyTheme('auto');
        }
    }
    
    function saveTheme(theme) {
        try {
            localStorage.setItem('mqtt_room_theme', theme);
        } catch (error) {
            console.warn('保存主题设置失败:', error);
        }
    }
    
    function applyTheme(theme) {
        const mqttScreen = mountEl.querySelector('.mqtt-room-screen');
        const themeBtn = elements.themeToggleBtn;
        
        if (!mqttScreen) return;
        
        // 移除所有主题类
        mqttScreen.classList.remove('light-theme', 'dark-theme');
        
        switch (theme) {
            case 'light':
                mqttScreen.classList.add('light-theme');
                if (themeBtn) themeBtn.textContent = '☀️';
                break;
            case 'dark':
                mqttScreen.classList.add('dark-theme');
                if (themeBtn) themeBtn.textContent = '🌙';
                break;
            case 'auto':
            default:
                // 使用系统偏好
                if (themeBtn) themeBtn.textContent = '🌓';
                break;
        }
    }
    
    function toggleTheme() {
        const themes = ['auto', 'light', 'dark'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        
        currentTheme = nextTheme;
        applyTheme(nextTheme);
        saveTheme(nextTheme);
        
        // 显示主题切换提示
        log('system', `已切换到${nextTheme === 'auto' ? '自动' : nextTheme === 'light' ? '浅色' : '深色'}主题`);
    }
    
    // 表情选择器功能
    function initEmojiPicker() {
        const emojiPicker = elements.emojiPicker;
        const emojiContent = elements.emojiPickerContent;
        
        if (!emojiPicker || !emojiContent) return;
        
        // 加载默认分类的表情
        loadEmojiCategory('smileys');
        
        // 分类切换事件
        const categories = emojiPicker.querySelectorAll('.emoji-category');
        categories.forEach(cat => {
            cat.addEventListener('click', () => {
                categories.forEach(c => c.classList.remove('active'));
                cat.classList.add('active');
                loadEmojiCategory(cat.dataset.category);
            });
        });
    }
    
    function loadEmojiCategory(category) {
        const emojiContent = elements.emojiPickerContent;
        if (!emojiContent) return;
        
        const emojis = emojiData[category] || [];
        emojiContent.innerHTML = '';
        
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.textContent = emoji;
            span.addEventListener('click', () => insertEmoji(emoji));
            emojiContent.appendChild(span);
        });
    }
    
    function insertEmoji(emoji) {
        const input = elements.messageInput;
        if (!input) return;
        
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
        
        // 隐藏表情选择器
        toggleEmojiPicker(false);
    }
    
    function toggleEmojiPicker(show) {
        const emojiPicker = elements.emojiPicker;
        if (!emojiPicker) return;
        
        if (show === undefined) {
            emojiPickerVisible = !emojiPickerVisible;
        } else {
            emojiPickerVisible = show;
        }
        
        emojiPicker.style.display = emojiPickerVisible ? 'block' : 'none';
    }
    
    // 处理表情快捷码自动替换
    function handleEmojiShortcuts(inputText) {
        let text = inputText;
        
        // 替换所有快捷码
        Object.keys(emojiShortcuts).forEach(shortcut => {
            const emoji = emojiShortcuts[shortcut];
            // 使用正则表达式进行全局替换，需要转义特殊字符
            const escapedShortcut = shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedShortcut, 'g');
            text = text.replace(regex, emoji);
        });
        
        return text;
    }
    
    // 实时检测并替换表情快捷码
    function checkAndReplaceShortcuts() {
        const input = elements.messageInput;
        if (!input) return;
        
        const cursorPos = input.selectionStart;
        const originalText = input.value;
        const replacedText = handleEmojiShortcuts(originalText);
        
        if (originalText !== replacedText) {
            // 计算光标位置的偏移
            const beforeCursor = originalText.substring(0, cursorPos);
            const replacedBeforeCursor = handleEmojiShortcuts(beforeCursor);
            const offset = replacedBeforeCursor.length - beforeCursor.length;
            
            // 更新输入框内容
            input.value = replacedText;
            
            // 恢复光标位置
            const newCursorPos = cursorPos + offset;
            input.selectionStart = input.selectionEnd = newCursorPos;
        }
    }
    
    // 私聊功能
    function startPrivateChat(targetUser) {
        if (!isConnected || !targetUser) return;
        
        currentChatType = 'private';
        currentPrivateUser = targetUser;
        
        // 切换到私聊界面
        switchToPrivateChat(targetUser);
        
        // 订阅私聊主题
        subscribeToPrivateChat(targetUser);
        
        // 显示提示
        log('system', `开始与 ${targetUser} 的私聊`);
    }
    
    function switchToPrivateChat(targetUser) {
        // 更新界面标题
        const header = mountEl.querySelector('.mqtt-header h2');
        if (header) {
            header.innerHTML = `私聊 - ${escapeHtml(targetUser)} <button class="back-to-room-btn" id="back-to-room-btn">返回群聊</button>`;
            
            // 绑定返回按钮事件
            const backBtn = header.querySelector('#back-to-room-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => backToRoomChat());
            }
        }
        
        // 清空消息区域
        elements.messages.innerHTML = '';
        
        // 加载私聊历史
        loadPrivateChatHistory(targetUser);
        
        // 更新输入框提示
        elements.messageInput.placeholder = `发送私聊消息给 ${targetUser}...`;
    }
    
    function subscribeToPrivateChat(targetUser) {
        if (!client) return;
        
        // 订阅对方发给我的私聊消息
        const incomingTopic = `game/${roomId}/private/${nickname}/${targetUser}`;
        client.subscribe(incomingTopic, (err) => {
            if (err) {
                console.error('订阅私聊失败:', err);
            }
        });
    }
    
    function loadPrivateChatHistory(targetUser) {
        const history = privateChats.get(targetUser) || [];
        history.forEach(msg => {
            const isOwnMessage = msg.sender === nickname;
            displayMessage(msg.type, msg.text, msg.sender, msg.timestamp, isOwnMessage);
        });
    }
    
    function sendPrivateMessage(targetUser, message) {
        if (!client || !isConnected || !targetUser) return;
        
        // 私聊主题格式：game/<roomId>/private/<receiver>/<sender>
        const privateTopic = `game/${roomId}/private/${targetUser}/${nickname}`;
        
        const messageData = {
            type: 'private',
            sender: nickname,
            receiver: targetUser,
            text: message,
            timestamp: Date.now()
        };
        
        client.publish(privateTopic, JSON.stringify(messageData), (err) => {
            if (err) {
                console.error('发送私聊消息失败:', err);
                log('error', '私聊消息发送失败');
            } else {
                // 显示自己发送的私聊消息
                addChatMessage(nickname, message, messageData.timestamp, true);
                
                // 保存到私聊历史
                savePrivateMessage(targetUser, messageData);
            }
        });
    }
    
    function savePrivateMessage(targetUser, messageData) {
        if (!privateChats.has(targetUser)) {
            privateChats.set(targetUser, []);
        }
        
        const history = privateChats.get(targetUser);
        history.push(messageData);
        
        // 限制历史记录数量
        if (history.length > 100) {
            history.shift();
        }
    }
    
    function backToRoomChat() {
        currentChatType = 'room';
        currentPrivateUser = null;
        
        // 恢复群聊界面
        const header = mountEl.querySelector('.mqtt-header h2');
        if (header) {
            header.textContent = 'MQTT聊天室';
        }
        
        // 清空消息区域
        elements.messages.innerHTML = '';
        
        // 重新加载群聊消息
        const roomChatHistory = chatHistory.get(roomId) || [];
        roomChatHistory.forEach(msg => {
            addChatMessage(msg.user, msg.text, msg.timestamp, msg.isOwnMessage);
        });
        
        // 恢复输入框提示
        elements.messageInput.placeholder = '输入消息...';
        
        log('system', '已返回群聊');
    }
    
    // 房间管理功能
    function initRoomSettings() {
        roomConfig = { ...defaultRoomConfig };
        
        // 绑定设置面板切换
        const settingsToggleBtn = mountEl.querySelector('#settings-toggle-btn');
        const settingsPanel = mountEl.querySelector('#settings-panel');
        
        if (settingsToggleBtn && settingsPanel) {
            settingsToggleBtn.addEventListener('click', () => {
                const isVisible = settingsPanel.style.display !== 'none';
                settingsPanel.style.display = isVisible ? 'none' : 'block';
                settingsToggleBtn.textContent = isVisible ? '⚙️ 房间设置' : '❌ 关闭设置';
            });
        }
        
        // 绑定密码保护复选框
        const privateRoomCheckbox = mountEl.querySelector('#private-room-checkbox');
        const passwordInput = mountEl.querySelector('.room-password-input');
        const savePasswordBtn = mountEl.querySelector('#save-password-btn');
        
        if (privateRoomCheckbox && passwordInput) {
            const passwordInputGroup = mountEl.querySelector('.password-input-group');
            
            privateRoomCheckbox.addEventListener('change', () => {
                const isPrivate = privateRoomCheckbox.checked;
                if (passwordInputGroup) {
                    passwordInputGroup.style.display = isPrivate ? 'flex' : 'none';
                } else {
                    passwordInput.style.display = isPrivate ? 'block' : 'none';
                }
                roomConfig.isPrivate = isPrivate;
                
                if (!isPrivate) {
                    passwordInput.value = '';
                    roomConfig.password = '';
                    roomConfig.hasPassword = false;
                } else {
                    roomConfig.hasPassword = true;
                }
            });
            
            // 绑定保存密码按钮
            if (savePasswordBtn) {
                savePasswordBtn.addEventListener('click', () => {
                    const password = passwordInput.value.trim();
                    if (password.length < 3) {
                        showAlert('密码长度至少3个字符！');
                        return;
                    }
                    if (password.length > 50) {
                        showAlert('密码长度不能超过50个字符！');
                        return;
                    }
                    
                    roomConfig.password = password;
                    roomConfig.hasPassword = true;
                    saveRoomConfig();
                    
                    showAlert('密码已保存！');
                    log('system', '✅ 房间密码已设置');
                });
            }
        }
        
        
        // 绑定最大用户数选择
        const maxUsersSelect = mountEl.querySelector('#max-users-select');
        if (maxUsersSelect) {
            maxUsersSelect.addEventListener('change', () => {
                roomConfig.maxUsers = parseInt(maxUsersSelect.value);
            });
        }
        
        // 绑定房间类型选择
        const categorySelect = mountEl.querySelector('#room-category-select');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                roomConfig.category = categorySelect.value;
            });
        }
    }
    
    function validateRoomAccess(targetRoomId, password = '') {
        // 检查房间是否需要密码
        if (roomConfig && roomConfig.isPrivate && roomConfig.password) {
            if (password !== roomConfig.password) {
                showAlert('房间密码错误！');
                return false;
            }
        }
        
        // 检查房间人数限制
        if (roomConfig && onlineUsers.size >= roomConfig.maxUsers) {
            showAlert(`房间已满！最大容量：${roomConfig.maxUsers}人`);
            return false;
        }
        
        return true;
    }
    
    function saveRoomConfig() {
        if (!roomConfig) return;
        
        const passwordInput = mountEl.querySelector('.room-password-input');
        if (passwordInput && roomConfig.isPrivate) {
            roomConfig.password = passwordInput.value.trim();
        }
        
        // 保存到本地存储
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            roomConfigs[roomId] = roomConfig;
            localStorage.setItem('mqtt_room_configs', JSON.stringify(roomConfigs));
        } catch (error) {
            console.warn('保存房间配置失败:', error);
        }
        
        // 广播房间配置更新
        if (client && isConnected) {
            const configTopic = `game/${roomId}/config`;
            client.publish(configTopic, JSON.stringify({
                type: 'room_config',
                config: roomConfig,
                updatedBy: nickname,
                timestamp: Date.now()
            }));
        }
    }
    
    function loadRoomConfig(targetRoomId) {
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            if (roomConfigs[targetRoomId]) {
                roomConfig = { ...defaultRoomConfig, ...roomConfigs[targetRoomId] };
                return roomConfig;
            }
        } catch (error) {
            console.warn('加载房间配置失败:', error);
        }
        
        // 如果房间不存在本地配置，返回null
        return null;
    }
    
    // 为外部房间保存基础配置
    function saveBasicRoomConfig(targetRoomId, joinerNickname) {
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            
            // 如果本地还没有这个房间的配置，创建一个基础配置
            if (!roomConfigs[targetRoomId]) {
                roomConfigs[targetRoomId] = {
                    ...defaultRoomConfig,
                    roomId: targetRoomId,
                    createdBy: 'unknown', // 标记为未知创建者
                    joinedBy: joinerNickname, // 记录谁加入了这个房间
                    joinedAt: Date.now(),
                    isLocallyCreated: false, // 标记为外部房间
                    isExternalRoom: true // 额外标记
                };
                
                localStorage.setItem('mqtt_room_configs', JSON.stringify(roomConfigs));
                log('system', `已保存外部房间 ${targetRoomId} 的基础配置`);
            }
        } catch (error) {
            console.warn('保存外部房间配置失败:', error);
        }
    }
    
    // 初始化全局房间列表监听
    function initGlobalRoomList() {
        if (roomListClient) return; // 已经初始化
        
        try {
            const currentBrokerUrl = brokerUrls[currentBrokerIndex];
            roomListClient = mqtt.connect(currentBrokerUrl, {
                clientId: `roomlist_${Math.random().toString(16).substr(2, 8)}`,
                clean: true,
                connectTimeout: 5000
            });
            
            roomListClient.on('connect', () => {
                console.log('全局房间列表客户端已连接');
                roomListClient.subscribe(globalRoomsTopic, (err) => {
                    if (!err) {
                        console.log('已订阅全局房间列表主题');
                        // 请求当前房间列表
                        requestRoomList();
                    }
                });
            });
            
            roomListClient.on('message', (topic, message) => {
                if (topic === globalRoomsTopic) {
                    handleGlobalRoomMessage(message.toString());
                }
            });
            
            roomListClient.on('error', (error) => {
                console.warn('全局房间列表客户端错误:', error);
            });
        } catch (error) {
            console.error('初始化全局房间列表失败:', error);
        }
    }
    
    // 处理全局房间消息
    function handleGlobalRoomMessage(message) {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'room_created':
                    globalRoomList.set(data.roomId, {
                        roomId: data.roomId,
                        createdBy: data.createdBy,
                        createdAt: data.createdAt,
                        userCount: data.userCount || 1,
                        maxUsers: data.maxUsers || 20,
                        category: data.category || 'chat',
                        isPrivate: data.isPrivate || false
                    });
                    console.log(`房间 ${data.roomId} 已创建`);
                    updateRoomListUI();
                    break;
                    
                case 'room_closed':
                    globalRoomList.delete(data.roomId);
                    console.log(`房间 ${data.roomId} 已关闭`);
                    updateRoomListUI();
                    break;
                    
                case 'room_update':
                    if (globalRoomList.has(data.roomId)) {
                        const room = globalRoomList.get(data.roomId);
                        Object.assign(room, data.update);
                        updateRoomListUI();
                    }
                    break;
                    
                case 'room_list':
                    // 完整房间列表
                    globalRoomList.clear();
                    if (data.rooms && Array.isArray(data.rooms)) {
                        data.rooms.forEach(room => {
                            globalRoomList.set(room.roomId, room);
                        });
                    }
                    updateRoomListUI();
                    break;
            }
        } catch (error) {
            console.warn('处理全局房间消息失败:', error);
        }
    }
    
    // 请求房间列表
    function requestRoomList() {
        if (roomListClient && roomListClient.connected) {
            roomListClient.publish(globalRoomsTopic, JSON.stringify({
                type: 'request_list',
                timestamp: Date.now()
            }));
        }
    }
    
    // 发布房间创建消息
    function publishRoomCreated(roomId, roomInfo) {
        if (roomListClient && roomListClient.connected) {
            roomListClient.publish(globalRoomsTopic, JSON.stringify({
                type: 'room_created',
                roomId: roomId,
                createdBy: nickname,
                createdAt: Date.now(),
                ...roomInfo
            }));
        }
    }
    
    // 发布房间关闭消息
    function publishRoomClosed(roomId) {
        if (roomListClient && roomListClient.connected) {
            roomListClient.publish(globalRoomsTopic, JSON.stringify({
                type: 'room_closed',
                roomId: roomId,
                closedBy: nickname,
                timestamp: Date.now()
            }));
        }
    }
    
    // 更新房间列表UI
    function updateRoomListUI() {
        const roomListContainer = mountEl.querySelector('.room-list-container');
        if (!roomListContainer) return;
        
        const roomsArray = Array.from(globalRoomList.values());
        
        if (roomsArray.length === 0) {
            roomListContainer.innerHTML = '<div class="no-rooms">暂无活跃房间</div>';
            return;
        }
        
        const roomListHTML = roomsArray.map(room => `
            <div class="room-item" data-room-id="${room.roomId}">
                <div class="room-info">
                    <span class="room-name">${room.roomId}</span>
                    <span class="room-creator">创建者: ${room.createdBy}</span>
                    <span class="room-users">${room.userCount || 0}/${room.maxUsers || 20}人</span>
                </div>
                <button class="btn-quick-join" data-room-id="${room.roomId}">
                    ${room.isPrivate ? '🔒' : '🚪'} 加入
                </button>
            </div>
        `).join('');
        
        roomListContainer.innerHTML = roomListHTML;
        
        // 绑定快速加入按钮事件
        roomListContainer.querySelectorAll('.btn-quick-join').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetRoomId = e.target.dataset.roomId;
                elements.roomInput.value = targetRoomId;
                joinRoom();
            });
        });
    }
    
    // 检查房间是否已存在（改进版）
    function roomExists(targetRoomId) {
        // 先检查全局房间列表
        if (globalRoomList.has(targetRoomId)) {
            return true;
        }
        
        // 再检查本地存储（兼容旧版本）
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            return roomConfigs.hasOwnProperty(targetRoomId) && roomConfigs[targetRoomId].createdBy;
        } catch (error) {
            return false;
        }
    }
    
    // 原来的 roomExists 函数改名为 localRoomExists
    function localRoomExists(targetRoomId) {
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            return roomConfigs.hasOwnProperty(targetRoomId) && roomConfigs[targetRoomId].createdBy;
        } catch (error) {
            return false;
        }
    }
    
    // 创建新房间配置（严格控制）
    function createRoomConfig(targetRoomId) {
        // 检查房间是否已存在
        if (roomExists(targetRoomId)) {
            throw new Error('房间已存在，请使用"加入房间"功能！');
        }
        
        roomConfig = { ...defaultRoomConfig };
        roomConfig.createdBy = nickname;
        roomConfig.adminUsers = [nickname];
        roomConfig.createdAt = Date.now();
        roomConfig.roomId = targetRoomId;
        
        // 生成房间唯一密钥（UID）
        if (!roomConfig.roomKey) {
            roomConfig.roomKey = generateRoomKey();
            window.__ROOM_UID__ = roomConfig.roomKey; // 保存到全局变量
        }
        
        // 保存新房间配置
        saveRoomConfig();
        
        // 发布房间创建消息到全局主题
        publishRoomCreated(targetRoomId, {
            maxUsers: roomConfig.maxUsers,
            category: roomConfig.category,
            isPrivate: roomConfig.isPrivate,
            userCount: 1
        });
        
        log('system', `🏠 您成功创建了房间 "${targetRoomId}"`);
        
        // 生成不同类型的邀请链接
        const ownerToken = generateInviteToken(targetRoomId, 'owner', 7200); // 房主令牌，2小时有效
        const adminToken = generateInviteToken(targetRoomId, 'admin', 3600); // 管理员令牌，1小时有效
        const memberLink = generateInviteLink(targetRoomId, '访客', true); // 普通成员链接（带密钥）
        
        // 显示邀请链接
        log('system', `🔗 普通邀请链接: ${memberLink}`);
        log('system', `👑 房主邀请链接: ${generateInviteLink(targetRoomId, '房主', true)}&token=${ownerToken}`);
        log('system', `⭐ 管理员邀请链接: ${generateInviteLink(targetRoomId, '管理员', true)}&token=${adminToken}`);
        log('system', '💡 提示: 房主和管理员链接可免密进入房间');
        
        return roomConfig;
    }
    
    // 限制房间设置只有房主可以修改
    function updateRoomSettingsAccess() {
        const settingsPanel = mountEl.querySelector('#settings-panel');
        const isOwner = roomConfig && roomConfig.createdBy === nickname;
        
        if (settingsPanel) {
            const settingElements = settingsPanel.querySelectorAll('input, select, button');
            settingElements.forEach(el => {
                if (isOwner) {
                    el.disabled = false;
                    el.style.opacity = '1';
                } else {
                    el.disabled = true;
                    el.style.opacity = '0.5';
                }
            });
            
            if (!isOwner && settingsPanel.style.display !== 'none') {
                const ownerWarning = settingsPanel.querySelector('.owner-warning');
                if (!ownerWarning) {
                    const warning = document.createElement('div');
                    warning.className = 'owner-warning';
                    warning.style.cssText = 'color: #ff6b6b; font-size: 12px; text-align: center; margin-top: 10px;';
                    warning.textContent = '⚠️ 只有房主可以修改房间设置';
                    settingsPanel.appendChild(warning);
                }
            }
        }
    }

    // 检查管理员权限
    function checkAdminPrivileges() {
        if (!roomConfig || !nickname) {
            isRoomAdmin = false;
            return false;
        }
        
        // 检查是否为管理员
        isRoomAdmin = roomConfig.adminUsers.includes(nickname);
        
        if (isRoomAdmin) {
            const isOwner = roomConfig.createdBy === nickname;
            if (isOwner) {
                log('system', '👑 您是房间创建者，拥有完全管理权限');
            } else {
                log('system', '👑 您拥有管理员权限');
            }
        }
        
        // 更新房间设置访问权限
        if (typeof updateRoomSettingsAccess === 'function') {
            updateRoomSettingsAccess();
        }
        
        return isRoomAdmin;
    }
    
    // 添加管理员
    function addAdmin(username) {
        if (!isRoomAdmin) {
            log('system', '❌ 只有管理员才能添加其他管理员');
            return false;
        }
        
        if (!roomConfig.adminUsers.includes(username)) {
            roomConfig.adminUsers.push(username);
            saveRoomConfig();
            log('system', `👑 ${username} 已被设为管理员`);
            
            // 广播管理员变更
            if (client && isConnected) {
                client.publish(`game/${roomId}/admin`, JSON.stringify({
                    type: 'admin_added',
                    admin: username,
                    by: nickname,
                    timestamp: Date.now()
                }));
            }
            
            return true;
        }
        
        return false;
    }
    
    // 移除管理员
    function removeAdmin(username) {
        if (!isRoomAdmin || username === roomConfig.createdBy) {
            log('system', '❌ 无法移除房间创建者的管理员权限');
            return false;
        }
        
        const index = roomConfig.adminUsers.indexOf(username);
        if (index > -1) {
            roomConfig.adminUsers.splice(index, 1);
            saveRoomConfig();
            log('system', `🚫 ${username} 的管理员权限已被移除`);
            
            // 广播管理员变更
            if (client && isConnected) {
                client.publish(`game/${roomId}/admin`, JSON.stringify({
                    type: 'admin_removed',
                    admin: username,
                    by: nickname,
                    timestamp: Date.now()
                }));
            }
            
            return true;
        }
        
        return false;
    }
    
    // 踢出用户 (管理员功能)
    function kickUser(username, reason = '违反房间规则') {
        if (!isRoomAdmin) {
            log('system', '❌ 只有管理员才能踢出用户');
            return false;
        }
        
        if (username === nickname) {
            log('system', '❌ 不能踢出自己');
            return false;
        }
        
        if (roomConfig.adminUsers.includes(username)) {
            log('system', '❌ 不能踢出其他管理员');
            return false;
        }
        
        // 广播踢出消息
        if (client && isConnected) {
            client.publish(`game/${roomId}/moderation`, JSON.stringify({
                type: 'user_kicked',
                user: username,
                reason: reason,
                by: nickname,
                timestamp: Date.now()
            }));
            
            log('system', `🚫 ${username} 已被踢出房间 (${reason})`);
        }
        
        return true;
    }
    
    // 格式化消息时间戳
    function formatMessageTime(timestamp) {
        const now = Date.now();
        const messageTime = new Date(timestamp);
        const diff = now - timestamp;
        
        // 如果是今天内的消息
        if (diff < 86400000) { // 24小时内
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            
            if (minutes < 1) {
                return '刚刚';
            } else if (minutes < 60) {
                return `${minutes}分钟前`;
            } else if (hours < 24) {
                return `${hours}小时前`;
            }
        }
        
        // 如果是昨天的消息
        const yesterday = new Date(now - 86400000);
        if (messageTime.toDateString() === yesterday.toDateString()) {
            return `昨天 ${messageTime.toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }
        
        // 如果是更早的消息，显示完整日期
        return messageTime.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    // 创建UI界面
    function createUI() {
        mountEl.innerHTML = `
            <div class="mqtt-room-screen">
                <header class="mqtt-header">
                    <button id="mqtt-back-btn" class="back-btn">‹</button>
                    <h2>MQTT聊天室</h2>
                    <div class="header-controls">
                        <button id="theme-toggle-btn" class="theme-toggle-btn" title="切换主题">🌙</button>
                        <div class="connection-status" id="mqtt-status">未连接</div>
                    </div>
                </header>
                
                <div class="mqtt-content">
                    <div class="room-section">
                        <div class="room-controls">
                            <div class="room-input-group" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" class="room-input" placeholder="房间号" value="demo-room-001" style="flex: 1;">
                                <button class="btn-generate-room" id="btn-generate-room" title="生成随机房间号">🎲</button>
                            </div>
                            <input type="text" class="nickname-input" placeholder="昵称" value="">
                            <div class="password-input-group" style="display: none;">
                                <input type="password" class="room-password-input" placeholder="房间密码" maxlength="50">
                                <button class="save-password-btn" id="save-password-btn">保存</button>
                            </div>
                        </div>
                        
                        <div class="room-actions">
                            <button class="btn-create-room" id="btn-create-room">🏠 创建房间</button>
                            <button class="btn-join-room" id="btn-join-room">🚪 加入房间</button>
                            <button class="btn-copy-invite" id="btn-copy-invite" title="复制邀请链接">🔗 复制邀请</button>
                        </div>
                        
                        <div class="room-settings">
                            <div class="settings-toggle">
                                <button class="settings-toggle-btn" id="settings-toggle-btn">⚙️ 房间设置</button>
                            </div>
                            <div class="settings-panel" id="settings-panel" style="display: none;">
                                <div class="setting-row">
                                    <label class="setting-label">
                                        <input type="checkbox" class="private-room-checkbox" id="private-room-checkbox">
                                        密码保护房间
                                    </label>
                                </div>
                                <div class="setting-row">
                                    <label class="setting-label">最大人数:</label>
                                    <select class="max-users-select" id="max-users-select">
                                        <option value="5">5人</option>
                                        <option value="10">10人</option>
                                        <option value="20" selected>20人</option>
                                        <option value="50">50人</option>
                                    </select>
                                </div>
                                <div class="setting-row">
                                    <label class="setting-label">房间类型:</label>
                                    <select class="room-category-select" id="room-category-select">
                                        <option value="chat">聊天室</option>
                                        <option value="game">游戏房</option>
                                        <option value="ai">AI助手</option>
                                        <option value="study">学习讨论</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 房间历史记录 -->
                        <div class="room-history" id="room-history-container" style="display: none;">
                            <div class="history-header">
                                <span class="history-title">📚 最近使用的房间</span>
                                <div class="history-controls">
                                    <input type="text" class="history-search" placeholder="搜索房间..." id="room-search-input">
                                    <button class="history-export-btn" title="导出历史记录">📤</button>
                                    <button class="history-import-btn" title="导入历史记录">📥</button>
                                    <button class="history-clear-btn" title="清空历史记录">🗑️</button>
                                </div>
                            </div>
                            <div class="history-list" id="room-history-list"></div>
                        </div>
                        
                        <!-- 全局房间列表 -->
                        <div class="room-list-section">
                            <div class="room-list-header">
                                <span class="room-list-title">🌐 活跃房间列表</span>
                                <button class="refresh-room-list" id="refresh-room-list" title="刷新房间列表">🔄</button>
                            </div>
                            <div class="room-list-container" id="room-list-container">
                                <div class="no-rooms">正在加载房间列表...</div>
                            </div>
                        </div>
                        
                        <div class="control-buttons">
                            <button class="leave-btn btn-leave" disabled>❌ 离开</button>
                        </div>
                        <div class="status-display status disconnected">📴 未连接</div>
                        <div class="broker-info">
                            <small>当前服务器：<span id="current-broker">test.mosquitto.org</span></small>
                        </div>
                        <div class="online-users-info">
                            <div class="online-count">
                                👥 在线人数：<span id="online-count">0</span>
                            </div>
                            <div class="online-list" id="online-list" style="display: none;">
                                <div class="online-list-header">在线用户：</div>
                                <div class="online-list-content" id="online-list-content"></div>
                            </div>
                        </div>
                        <div class="warning">
                            ⚠️ 公共 Broker 不保证隐私与稳定，勿传敏感信息
                        </div>
                    </div>

                    <div class="chat-container">
                        <div class="messages" id="messages-container">
                            <div class="welcome-message">
                                <p>👋 欢迎使用MQTT聊天室！</p>
                                <p>输入房间号和昵称，点击"连接"开始聊天</p>
                                <p>支持自动断线重连和备用服务器切换</p>
                            </div>
                        </div>
                        <div class="input-area">
                            <button class="emoji-btn" title="选择表情" disabled>😊</button>
                            <input type="text" class="message-input" placeholder="输入消息..." disabled>
                            <button class="send-btn" disabled>📤</button>
                        </div>
                        
                        <!-- 表情选择器面板 -->
                        <div class="emoji-picker" id="emoji-picker" style="display: none;">
                            <div class="emoji-picker-header">
                                <span class="emoji-category active" data-category="smileys">😊</span>
                                <span class="emoji-category" data-category="gestures">👍</span>
                                <span class="emoji-category" data-category="people">👨</span>
                                <span class="emoji-category" data-category="animals">🐶</span>
                                <span class="emoji-category" data-category="food">🍎</span>
                                <span class="emoji-category" data-category="activities">⚽</span>
                                <span class="emoji-category" data-category="objects">💡</span>
                                <span class="emoji-category" data-category="symbols">❤️</span>
                            </div>
                            <div class="emoji-picker-content" id="emoji-picker-content">
                                <!-- 动态加载表情 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                /* =================== MQTT聊天室美化样式 =================== */
                /* CSS变量定义 - 支持深浅主题切换 */
                .mqtt-room-screen {
                    /* 颜色变量定义 */
                    --bg-primary: #0b0f15;
                    --bg-secondary: #1a1f26;
                    --card-bg: rgba(255,255,255,.08);
                    --card-border: rgba(255,255,255,.15);
                    --text-primary: #e9eef6;
                    --text-secondary: #9fb1c7;
                    --text-muted: #6b7280;
                    
                    /* 主题色彩 */
                    --accent-gradient: linear-gradient(135deg, #7c6fff 0%, #49d1ff 100%);
                    --success-color: #56d364;
                    --error-color: #ff6b6b;
                    --warning-color: #ffd166;
                    --info-color: #70b7ff;
                    
                    /* 阴影和效果 */
                    --shadow-sm: 0 2px 8px rgba(0,0,0,0.1);
                    --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
                    --shadow-lg: 0 8px 24px rgba(0,0,0,0.2);
                    --border-radius: 12px;
                    --border-radius-sm: 8px;
                    --border-radius-lg: 16px;
                    
                    /* 间距 */
                    --spacing-xs: 4px;
                    --spacing-sm: 8px;
                    --spacing-md: 12px;
                    --spacing-lg: 16px;
                    --spacing-xl: 20px;
                    --spacing-2xl: 24px;
                }
                
                /* 浅色主题支持 */
                @media (prefers-color-scheme: light) {
                    .mqtt-room-screen:not(.dark-theme) {
                        --bg-primary: #f6f8fb;
                        --bg-secondary: #ffffff;
                        --card-bg: rgba(255,255,255,0.9);
                        --card-border: rgba(0,0,0,0.08);
                        --text-primary: #0b1c36;
                        --text-secondary: #5b6b80;
                        --text-muted: #9ca3af;
                    }
                }
                
                /* 强制浅色主题 */
                .mqtt-room-screen.light-theme {
                    --bg-primary: #f6f8fb;
                    --bg-secondary: #ffffff;
                    --card-bg: rgba(255,255,255,0.9);
                    --card-border: rgba(0,0,0,0.08);
                    --text-primary: #0b1c36;
                    --text-secondary: #5b6b80;
                    --text-muted: #9ca3af;
                }
                
                /* 强制深色主题 */
                .mqtt-room-screen.dark-theme {
                    --bg-primary: #0b0f15;
                    --bg-secondary: #1a1f26;
                    --card-bg: rgba(255,255,255,.08);
                    --card-border: rgba(255,255,255,.15);
                    --text-primary: #e9eef6;
                    --text-secondary: #9fb1c7;
                    --text-muted: #6b7280;
                }
                
                .mqtt-room-screen {
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    overflow: hidden;
                    position: relative;
                    /* 确保在虚拟手机中不会超出边界 */
                    max-height: 667px;
                    width: 100%;
                    max-width: 375px;
                }
                
                /* 背景渐变效果 */
                .mqtt-room-screen::before {
                    content: "";
                    position: fixed;
                    inset: -20%;
                    background: 
                        radial-gradient(60% 60% at 20% 20%, rgba(124, 111, 255, 0.15), transparent 60%),
                        radial-gradient(60% 60% at 80% 30%, rgba(73, 209, 255, 0.12), transparent 60%),
                        radial-gradient(60% 60% at 50% 80%, rgba(255, 154, 199, 0.15), transparent 60%);
                    filter: blur(40px);
                    z-index: -1;
                    opacity: 0.6;
                }
                
                @media (prefers-color-scheme: light) {
                    .mqtt-room-screen::before {
                        opacity: 0.3;
                    }
                }
                
                .mqtt-header {
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid var(--card-border);
                    padding: var(--spacing-lg);
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-lg);
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    /* 确保头部固定且可点击 */
                    flex-shrink: 0;
                    min-height: 60px;
                }
                
                .header-controls {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }
                
                .theme-toggle-btn {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 6px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    color: var(--text-primary);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                }
                
                .theme-toggle-btn:hover {
                    background: var(--card-border);
                    transform: scale(1.1) rotate(15deg);
                }
                
                .back-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    color: var(--text-primary);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .back-btn:hover {
                    background: var(--card-border);
                    transform: scale(1.05);
                }
                
                .mqtt-header h2 {
                    margin: 0;
                    flex: 1;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                
                .connection-status {
                    font-size: 12px;
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--border-radius-sm);
                    font-weight: 600;
                    backdrop-filter: blur(10px);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .connection-status.connected {
                    background: rgba(86, 211, 100, 0.15);
                    color: var(--success-color);
                    border: 1px solid rgba(86, 211, 100, 0.3);
                }
                
                .connection-status.connecting {
                    background: rgba(255, 209, 102, 0.15);
                    color: var(--warning-color);
                    border: 1px solid rgba(255, 209, 102, 0.3);
                }
                
                .connection-status.disconnected {
                    background: rgba(255, 107, 107, 0.15);
                    color: var(--error-color);
                    border: 1px solid rgba(255, 107, 107, 0.3);
                }
                
                .mqtt-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: var(--spacing-lg);
                    gap: var(--spacing-lg);
                    overflow-y: auto;
                    /* 确保内容区域不会遮挡头部 */
                    height: calc(100vh - 60px);
                    max-height: calc(667px - 60px);
                }
                
                .room-section {
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--card-border);
                    padding: var(--spacing-xl);
                    border-radius: var(--border-radius-lg);
                    box-shadow: var(--shadow-md);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    /* 优化房间控制区域，减少空间占用 */
                    flex-shrink: 0;
                    margin-bottom: var(--spacing-md);
                }
                
                .room-section:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-lg);
                }
                
                .room-controls {
                    display: flex;
                    gap: var(--spacing-md);
                    margin-bottom: var(--spacing-md);
                    flex-wrap: wrap;
                }
                
                .room-controls input {
                    padding: var(--spacing-md) var(--spacing-lg);
                    border: 2px solid var(--card-border);
                    border-radius: var(--border-radius);
                    font-size: 16px;
                    flex: 1;
                    min-width: 120px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                }
                
                .room-controls input:focus {
                    outline: none;
                    border-color: var(--info-color);
                    box-shadow: 0 0 0 4px rgba(112, 183, 255, 0.1);
                    transform: translateY(-1px);
                }
                
                .room-controls input::placeholder {
                    color: var(--text-muted);
                }
                
                .control-buttons {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                }
                
                .control-buttons button {
                    padding: var(--spacing-md) var(--spacing-lg);
                    border: none;
                    border-radius: var(--border-radius);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                }
                
                .control-buttons button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                }
                
                /* 房间设置样式 */
                .room-settings {
                    margin-top: var(--spacing-md);
                }
                
                .settings-toggle {
                    text-align: center;
                    margin-bottom: var(--spacing-sm);
                }
                
                .settings-toggle-btn {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    color: var(--text-secondary);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                }
                
                .settings-toggle-btn:hover {
                    background: var(--card-border);
                    color: var(--text-primary);
                }
                
                .settings-panel {
                    background: var(--bg-secondary);
                    border: 1px solid var(--card-border);
                    border-radius: var(--border-radius);
                    padding: var(--spacing-md);
                    margin-top: var(--spacing-sm);
                }
                
                .setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-sm);
                    font-size: 12px;
                }
                
                .setting-label {
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                }
                
                .setting-label input[type="checkbox"] {
                    margin: 0;
                }
                
                .max-users-select,
                .room-category-select {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    color: var(--text-primary);
                    padding: 4px 8px;
                    border-radius: var(--border-radius-sm);
                    font-size: 11px;
                }
                
                .password-input-group {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-sm);
                    align-items: center;
                }
                
                .room-password-input {
                    flex: 1;
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: 2px solid var(--warning-color);
                    border-radius: var(--border-radius);
                    background: rgba(255, 193, 7, 0.1);
                    color: var(--text-primary);
                    font-size: 14px;
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                }
                
                .room-password-input:focus {
                    outline: none;
                    border-color: var(--warning-color);
                    box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.2);
                }
                
                .save-password-btn {
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--success-color);
                    color: white;
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                
                .save-password-btn:hover {
                    background: #4aa450;
                    transform: translateY(-1px);
                }
                
                .save-password-btn:active {
                    transform: translateY(0);
                }
                
                .room-actions {
                    display: flex;
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-md);
                    justify-content: center;
                }
                
                .btn-create-room,
                .btn-join-room {
                    flex: 1;
                    padding: var(--spacing-md) var(--spacing-lg);
                    border: none;
                    border-radius: var(--border-radius);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                }
                
                .btn-create-room {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    box-shadow: var(--shadow-md);
                }
                
                .btn-create-room:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-lg);
                }
                
                .btn-join-room {
                    background: linear-gradient(135deg, #56d364 0%, #28a745 100%);
                    color: white;
                    box-shadow: var(--shadow-md);
                }
                
                .btn-join-room:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-lg);
                }
                
                .btn-create-room:disabled,
                .btn-join-room:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                
                .room-owner-badge {
                    background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%);
                    color: #8b4513;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: bold;
                    margin-left: 8px;
                    box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
                }
                
                .btn-connect {
                    background: var(--accent-gradient);
                    color: white;
                    box-shadow: var(--shadow-sm);
                }
                
                .btn-connect:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                
                .btn-connect:active:not(:disabled) {
                    transform: translateY(0px);
                }
                
                .btn-leave {
                    background: linear-gradient(135deg, var(--error-color) 0%, #e74c3c 100%);
                    color: white;
                    box-shadow: var(--shadow-sm);
                }
                
                .btn-leave:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                
                .btn-leave:active:not(:disabled) {
                    transform: translateY(0px);
                }
                
                .control-buttons button:disabled {
                    background: var(--card-border) !important;
                    color: var(--text-muted) !important;
                    cursor: not-allowed;
                    box-shadow: none !important;
                }
                
                .status-display {
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius-sm);
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: var(--spacing-sm);
                    text-align: center;
                    backdrop-filter: blur(10px);
                }
                
                .broker-info {
                    text-align: center;
                    margin-bottom: var(--spacing-sm);
                    color: var(--text-secondary);
                    font-size: 12px;
                }
                
                .broker-info small {
                    color: var(--text-muted);
                }
                
                .online-users-info {
                    text-align: center;
                    margin-bottom: var(--spacing-sm);
                }
                
                .online-count {
                    font-size: 14px;
                    color: var(--success-color);
                    font-weight: 600;
                    cursor: pointer;
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--border-radius);
                    background: rgba(86, 211, 100, 0.1);
                    border: 1px solid rgba(86, 211, 100, 0.3);
                    margin-bottom: var(--spacing-sm);
                    backdrop-filter: blur(10px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .online-count:hover {
                    background: rgba(86, 211, 100, 0.2);
                    transform: translateY(-1px);
                }
                
                .online-list {
                    background: rgba(86, 211, 100, 0.1);
                    border: 1px solid rgba(86, 211, 100, 0.3);
                    border-radius: var(--border-radius-sm);
                    padding: var(--spacing-sm);
                    margin-top: var(--spacing-sm);
                    max-height: 120px;
                    overflow-y: auto;
                    backdrop-filter: blur(10px);
                }
                
                .online-list-header {
                    font-weight: 600;
                    font-size: 12px;
                    color: var(--success-color);
                    margin-bottom: var(--spacing-sm);
                }
                
                .online-list-content {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--spacing-xs);
                }
                
                .online-user {
                    background: rgba(112, 183, 255, 0.15);
                    color: var(--info-color);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--border-radius);
                    font-size: 11px;
                    font-weight: 500;
                    border: 1px solid rgba(112, 183, 255, 0.3);
                    backdrop-filter: blur(5px);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .online-user:hover {
                    background: rgba(112, 183, 255, 0.25);
                    transform: translateY(-1px);
                }
                
                .user-actions {
                    display: flex;
                    gap: 3px;
                    margin-left: 5px;
                }
                
                .private-chat-btn,
                .admin-action-btn,
                .kick-btn,
                .remove-admin-btn {
                    padding: 2px 6px;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: all 0.2s ease;
                    min-width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .private-chat-btn {
                    background: var(--info-color);
                }
                
                .private-chat-btn:hover {
                    background: #5a9fd4;
                    transform: scale(1.1);
                }
                
                .admin-action-btn {
                    background: var(--warning-color);
                }
                
                .admin-action-btn:hover {
                    background: #e6a800;
                    transform: scale(1.1);
                }
                
                .kick-btn {
                    background: var(--error-color);
                }
                
                .kick-btn:hover {
                    background: #e53e3e;
                    transform: scale(1.1);
                }
                
                .remove-admin-btn {
                    background: var(--text-muted);
                }
                
                .remove-admin-btn:hover {
                    background: #718096;
                    transform: scale(1.1);
                }
                
                .warning {
                    background: rgba(255, 209, 102, 0.15);
                    border: 1px solid rgba(255, 209, 102, 0.3);
                    color: var(--warning-color);
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius-sm);
                    font-size: 11px;
                    text-align: center;
                    margin-top: var(--spacing-sm);
                    backdrop-filter: blur(10px);
                }
                
                .room-history {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--border-radius-sm);
                    margin: 10px 0;
                    padding: 8px;
                    backdrop-filter: blur(10px);
                }
                
                .history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .history-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .history-search {
                    padding: 4px 8px;
                    border: 1px solid var(--card-border);
                    border-radius: 4px;
                    font-size: 12px;
                    width: 120px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    transition: all 0.2s ease;
                }
                
                .history-search:focus {
                    outline: none;
                    border-color: var(--info-color);
                    box-shadow: 0 0 0 2px rgba(112, 183, 255, 0.1);
                }
                
                .history-title {
                    font-size: 12px;
                    font-weight: bold;
                    color: var(--text-secondary);
                }
                
                .history-export-btn,
                .history-import-btn,
                .history-clear-btn {
                    background: none;
                    border: none;
                    font-size: 14px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: var(--text-muted);
                    transition: all 0.2s ease;
                }
                
                .history-export-btn:hover {
                    background: var(--card-border);
                    color: var(--success-color);
                }
                
                .history-import-btn:hover {
                    background: var(--card-border);
                    color: var(--info-color);
                }
                
                .history-clear-btn:hover {
                    background: var(--card-border);
                    color: var(--error-color);
                }
                
                .history-list {
                    max-height: 120px;
                    overflow-y: auto;
                }
                
                .history-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 8px;
                    margin: 2px 0;
                    background: var(--bg-secondary);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid var(--card-border);
                }
                
                .history-item:hover {
                    background: var(--card-bg);
                    border-color: var(--info-color);
                    transform: translateY(-1px);
                }
                
                .history-room {
                    font-weight: bold;
                    color: var(--info-color);
                    font-size: 13px;
                    margin-right: 8px;
                    flex-shrink: 0;
                }
                
                .history-nickname {
                    color: var(--text-secondary);
                    font-size: 12px;
                    margin-right: 8px;
                    flex-shrink: 0;
                }
                
                .history-time {
                    font-size: 11px;
                    color: var(--text-muted);
                    margin-right: 8px;
                    flex-shrink: 0;
                    margin-left: auto;
                }
                
                .history-remove {
                    background: none;
                    border: none;
                    color: var(--error-color);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }
                
                .history-remove:hover {
                    background: rgba(255, 107, 107, 0.15);
                    transform: scale(1.1);
                }
                
                .no-results {
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 12px;
                    padding: 20px;
                    font-style: italic;
                }
                
                .chat-container {
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--card-border);
                    border-radius: var(--border-radius-lg);
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: var(--shadow-md);
                    /* 优化聊天容器高度分配 */
                    min-height: 350px;
                    max-height: calc(100vh - 280px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .chat-container:hover {
                    box-shadow: var(--shadow-lg);
                }
                
                .messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--spacing-lg);
                    background: transparent;
                }
                
                /* 美化滚动条样式 */
                .messages::-webkit-scrollbar {
                    width: 6px;
                }
                
                .messages::-webkit-scrollbar-track {
                    background: transparent;
                    border-radius: 3px;
                }
                
                .messages::-webkit-scrollbar-thumb {
                    background: var(--card-border);
                    border-radius: 3px;
                    transition: all 0.3s ease;
                }
                
                .messages::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }
                
                /* Firefox滚动条样式 */
                .messages {
                    scrollbar-width: thin;
                    scrollbar-color: var(--card-border) transparent;
                }
                
                /* 其他滚动区域统一样式 */
                .mqtt-content::-webkit-scrollbar,
                .history-list::-webkit-scrollbar,
                .online-list::-webkit-scrollbar {
                    width: 4px;
                }
                
                .mqtt-content::-webkit-scrollbar-track,
                .history-list::-webkit-scrollbar-track,
                .online-list::-webkit-scrollbar-track {
                    background: transparent;
                    border-radius: 2px;
                }
                
                .mqtt-content::-webkit-scrollbar-thumb,
                .history-list::-webkit-scrollbar-thumb,
                .online-list::-webkit-scrollbar-thumb {
                    background: var(--card-border);
                    border-radius: 2px;
                    transition: all 0.3s ease;
                }
                
                .mqtt-content::-webkit-scrollbar-thumb:hover,
                .history-list::-webkit-scrollbar-thumb:hover,
                .online-list::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }
                
                .mqtt-content,
                .history-list,
                .online-list {
                    scrollbar-width: thin;
                    scrollbar-color: var(--card-border) transparent;
                }
                
                .welcome-message {
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 14px;
                    padding: var(--spacing-xl);
                    border-radius: var(--border-radius);
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--card-border);
                }
                
                .welcome-message p {
                    margin: var(--spacing-sm) 0;
                    color: var(--text-muted);
                }
                
                .message {
                    margin-bottom: var(--spacing-md);
                    padding: var(--spacing-md) var(--spacing-lg);
                    border-radius: var(--border-radius-lg);
                    font-size: 14px;
                    line-height: 1.5;
                    word-wrap: break-word;
                    backdrop-filter: blur(10px);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                
                .message:hover {
                    transform: translateY(-1px);
                }
                
                .message.chat {
                    background: rgba(112, 183, 255, 0.15);
                    border-left: 4px solid var(--info-color);
                    color: var(--text-primary);
                }
                
                .message.own-message {
                    background: var(--accent-gradient);
                    color: white;
                    margin-left: 60px;
                    border-radius: var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-sm) var(--border-radius-lg);
                    box-shadow: var(--shadow-sm);
                }
                
                .message.presence {
                    background: rgba(255, 154, 199, 0.15);
                    border: 1px solid rgba(255, 154, 199, 0.3);
                    color: var(--text-secondary);
                    font-style: italic;
                    font-size: 12px;
                    text-align: center;
                }
                
                .message.system {
                    background: rgba(255, 209, 102, 0.15);
                    border: 1px solid rgba(255, 209, 102, 0.3);
                    color: var(--warning-color);
                    font-size: 12px;
                    text-align: center;
                    font-weight: 500;
                }
                
                /* 私聊消息样式 */
                .message.private {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: 2px solid rgba(118, 75, 162, 0.3);
                    position: relative;
                }
                
                .message.private::before {
                    content: '🔒 私聊';
                    position: absolute;
                    top: -8px;
                    right: 10px;
                    background: #764ba2;
                    color: white;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: bold;
                }
                
                .message.private.own-message {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    border: 2px solid rgba(245, 87, 108, 0.3);
                }
                
                .message.private.own-message::before {
                    background: #f5576c;
                }
                
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-xs);
                }
                
                .user-name {
                    font-weight: 600;
                    font-size: 13px;
                    color: var(--text-primary);
                }
                
                .message.chat .user-name {
                    color: var(--info-color);
                }
                
                .message-time {
                    font-size: 11px;
                    color: var(--text-muted);
                    opacity: 0.8;
                    font-weight: 500;
                }
                
                .input-area {
                    padding: var(--spacing-lg);
                    display: flex;
                    gap: var(--spacing-md);
                    border-top: 1px solid var(--card-border);
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    position: relative;
                }
                
                .input-area input {
                    flex: 1;
                    padding: var(--spacing-md) var(--spacing-lg);
                    border: 2px solid var(--card-border);
                    border-radius: 24px;
                    font-size: 16px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                }
                
                .input-area input:focus {
                    outline: none;
                    border-color: var(--info-color);
                    box-shadow: 0 0 0 4px rgba(112, 183, 255, 0.1);
                    transform: translateY(-1px);
                }
                
                .input-area input::placeholder {
                    color: var(--text-muted);
                }
                
                .input-area button {
                    width: 44px;
                    height: 44px;
                    background: var(--accent-gradient);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    box-shadow: var(--shadow-sm);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .input-area button:hover:not(:disabled) {
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px) scale(1.05);
                }
                
                .input-area button:active:not(:disabled) {
                    transform: translateY(0) scale(0.98);
                }
                
                .input-area button:disabled {
                    background: var(--card-border) !important;
                    color: var(--text-muted) !important;
                    cursor: not-allowed;
                    transform: none !important;
                    box-shadow: none !important;
                }
                
                /* 表情按钮样式 */
                .emoji-btn {
                    width: 44px;
                    height: 44px;
                    background: var(--card-bg);
                    color: var(--text-primary);
                    border: 2px solid var(--card-border);
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .emoji-btn:hover:not(:disabled) {
                    background: var(--accent-gradient);
                    border-color: transparent;
                    transform: scale(1.05) rotate(15deg);
                }
                
                .emoji-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                /* 表情选择器面板 */
                .emoji-picker {
                    position: absolute;
                    bottom: 70px;
                    left: var(--spacing-lg);
                    right: var(--spacing-lg);
                    background: var(--bg-secondary);
                    border: 1px solid var(--card-border);
                    border-radius: var(--border-radius-lg);
                    box-shadow: var(--shadow-lg);
                    z-index: 1000;
                    backdrop-filter: blur(20px);
                    max-height: 300px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                
                .emoji-picker-header {
                    display: flex;
                    gap: 2px;
                    padding: var(--spacing-sm);
                    border-bottom: 1px solid var(--card-border);
                    background: var(--card-bg);
                    overflow-x: auto;
                }
                
                .emoji-category {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--border-radius-sm);
                    cursor: pointer;
                    font-size: 18px;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                
                .emoji-category:hover {
                    background: var(--card-border);
                    transform: scale(1.1);
                }
                
                .emoji-category.active {
                    background: var(--accent-gradient);
                    transform: scale(1.15);
                }
                
                .emoji-picker-content {
                    padding: var(--spacing-md);
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                    gap: var(--spacing-xs);
                    flex: 1;
                }
                
                .emoji-item {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    font-size: 24px;
                    cursor: pointer;
                    border-radius: var(--border-radius-sm);
                    transition: all 0.2s ease;
                }
                
                .emoji-item:hover {
                    background: var(--card-bg);
                    transform: scale(1.3);
                    z-index: 10;
                }
                
                /* 手机屏幕适配 - 专门为375px×667px虚拟手机优化 */
                @media (max-width: 480px) {
                    .mqtt-room-screen {
                        /* 调整小屏幕变量 */
                        --spacing-xs: 3px;
                        --spacing-sm: 6px;
                        --spacing-md: 8px;
                        --spacing-lg: 12px;
                        --spacing-xl: 16px;
                        --spacing-2xl: 20px;
                        --border-radius: 8px;
                        --border-radius-sm: 6px;
                        --border-radius-lg: 12px;
                        
                        /* 固定虚拟手机尺寸 */
                        width: 375px !important;
                        height: 667px !important;
                        max-width: 375px !important;
                        max-height: 667px !important;
                        overflow: hidden;
                    }
                    
                    .mqtt-header {
                        padding: 12px 16px;
                        min-height: 50px;
                        max-height: 50px;
                        flex-shrink: 0;
                    }
                    
                    .mqtt-header h2 {
                        font-size: 16px;
                        font-weight: 600;
                    }
                    
                    .connection-status {
                        font-size: 11px;
                        padding: 4px 8px;
                    }
                    
                    .mqtt-content {
                        padding: 8px;
                        gap: 8px;
                        height: calc(100vh - 50px);
                        overflow-y: auto;
                        flex: 1;
                    }
                    
                    .room-section {
                        padding: 12px;
                        border-radius: 12px;
                        flex-shrink: 0;
                        margin-bottom: 8px;
                    }
                    
                    .room-controls {
                        flex-direction: column;
                        gap: 6px;
                        margin-bottom: 8px;
                    }
                    
                    .room-controls input {
                        min-width: unset;
                        padding: 10px 12px;
                        font-size: 14px;
                        height: 40px;
                        box-sizing: border-box;
                    }
                    
                    .control-buttons {
                        margin-bottom: 8px;
                        gap: 6px;
                    }
                    
                    .control-buttons button {
                        padding: 8px 12px;
                        font-size: 13px;
                        min-height: 36px;
                    }
                    
                    .chat-container {
                        /* 关键：给聊天容器分配剩余的所有空间 */
                        flex: 1;
                        min-height: 280px;
                        max-height: calc(100vh - 280px);
                        display: flex;
                        flex-direction: column;
                        border-radius: 12px;
                    }
                    
                    .messages {
                        /* 确保消息区域能够正常滚动，不会挤压输入区域 */
                        flex: 1;
                        overflow-y: auto;
                        padding: 8px;
                        min-height: 200px;
                        max-height: calc(100vh - 380px);
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .message {
                        padding: 6px 10px;
                        margin-bottom: 6px;
                        font-size: 13px;
                        line-height: 1.4;
                    }
                    
                    .message.own-message {
                        margin-left: 30px;
                        margin-right: 0px;
                    }
                    
                    .message-header {
                        margin-bottom: 3px;
                    }
                    
                    .user-name {
                        font-size: 12px;
                        font-weight: 600;
                    }
                    
                    .message-time {
                        font-size: 10px;
                    }
                    
                    .input-area {
                        padding: 8px;
                        gap: 6px;
                        flex-shrink: 0;
                        min-height: 60px;
                        max-height: 60px;
                    }
                    
                    .input-area input {
                        padding: 8px 12px;
                        font-size: 14px;
                        height: 36px;
                        box-sizing: border-box;
                    }
                    
                    .input-area button {
                        width: 36px;
                        height: 36px;
                        font-size: 14px;
                        flex-shrink: 0;
                    }
                    
                    /* 优化小屏幕下的背景效果 */
                    .mqtt-room-screen::before {
                        filter: blur(25px);
                        opacity: 0.3;
                    }
                    
                    .mqtt-room-screen.light-theme::before,
                    .mqtt-room-screen:not(.dark-theme)::before {
                        opacity: 0.15;
                    }
                    
                    .mqtt-room-screen.dark-theme::before {
                        opacity: 0.3;
                    }
                    
                    /* 优化房间历史记录在小屏幕的显示 */
                    .room-history {
                        max-height: 100px;
                        margin: 8px 0;
                    }
                    
                    .history-list {
                        max-height: 80px;
                    }
                    
                    .history-item {
                        padding: 4px 6px;
                        margin: 1px 0;
                    }
                    
                    .history-room, .history-nickname {
                        font-size: 11px;
                    }
                    
                    .history-time {
                        font-size: 9px;
                    }
                    
                    /* 在线用户信息优化 */
                    .online-count {
                        font-size: 12px;
                        padding: 4px 8px;
                    }
                    
                    .online-list {
                        max-height: 80px;
                        padding: 6px;
                    }
                    
                    .online-user {
                        font-size: 10px;
                        padding: 2px 6px;
                    }
                    
                    /* 状态显示优化 */
                    .status-display {
                        padding: 6px;
                        font-size: 11px;
                        margin-bottom: 6px;
                    }
                    
                    .broker-info {
                        margin-bottom: 6px;
                        font-size: 11px;
                    }
                    
                    .online-users-info {
                        margin-bottom: 6px;
                    }
                    
                    .warning {
                        padding: 6px;
                        font-size: 10px;
                        margin-top: 6px;
                    }
                    
                    /* 欢迎消息优化 */
                    .welcome-message {
                        padding: 12px;
                        font-size: 12px;
                    }
                    
                    .welcome-message p {
                        margin: 6px 0;
                    }
                }
            </style>
        `;
        
        // 获取UI元素引用
        elements = {
            backBtn: mountEl.querySelector('#mqtt-back-btn'),
            themeToggleBtn: mountEl.querySelector('#theme-toggle-btn'),
            roomInput: mountEl.querySelector('.room-input'),
            nicknameInput: mountEl.querySelector('.nickname-input'),
            createRoomBtn: mountEl.querySelector('#btn-create-room'),
            joinRoomBtn: mountEl.querySelector('#btn-join-room'),
            leaveBtn: mountEl.querySelector('.leave-btn'),
            statusDisplay: mountEl.querySelector('.status-display'),
            connectionStatus: mountEl.querySelector('#mqtt-status'),
            currentBroker: mountEl.querySelector('#current-broker'),
            messages: mountEl.querySelector('#messages-container'),
            messageInput: mountEl.querySelector('.message-input'),
            sendBtn: mountEl.querySelector('.send-btn'),
            emojiBtn: mountEl.querySelector('.emoji-btn'),
            emojiPicker: mountEl.querySelector('#emoji-picker'),
            emojiPickerContent: mountEl.querySelector('#emoji-picker-content'),
            onlineCount: mountEl.querySelector('#online-count'),
            onlineList: mountEl.querySelector('#online-list'),
            onlineListContent: mountEl.querySelector('#online-list-content'),
            onlineCountDisplay: mountEl.querySelector('.online-count'),
            roomHistoryContainer: mountEl.querySelector('#room-history-container'),
            roomHistoryList: mountEl.querySelector('#room-history-list')
        };
        
        // 验证关键元素是否存在
        if (!elements.backBtn) {
            console.error('MQTT聊天室：返回按钮未找到');
        }
        if (!elements.messages) {
            console.error('MQTT聊天室：消息容器未找到');
        }
        if (!elements.themeToggleBtn) {
            console.error('MQTT聊天室：主题切换按钮未找到');
        }
        
        // 设置默认昵称
        elements.nicknameInput.value = getPlayerName() || '匿名用户';
        updateBrokerDisplay();
        
        // 加载房间历史记录
        loadRoomHistory();
        updateRoomHistoryDisplay();
        
        // 加载聊天记录
        loadChatHistory();
        
        // 加载并应用主题
        loadTheme();
        
        // 初始化表情选择器
        initEmojiPicker();
        
        // 初始化房间设置
        initRoomSettings();
        
        // 绑定事件
        bindEvents();
        
        // 解析URL参数并预填表单
        parseURLParams();
    }
    
    // 解析URL参数预填表单
    function parseURLParams() {
        try {
            // 支持 hash 和 search 两种方式的参数
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            
            // 优先使用 search 参数，其次使用 hash 参数
            const room = urlParams.get('room') || hashParams.get('room');
            const nick = urlParams.get('nick') || hashParams.get('nick');
            const uid = urlParams.get('uid') || hashParams.get('uid');
            const token = urlParams.get('token') || hashParams.get('token');
            const autoJoin = urlParams.get('auto') || hashParams.get('auto');
            
            // 预填房间号
            if (room && elements.roomInput) {
                elements.roomInput.value = decodeURIComponent(room);
                log('system', `📎 从链接预填房间号: ${room}`);
            }
            
            // 预填昵称
            if (nick && elements.nicknameInput) {
                elements.nicknameInput.value = decodeURIComponent(nick);
                log('system', `📎 从链接预填昵称: ${decodeURIComponent(nick)}`);
            }
            
            // 预填房间密钥/密码（如果有）
            if (uid) {
                // 保存到临时变量，用于后续的加密通信
                window.__ROOM_UID__ = uid;
                log('system', '🔑 检测到房间密钥');
            }
            
            // 处理邀请令牌（房主/管理员免密）
            if (token) {
                const tokenData = verifyInviteToken(token);
                if (tokenData) {
                    window.__INVITE_TOKEN__ = tokenData;
                    if (tokenData.role === 'owner') {
                        log('system', '👑 检测到房主邀请令牌');
                    } else if (tokenData.role === 'admin') {
                        log('system', '⭐ 检测到管理员邀请令牌');
                    }
                } else {
                    log('system', '⚠️ 邀请令牌已过期或无效');
                }
            }
            
            // 自动加入房间（可选）
            if (autoJoin === 'true' && room) {
                setTimeout(() => {
                    log('system', '⚡ 自动加入房间...');
                    joinRoom();
                }, 1000);
            }
        } catch (error) {
            console.warn('解析URL参数失败:', error);
        }
    }
    
    // 生成随机房间ID
    function generateRandomRoomId(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'rm_';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // 生成房间密钥（UID）
    function generateRoomKey(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    // 生成邀请链接
    function generateInviteLink(roomId, nickname, includeUid = false) {
        const url = new URL(window.location.href);
        url.search = ''; // 清除原有参数
        url.hash = '';
        
        const params = new URLSearchParams();
        params.set('room', roomId);
        if (nickname) params.set('nick', nickname);
        if (includeUid && window.__ROOM_UID__) {
            params.set('uid', window.__ROOM_UID__);
        }
        
        return `${url.origin}${url.pathname}?${params.toString()}`;
    }
    
    // ============= 消息加密功能 =============
    
    // 将Base64转换为Uint8Array
    function base64ToUint8Array(base64) {
        const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    
    // 将Uint8Array转换为Base64
    function uint8ArrayToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    
    // 导入密钥用于加密/解密
    async function deriveKey(roomKey) {
        try {
            // 将房间密钥转换为原始密钥材料
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                base64ToUint8Array(roomKey).slice(0, 32), // 使用前32字节
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );
            
            // 使用PBKDF2派生AES-GCM密钥
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new TextEncoder().encode('mqtt-room-salt'),
                    iterations: 1000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            return key;
        } catch (error) {
            console.error('密钥派生失败:', error);
            return null;
        }
    }
    
    // 加密消息
    async function encryptMessage(text, roomKey) {
        if (!roomKey) return text; // 如果没有密钥，返回原文
        
        try {
            const key = await deriveKey(roomKey);
            if (!key) return text;
            
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            
            // 生成随机IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // 加密
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );
            
            // 组合IV和加密数据
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // 返回Base64编码的加密数据
            return 'ENC:' + uint8ArrayToBase64(combined);
        } catch (error) {
            console.error('消息加密失败:', error);
            return text;
        }
    }
    
    // 解密消息
    async function decryptMessage(encryptedText, roomKey) {
        if (!roomKey || !encryptedText.startsWith('ENC:')) {
            return encryptedText; // 如果没有密钥或不是加密消息，返回原文
        }
        
        try {
            const key = await deriveKey(roomKey);
            if (!key) return encryptedText;
            
            // 移除前缀并解码Base64
            const combined = base64ToUint8Array(encryptedText.slice(4));
            
            // 分离IV和加密数据
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            // 解密
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            // 返回解密后的文本
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('消息解密失败:', error);
            return '[解密失败]'; // 返回错误提示而不是原文
        }
    }
    
    // 生成房主/管理员令牌
    function generateInviteToken(roomId, role = 'member', expiresIn = 3600) {
        const payload = {
            roomId: roomId,
            role: role, // owner, admin, member
            exp: Date.now() + (expiresIn * 1000),
            nonce: Math.random().toString(36).substr(2)
        };
        
        // 简单的Base64编码（实际应用中应使用JWT）
        return uint8ArrayToBase64(new TextEncoder().encode(JSON.stringify(payload)));
    }
    
    // 验证邀请令牌
    function verifyInviteToken(token) {
        try {
            const payload = JSON.parse(new TextDecoder().decode(base64ToUint8Array(token)));
            
            // 检查是否过期
            if (payload.exp && payload.exp < Date.now()) {
                return null;
            }
            
            return payload;
        } catch (error) {
            console.error('令牌验证失败:', error);
            return null;
        }
    }
    
    // 复制邀请链接到剪贴板
    async function copyInviteLink() {
        const roomId = elements.roomInput?.value?.trim();
        const nickname = elements.nicknameInput?.value?.trim();
        
        if (!roomId) {
            showAlert('请先输入或生成房间号');
            return;
        }
        
        const inviteLink = generateInviteLink(roomId, '访客', true);
        
        try {
            await navigator.clipboard.writeText(inviteLink);
            log('system', '✅ 邀请链接已复制到剪贴板');
            showAlert('邀请链接已复制！\n' + inviteLink);
        } catch (error) {
            showAlert('复制失败，请手动复制：\n' + inviteLink);
        }
    }
    
    function bindEvents() {
        // 主题切换按钮
        if (elements.themeToggleBtn) {
            elements.themeToggleBtn.addEventListener('click', () => toggleTheme());
        }
        
        // 表情按钮
        if (elements.emojiBtn) {
            elements.emojiBtn.addEventListener('click', () => toggleEmojiPicker());
        }
        
        // 点击其他地方关闭表情选择器
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.emoji-btn') && !e.target.closest('.emoji-picker')) {
                toggleEmojiPicker(false);
            }
        });
        
        // 生成随机房间号按钮
        const generateRoomBtn = mountEl.querySelector('#btn-generate-room');
        if (generateRoomBtn) {
            generateRoomBtn.addEventListener('click', () => {
                const randomId = generateRandomRoomId();
                elements.roomInput.value = randomId;
                log('system', `🎲 生成随机房间号: ${randomId}`);
            });
        }
        
        // 复制邀请链接按钮
        const copyInviteBtn = mountEl.querySelector('#btn-copy-invite');
        if (copyInviteBtn) {
            copyInviteBtn.addEventListener('click', () => copyInviteLink());
        }
        
        // 创建房间按钮
        if (elements.createRoomBtn) {
            elements.createRoomBtn.addEventListener('click', () => createRoom());
        }
        
        // 加入房间按钮
        if (elements.joinRoomBtn) {
            elements.joinRoomBtn.addEventListener('click', () => joinRoom());
        }
        
        // 离开按钮
        if (elements.leaveBtn) {
            elements.leaveBtn.addEventListener('click', () => leaveRoom());
        }
        
        // 发送按钮
        if (elements.sendBtn) {
            elements.sendBtn.addEventListener('click', () => sendMessage());
        }
        
        // 回车发送消息
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            
            // 输入时检测表情快捷码
            elements.messageInput.addEventListener('input', (e) => {
                // 检测空格或特定字符触发快捷码替换
                const lastChar = e.data;
                if (lastChar === ' ' || lastChar === null) {
                    checkAndReplaceShortcuts();
                }
            });
        }
        
        // 失去焦点时也检查一次
        if (elements.messageInput) {
            elements.messageInput.addEventListener('blur', () => {
                checkAndReplaceShortcuts();
            });
        }
        
        // 回车快速加入房间
        if (elements.roomInput) {
            elements.roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !isConnected) joinRoom();
            });
        }
        
        if (elements.nicknameInput) {
            elements.nicknameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !isConnected) joinRoom();
            });
        }
        
        // 在线人数点击切换显示用户列表
        if (elements.onlineCountDisplay) {
            elements.onlineCountDisplay.addEventListener('click', () => {
                const isVisible = elements.onlineList.style.display !== 'none';
                elements.onlineList.style.display = isVisible ? 'none' : 'block';
            });
        }
        
        // 刷新房间列表按钮
        const refreshRoomListBtn = mountEl.querySelector('#refresh-room-list');
        if (refreshRoomListBtn) {
            refreshRoomListBtn.addEventListener('click', () => {
                requestRoomList();
                log('system', '🔄 正在刷新房间列表...');
            });
        }
        
        // 清空历史记录按钮
        const clearHistoryBtn = mountEl.querySelector('.history-clear-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有房间历史记录吗？')) {
                    roomHistory = [];
                    saveRoomHistory();
                    updateRoomHistoryDisplay();
                }
            });
        }
        
        // 搜索功能
        const searchInput = mountEl.querySelector('#room-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                updateRoomHistoryDisplay(searchTerm);
            });
        }
        
        // 导出功能
        const exportBtn = mountEl.querySelector('.history-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportRoomHistory();
            });
        }
        
        // 导入功能
        const importBtn = mountEl.querySelector('.history-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        importRoomHistory(file);
                    }
                };
                input.click();
            });
        }
        
        // 页面可见性变化处理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && isConnected) {
                log('system', '📱 页面已隐藏，连接保持中...');
            } else if (!document.hidden && client && !isConnected) {
                log('system', '📱 页面已显示');
            }
        });
    }
    
    async function getRoomUserCount(roomId) {
        // 从localStorage获取房间用户统计
        const roomStats = JSON.parse(localStorage.getItem(`room_stats_${roomId}`) || '{"users": [], "lastUpdate": 0}');
        
        // 清理超过5分钟没有活动的用户
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        roomStats.users = roomStats.users.filter(user => user.lastSeen > fiveMinutesAgo);
        
        // 保存清理后的统计
        localStorage.setItem(`room_stats_${roomId}`, JSON.stringify(roomStats));
        
        return roomStats.users.length;
    }
    
    function updateRoomUserCount(roomId, username, action = 'join') {
        const roomStats = JSON.parse(localStorage.getItem(`room_stats_${roomId}`) || '{"users": [], "lastUpdate": 0}');
        const now = Date.now();
        
        if (action === 'join') {
            // 添加用户或更新最后在线时间
            const existingUserIndex = roomStats.users.findIndex(u => u.name === username);
            if (existingUserIndex >= 0) {
                roomStats.users[existingUserIndex].lastSeen = now;
            } else {
                roomStats.users.push({ name: username, lastSeen: now });
            }
        } else if (action === 'leave') {
            // 移除用户
            roomStats.users = roomStats.users.filter(u => u.name !== username);
        } else if (action === 'ping') {
            // 更新心跳时间
            const userIndex = roomStats.users.findIndex(u => u.name === username);
            if (userIndex >= 0) {
                roomStats.users[userIndex].lastSeen = now;
            }
        }
        
        roomStats.lastUpdate = now;
        localStorage.setItem(`room_stats_${roomId}`, JSON.stringify(roomStats));
        
        // 发布房间用户数更新到全局房间列表
        if (roomListClient && roomListClient.connected) {
            roomListClient.publish(globalRoomsTopic, JSON.stringify({
                type: 'room_update',
                roomId: roomId,
                update: {
                    userCount: roomStats.users.length
                },
                timestamp: now
            }));
        }
        
        return roomStats.users.length;
    }

    async function validateRoomAccess(roomId) {
        const config = loadRoomConfig(roomId);
        
        // 如果是房间创建者，直接允许进入
        const isCreator = config.createdBy === nickname;
        if (isCreator) {
            return { allowed: true };
        }
        
        // 检查密码保护
        if (config.hasPassword && config.password) {
            const passwordInput = mountEl.querySelector('.room-password-input');
            if (!passwordInput) {
                return { allowed: false, message: '此房间需要密码！请输入密码。' };
            }
            
            const enteredPassword = passwordInput.value.trim();
            if (!enteredPassword) {
                return { allowed: false, message: '此房间需要密码，请在下方输入密码！' };
            }
            
            if (enteredPassword !== config.password) {
                return { allowed: false, message: '房间密码错误！' };
            }
        }
        
        // 检查人数限制
        if (config.maxUsers > 0) {
            // 获取当前房间用户数（不包括即将加入的用户）
            const currentUserCount = await getRoomUserCount(roomId);
            if (currentUserCount >= config.maxUsers) {
                return { allowed: false, message: `房间已满！当前人数 ${currentUserCount}/${config.maxUsers}` };
            }
        }
        
        return { allowed: true };
    }

    // 创建房间
    async function createRoom() {
        roomId = elements.roomInput.value.trim();
        nickname = elements.nicknameInput.value.trim();
        
        if (!roomId || !nickname) {
            showAlert('请输入房间号和昵称！');
            return;
        }
        
        // 检查昵称长度
        if (nickname.length > 20) {
            showAlert('昵称不能超过20个字符！');
            return;
        }
        
        // 检查房间号格式
        if (!/^[a-zA-Z0-9\-_]+$/.test(roomId)) {
            showAlert('房间号只能包含字母、数字、横线和下划线！');
            return;
        }
        
        try {
            // 创建房间配置
            createRoomConfig(roomId);
            
            // 连接到房间
            await connectToMqttRoom();
            
        } catch (error) {
            showAlert(error.message);
        }
    }
    
    // 加入房间
    async function joinRoom() {
        roomId = elements.roomInput.value.trim();
        nickname = elements.nicknameInput.value.trim();
        
        if (!roomId || !nickname) {
            showAlert('请输入房间号和昵称！');
            return;
        }
        
        // 检查昵称长度
        if (nickname.length > 20) {
            showAlert('昵称不能超过20个字符！');
            return;
        }
        
        // 检查房间号格式
        if (!/^[a-zA-Z0-9\-_]+$/.test(roomId)) {
            showAlert('房间号只能包含字母、数字、横线和下划线！');
            return;
        }
        
        // 尝试加载房间配置（如果本地存在）
        const localConfig = loadRoomConfig(roomId);
        
        // 如果有从URL传入的UID，使用它作为房间密钥
        if (window.__ROOM_UID__ && localConfig) {
            localConfig.roomKey = window.__ROOM_UID__;
            log('system', '🔑 使用邀请链接中的房间密钥');
        }
        
        // 检查是否有邀请令牌（房主/管理员免密）
        let skipPasswordCheck = false;
        if (window.__INVITE_TOKEN__) {
            const tokenData = window.__INVITE_TOKEN__;
            if (tokenData.roomId === roomId) {
                skipPasswordCheck = true;
                log('system', `✅ 使用${tokenData.role === 'owner' ? '房主' : '管理员'}令牌免密进入`);
                
                // 如果是房主或管理员令牌，更新本地权限
                if (localConfig) {
                    if (tokenData.role === 'owner' && !localConfig.createdBy) {
                        localConfig.createdBy = nickname;
                    }
                    if (!localConfig.adminUsers.includes(nickname)) {
                        localConfig.adminUsers.push(nickname);
                    }
                }
            }
        }
        
        if (!skipPasswordCheck && localConfig && localConfig.isPrivate && localConfig.password) {
            // 显示密码输入框
            const passwordInputGroup = mountEl.querySelector('.password-input-group');
            if (passwordInputGroup) {
                passwordInputGroup.style.display = 'flex';
            }
            
            // 获取用户输入的密码
            const passwordInput = mountEl.querySelector('.room-password-input');
            const inputPassword = passwordInput ? passwordInput.value.trim() : '';
            
            // 如果有本地配置且需要密码，进行验证
            const accessResult = validateRoomAccess(roomId, inputPassword);
            if (!accessResult) {
                return;
            }
        }
        
        try {
            // 尝试加载房间配置（如果本地不存在，使用默认配置）
            if (!loadRoomConfig(roomId)) {
                // 如果本地没有配置，创建基础配置以便连接
                roomConfig = { ...defaultRoomConfig };
                roomConfig.roomId = roomId;
                roomConfig.isLocallyCreated = false; // 标记为外部房间
                // 对于外部房间，作为普通用户加入，真实权限需要从服务器获取
                log('system', `正在连接到外部房间: ${roomId}`);
            }
            
            // 连接到房间
            await connectToMqttRoom();
            
        } catch (error) {
            showAlert(error.message);
        }
    }

    // 连接到MQTT房间的核心函数
    async function connectToMqttRoom() {
        // 如果已经连接，先断开
        if (client && isConnected) {
            await leaveRoom();
        }
        
        messageTopic = `game/${roomId}/messages`;
        presenceTopic = `game/${roomId}/presence`;
        
        updateStatus('connecting', '🔄 连接中...');
        updateConnectionStatus('connecting');
        log('system', `正在连接到房间: ${roomId}`);
        clearMessages();
        
        try {
            const currentBrokerUrl = brokerUrls[currentBrokerIndex];
            const options = {
                clientId: `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
                clean: true,
                connectTimeout: 8000,
                reconnectPeriod: 3000,
                // Last Will 遗嘱消息
                will: {
                    topic: presenceTopic,
                    payload: JSON.stringify({
                        type: 'leave',
                        name: nickname,
                        timestamp: Date.now()
                    }),
                    qos: 0,
                    retain: false
                }
            };
            
            client = mqtt.connect(currentBrokerUrl, options);
            
            client.on('connect', () => {
                isConnected = true;
                updateStatus('connected', '✅ 已连接');
                updateConnectionStatus('connected');
                log('system', `已加入房间: ${roomId}`);
                
                // 清空之前的在线用户列表，然后添加自己
                clearOnlineUsers();
                addOnlineUser(nickname);
                
                const adminTopic = `game/${roomId}/admin`;
                const moderationTopic = `game/${roomId}/moderation`;
                
                client.subscribe([messageTopic, presenceTopic, adminTopic, moderationTopic], (err) => {
                    if (!err) {
                        publishPresence('join');
                        updateUI(true);
                        // 添加房间到历史记录
                        addToRoomHistory(roomId, nickname);
                        // 加载历史聊天记录
                        loadChatHistoryToUI(roomId);
                        
                        // 如果是外部房间，保存基础配置到本地
                        if (roomConfig && roomConfig.isLocallyCreated === false) {
                            saveBasicRoomConfig(roomId, nickname);
                        }
                        
                        // 检查管理员权限
                        checkAdminPrivileges();
                        
                        // 强制更新在线用户显示，确保管理员UI正确显示
                        setTimeout(() => {
                            updateOnlineUsersDisplay();
                        }, 500);
                        
                        // 启动心跳定时器，每30秒更新一次在线状态
                        heartbeatInterval = setInterval(() => {
                            if (isConnected && roomId) {
                                updateRoomUserCount(roomId, nickname, 'ping');
                            }
                        }, 30000);
                    } else {
                        log('system', '订阅失败: ' + err.message);
                    }
                });
            });
            
            client.on('message', (topic, message) => {
                handleMessage(topic, message.toString());
            });
            
            client.on('reconnect', () => {
                log('system', '🔄 自动重连中...');
                updateConnectionStatus('connecting');
            });
            
            client.on('close', () => {
                log('system', '🔌 连接断开');
                if (isConnected) {
                    isConnected = false;
                    updateStatus('disconnected', '📴 已断开');
                    updateConnectionStatus('disconnected');
                    updateUI(false);
                    clearOnlineUsers(); // 清空在线用户列表
                }
            });
            
            client.on('error', (err) => {
                console.error('MQTT连接错误:', err);
                log('system', `❌ 连接失败: ${err.message}`);
                
                // 尝试切换到备选服务器
                if (currentBrokerIndex < brokerUrls.length - 1) {
                    currentBrokerIndex++;
                    updateBrokerDisplay();
                    log('system', `🔄 切换到备选服务器，重新连接...`);
                    setTimeout(() => {
                        if (client) {
                            client.end();
                        }
                        connectRoom();
                    }, 2000);
                } else {
                    updateStatus('disconnected', '❌ 连接失败');
                    updateConnectionStatus('disconnected');
                    updateUI(false);
                    clearOnlineUsers(); // 清空在线用户列表
                    // 重置服务器索引为下次连接做准备
                    currentBrokerIndex = 0;
                    updateBrokerDisplay();
                }
            });
            
        } catch (error) {
            log('system', `连接异常: ${error.message}`);
            updateStatus('disconnected', '❌ 连接异常');
            updateConnectionStatus('disconnected');
        }
    }
    
    function leaveRoom() {
        return new Promise((resolve) => {
            if (client) {
                try {
                    if (isConnected) {
                        // 发送离开消息
                        publishPresence('leave');
                        // 更新用户计数
                        updateRoomUserCount(roomId, nickname, 'leave');
                        
                        // 如果是房主离开，发布房间关闭消息
                        if (roomConfig && roomConfig.createdBy === nickname) {
                            publishRoomClosed(roomId);
                            log('system', '房主离开，房间将关闭...');
                        }
                        
                        log('system', '正在离开房间...');
                    }
                    
                    // 清除心跳定时器
                    if (heartbeatInterval) {
                        clearInterval(heartbeatInterval);
                        heartbeatInterval = null;
                    }
                    
                    // 强制断开连接
                    client.end(true); // 强制立即断开
                    client = null;
                    isConnected = false;
                    
                    // 更新界面状态
                    updateStatus('disconnected', '📴 已离开');
                    updateConnectionStatus('disconnected');
                    updateUI(false);
                    log('system', '已离开房间');
                    
                    // 清空在线用户列表
                    clearOnlineUsers();
                    
                    // 重置服务器索引
                    currentBrokerIndex = 0;
                    updateBrokerDisplay();
                    
                    console.log('MQTT房间离开完成');
                    resolve();
                } catch (error) {
                    console.error('离开房间时发生错误:', error);
                    // 确保状态重置
                    client = null;
                    isConnected = false;
                    updateStatus('disconnected', '❌ 离开异常');
                    updateConnectionStatus('disconnected');
                    updateUI(false);
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }
    
    function sendMessage() {
        const text = elements.messageInput.value.trim();
        if (!text) return;
        
        if (!isConnected || !client) {
            showAlert('未连接到聊天室，无法发送消息');
            return;
        }
        
        // 检查消息长度
        if (text.length > 500) {
            showAlert('消息长度不能超过500个字符');
            return;
        }
        
        // 根据当前聊天类型发送消息
        if (currentChatType === 'private' && currentPrivateUser) {
            // 发送私聊消息
            sendPrivateMessage(currentPrivateUser, text);
            elements.messageInput.value = '';
            return;
        }
        
        try {
            const message = {
                type: 'chat',
                name: nickname,
                text: text,
                timestamp: Date.now()
            };
            
            // 如果有房间密钥，加密消息
            const roomKey = window.__ROOM_UID__ || (roomConfig && roomConfig.roomKey);
            if (roomKey) {
                // 加密消息内容
                encryptMessage(JSON.stringify(message), roomKey).then(encrypted => {
                    client.publish(messageTopic, encrypted, (err) => {
                        if (err) {
                            console.error('消息发送失败:', err);
                            log('system', '❌ 消息发送失败');
                        } else {
                            log('system', '🔒 已发送加密消息');
                        }
                    });
                });
            } else {
                // 无密钥时发送明文（向后兼容）
                client.publish(messageTopic, JSON.stringify(message), (err) => {
                    if (err) {
                        console.error('消息发送失败:', err);
                        log('system', '❌ 消息发送失败');
                    }
                });
            }
            
            elements.messageInput.value = '';
        } catch (error) {
            console.error('发送消息时发生错误:', error);
            log('system', '❌ 消息发送异常');
        }
    }
    
    function sendTextMessage(text) {
        if (!text || !isConnected || !client) return false;
        
        // 检查消息长度
        if (text.length > 500) {
            console.warn('API调用：消息长度超出限制');
            return false;
        }
        
        try {
            const message = {
                type: 'chat',
                name: nickname,
                text: text,
                timestamp: Date.now()
            };
            
            client.publish(messageTopic, JSON.stringify(message), (err) => {
                if (err) {
                    console.error('API调用消息发送失败:', err);
                }
            });
            
            return true;
        } catch (error) {
            console.error('API调用发送消息异常:', error);
            return false;
        }
    }
    
    function publishPresence(type) {
        if (!client || !isConnected) return;
        
        const presence = {
            type: type,
            name: nickname,
            timestamp: Date.now()
        };
        
        client.publish(presenceTopic, JSON.stringify(presence));
    }
    
    async function handleMessage(topic, message) {
        try {
            let data;
            const roomKey = window.__ROOM_UID__ || (roomConfig && roomConfig.roomKey);
            
            // 尝试解密消息
            if (roomKey && message.startsWith('ENC:')) {
                const decrypted = await decryptMessage(message, roomKey);
                if (decrypted === '[解密失败]') {
                    log('system', '⚠️ 收到加密消息但解密失败，可能密钥不匹配');
                    return;
                }
                data = JSON.parse(decrypted);
            } else {
                // 尝试解析为JSON（向后兼容明文消息）
                try {
                    data = JSON.parse(message);
                } catch (e) {
                    // 如果不是JSON，可能是加密消息但我们没有密钥
                    if (message.startsWith('ENC:')) {
                        log('system', '🔒 收到加密消息，但缺少房间密钥');
                        return;
                    }
                    throw e;
                }
            }
            
            if (topic === messageTopic && data.type === 'chat') {
                const isOwnMessage = data.name === nickname;
                addChatMessage(data.name, data.text, data.timestamp, isOwnMessage);
            } else if (topic === presenceTopic) {
                // 处理用户加入/离开的presence消息
                if (data.type === 'join') {
                    addOnlineUser(data.name);
                    updateRoomUserCount(roomId, data.name, 'join');
                    if (data.name !== nickname) {
                        log('presence', `${data.name} 加入了房间`, data.timestamp);
                    }
                } else if (data.type === 'leave') {
                    removeOnlineUser(data.name);
                    updateRoomUserCount(roomId, data.name, 'leave');
                    if (data.name !== nickname) {
                        log('presence', `${data.name} 离开了房间`, data.timestamp);
                    }
                }
            } else if (topic.includes('/private/') && data.type === 'private') {
                // 处理私聊消息
                if (data.receiver === nickname && data.sender !== nickname) {
                    // 收到别人发给我的私聊消息
                    if (currentChatType === 'private' && currentPrivateUser === data.sender) {
                        // 当前正在与发送者私聊，直接显示
                        addChatMessage(data.sender, data.text, data.timestamp, false);
                    } else {
                        // 当前不在私聊界面或在与其他人私聊，显示通知
                        log('system', `💬 ${data.sender} 发来私聊消息`);
                    }
                    
                    // 保存私聊消息
                    savePrivateMessage(data.sender, data);
                }
            } else if (topic.includes('/admin') && data.type) {
                // 处理管理员相关消息
                handleAdminMessage(data);
            } else if (topic.includes('/moderation') && data.type) {
                // 处理管理操作消息
                handleModerationMessage(data);
            }
        } catch (error) {
            log('system', `消息解析错误: ${error.message}`);
        }
    }
    
    function handleAdminMessage(data) {
        if (data.type === 'admin_added') {
            log('system', `👑 ${data.admin} 被 ${data.by} 设为管理员`);
            if (data.admin === nickname) {
                // 刷新自己的管理员状态
                loadRoomConfig(roomId);
                checkAdminPrivileges();
            }
        } else if (data.type === 'admin_removed') {
            log('system', `🚫 ${data.admin} 的管理员权限被 ${data.by} 移除`);
            if (data.admin === nickname) {
                // 刷新自己的管理员状态
                isRoomAdmin = false;
                log('system', '⚠️ 您的管理员权限已被移除');
            }
        }
    }
    
    function handleModerationMessage(data) {
        if (data.type === 'user_kicked') {
            if (data.user === nickname) {
                // 自己被踢出
                log('system', `🚫 您被管理员 ${data.by} 踢出房间: ${data.reason}`);
                setTimeout(() => {
                    leaveRoom();
                }, 2000);
            } else {
                log('system', `🚫 ${data.user} 被管理员 ${data.by} 踢出房间: ${data.reason}`);
                removeOnlineUser(data.user);
            }
        }
    }
    
    function addChatMessage(user, text, timestamp, isOwnMessage = false) {
        // 保存聊天记录
        const messageData = {
            user: user,
            text: text,
            timestamp: timestamp,
            isOwnMessage: isOwnMessage
        };
        addToChatHistory(roomId, messageData);
        
        // 使用 requestAnimationFrame 优化DOM操作，避免界面卡顿
        requestAnimationFrame(() => {
            const messageEl = document.createElement('div');
            messageEl.className = `message chat ${isOwnMessage ? 'own-message' : ''}`;

            const time = formatMessageTime(timestamp);

            // 限制消息数量，避免DOM元素过多导致卡顿
            if (elements.messages.children.length > 200) {
                elements.messages.removeChild(elements.messages.firstChild);
            }

            if (isOwnMessage) {
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${escapeHtml(text)}</div>
                `;
            } else {
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="user-name">${escapeHtml(user)}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${escapeHtml(text)}</div>
                `;
            }

            elements.messages.appendChild(messageEl);
            scrollToBottom();
        });
    }
    
    function log(type, message, timestamp = Date.now()) {
        // 使用 requestAnimationFrame 优化DOM操作
        requestAnimationFrame(() => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${type}`;
            
            const time = new Date(timestamp).toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // 限制消息数量
            if (elements.messages.children.length > 200) {
                elements.messages.removeChild(elements.messages.firstChild);
            }
            
            messageEl.innerHTML = `<span class="timestamp">[${time}]</span> ${escapeHtml(message)}`;
            
            elements.messages.appendChild(messageEl);
            scrollToBottom();
        });
    }
    
    function clearMessages() {
        elements.messages.innerHTML = '';
    }
    
    // 防抖滚动函数，避免频繁滚动造成卡顿
    let scrollTimeout = null;
    function scrollToBottom() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            if (elements.messages) {
                elements.messages.scrollTop = elements.messages.scrollHeight;
            }
            scrollTimeout = null;
        }, 50); // 50ms防抖延迟
    }
    
    function updateStatus(type, message) {
        elements.statusDisplay.className = `status-display status ${type}`;
        elements.statusDisplay.textContent = message;
    }
    
    function updateConnectionStatus(status) {
        elements.connectionStatus.className = `connection-status ${status}`;
        const statusText = {
            'connected': '已连接',
            'connecting': '连接中',
            'disconnected': '未连接'
        };
        elements.connectionStatus.textContent = statusText[status] || '未知';
    }
    
    function updateBrokerDisplay() {
        const currentUrl = brokerUrls[currentBrokerIndex];
        const brokerName = currentUrl.includes('mosquitto') ? 'test.mosquitto.org' : 'broker.hivemq.com';
        elements.currentBroker.textContent = brokerName;
    }
    
    // 更新在线用户显示
    function updateOnlineUsersDisplay() {
        const count = onlineUsers.size;
        elements.onlineCount.textContent = count;
        
        // 清空当前用户列表
        elements.onlineListContent.innerHTML = '';
        
        // 如果有在线用户，显示用户列表
        if (count > 0) {
            onlineUsers.forEach(user => {
                const userEl = document.createElement('div');
                userEl.className = 'online-user';
                
                // 检查是否为管理员
                const isUserAdmin = roomConfig && roomConfig.adminUsers && roomConfig.adminUsers.includes(user);
                
                // 如果是当前用户，添加特殊样式
                if (user === nickname) {
                    userEl.style.background = isUserAdmin ? '#fff3cd' : '#e8f5e8';
                    userEl.style.color = isUserAdmin ? '#856404' : '#2e7d32';
                    userEl.style.fontWeight = 'bold';
                    userEl.textContent = user + (isUserAdmin ? ' 👑 (我)' : ' (我)');
                } else {
                    // 为其他用户添加私聊按钮
                    const userNameSpan = document.createElement('span');
                    userNameSpan.textContent = user + (isUserAdmin ? ' 👑' : '');
                    if (isUserAdmin) {
                        userNameSpan.style.color = '#856404';
                        userNameSpan.style.fontWeight = 'bold';
                    }
                    
                    const buttonContainer = document.createElement('span');
                    buttonContainer.className = 'user-actions';
                    
                    // 私聊按钮
                    const privateChatBtn = document.createElement('button');
                    privateChatBtn.className = 'private-chat-btn';
                    privateChatBtn.title = `与 ${user} 私聊`;
                    privateChatBtn.innerHTML = '💬';
                    privateChatBtn.onclick = () => startPrivateChat(user);
                    buttonContainer.appendChild(privateChatBtn);
                    
                    // 管理员专用按钮
                    if (isRoomAdmin && !isUserAdmin) {
                        // 设为管理员按钮
                        const makeAdminBtn = document.createElement('button');
                        makeAdminBtn.className = 'admin-action-btn';
                        makeAdminBtn.title = `设 ${user} 为管理员`;
                        makeAdminBtn.innerHTML = '👑';
                        makeAdminBtn.onclick = () => addAdmin(user);
                        buttonContainer.appendChild(makeAdminBtn);
                        
                        // 踢出用户按钮
                        const kickBtn = document.createElement('button');
                        kickBtn.className = 'kick-btn';
                        kickBtn.title = `踢出 ${user}`;
                        kickBtn.innerHTML = '🚫';
                        kickBtn.onclick = () => {
                            const reason = prompt(`踢出用户 ${user} 的理由:`, '违反房间规则');
                            if (reason !== null) {
                                kickUser(user, reason);
                            }
                        };
                        buttonContainer.appendChild(kickBtn);
                    } else if (isRoomAdmin && isUserAdmin && user !== roomConfig.createdBy) {
                        // 移除管理员权限按钮
                        const removeAdminBtn = document.createElement('button');
                        removeAdminBtn.className = 'remove-admin-btn';
                        removeAdminBtn.title = `移除 ${user} 的管理员权限`;
                        removeAdminBtn.innerHTML = '👤';
                        removeAdminBtn.onclick = () => {
                            if (confirm(`确定要移除 ${user} 的管理员权限吗？`)) {
                                removeAdmin(user);
                            }
                        };
                        buttonContainer.appendChild(removeAdminBtn);
                    }
                    
                    userEl.appendChild(userNameSpan);
                    userEl.appendChild(buttonContainer);
                }
                
                elements.onlineListContent.appendChild(userEl);
            });
            
            // 如果在线人数大于0且用户列表当前显示，保持显示状态
            if (elements.onlineList.style.display === 'block') {
                elements.onlineList.style.display = 'block';
            }
        } else {
            // 如果没有在线用户，隐藏用户列表
            elements.onlineList.style.display = 'none';
        }
    }
    
    // 添加在线用户
    function addOnlineUser(username) {
        if (username && username.trim()) {
            onlineUsers.add(username);
            userJoinTimes.set(username, Date.now());
            updateOnlineUsersDisplay();
        }
    }
    
    // 移除在线用户
    function removeOnlineUser(username) {
        if (username && onlineUsers.has(username)) {
            onlineUsers.delete(username);
            userJoinTimes.delete(username);
            updateOnlineUsersDisplay();
        }
    }
    
    // 清空在线用户列表
    function clearOnlineUsers() {
        onlineUsers.clear();
        userJoinTimes.clear();
        updateOnlineUsersDisplay();
    }
    
    function updateUI(connected) {
        // 禁用/启用房间连接按钮
        if (elements.createRoomBtn) elements.createRoomBtn.disabled = connected;
        if (elements.joinRoomBtn) elements.joinRoomBtn.disabled = connected;
        
        // 禁用/启用聊天相关按钮
        if (elements.leaveBtn) elements.leaveBtn.disabled = !connected;
        if (elements.messageInput) elements.messageInput.disabled = !connected;
        if (elements.sendBtn) elements.sendBtn.disabled = !connected;
        if (elements.emojiBtn) elements.emojiBtn.disabled = !connected;
        
        // 禁用/启用房间输入框
        if (elements.roomInput) elements.roomInput.disabled = connected;
        if (elements.nicknameInput) elements.nicknameInput.disabled = connected;
        
        if (connected && elements.messageInput) {
            elements.messageInput.focus();
        }
    }
    
    // 初始化UI
    createUI();
    
    // 初始化全局房间列表
    initGlobalRoomList();
    
    // 返回控制接口
    const appInstance = {
        /**
         * 连接到指定房间
         * @param {string} room 房间号（可选，不传则使用UI中的值）
         */
        connect(room) {
            if (room) {
                elements.roomInput.value = room;
            }
            connectRoom();
        },
        
        /**
         * 离开当前房间
         */
        leave() {
            leaveRoom();
        },
        
        /**
         * 发送文本消息
         * @param {string} text 要发送的文本
         * @returns {boolean} 是否发送成功
         */
        sendText(text) {
            return sendTextMessage(text);
        }
    };
    
    // 将实例保存到全局，以便main.js可以访问
    window.currentMqttRoomApp = appInstance;
    
    return appInstance;
}

// 导出模块（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = createMqttRoomApp;
}