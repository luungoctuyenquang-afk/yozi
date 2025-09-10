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
    
    // 在线用户管理
    let onlineUsers = new Set(); // 在线用户集合
    let userJoinTimes = new Map(); // 用户加入时间记录
    
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
                <div class="history-room">${escapeHtml(item.roomId)}</div>
                <div class="history-nickname">${escapeHtml(item.nickname)}</div>
                <div class="history-time">${timeAgo}</div>
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
                    <div class="connection-status" id="mqtt-status">未连接</div>
                </header>
                
                <div class="mqtt-content">
                    <div class="room-section">
                        <div class="room-controls">
                            <input type="text" class="room-input" placeholder="房间号" value="demo-room-001">
                            <input type="text" class="nickname-input" placeholder="昵称" value="">
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
                        
                        <div class="control-buttons">
                            <button class="connect-btn btn-connect">🔗 连接</button>
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
                            <input type="text" class="message-input" placeholder="输入消息..." disabled>
                            <button class="send-btn" disabled>📤</button>
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
                    .mqtt-room-screen {
                        --bg-primary: #f6f8fb;
                        --bg-secondary: #ffffff;
                        --card-bg: rgba(255,255,255,0.9);
                        --card-border: rgba(0,0,0,0.08);
                        --text-primary: #0b1c36;
                        --text-secondary: #5b6b80;
                        --text-muted: #9ca3af;
                    }
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
                    z-index: 100;
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
                    overflow: hidden;
                }
                
                .room-section {
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--card-border);
                    padding: var(--spacing-xl);
                    border-radius: var(--border-radius-lg);
                    box-shadow: var(--shadow-md);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    margin: 10px 0;
                    padding: 8px;
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
                    border: 1px solid #e9ecef;
                    border-radius: 4px;
                    font-size: 12px;
                    width: 120px;
                }
                
                .history-search:focus {
                    outline: none;
                    border-color: #007bff;
                }
                
                .history-title {
                    font-size: 12px;
                    font-weight: bold;
                    color: #495057;
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
                    color: #6c757d;
                }
                
                .history-export-btn:hover {
                    background: #e9ecef;
                    color: #28a745;
                }
                
                .history-import-btn:hover {
                    background: #e9ecef;
                    color: #007bff;
                }
                
                .history-clear-btn:hover {
                    background: #e9ecef;
                    color: #dc3545;
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
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                
                .history-item:hover {
                    background: #e3f2fd;
                    border-color: #bbdefb;
                }
                
                .history-room {
                    flex: 1;
                    font-weight: bold;
                    color: #1976d2;
                    font-size: 13px;
                }
                
                .history-nickname {
                    flex: 1;
                    color: #666;
                    font-size: 12px;
                    margin: 0 8px;
                }
                
                .history-time {
                    font-size: 11px;
                    color: #999;
                    margin-right: 8px;
                }
                
                .history-remove {
                    background: none;
                    border: none;
                    color: #dc3545;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .history-remove:hover {
                    background: #f8d7da;
                }
                
                .no-results {
                    text-align: center;
                    color: #999;
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
                    min-height: 300px;
                    max-height: calc(100vh - 200px);
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
                
                /* 手机屏幕适配 - 专门为375px×667px虚拟手机优化 */
                @media (max-width: 480px) {
                    :root {
                        --spacing-xs: 3px;
                        --spacing-sm: 6px;
                        --spacing-md: 10px;
                        --spacing-lg: 14px;
                        --spacing-xl: 18px;
                        --spacing-2xl: 22px;
                        --border-radius: 10px;
                        --border-radius-sm: 6px;
                        --border-radius-lg: 14px;
                    }
                    
                    .mqtt-content {
                        padding: var(--spacing-md);
                        gap: var(--spacing-md);
                    }
                    
                    .room-section {
                        padding: var(--spacing-lg);
                        border-radius: var(--border-radius-lg);
                    }
                    
                    .room-controls {
                        flex-direction: column;
                        gap: var(--spacing-sm);
                    }
                    
                    .room-controls input {
                        min-width: unset;
                        padding: var(--spacing-md) var(--spacing-lg);
                        font-size: 15px;
                    }
                    
                    .mqtt-header {
                        padding: var(--spacing-lg);
                    }
                    
                    .mqtt-header h2 {
                        font-size: 16px;
                        font-weight: 600;
                    }
                    
                    .messages {
                        padding: var(--spacing-md);
                    }
                    
                    .message {
                        padding: var(--spacing-sm) var(--spacing-md);
                        margin-bottom: var(--spacing-sm);
                    }
                    
                    .message.own-message {
                        margin-left: 40px;
                    }
                    
                    .input-area {
                        padding: var(--spacing-md);
                        gap: var(--spacing-sm);
                    }
                    
                    .input-area input {
                        padding: var(--spacing-sm) var(--spacing-md);
                        font-size: 15px;
                    }
                    
                    .input-area button {
                        width: 40px;
                        height: 40px;
                        font-size: 14px;
                    }
                    
                    .control-buttons button {
                        padding: var(--spacing-sm) var(--spacing-md);
                        font-size: 13px;
                    }
                    
                    .connection-status {
                        font-size: 11px;
                        padding: var(--spacing-xs) var(--spacing-sm);
                    }
                    
                    .chat-container {
                        min-height: 250px;
                        max-height: calc(100vh - 180px);
                    }
                    
                    /* 优化小屏幕下的背景效果 */
                    .mqtt-room-screen::before {
                        filter: blur(30px);
                        opacity: 0.4;
                    }
                    
                    @media (prefers-color-scheme: light) {
                        .mqtt-room-screen::before {
                            opacity: 0.2;
                        }
                    }
                    
                    /* 优化房间历史记录在小屏幕的显示 */
                    .history-list {
                        max-height: 100px;
                    }
                    
                    .history-item {
                        padding: var(--spacing-xs) var(--spacing-sm);
                        margin: 1px 0;
                    }
                    
                    .history-room, .history-nickname {
                        font-size: 12px;
                    }
                    
                    .history-time {
                        font-size: 10px;
                    }
                    
                    /* 在线用户信息优化 */
                    .online-count {
                        font-size: 13px;
                        padding: var(--spacing-xs) var(--spacing-sm);
                    }
                }
            </style>
        `;
        
        // 获取UI元素引用
        elements = {
            backBtn: mountEl.querySelector('#mqtt-back-btn'),
            roomInput: mountEl.querySelector('.room-input'),
            nicknameInput: mountEl.querySelector('.nickname-input'),
            connectBtn: mountEl.querySelector('.connect-btn'),
            leaveBtn: mountEl.querySelector('.leave-btn'),
            statusDisplay: mountEl.querySelector('.status-display'),
            connectionStatus: mountEl.querySelector('#mqtt-status'),
            currentBroker: mountEl.querySelector('#current-broker'),
            messages: mountEl.querySelector('#messages-container'),
            messageInput: mountEl.querySelector('.message-input'),
            sendBtn: mountEl.querySelector('.send-btn'),
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
        
        // 设置默认昵称
        elements.nicknameInput.value = getPlayerName() || '匿名用户';
        updateBrokerDisplay();
        
        // 加载房间历史记录
        loadRoomHistory();
        updateRoomHistoryDisplay();
        
        // 加载聊天记录
        loadChatHistory();
        
        // 绑定事件
        bindEvents();
    }
    
    function bindEvents() {
        // 连接按钮
        elements.connectBtn.addEventListener('click', () => connectRoom());
        
        // 离开按钮
        elements.leaveBtn.addEventListener('click', () => leaveRoom());
        
        // 发送按钮
        elements.sendBtn.addEventListener('click', () => sendMessage());
        
        // 回车发送消息
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // 回车连接房间
        elements.roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isConnected) connectRoom();
        });
        
        elements.nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isConnected) connectRoom();
        });
        
        // 在线人数点击切换显示用户列表
        elements.onlineCountDisplay.addEventListener('click', () => {
            const isVisible = elements.onlineList.style.display !== 'none';
            elements.onlineList.style.display = isVisible ? 'none' : 'block';
        });
        
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
    
    async function connectRoom() {
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
                
                client.subscribe([messageTopic, presenceTopic], (err) => {
                    if (!err) {
                        publishPresence('join');
                        updateUI(true);
                        // 添加房间到历史记录
                        addToRoomHistory(roomId, nickname);
                        // 加载历史聊天记录
                        loadChatHistoryToUI(roomId);
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
                        log('system', '正在离开房间...');
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
        
        try {
            const message = {
                type: 'chat',
                name: nickname,
                text: text,
                timestamp: Date.now()
            };
            
            client.publish(messageTopic, JSON.stringify(message), (err) => {
                if (err) {
                    console.error('消息发送失败:', err);
                    log('system', '❌ 消息发送失败');
                }
            });
            
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
    
    function handleMessage(topic, message) {
        try {
            const data = JSON.parse(message);
            
            if (topic === messageTopic && data.type === 'chat') {
                const isOwnMessage = data.name === nickname;
                addChatMessage(data.name, data.text, data.timestamp, isOwnMessage);
            } else if (topic === presenceTopic) {
                // 处理用户加入/离开的presence消息
                if (data.type === 'join') {
                    addOnlineUser(data.name);
                    if (data.name !== nickname) {
                        log('presence', `${data.name} 加入了房间`, data.timestamp);
                    }
                } else if (data.type === 'leave') {
                    removeOnlineUser(data.name);
                    if (data.name !== nickname) {
                        log('presence', `${data.name} 离开了房间`, data.timestamp);
                    }
                }
            }
        } catch (error) {
            log('system', `消息解析错误: ${error.message}`);
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
                userEl.textContent = user;
                
                // 如果是当前用户，添加特殊样式
                if (user === nickname) {
                    userEl.style.background = '#e8f5e8';
                    userEl.style.color = '#2e7d32';
                    userEl.style.fontWeight = 'bold';
                    userEl.textContent = user + ' (我)';
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
        elements.connectBtn.disabled = connected;
        elements.leaveBtn.disabled = !connected;
        elements.messageInput.disabled = !connected;
        elements.sendBtn.disabled = !connected;
        elements.roomInput.disabled = connected;
        elements.nicknameInput.disabled = connected;
        
        if (connected) {
            elements.messageInput.focus();
        }
    }
    
    // 初始化UI
    createUI();
    
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