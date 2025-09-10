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
                .mqtt-room-screen {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                    background: #f5f5f5;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                
                .mqtt-header {
                    background: white;
                    padding: 15px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    gap: 15px;
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
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                
                .back-btn:hover {
                    background: #f0f0f0;
                }
                
                .mqtt-header h2 {
                    margin: 0;
                    flex: 1;
                    font-size: 18px;
                    color: #333;
                }
                
                .connection-status {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-weight: bold;
                }
                
                .connection-status.connected {
                    background: #d4edda;
                    color: #155724;
                }
                
                .connection-status.connecting {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .connection-status.disconnected {
                    background: #f8d7da;
                    color: #721c24;
                }
                
                .mqtt-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 15px;
                    gap: 15px;
                    overflow: hidden;
                }
                
                .room-section {
                    background: white;
                    padding: 15px;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .room-controls {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                }
                
                .room-controls input {
                    padding: 10px;
                    border: 2px solid #e1e5e9;
                    border-radius: 8px;
                    font-size: 16px;
                    flex: 1;
                    min-width: 120px;
                    transition: border-color 0.3s;
                }
                
                .room-controls input:focus {
                    outline: none;
                    border-color: #007bff;
                }
                
                .control-buttons {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                
                .control-buttons button {
                    padding: 10px 16px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    flex: 1;
                    transition: all 0.3s;
                }
                
                .btn-connect {
                    background: #28a745;
                    color: white;
                }
                
                .btn-connect:hover:not(:disabled) {
                    background: #218838;
                }
                
                .btn-leave {
                    background: #dc3545;
                    color: white;
                }
                
                .btn-leave:hover:not(:disabled) {
                    background: #c82333;
                }
                
                .control-buttons button:disabled {
                    background: #e9ecef;
                    color: #6c757d;
                    cursor: not-allowed;
                }
                
                .status-display {
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    text-align: center;
                }
                
                .broker-info {
                    text-align: center;
                    margin-bottom: 8px;
                    color: #666;
                }
                
                .online-users-info {
                    text-align: center;
                    margin-bottom: 8px;
                }
                
                .online-count {
                    font-size: 14px;
                    color: #28a745;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 12px;
                    background: #f8fff8;
                    border: 1px solid #d4edda;
                    margin-bottom: 8px;
                    transition: all 0.3s;
                }
                
                .online-count:hover {
                    background: #d4edda;
                }
                
                .online-list {
                    background: #f8fff8;
                    border: 1px solid #d4edda;
                    border-radius: 8px;
                    padding: 8px;
                    margin-top: 8px;
                    max-height: 120px;
                    overflow-y: auto;
                }
                
                .online-list-header {
                    font-weight: bold;
                    font-size: 12px;
                    color: #28a745;
                    margin-bottom: 6px;
                }
                
                .online-list-content {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }
                
                .online-user {
                    background: #e3f2fd;
                    color: #1976d2;
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-size: 11px;
                    border: 1px solid #bbdefb;
                }
                
                .warning {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    color: #856404;
                    text-align: center;
                }
                
                .chat-container {
                    background: white;
                    border-radius: 12px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    min-height: 300px;
                }
                
                .messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    background: #fafafa;
                }
                
                .welcome-message {
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                    padding: 20px;
                }
                
                .welcome-message p {
                    margin: 8px 0;
                }
                
                .message {
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                }
                
                .message.chat {
                    background: #e3f2fd;
                }
                
                .message.own-message {
                    background: #007bff;
                    color: white;
                    margin-left: 60px;
                }
                
                .message.presence {
                    background: #f3e5f5;
                    font-style: italic;
                    font-size: 12px;
                    text-align: center;
                }
                
                .message.system {
                    background: #fff3e0;
                    color: #ef6c00;
                    font-size: 12px;
                    text-align: center;
                }
                
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                
                .user-name {
                    font-weight: bold;
                    font-size: 13px;
                }
                
                .message-time {
                    font-size: 11px;
                    color: #666;
                    opacity: 0.7;
                }
                
                .input-area {
                    padding: 15px;
                    display: flex;
                    gap: 10px;
                    border-top: 1px solid #e9ecef;
                    background: white;
                }
                
                .input-area input {
                    flex: 1;
                    padding: 10px 15px;
                    border: 2px solid #e1e5e9;
                    border-radius: 20px;
                    font-size: 16px;
                    transition: border-color 0.3s;
                }
                
                .input-area input:focus {
                    outline: none;
                    border-color: #007bff;
                }
                
                .input-area button {
                    width: 44px;
                    height: 44px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.3s;
                }
                
                .input-area button:hover:not(:disabled) {
                    background: #0056b3;
                    transform: scale(1.05);
                }
                
                .input-area button:disabled {
                    background: #e9ecef;
                    color: #6c757d;
                    cursor: not-allowed;
                    transform: none;
                }
                
                /* 手机屏幕适配 */
                @media (max-width: 480px) {
                    .mqtt-content {
                        padding: 10px;
                        gap: 10px;
                    }
                    
                    .room-section {
                        padding: 12px;
                    }
                    
                    .room-controls {
                        flex-direction: column;
                    }
                    
                    .room-controls input {
                        min-width: unset;
                    }
                    
                    .mqtt-header {
                        padding: 12px;
                    }
                    
                    .mqtt-header h2 {
                        font-size: 16px;
                    }
                    
                    .messages {
                        padding: 10px;
                    }
                    
                    .input-area {
                        padding: 10px;
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
            onlineCountDisplay: mountEl.querySelector('.online-count')
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
        // 使用 requestAnimationFrame 优化DOM操作，避免界面卡顿
        requestAnimationFrame(() => {
            const messageEl = document.createElement('div');
            messageEl.className = `message chat ${isOwnMessage ? 'own-message' : ''}`;

            const time = new Date(timestamp).toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });

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