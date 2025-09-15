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
    
    // 检测PWA模式
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                 window.matchMedia('(display-mode: fullscreen)').matches ||
                 window.navigator.standalone ||
                 document.referrer.includes('android-app://');
    
    // 检测iPhone
    const isIPhone = /iPhone/.test(navigator.userAgent) && !window.MSStream;
    
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
    
    // 房间类型定义
    const ROOM_TYPES = {
        CASUAL: 'casual',      // 临时房间（简单快速，旧模式）
        REGISTERED: 'registered'  // 正式房间（需要注册，有唯一房主）
    };
    
    // 默认房间配置
    const defaultRoomConfig = {
        maxUsers: 20,              // 最大用户数
        password: '',              // 房间密码
        isPrivate: false,          // 是否私密房间
        category: 'chat',          // 房间分类: chat, game, ai, private
        roomType: ROOM_TYPES.CASUAL,  // 房间类型
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
        const themeBtn = elements.themeToggleBtn || mountEl.querySelector('#theme-toggle-btn');

        if (!mqttScreen) {
            console.warn('MQTT: 找不到.mqtt-room-screen元素');
            return;
        }

        // 移除所有主题类
        mqttScreen.classList.remove('light-theme', 'dark-theme');
        // 同时移除可能存在的data-theme属性
        mqttScreen.removeAttribute('data-theme');
        
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

        // 更新全局主题色以匹配MQTT主题
        if (window.Utils && typeof window.Utils.updateThemeColor === 'function') {
            // 延迟执行以确保主题已应用
            setTimeout(() => {
                window.Utils.updateThemeColor('mqtt-room-screen');
            }, 50);
        }

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
        
        // 绑定密码保护复选框（创建房间时）
        const privateRoomCheckbox = mountEl.querySelector('#private-room-checkbox');
        const passwordCreateInput = mountEl.querySelector('.room-password-create');
        const savePasswordBtn = mountEl.querySelector('#save-password-btn');

        if (privateRoomCheckbox && passwordCreateInput) {
            const passwordCreateGroup = mountEl.querySelector('.password-create-group');

            privateRoomCheckbox.addEventListener('change', () => {
                const isPrivate = privateRoomCheckbox.checked;
                if (passwordCreateGroup) {
                    passwordCreateGroup.style.display = isPrivate ? 'flex' : 'none';
                }

                if (!isPrivate) {
                    passwordCreateInput.value = '';
                    // 清除保存的密码
                    if (savePasswordBtn) {
                        delete savePasswordBtn.dataset.savedPassword;
                        savePasswordBtn.textContent = '保存';
                        savePasswordBtn.style.background = '';
                    }
                } else {
                    // 自动聚焦到密码输入框
                    passwordCreateInput.focus();
                }

                // 如果房间已存在，更新配置
                if (roomConfig && roomConfig.roomId) {
                    roomConfig.isPrivate = isPrivate;
                    if (!isPrivate) {
                        roomConfig.password = '';
                        roomConfig.hasPassword = false;
                    }
                }
            });

            // 监听密码输入框变化，重置保存按钮状态
            passwordInput.addEventListener('input', () => {
                if (savePasswordBtn) {
                    savePasswordBtn.textContent = '保存';
                    savePasswordBtn.style.background = '';
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

                    // 暂存密码到按钮的data属性，等创建房间时使用
                    savePasswordBtn.dataset.savedPassword = password;
                    savePasswordBtn.textContent = '已保存';
                    savePasswordBtn.style.background = '#28a745';

                    showAlert('密码已暂存，创建房间时将自动应用！');

                    // 如果房间已存在，更新房间配置
                    if (roomConfig && roomConfig.roomId) {
                        roomConfig.password = password;
                        roomConfig.hasPassword = true;
                        roomConfig.isPrivate = true;
                        saveRoomConfig();
                        log('system', '✅ 已更新当前房间密码');
                    }
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

        // 优先使用创建房间时的密码输入框，否则使用加入房间时的密码输入框
        const passwordCreateInput = mountEl.querySelector('.room-password-create');
        const passwordInput = mountEl.querySelector('.room-password-input');

        if (passwordCreateInput && roomConfig.isPrivate) {
            roomConfig.password = passwordCreateInput.value.trim();
        } else if (passwordInput && roomConfig.isPrivate) {
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
    
    // 保存指定房间的配置
    function saveRoomConfigForRoom(targetRoomId, config) {
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            roomConfigs[targetRoomId] = config;
            localStorage.setItem('mqtt_room_configs', JSON.stringify(roomConfigs));
            return true;
        } catch (error) {
            console.warn('保存房间配置失败:', error);
            return false;
        }
    }

    function loadRoomConfig(targetRoomId) {
        try {
            const roomConfigs = JSON.parse(localStorage.getItem('mqtt_room_configs') || '{}');
            if (roomConfigs[targetRoomId]) {
                // 不要直接修改全局 roomConfig，只返回配置
                return { ...defaultRoomConfig, ...roomConfigs[targetRoomId] };
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
    
    // 创建新房间配置（临时房间）
    function createRoomConfig(targetRoomId, roomType = ROOM_TYPES.CASUAL) {
        // 临时房间：不检查是否存在，允许多人"创建"同一房间
        // 但只有第一个创建者是真正的房主

        roomConfig = { ...defaultRoomConfig };
        roomConfig.createdBy = nickname;
        roomConfig.adminUsers = [nickname];
        roomConfig.createdAt = Date.now();
        roomConfig.roomId = targetRoomId;
        roomConfig.roomType = roomType;

        // 从UI读取房间设置
        const privateCheckbox = mountEl.querySelector('#private-room-checkbox');
        const maxUsersSelect = mountEl.querySelector('#max-users-select');
        const categorySelect = mountEl.querySelector('#room-category-select');
        const passwordCreateInput = mountEl.querySelector('.room-password-create');

        // 应用设置
        if (privateCheckbox && privateCheckbox.checked) {
            roomConfig.isPrivate = true;
            roomConfig.hasPassword = true;
            if (passwordCreateInput) {
                // 优先使用当前输入的密码，如果为空则使用保存的密码
                let password = passwordCreateInput.value.trim();
                const saveBtn = mountEl.querySelector('#save-password-btn');

                // 如果输入框为空但有保存的密码，使用保存的
                if (!password && saveBtn && saveBtn.dataset.savedPassword) {
                    password = saveBtn.dataset.savedPassword;
                    log('system', '使用已保存的密码');
                }

                if (password.length >= 3) {
                    roomConfig.password = password;
                    log('system', `🔒 房间已设置密码保护（密码：${password}）`);
                } else {
                    showAlert('密码长度至少3个字符！将创建无密码房间。');
                    roomConfig.isPrivate = false;
                    roomConfig.hasPassword = false;
                    roomConfig.password = '';
                    // 取消勾选密码保护
                    privateCheckbox.checked = false;
                }
            }
        } else {
            // 确保不勾选时清除密码设置
            roomConfig.isPrivate = false;
            roomConfig.hasPassword = false;
            roomConfig.password = '';
        }

        if (maxUsersSelect) {
            roomConfig.maxUsers = parseInt(maxUsersSelect.value) || 20;
        }

        if (categorySelect) {
            roomConfig.category = categorySelect.value || 'chat';
        }

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
        
        // 显示房间类型和提示
        if (roomType === ROOM_TYPES.CASUAL) {
            log('system', '💡 提示: 临时房间任何人都可以通过房间号加入');
            log('system', '⚠️ 注意: 只有您（房主）才有管理权限');
        } else {
            // 正式房间：生成特殊邀请链接
            const ownerToken = generateInviteToken(targetRoomId, 'owner', 7200);
            const adminToken = generateInviteToken(targetRoomId, 'admin', 3600);
            const memberLink = generateInviteLink(targetRoomId, '访客', true);
            
            log('system', `🔗 普通邀请链接: ${memberLink}`);
            log('system', `👑 房主邀请链接: ${generateInviteLink(targetRoomId, '房主', true)}&token=${ownerToken}`);
            log('system', `⭐ 管理员邀请链接: ${generateInviteLink(targetRoomId, '管理员', true)}&token=${adminToken}`);
            log('system', '💡 提示: 房主和管理员链接可免密进入房间');
        }
        
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
        
        // 根据房间类型检查权限
        if (roomConfig.roomType === ROOM_TYPES.REGISTERED) {
            // 正式房间：严格权限控制
            const isOwner = roomConfig.createdBy === nickname;
            const isAdmin = roomConfig.adminUsers && roomConfig.adminUsers.includes(nickname);
            isRoomAdmin = isOwner || isAdmin;
            
            if (isOwner) {
                log('system', '👑 您是正式房间的房主，拥有完全管理权限');
            } else if (isAdmin) {
                log('system', '⭐ 您是正式房间的管理员');
            } else {
                log('debug', '👤 您是正式房间的访客，无管理权限');
            }
        } else {
            // 临时房间：保持原有逻辑
            isRoomAdmin = roomConfig.adminUsers && roomConfig.adminUsers.includes(nickname);
            
            if (isRoomAdmin) {
                const isOwner = roomConfig.createdBy === nickname;
                if (isOwner) {
                    log('system', '👑 您是临时房间创建者，拥有完全管理权限');
                } else {
                    log('system', '👑 您拥有管理员权限');
                }
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
        // 添加PWA相关类名
        const pwaClass = isPWA ? 'pwa-mode' : '';
        const iphoneClass = isPWA && isIPhone ? 'iphone-pwa' : '';
        
        mountEl.innerHTML = `
            <div class="mqtt-room-screen ${pwaClass} ${iphoneClass}">
                <header class="mqtt-header">
                    <button id="mqtt-back-btn" class="back-btn">‹</button>
                    <h2>MQTT聊天室</h2>
                    <div class="header-controls">
                        <button id="room-settings-btn" class="room-settings-btn" title="房间设置" style="display: none;">⚙️</button>
                        <button id="theme-toggle-btn" class="theme-toggle-btn" title="切换主题">🌙</button>
                        <div class="connection-status" id="mqtt-status">未连接</div>
                    </div>
                </header>
                
                <div class="mqtt-content">
                    <div class="room-section">
                        <!-- 房间模式选择标签 -->
                        <div class="room-mode-tabs" style="display: flex; gap: 8px; margin-bottom: 12px;">
                            <button class="mode-tab active" data-mode="join" id="mode-tab-join" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--primary-color); color: white; cursor: pointer; transition: all 0.3s;">
                                🚪 加入房间
                            </button>
                            <button class="mode-tab" data-mode="create" id="mode-tab-create" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-primary); cursor: pointer; transition: all 0.3s;">
                                🏠 创建房间
                            </button>
                        </div>
                        
                        <div class="room-controls">
                            <div class="room-input-group" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" class="room-input" placeholder="房间号" value="demo-room-001" style="flex: 1;">
                                <button class="btn-generate-room" id="btn-generate-room" title="生成随机房间号" style="display: none;">🎲</button>
                            </div>
                            <input type="text" class="nickname-input" placeholder="昵称" value="">
                            <div class="password-input-group" style="display: none;">
                                <input type="password" class="room-password-input" placeholder="输入房间密码" maxlength="50">
                                <button class="confirm-password-btn" id="confirm-password-btn">确认</button>
                            </div>
                            <div class="password-create-group" style="display: none;">
                                <input type="password" class="room-password-create" placeholder="设置房间密码" maxlength="50">
                                <button class="save-password-btn" id="save-password-btn">保存</button>
                            </div>
                            
                            <!-- 创建房间类型选择（默认隐藏） -->
                            <div class="room-type-selector" id="room-type-selector" style="display: none;">
                                <div class="room-type-title">选择房间类型：</div>
                                <label class="room-type-option">
                                    <input type="radio" name="room-type" value="casual" checked>
                                    <span class="room-type-text">🔓 临时房间（任何人可加入，适合快速测试）</span>
                                </label>
                                <label class="room-type-option">
                                    <input type="radio" name="room-type" value="registered">
                                    <span class="room-type-text">🔐 正式房间（独占房间号，需要密钥）</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="room-actions">
                            <button class="btn-create-room" id="btn-create-room" style="display: none;">🏠 创建房间</button>
                            <button class="btn-join-room" id="btn-join-room">🚪 加入房间</button>
                            <button class="btn-copy-invite" id="btn-copy-invite" title="复制邀请链接" style="display: none;">🔗 复制邀请</button>
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
                            <button class="backup-btn" id="backup-room-btn" style="display: none;">💾 备份房间</button>
                            <button class="restore-btn" id="restore-room-btn" style="display: none;">📂 恢复房间</button>
                            <input type="file" id="restore-file-input" accept=".json" style="display: none;">
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

                    <!-- 房间设置面板 -->
                    <div class="room-settings-panel" id="room-settings-panel" style="display: none;">
                        <div class="settings-panel-header">
                            <h3>⚙️ 房间设置</h3>
                            <button class="settings-close-btn" id="settings-close-btn">✕</button>
                        </div>

                        <div class="settings-panel-content">
                            <!-- 房间基本信息 -->
                            <div class="settings-section">
                                <h4>📋 房间信息</h4>
                                <div class="settings-info">
                                    <div class="info-row">
                                        <span class="info-label">房间ID：</span>
                                        <span class="info-value" id="settings-room-id">-</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">房主：</span>
                                        <span class="info-value" id="settings-room-owner">-</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">创建时间：</span>
                                        <span class="info-value" id="settings-create-time">-</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">房间类型：</span>
                                        <span class="info-value" id="settings-room-type">-</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 房间权限设置 -->
                            <div class="settings-section" id="owner-settings" style="display: none;">
                                <h4>🔐 权限设置</h4>

                                <!-- 房间密码 -->
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="settings-private-room">
                                        <span>设置房间密码</span>
                                    </label>
                                    <div class="password-setting" id="password-setting" style="display: none;">
                                        <input type="password" id="settings-room-password" placeholder="输入房间密码" class="settings-input">
                                        <button class="settings-btn" id="save-room-password">保存密码</button>
                                    </div>
                                </div>

                                <!-- 最大人数 -->
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <span>最大人数：</span>
                                        <select id="settings-max-users" class="settings-select">
                                            <option value="10">10人</option>
                                            <option value="20" selected>20人</option>
                                            <option value="50">50人</option>
                                            <option value="100">100人</option>
                                        </select>
                                    </label>
                                </div>

                                <!-- 管理员管理 -->
                                <div class="setting-item">
                                    <label class="setting-label">管理员列表</label>
                                    <div class="admin-list" id="admin-list">
                                        <div class="no-admins">暂无管理员</div>
                                    </div>
                                </div>
                            </div>

                            <!-- 房间操作 -->
                            <div class="settings-section">
                                <h4>🛠️ 房间操作</h4>
                                <div class="settings-actions">
                                    <button class="settings-btn btn-primary" id="backup-room-btn" style="display: none;">
                                        💾 备份房间
                                    </button>
                                    <button class="settings-btn btn-secondary" id="restore-room-btn">
                                        📂 恢复房间
                                    </button>
                                    <input type="file" id="restore-room-file" accept=".json" style="display: none;">

                                    <button class="settings-btn btn-warning" id="clear-messages-btn">
                                        🗑️ 清空聊天记录
                                    </button>

                                    <button class="settings-btn btn-danger" id="release-room-btn" style="display: none;">
                                        🔓 释放房间
                                    </button>
                                </div>
                            </div>

                            <!-- 高级设置 -->
                            <div class="settings-section">
                                <h4>🔧 高级设置</h4>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="settings-auto-reconnect" checked>
                                        <span>自动重连</span>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="settings-show-timestamp" checked>
                                        <span>显示时间戳</span>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="settings-notification" checked>
                                        <span>消息通知</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

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

            // 设置面板相关元素
            roomSettingsBtn: mountEl.querySelector('#room-settings-btn'),
            settingsPanel: mountEl.querySelector('#room-settings-panel'),
            settingsCloseBtn: mountEl.querySelector('#settings-close-btn'),

            // 设置面板内的元素
            settingsRoomId: mountEl.querySelector('#settings-room-id'),
            settingsRoomOwner: mountEl.querySelector('#settings-room-owner'),
            settingsCreateTime: mountEl.querySelector('#settings-create-time'),
            settingsRoomType: mountEl.querySelector('#settings-room-type'),

            ownerSettings: mountEl.querySelector('#owner-settings'),
            settingsPrivateRoom: mountEl.querySelector('#settings-private-room'),
            passwordSetting: mountEl.querySelector('#password-setting'),
            settingsRoomPassword: mountEl.querySelector('#settings-room-password'),
            saveRoomPasswordBtn: mountEl.querySelector('#save-room-password'),

            settingsMaxUsers: mountEl.querySelector('#settings-max-users'),
            adminList: mountEl.querySelector('#admin-list'),

            backupRoomBtn: mountEl.querySelector('#backup-room-btn'),
            restoreRoomBtn: mountEl.querySelector('#restore-room-btn'),
            restoreRoomFile: mountEl.querySelector('#restore-room-file'),
            clearMessagesBtn: mountEl.querySelector('#clear-messages-btn'),
            releaseRoomBtn: mountEl.querySelector('#release-room-btn'),

            settingsAutoReconnect: mountEl.querySelector('#settings-auto-reconnect'),
            settingsShowTimestamp: mountEl.querySelector('#settings-show-timestamp'),
            settingsNotification: mountEl.querySelector('#settings-notification')
        };

        // 绑定事件处理器
        setupSettingsPanel();

        // 验证关键元素是否存在
        if (!elements.backBtn) {
            console.error('MQTT聊天室：返回按钮未找到');
        }
        if (!elements.messages) {
            console.error('MQTT聊天室：消息容器未找到');
        }
        if (!elements.themeToggleBtn) {
            console.warn('MQTT聊天室：主题切换按钮未找到');
        }

        // 设置默认昵称
        elements.nicknameInput.value = getPlayerName() || '匿名用户';
        
        // 检查URL中的房间参数，如果是房主则自动使用房主昵称
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl && elements.roomInput) {
            const localConfig = loadRoomConfig(roomFromUrl);
            if (localConfig && localConfig.createdBy) {
                // 如果用户是这个房间的房主，自动填入房主昵称
                const currentPlayerName = getPlayerName();
                if (currentPlayerName === localConfig.createdBy || 
                    !elements.nicknameInput.value || 
                    elements.nicknameInput.value === '匿名用户') {
                    elements.nicknameInput.value = localConfig.createdBy;
                    log('system', `🔄 检测到您是房间 "${roomFromUrl}" 的房主，自动填入房主昵称`);
                }
            }
        }
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

    // 简单的密码哈希函数（用于验证，不是真正的加密）
    async function hashPassword(password) {
        // 使用浏览器内置的 crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 16); // 只取前16位作为简单哈希
    }

    // 发布房间配置到MQTT（房主专用）
    async function publishRoomConfig() {
        if (!client || !isConnected || !roomConfig) return;
        if (roomConfig.createdBy !== nickname) return; // 只有房主能发布配置

        const configTopic = `game/${roomId}/config`;
        const permissionsTopic = `game/${roomId}/permissions`;

        // 房间配置信息
        const configData = {
            roomId: roomId,
            createdBy: roomConfig.createdBy,
            isPrivate: roomConfig.isPrivate || false,
            hasPassword: roomConfig.hasPassword || false,
            passwordHash: roomConfig.password ? await hashPassword(roomConfig.password) : null,
            maxUsers: roomConfig.maxUsers || 20,
            category: roomConfig.category || 'chat',
            roomType: roomConfig.roomType || ROOM_TYPES.CASUAL,
            timestamp: Date.now()
        };

        // 权限信息（独立发布，最重要！）
        const permissionsData = {
            owner: roomConfig.createdBy,  // 房主永久有效
            admins: roomConfig.adminUsers || [],  // 管理员列表
            createdAt: roomConfig.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        // 发布配置
        client.publish(configTopic, JSON.stringify(configData), {
            qos: 1,
            retain: true
        });

        // 发布权限（更重要，使用 QoS 2 确保送达）
        client.publish(permissionsTopic, JSON.stringify(permissionsData), {
            qos: 2,
            retain: true
        });

        log('system', '📢 已发布房间配置和权限到MQTT');
    }

    // 处理接收到的房间权限（最重要！）
    function handleRoomPermissions(permissionsData) {
        if (!permissionsData) return;

        // 保存权限信息到全局变量（不是localStorage！）
        window.__roomPermissions__ = permissionsData;

        // 更新本地的房间配置
        if (!roomConfig) {
            roomConfig = { ...defaultRoomConfig };
        }

        roomConfig.createdBy = permissionsData.owner;
        roomConfig.adminUsers = permissionsData.admins || [];

        // 判断当前用户的角色
        const isOwner = permissionsData.owner === nickname;
        const isAdmin = permissionsData.admins && permissionsData.admins.includes(nickname);

        if (isOwner) {
            log('system', '👑 您是房主，拥有完全管理权限');
            isRoomAdmin = true;
        } else if (isAdmin) {
            log('system', '⭐ 您是管理员');
            isRoomAdmin = true;
        } else {
            log('system', '👤 您是访客');
            isRoomAdmin = false;
        }

        // 更新UI显示
        updateAdminUI();
    }

    // 更新管理员UI（显示/隐藏管理功能）
    function updateAdminUI() {
        const backupBtn = mountEl.querySelector('#backup-room-btn');
        const restoreBtn = mountEl.querySelector('#restore-room-btn');

        // 只有房主才能看到备份/恢复按钮
        const isOwner = window.__roomPermissions__ && window.__roomPermissions__.owner === nickname;

        if (backupBtn) {
            backupBtn.style.display = isOwner ? 'inline-block' : 'none';
        }
        if (restoreBtn) {
            restoreBtn.style.display = isOwner ? 'inline-block' : 'none';
        }
    }

    // 处理接收到的房间配置
    async function handleRoomConfig(configData) {
        if (!configData || configData.roomId !== roomId) return;

        // 不再检查是否是房主，因为权限信息从 permissions topic 获取

        // 更新本地房间配置（访客使用）
        const remoteConfig = {
            roomId: configData.roomId,
            createdBy: configData.createdBy,
            isPrivate: configData.isPrivate,
            hasPassword: configData.hasPassword,
            passwordHash: configData.passwordHash,  // 保存哈希值用于验证
            maxUsers: configData.maxUsers,
            category: configData.category,
            roomType: configData.roomType
        };

        // 保存远程配置供密码验证使用
        window.__remoteRoomConfig__ = remoteConfig;

        log('system', `📥 接收到房间配置（房主：${configData.createdBy}）`);

        // 如果房间需要密码且用户还没验证
        if (remoteConfig.hasPassword && !window.__passwordVerified__) {
            // 显示密码输入框
            const passwordInputGroup = mountEl.querySelector('.password-input-group');
            if (passwordInputGroup) {
                passwordInputGroup.style.display = 'flex';
                const passwordInput = mountEl.querySelector('.room-password-input');
                if (passwordInput) {
                    passwordInput.focus();
                }
                log('system', '🔒 此房间需要密码，请在上方输入密码并按回车确认');
                showAlert('此房间需要密码，请输入密码并按回车！');
            }

            // 禁用消息输入和发送功能
            if (elements.messageInput) {
                elements.messageInput.disabled = true;
                elements.messageInput.placeholder = '请先输入房间密码...';
            }
            if (elements.sendBtn) {
                elements.sendBtn.disabled = true;
            }
            if (elements.emojiBtn) {
                elements.emojiBtn.disabled = true;
            }

            // 在聊天区域显示提示
            const messagesContainer = mountEl.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="password-required-notice" style="
                        text-align: center;
                        padding: 50px 20px;
                        color: var(--text-secondary);
                    ">
                        <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
                        <div style="font-size: 18px; margin-bottom: 10px;">此房间需要密码</div>
                        <div style="font-size: 14px;">请在上方输入密码并按回车键验证</div>
                    </div>
                `;
            }
        } else if (!remoteConfig.hasPassword) {
            log('system', '🔓 此房间无需密码，欢迎加入！');
        }

        // 更新房间设置显示
        const maxUsersSelect = mountEl.querySelector('#max-users-select');
        if (maxUsersSelect && remoteConfig.maxUsers) {
            maxUsersSelect.value = remoteConfig.maxUsers;
        }

        const categorySelect = mountEl.querySelector('#room-category-select');
        if (categorySelect && remoteConfig.category) {
            categorySelect.value = remoteConfig.category;
        }
    }
    
    // 备份房间数据（房主专用）
    function backupRoomData() {
        if (!roomConfig || roomConfig.createdBy !== nickname) {
            showAlert('只有房主可以备份房间数据');
            return;
        }

        const backupData = {
            version: '1.0',
            timestamp: Date.now(),
            room: {
                roomId: roomId,
                roomType: roomConfig.roomType,
                createdAt: roomConfig.createdAt,
                createdBy: roomConfig.createdBy,
                roomKey: roomConfig.roomKey
            },
            config: {
                maxUsers: roomConfig.maxUsers,
                category: roomConfig.category,
                isPrivate: roomConfig.isPrivate,
                hasPassword: roomConfig.hasPassword,
                password: roomConfig.password  // 注意：这是明文密码，实际应用应该加密
            },
            permissions: {
                owner: roomConfig.createdBy,
                admins: roomConfig.adminUsers || []
            },
            chatHistory: chatHistory.get(roomId) || []
        };

        // 创建下载链接
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `room_${roomId}_backup_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        log('system', '✅ 房间数据已备份');
    }

    // 恢复房间数据（房主专用）
    async function restoreRoomData(fileContent) {
        try {
            const backupData = JSON.parse(fileContent);

            if (!backupData.version || !backupData.room) {
                throw new Error('无效的备份文件格式');
            }

            // 先检查房间是否已被其他人占用
            const currentOccupation = await checkRoomOccupation(backupData.room.roomId);

            if (currentOccupation && currentOccupation.roomKey !== backupData.room.roomKey) {
                // 房间已被其他人占用，提供选项
                const options = confirm(
                    `⚠️ 房间 "${backupData.room.roomId}" 已被其他人占用！\n\n` +
                    `当前房主：${currentOccupation.owner}\n` +
                    `原房主：${backupData.room.createdBy}\n\n` +
                    `是否要使用新的房间ID恢复？\n` +
                    `选择"确定"将生成新房间ID\n` +
                    `选择"取消"将放弃恢复`
                );

                if (options) {
                    // 生成新的房间ID
                    const timestamp = Date.now().toString(36);
                    const randomStr = Math.random().toString(36).substr(2, 4);
                    const newRoomId = `${backupData.room.roomId}-${timestamp}-${randomStr}`;

                    showAlert(`原房间ID已被占用，将使用新ID：${newRoomId}`);
                    backupData.room.roomId = newRoomId;
                } else {
                    throw new Error('房间恢复已取消');
                }
            }

            // 恢复房间配置
            roomConfig = {
                ...defaultRoomConfig,
                ...backupData.config,
                roomId: backupData.room.roomId,
                roomType: backupData.room.roomType,
                createdAt: backupData.room.createdAt,
                createdBy: backupData.room.createdBy,
                roomKey: backupData.room.roomKey,
                adminUsers: backupData.permissions.admins
            };

            // 恢复到localStorage（作为本地缓存）
            saveRoomConfig();

            // 恢复聊天记录
            if (backupData.chatHistory) {
                chatHistory.set(backupData.room.roomId, backupData.chatHistory);
            }

            // 如果已连接，发布到MQTT
            if (isConnected) {
                publishRoomConfig();
                // 发布房间占用信息，激活房间
                if (roomConfig.roomId && roomConfig.createdBy && roomConfig.roomKey) {
                    publishRoomOccupation(roomConfig.roomId, roomConfig.createdBy, roomConfig.roomKey);
                }
            }

            log('system', '✅ 房间数据已恢复，房间已激活');
            showAlert('房间数据恢复成功！房间已激活，其他用户现在可以加入。');

            // 更新UI
            elements.roomInput.value = backupData.room.roomId;
            elements.nicknameInput.value = backupData.room.createdBy;

        } catch (error) {
            console.error('恢复房间数据失败:', error);
            showAlert('恢复失败：' + error.message);
        }
    }

    // 设置面板相关函数
    function setupSettingsPanel() {
        // 设置按钮点击事件
        if (elements.roomSettingsBtn) {
            elements.roomSettingsBtn.addEventListener('click', () => openSettingsPanel());
        }

        // 关闭按钮点击事件
        if (elements.settingsCloseBtn) {
            elements.settingsCloseBtn.addEventListener('click', () => closeSettingsPanel());
        }

        // 设置密码开关
        if (elements.settingsPrivateRoom) {
            elements.settingsPrivateRoom.addEventListener('change', (e) => {
                if (elements.passwordSetting) {
                    elements.passwordSetting.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }

        // 保存密码按钮
        if (elements.saveRoomPasswordBtn) {
            elements.saveRoomPasswordBtn.addEventListener('click', () => saveRoomPassword());
        }

        // 最大人数设置
        if (elements.settingsMaxUsers) {
            elements.settingsMaxUsers.addEventListener('change', (e) => {
                if (roomConfig) {
                    roomConfig.maxUsers = parseInt(e.target.value);
                    saveRoomConfig();
                    publishRoomConfig();
                }
            });
        }

        // 备份房间按钮
        if (elements.backupRoomBtn) {
            elements.backupRoomBtn.addEventListener('click', () => backupRoomData());
        }

        // 恢复房间按钮
        if (elements.restoreRoomBtn) {
            elements.restoreRoomBtn.addEventListener('click', () => {
                elements.restoreRoomFile.click();
            });
        }

        // 恢复房间文件选择
        if (elements.restoreRoomFile) {
            elements.restoreRoomFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        restoreRoomData(event.target.result);
                    };
                    reader.readAsText(file);
                }
            });
        }

        // 清空聊天记录
        if (elements.clearMessagesBtn) {
            elements.clearMessagesBtn.addEventListener('click', () => {
                if (confirm('确定要清空本地聊天记录吗？')) {
                    clearMessages();
                    if (roomId) {
                        chatHistory.delete(roomId);
                        saveChatHistory();
                    }
                    log('system', '💬 本地聊天记录已清空');
                }
            });
        }

        // 释放房间按钮
        if (elements.releaseRoomBtn) {
            elements.releaseRoomBtn.addEventListener('click', () => {
                if (confirm(`确定要释放房间 "${roomId}" 吗？\n\n释放后：\n- 房间ID将可被他人使用\n- 其他用户将无法加入\n- 您需要重新创建或导入备份恢复房间`)) {
                    clearRoomOccupation(roomId);
                    log('system', `🔓 房间 "${roomId}" 已释放`);
                    closeSettingsPanel();
                    // 可选：自动离开房间
                    leaveRoom();
                }
            });
        }
    }

    // 打开设置面板
    function openSettingsPanel() {
        if (!elements.settingsPanel) return;

        // 更新设置面板信息
        updateSettingsPanelInfo();

        // 显示面板
        elements.settingsPanel.style.display = 'flex';
        setTimeout(() => {
            elements.settingsPanel.classList.add('show');
        }, 10);
    }

    // 关闭设置面板
    function closeSettingsPanel() {
        if (!elements.settingsPanel) return;

        elements.settingsPanel.classList.remove('show');
        setTimeout(() => {
            elements.settingsPanel.style.display = 'none';
        }, 300);
    }

    // 更新设置面板信息
    function updateSettingsPanelInfo() {
        // 更新房间基本信息
        if (elements.settingsRoomId) {
            elements.settingsRoomId.textContent = roomId || '-';
        }

        if (elements.settingsRoomOwner && roomConfig) {
            elements.settingsRoomOwner.textContent = roomConfig.createdBy || '-';
        }

        if (elements.settingsCreateTime && roomConfig) {
            const createTime = roomConfig.createdAt ? new Date(roomConfig.createdAt).toLocaleString() : '-';
            elements.settingsCreateTime.textContent = createTime;
        }

        if (elements.settingsRoomType && roomConfig) {
            const typeText = roomConfig.roomType === ROOM_TYPES.REGISTERED ? '正式房间' : '临时房间';
            elements.settingsRoomType.textContent = typeText;
        }

        // 显示房主专属设置
        const isOwner = roomConfig && roomConfig.createdBy === nickname;
        if (elements.ownerSettings) {
            elements.ownerSettings.style.display = isOwner ? 'block' : 'none';
        }

        // 显示房主专属按钮
        if (elements.backupRoomBtn) {
            elements.backupRoomBtn.style.display = isOwner ? 'block' : 'none';
        }
        if (elements.releaseRoomBtn) {
            elements.releaseRoomBtn.style.display = isOwner ? 'block' : 'none';
        }

        // 更新密码设置
        if (elements.settingsPrivateRoom && roomConfig) {
            elements.settingsPrivateRoom.checked = roomConfig.hasPassword || false;
            if (elements.passwordSetting) {
                elements.passwordSetting.style.display = roomConfig.hasPassword ? 'flex' : 'none';
            }
        }

        // 更新最大人数
        if (elements.settingsMaxUsers && roomConfig) {
            elements.settingsMaxUsers.value = roomConfig.maxUsers || 20;
        }

        // 更新管理员列表
        updateAdminList();
    }

    // 更新管理员列表
    function updateAdminList() {
        if (!elements.adminList) return;

        const admins = roomConfig?.adminUsers || [];
        if (admins.length === 0) {
            elements.adminList.innerHTML = '<div class="no-admins">暂无管理员</div>';
        } else {
            elements.adminList.innerHTML = admins.map(admin => `
                <div class="admin-item">
                    <span class="admin-name">${admin}</span>
                    <button class="remove-admin-btn" data-admin="${admin}">移除</button>
                </div>
            `).join('');

            // 绑定移除管理员事件
            elements.adminList.querySelectorAll('.remove-admin-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const adminName = e.target.dataset.admin;
                    removeAdmin(adminName);
                });
            });
        }
    }

    // 保存房间密码
    function saveRoomPassword() {
        if (!elements.settingsRoomPassword || !roomConfig) return;

        const password = elements.settingsRoomPassword.value.trim();
        if (!password && elements.settingsPrivateRoom.checked) {
            showAlert('请输入房间密码');
            return;
        }

        roomConfig.hasPassword = elements.settingsPrivateRoom.checked;
        roomConfig.password = password;

        saveRoomConfig();
        publishRoomConfig();

        showAlert('密码设置已更新');
        log('system', roomConfig.hasPassword ? '🔐 房间密码已设置' : '🔓 房间密码已移除');
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
        
        // 根据房间类型决定是否包含密钥
        let inviteLink;
        if (roomConfig && roomConfig.roomType === ROOM_TYPES.REGISTERED) {
            // 正式房间：必须包含密钥
            if (!roomConfig.roomKey) {
                showAlert('正式房间缺少密钥，无法生成邀请链接');
                return;
            }
            inviteLink = generateInviteLink(roomId, '访客', true);
            log('system', '🔐 复制正式房间邀请链接（包含密钥）');
        } else {
            // 临时房间和搜索房间：生成简单的房间号链接（不含密钥）
            inviteLink = generateInviteLink(roomId, '访客', false);
            log('system', '🔓 复制房间链接（无密钥，任何人可加入）');
        }
        
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
        
        // 添加模式切换功能
        const modeTabs = mountEl.querySelectorAll('.mode-tab');
        const roomTypeSelector = mountEl.querySelector('#room-type-selector');
        const genBtn = mountEl.querySelector('#btn-generate-room');
        
        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                
                // 更新标签样式
                modeTabs.forEach(t => {
                    if (t === tab) {
                        t.classList.add('active');
                        t.style.background = 'var(--primary-color)';
                        t.style.color = 'white';
                    } else {
                        t.classList.remove('active');
                        t.style.background = 'var(--card-bg)';
                        t.style.color = 'var(--text-primary)';
                    }
                });
                
                // 切换UI元素
                if (mode === 'create') {
                    elements.createRoomBtn.style.display = 'inline-block';
                    elements.joinRoomBtn.style.display = 'none';
                    if (genBtn) genBtn.style.display = 'inline-block';
                    if (roomTypeSelector) roomTypeSelector.style.display = 'block';
                    elements.roomInput.placeholder = '输入房间号（或点击骰子生成）';
                } else {
                    elements.createRoomBtn.style.display = 'none';
                    elements.joinRoomBtn.style.display = 'inline-block';
                    if (genBtn) genBtn.style.display = 'none';
                    if (roomTypeSelector) roomTypeSelector.style.display = 'none';
                    elements.roomInput.placeholder = '输入房间号';
                }
            });
        });
        
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

        // 备份按钮（房主专用）
        const backupBtn = mountEl.querySelector('#backup-room-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => backupRoomData());
        }

        // 恢复按钮（房主专用）
        const restoreBtn = mountEl.querySelector('#restore-room-btn');
        const restoreInput = mountEl.querySelector('#restore-file-input');
        if (restoreBtn && restoreInput) {
            restoreBtn.addEventListener('click', () => {
                restoreInput.click();
            });

            restoreInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        restoreRoomData(event.target.result);
                    };
                    reader.readAsText(file);
                }
            });
        }
        
        // 发送按钮
        if (elements.sendBtn) {
            elements.sendBtn.addEventListener('click', () => sendMessage());
        }

        // 密码验证函数（加入房间时）
        const verifyRoomPassword = async () => {
            const passwordInput = mountEl.querySelector('.room-password-input');
            if (!passwordInput || !window.__remoteRoomConfig__ || !window.__remoteRoomConfig__.hasPassword) {
                return;
            }

            const inputPassword = passwordInput.value.trim();
            if (inputPassword) {
                const inputHash = await hashPassword(inputPassword);
                if (inputHash === window.__remoteRoomConfig__.passwordHash) {
                    window.__passwordVerified__ = true;
                    showAlert('✅ 密码正确！');
                    // 隐藏密码输入框
                    const passwordInputGroup = mountEl.querySelector('.password-input-group');
                    if (passwordInputGroup) {
                        passwordInputGroup.style.display = 'none';
                    }
                    // 清空密码输入框
                    passwordInput.value = '';
                    log('system', '🔓 密码验证成功，欢迎进入房间！');

                    // 启用消息输入框和发送按钮
                    if (elements.messageInput) {
                        elements.messageInput.disabled = false;
                        elements.messageInput.placeholder = '输入消息...';
                        elements.messageInput.focus();
                    }
                    if (elements.sendBtn) {
                        elements.sendBtn.disabled = false;
                    }
                    if (elements.emojiBtn) {
                        elements.emojiBtn.disabled = false;
                    }

                    // 清空聊天区域的密码提示
                    const messagesContainer = mountEl.querySelector('#messages-container');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                        log('system', '✅ 您现在可以查看和发送消息了');
                    }
                } else {
                    showAlert('❌ 密码错误！');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            }
        };

        // 绑定密码输入框的回车事件
        const passwordInput = mountEl.querySelector('.room-password-input');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await verifyRoomPassword();
                }
            });
        }

        // 绑定确认密码按钮
        const confirmPasswordBtn = mountEl.querySelector('#confirm-password-btn');
        if (confirmPasswordBtn) {
            confirmPasswordBtn.addEventListener('click', async () => {
                await verifyRoomPassword();
            });
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

    // 创建正式房间（注册到全局）
    async function createRegisteredRoom(targetRoomId, creatorNickname) {
        // 检查全局房间列表中是否已存在
        if (globalRoomList.has(targetRoomId)) {
            const roomInfo = globalRoomList.get(targetRoomId);
            if (roomInfo.registered) {
                throw new Error('该房间号已被注册，请使用其他房间号！');
            }
        }
        
        // 创建注册信息
        const registrationData = {
            roomId: targetRoomId,
            roomKey: generateRoomKey(),
            owner: creatorNickname,
            createdAt: Date.now(),
            registered: true,
            signature: await generateSignature(targetRoomId, creatorNickname)
        };
        
        // 发布注册信息到全局主题（使用retained消息）
        if (roomListClient && roomListClient.connected) {
            const registryTopic = `yoyo/registry/${targetRoomId}`;
            roomListClient.publish(registryTopic, JSON.stringify(registrationData), {
                qos: 2,
                retain: true  // 保留消息，确保唯一性
            });
        }
        
        // 创建本地房间配置
        roomConfig = { ...defaultRoomConfig };
        roomConfig.createdBy = creatorNickname;
        roomConfig.adminUsers = [creatorNickname];
        roomConfig.createdAt = Date.now();
        roomConfig.roomId = targetRoomId;
        roomConfig.roomKey = registrationData.roomKey;
        roomConfig.roomType = ROOM_TYPES.REGISTERED;

        // 从UI读取房间设置（与临时房间一样）
        const privateCheckbox = mountEl.querySelector('#private-room-checkbox');
        const maxUsersSelect = mountEl.querySelector('#max-users-select');
        const categorySelect = mountEl.querySelector('#room-category-select');
        const passwordCreateInput = mountEl.querySelector('.room-password-create');

        // 应用设置
        if (privateCheckbox && privateCheckbox.checked) {
            roomConfig.isPrivate = true;
            roomConfig.hasPassword = true;
            if (passwordCreateInput) {
                // 优先使用当前输入的密码，如果为空则使用保存的密码
                let password = passwordCreateInput.value.trim();
                const saveBtn = mountEl.querySelector('#save-password-btn');

                // 如果输入框为空但有保存的密码，使用保存的
                if (!password && saveBtn && saveBtn.dataset.savedPassword) {
                    password = saveBtn.dataset.savedPassword;
                    log('system', '使用已保存的密码');
                }

                if (password.length >= 3) {
                    roomConfig.password = password;
                    log('system', `🔒 正式房间已设置密码保护（密码：${password}）`);
                } else {
                    showAlert('密码长度至少3个字符！将创建无密码房间。');
                    roomConfig.isPrivate = false;
                    roomConfig.hasPassword = false;
                    roomConfig.password = '';
                    // 取消勾选密码保护
                    privateCheckbox.checked = false;
                }
            }
        } else {
            // 确保不勾选时清除密码设置
            roomConfig.isPrivate = false;
            roomConfig.hasPassword = false;
            roomConfig.password = '';
        }

        if (maxUsersSelect) {
            roomConfig.maxUsers = parseInt(maxUsersSelect.value) || 20;
        }

        if (categorySelect) {
            roomConfig.category = categorySelect.value || 'chat';
        }

        window.__ROOM_UID__ = roomConfig.roomKey;

        // 保存配置
        saveRoomConfig();

        // 发布房间创建消息
        publishRoomCreated(targetRoomId, {
            maxUsers: roomConfig.maxUsers,
            category: roomConfig.category,
            isPrivate: roomConfig.isPrivate,
            userCount: 1,
            registered: true
        });
        
        log('system', `🔐 您成功创建了正式房间 "${targetRoomId}"`); 
        log('system', `🔑 房间密钥已生成，只有拥有密钥的人才能查看消息`);
        
        return roomConfig;
    }
    
    // 生成签名（用于验证房主身份）
    async function generateSignature(roomId, owner) {
        const data = `${roomId}:${owner}:${Date.now()}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    }
    
    // 创建房间
    async function createRoom() {
        roomId = elements.roomInput.value.trim();
        nickname = elements.nicknameInput.value.trim();

        // 先检查本地是否有该房间的配置
        const existingConfig = loadRoomConfig(roomId);
        if (existingConfig && existingConfig.createdBy) {
            // 房间已存在，检查用户身份
            const currentPlayerName = getPlayerName();
            if (currentPlayerName === existingConfig.createdBy || nickname === existingConfig.createdBy) {
                // 这是房主，检查是否需要迁移旧房间
                if (!existingConfig.roomKey) {
                    // 旧版本房间，需要迁移
                    const migrate = confirm(
                        `检测到这是旧版本创建的房间 "${roomId}"！\n\n` +
                        `需要升级才能继续使用：\n` +
                        `1. 系统将生成新的安全密钥\n` +
                        `2. 房间将被激活到服务器\n` +
                        `3. 其他用户即可正常加入\n\n` +
                        `是否立即升级？`
                    );

                    if (migrate) {
                        // 生成新的roomKey并更新配置
                        existingConfig.roomKey = generateRoomKey();
                        existingConfig.version = '2.0';
                        saveRoomConfigForRoom(roomId, existingConfig);

                        // 保存更新后的配置
                        roomConfig = existingConfig;
                        roomId = existingConfig.roomId;
                        nickname = existingConfig.createdBy;

                        // 发布占用信息，激活房间
                        log('system', '正在激活房间到服务器...');

                        // 连接并发布占用信息
                        try {
                            await connectToMqttRoom();
                            publishRoomOccupation(roomId, existingConfig.createdBy, existingConfig.roomKey);
                        } catch (error) {
                            console.error('激活房间失败:', error);
                            showAlert('房间激活失败，请重试');
                            return;
                        }

                        log('system', `✅ 房间 "${roomId}" 已成功升级并激活！`);
                        showAlert('房间升级成功！建议您立即备份房间数据。');
                        return;
                    }
                }

                // 这是房主，应该直接加入而不是重新创建
                showAlert(`房间 "${roomId}" 已存在，您是房主。请使用"加入房间"功能。`);
                // 自动切换到加入房间模式
                elements.nicknameInput.value = existingConfig.createdBy;
                return;
            } else {
                // 不是房主，房间已存在不能重新创建
                showAlert(`房间 "${roomId}" 已存在且有其他房主。请选择其他房间号或直接加入此房间。`);
                return;
            }
        }

        // 检查MQTT服务器上的房间占用状态
        log('system', '🔍 检查房间ID是否已被占用...');
        const roomOccupied = await checkRoomOccupation(roomId);
        if (roomOccupied) {
            showAlert(`❌ 房间 "${roomId}" 已被占用！\n\n房主: ${roomOccupied.owner}\n创建时间: ${new Date(roomOccupied.createdAt).toLocaleString()}\n\n请选择其他房间号或联系房主。`);
            return;
        }
        
        if (!roomId || !nickname) {
            showAlert('请输入房间号和昵称！');
            return;
        }
        
        // 获取房间类型
        const roomTypeRadio = mountEl.querySelector('input[name="room-type"]:checked');
        const roomType = roomTypeRadio ? roomTypeRadio.value : ROOM_TYPES.CASUAL;
        
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
            // 根据房间类型处理
            if (roomType === ROOM_TYPES.REGISTERED) {
                // 正式房间：需要注册
                await createRegisteredRoom(roomId, nickname);
            } else {
                // 临时房间：原有逻辑
                createRoomConfig(roomId, ROOM_TYPES.CASUAL);
            }

            // 连接到房间
            await connectToMqttRoom();

            // 发布房间占用信息到MQTT服务器
            const roomConfig = loadRoomConfig(roomId);
            if (roomConfig && roomConfig.roomKey) {
                publishRoomOccupation(roomId, nickname, roomConfig.roomKey);
            }
            
            // 根据房间类型决定是否显示复制邀请按钮
            const copyInviteBtn = mountEl.querySelector('#btn-copy-invite');
            if (copyInviteBtn) {
                if (roomType === ROOM_TYPES.REGISTERED) {
                    // 正式房间：显示复制邀请按钮（需要密钥）
                    copyInviteBtn.style.display = 'inline-block';
                    copyInviteBtn.title = '复制加密房间邀请链接';
                } else {
                    // 临时房间：隐藏复制邀请按钮（任何人都能直接加入）
                    copyInviteBtn.style.display = 'none';
                }
            }
            
        } catch (error) {
            showAlert(error.message);
        }
    }
    
    // 检查房间占用状态
    async function checkRoomOccupation(targetRoomId) {
        return new Promise((resolve) => {
            // 创建临时客户端检查房间占用状态
            const checkClient = mqtt.connect(brokerUrl, {
                clientId: `check_${Math.random().toString(16).substr(2, 8)}`,
                clean: true,
                connectTimeout: 5000
            });

            let timeoutId = setTimeout(() => {
                checkClient.end();
                resolve(null); // 超时则认为房间未被占用
            }, 3000);

            checkClient.on('connect', () => {
                const occupationTopic = `game/${targetRoomId}/occupation`;

                checkClient.subscribe(occupationTopic, (err) => {
                    if (err) {
                        clearTimeout(timeoutId);
                        checkClient.end();
                        resolve(null);
                        return;
                    }
                });

                // 监听占用消息
                checkClient.on('message', (topic, message) => {
                    if (topic === occupationTopic) {
                        try {
                            const occupationData = JSON.parse(message.toString());
                            clearTimeout(timeoutId);
                            checkClient.end();

                            // 验证占用信息的有效性
                            if (occupationData && occupationData.owner && occupationData.roomKey) {
                                resolve(occupationData);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            clearTimeout(timeoutId);
                            checkClient.end();
                            resolve(null);
                        }
                    }
                });
            });

            checkClient.on('error', () => {
                clearTimeout(timeoutId);
                checkClient.end();
                resolve(null);
            });
        });
    }

    // 发布房间占用信息
    function publishRoomOccupation(targetRoomId, ownerName, roomKey) {
        if (!client || !client.connected) return;

        const occupationData = {
            roomId: targetRoomId,
            owner: ownerName,
            roomKey: roomKey,
            createdAt: Date.now(),
            version: '1.0'
        };

        const occupationTopic = `game/${targetRoomId}/occupation`;

        // 发布retained消息，确保房间占用信息持久化
        client.publish(occupationTopic, JSON.stringify(occupationData), {
            retain: true,
            qos: 1
        }, (err) => {
            if (err) {
                console.error('发布房间占用信息失败:', err);
            } else {
                log('system', `✅ 房间 "${targetRoomId}" 已注册为专属房间`);
            }
        });
    }

    // 清除房间占用信息（房主释放房间时调用）
    function clearRoomOccupation(targetRoomId) {
        if (!client || !client.connected) return;

        const occupationTopic = `game/${targetRoomId}/occupation`;

        // 发布空的retained消息来清除占用信息
        client.publish(occupationTopic, '', {
            retain: true,
            qos: 1
        }, (err) => {
            if (!err) {
                log('system', `🔓 房间 "${targetRoomId}" 占用已释放`);
            }
        });
    }

    // 检查房间注册状态
    async function checkRoomRegistration(targetRoomId) {
        return new Promise((resolve) => {
            if (!roomListClient || !roomListClient.connected) {
                resolve(null);
                return;
            }
            
            const registryTopic = `yoyo/registry/${targetRoomId}`;
            let resolved = false;
            let messageHandler;
            
            // 设置消息处理器
            messageHandler = (topic, message) => {
                if (topic === registryTopic && !resolved) {
                    resolved = true;
                    try {
                        const registrationData = JSON.parse(message.toString());
                        roomListClient.off('message', messageHandler);
                        roomListClient.unsubscribe(registryTopic);
                        resolve(registrationData);
                    } catch (e) {
                        resolve(null);
                    }
                }
            };
            
            // 订阅注册主题
            roomListClient.subscribe(registryTopic, (err) => {
                if (err) {
                    resolved = true;
                    resolve(null);
                    return;
                }
                
                // 监听消息
                roomListClient.on('message', messageHandler);
            });
            
            // 超时处理
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    roomListClient.off('message', messageHandler);
                    roomListClient.unsubscribe(registryTopic);
                    resolve(null);
                }
            }, 2000);
        });
    }
    
    // 加入房间
    async function joinRoom() {
        roomId = elements.roomInput.value.trim();
        nickname = elements.nicknameInput.value.trim();

        if (!roomId || !nickname) {
            showAlert('请输入房间号和昵称！');
            return;
        }

        // 先检查房间是否已被占用（激活）
        log('system', '🔍 检查房间状态...');
        const roomOccupation = await checkRoomOccupation(roomId);

        if (!roomOccupation) {
            // 房间未被占用，不能加入
            showAlert(`❌ 房间 "${roomId}" 不存在或未激活！\n\n可能原因：\n1. 房间ID输入错误\n2. 房主尚未创建此房间\n3. 房主已释放此房间\n\n请确认房间ID或联系房主。`);
            return;
        }

        // 房间已被占用，可以尝试加入
        log('system', `✅ 找到房间 "${roomId}"，房主: ${roomOccupation.owner}`);

        // 检查是否是房主本人
        const currentPlayerName = getPlayerName();
        if (currentPlayerName === roomOccupation.owner || nickname === roomOccupation.owner) {
            // 是房主，需要验证是否有本地备份
            const localConfig = loadRoomConfig(roomId);
            if (!localConfig || localConfig.roomKey !== roomOccupation.roomKey) {
                showAlert(`⚠️ 检测到您是房主 "${roomOccupation.owner}"，但本地没有房间密钥！\n\n请使用房间备份文件恢复房间权限。`);
                return;
            }
            // 恢复房主权限
            window.__ROOM_UID__ = localConfig.roomKey;
            log('system', `👑 房主身份确认，恢复房间权限`);
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
        let localConfig = loadRoomConfig(roomId);
        
        // 如果本地有房间配置，检查房主身份
        if (localConfig && localConfig.createdBy) {
            const currentPlayerName = getPlayerName();
            
            // 检查是否是房主身份
            if (currentPlayerName === localConfig.createdBy || nickname === localConfig.createdBy) {
                // 确认房主身份，使用保存的房主昵称和房间密钥
                if (nickname !== localConfig.createdBy) {
                    nickname = localConfig.createdBy;
                    elements.nicknameInput.value = nickname;
                    log('system', `👑 确认房主身份，使用房主昵称: ${nickname}`);
                }
                // 恢复房主的房间密钥权限
                if (localConfig.roomKey) {
                    window.__ROOM_UID__ = localConfig.roomKey;
                    log('system', `🔑 房主身份确认，恢复房间密钥权限`);
                }
            } else {
                // 不是房主，但要检查是否误输入了昵称
                if (elements.nicknameInput.defaultValue === localConfig.createdBy) {
                    // 可能是房主但昵称输错了
                    const confirmOwner = confirm(`检测到您可能是房间 "${roomId}" 的房主 "${localConfig.createdBy}"，是否使用房主身份加入？`);
                    if (confirmOwner) {
                        nickname = localConfig.createdBy;
                        elements.nicknameInput.value = nickname;
                        log('system', `👑 使用房主身份加入: ${nickname}`);
                        // 恢复房主的房间密钥权限
                        if (localConfig.roomKey) {
                            window.__ROOM_UID__ = localConfig.roomKey;
                            log('system', `🔑 房主身份确认，恢复房间密钥权限`);
                        }
                    }
                }
            }
        }
        
        // 检查房间状态优先级：正式房间 > 临时房间 > 搜索房间
        log('system', '🔍 检查房间状态...');
        const registrationData = await checkRoomRegistration(roomId);
        
        if (registrationData && registrationData.registered) {
            // 优先级最高：正式房间
            // 这是一个正式房间
            log('system', '🔐 检测到正式房间');
            
            // 设置基础配置
            localConfig = {
                roomId: roomId,
                roomKey: registrationData.roomKey,  // 保存房间密钥（用于加密）
                roomType: ROOM_TYPES.REGISTERED,
                owner: registrationData.owner,
                isLocallyCreated: false,
                adminUsers: [],
                hasPassword: false
            };
            
            // 判断用户身份和权限
            let hasDecryptKey = window.__ROOM_UID__ === registrationData.roomKey;
            
            if (hasDecryptKey) {
                // 有密钥：可以看到加密消息
                log('system', '🔑 您拥有房间密钥，可以查看加密消息');
                
                // 判断是否是房主
                if (nickname === registrationData.owner) {
                    localConfig.createdBy = nickname;
                    localConfig.adminUsers = [nickname];
                    log('system', '👑 欢迎回来，房主！');
                } else {
                    log('system', '👤 您以访客身份加入（有密钥）');
                }
            } else {
                // 无密钥：只能看到乱码
                log('system', '⚠️ 您没有房间密钥，消息将显示为乱码');
                log('system', '👤 您以访客身份加入（无密钥）');
                log('system', '💡 提示：请向房主索取邀请链接以获得密钥');
                
                // 不要保存密钥到本地配置，让他们看到乱码
                localConfig.roomKey = null;
            }
            
            roomConfig = localConfig;
            
        } else {
            // 优先级：临时房间 > 搜索房间
            
            if (localConfig && localConfig.createdBy) {
                // 优先级中等：临时房间（已有房主）
                log('system', `🔓 检测到临时房间（房主：${localConfig.createdBy}）`);
            } else {
                // 优先级最低：搜索房间（无房主）
                log('system', '🔍 这是一个搜索房间');
                
                if (!localConfig) {
                    localConfig = {
                        roomId: roomId,
                        roomType: ROOM_TYPES.CASUAL,
                        isLocallyCreated: false,
                        adminUsers: [],
                        hasPassword: false,
                        createdBy: null  // 搜索房间：所有人都是访客
                    };
                }
            }
            
            // 如果有URL密钥，使用它
            if (window.__ROOM_UID__) {
                localConfig.roomKey = window.__ROOM_UID__;
                log('system', '🔑 使用邀请链接中的房间密钥');
            }
            
            // 判断用户身份
            if (localConfig.createdBy && localConfig.createdBy === nickname) {
                // 这是房间的创建者（房主）
                log('system', '👑 欢迎回来，房主！');
                // 恢复房主的房间密钥权限
                if (localConfig.roomKey && !window.__ROOM_UID__) {
                    window.__ROOM_UID__ = localConfig.roomKey;
                    log('system', `🔑 恢复房主密钥权限`);
                }
            } else if (localConfig.createdBy) {
                // 房间有房主，但不是当前用户 - 访客身份
                log('system', `👤 您以访客身份加入临时房间（房主：${localConfig.createdBy}）`);
                // 确保访客没有管理权限
                if (localConfig.adminUsers && localConfig.adminUsers.includes(nickname)) {
                    const index = localConfig.adminUsers.indexOf(nickname);
                    if (index > -1) {
                        localConfig.adminUsers.splice(index, 1);
                    }
                }
            } else {
                // 搜索房间 - 所有人都是访客
                log('system', '👤 您以访客身份加入搜索房间（无房主）');
            }
            
            roomConfig = localConfig;
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
        
        // 注释掉本地密码验证，改为连接后通过MQTT验证
        // 本地配置的密码可能不准确（只有房主的localStorage有）
        // 真正的密码验证应该在收到MQTT配置消息后进行
        /*
        if (!skipPasswordCheck && localConfig && localConfig.isPrivate && localConfig.password) {
            // 这段代码会阻止连接，改为连接后验证
        }
        */
        
        try {
            // 确保有房间配置
            if (!roomConfig) {
                if (localConfig) {
                    roomConfig = localConfig;
                } else {
                    // 创建默认配置（临时房间）
                    roomConfig = { ...defaultRoomConfig };
                    roomConfig.roomId = roomId;
                    roomConfig.roomType = ROOM_TYPES.CASUAL;
                    roomConfig.isLocallyCreated = false;
                    roomConfig.adminUsers = [];
                    log('system', `正在连接到房间: ${roomId}`);
                }
            }
            
            // 连接到房间
            await connectToMqttRoom();
            
            // 根据房间类型决定是否显示复制邀请按钮
            const copyInviteBtn = mountEl.querySelector('#btn-copy-invite');
            if (copyInviteBtn) {
                if (roomConfig && roomConfig.roomType === ROOM_TYPES.REGISTERED) {
                    // 正式房间：显示复制邀请按钮（需要密钥）
                    copyInviteBtn.style.display = 'inline-block';
                    copyInviteBtn.title = '复制加密房间邀请链接';
                } else {
                    // 临时房间或搜索房间：隐藏复制邀请按钮
                    copyInviteBtn.style.display = 'none';
                }
            }
            
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
        
        // 确保有房间配置
        if (!roomConfig) {
            // 检查是否有现有房间配置
            const existingConfig = loadRoomConfig(roomId);
            if (existingConfig) {
                // 使用现有配置（保持房主身份）
                roomConfig = existingConfig;
                log('system', '✅ 使用现有房间配置');
            } else {
                // 新的搜索房间（无房主）
                roomConfig = {
                    roomId: roomId,
                    roomType: ROOM_TYPES.CASUAL,
                    isLocallyCreated: false,
                    roomKey: window.__ROOM_UID__ || null,
                    adminUsers: [],
                    hasPassword: false,
                    createdBy: null  // 搜索房间：无房主
                };
                log('system', '🔍 创建搜索房间配置（无房主）');
            }
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

                // 显示房间类型和用户身份
                if (roomConfig) {
                    const roomTypeText = roomConfig.roomType === ROOM_TYPES.REGISTERED ? '🔐 正式房间' : '🔓 临时房间';
                    const isOwner = roomConfig.createdBy === nickname;
                    const roleText = isOwner ? '👑 房主' : '👤 访客';

                    // 更新状态显示
                    const statusEl = mountEl.querySelector('#mqtt-status');
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color: var(--success-color);">${roomTypeText}</span> <span style="color: var(--info-color);">${roleText}</span>`;
                    }
                }

                // 清空之前的在线用户列表，然后添加自己
                clearOnlineUsers();
                addOnlineUser(nickname);

                const adminTopic = `game/${roomId}/admin`;
                const moderationTopic = `game/${roomId}/moderation`;
                const configTopic = `game/${roomId}/config`;  // 配置主题
                const permissionsTopic = `game/${roomId}/permissions`;  // 权限主题（最重要！）

                client.subscribe([messageTopic, presenceTopic, adminTopic, moderationTopic, configTopic, permissionsTopic], (err) => {
                    if (!err) {
                        publishPresence('join');
                        updateUI(true);

                        // 如果是房主，发布房间配置（移到订阅成功后）
                        if (roomConfig && roomConfig.createdBy === nickname) {
                            // 延迟一点发布，确保订阅已经生效
                            setTimeout(() => {
                                publishRoomConfig();
                            }, 500);
                        }

                        // 添加房间到历史记录
                        addToRoomHistory(roomId, nickname);
                        // 加载历史聊天记录
                        loadChatHistoryToUI(roomId);
                        
                        // 保存房间配置到本地（确保房主权限和密钥被持久化）
                        if (roomConfig) {
                            if (roomConfig.isLocallyCreated === false) {
                                saveBasicRoomConfig(roomId, nickname);
                            } else {
                                // 对于本地创建的房间，也要保存配置以确保房主权限和密钥持久化
                                saveRoomConfig();
                            }
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

                    // 清理密码验证相关的全局变量
                    delete window.__remoteRoomConfig__;
                    delete window.__passwordVerified__;
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
                        // 重新尝试连接
                        connectToMqttRoom();
                    }, 2000);
                } else {
                    updateStatus('disconnected', '❌ 连接失败');
                    updateConnectionStatus('disconnected');
                    updateUI(false);
                    clearOnlineUsers(); // 清空在线用户列表

                    // 清理密码验证相关的全局变量
                    delete window.__remoteRoomConfig__;
                    delete window.__passwordVerified__;
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
                        
                        // 如果是房主离开，询问是否释放房间
                        if (roomConfig && roomConfig.createdBy === nickname) {
                            const releaseRoom = confirm(
                                `您是房主，是否要释放房间 "${roomId}"？\n\n` +
                                `⚠️ 释放风险：\n` +
                                `- 房间ID将可被其他人占用\n` +
                                `- 如果ID被占用，您需要使用新ID恢复房间\n` +
                                `- 其他用户将无法再加入此房间\n\n` +
                                `✅ 不释放的好处：\n` +
                                `- 房间保持激活，其他用户可继续使用\n` +
                                `- 您随时可以用房主身份重新加入\n` +
                                `- 房间ID永远为您保留\n\n` +
                                `建议：长期房间选择"取消"保留，临时房间选择"确定"释放`
                            );

                            if (releaseRoom) {
                                // 清除房间占用信息
                                clearRoomOccupation(roomId);
                                publishRoomClosed(roomId);
                                log('system', '房主离开，房间已释放');
                            } else {
                                log('system', '房主离开，房间保持激活状态');
                            }
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

        // 检查是否需要密码验证
        if (window.__remoteRoomConfig__ && window.__remoteRoomConfig__.hasPassword && !window.__passwordVerified__) {
            showAlert('⚠️ 请先输入房间密码才能发送消息！');
            const passwordInput = mountEl.querySelector('.room-password-input');
            if (passwordInput) {
                passwordInput.focus();
            }
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
            
            // 处理权限消息（最优先！）
            if (topic === `game/${roomId}/permissions`) {
                handleRoomPermissions(data);
                return;
            }

            // 处理配置消息
            if (topic === `game/${roomId}/config`) {
                await handleRoomConfig(data);
                return;
            }

            if (topic === messageTopic && data.type === 'chat') {
                // 检查是否需要密码验证才能看到消息
                if (window.__remoteRoomConfig__ && window.__remoteRoomConfig__.hasPassword && !window.__passwordVerified__) {
                    // 未验证密码，显示提示而不是消息内容
                    log('system', '🔒 [需要密码才能查看消息]');
                    return;
                }
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
                    // 根据当前主题设置背景色
                    const mqttScreen = mountEl.querySelector('.mqtt-room-screen');
                    const isDarkTheme = mqttScreen && (mqttScreen.classList.contains('dark-theme') || 
                                                       mqttScreen.getAttribute('data-theme') === 'dark');
                    
                    if (isDarkTheme) {
                        // 夜间模式使用深色背景
                        userEl.style.background = isUserAdmin ? 'rgba(102, 126, 234, 0.3)' : 'rgba(26, 31, 38, 0.8)';
                        userEl.style.color = isUserAdmin ? '#e9eef6' : '#9fb1c7';
                    } else {
                        // 日间模式使用原来的亮色背景
                        userEl.style.background = isUserAdmin ? '#fff3cd' : '#e8f5e8';
                        userEl.style.color = isUserAdmin ? '#856404' : '#2e7d32';
                    }
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

        // 显示/隐藏设置按钮
        if (elements.roomSettingsBtn) {
            elements.roomSettingsBtn.style.display = connected ? 'block' : 'none';
        }

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