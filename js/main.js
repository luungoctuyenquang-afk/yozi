// 主入口文件
document.addEventListener('DOMContentLoaded', () => {
    // 捕获未处理的Promise错误
    window.addEventListener('unhandledrejection', event => {
        console.warn('未处理的Promise错误：', event.reason);
        event.preventDefault();
    });
    
    // 初始化数据库
    Database.init();
    
    // 主程序入口
    async function main() {
        try {
            // 加载世界状态
            await Database.loadWorldState();
            
            // 初始化时钟
            Utils.updateClock();
            setInterval(Utils.updateClock, 30000);
            
            // 渲染主屏幕
            renderHomeScreen();
            
            // 显示锁屏
            Utils.showScreen('lock-screen');
            
            // 刷新变量演示
            setTimeout(() => {
                if (window.refreshVarsDemo) window.refreshVarsDemo();
            }, 100);
            
            // 绑定所有事件
            bindEvents();

            // 实时收益系统（每分钟执行一次）
            setInterval(async () => {
                const state = StateManager.get();
                const incomeRule = state.worldBook.find(rule => rule.id === 'rule001');
                const incomePerMinute = incomeRule ? (incomeRule.value || 0) : 0;

                if (incomePerMinute > 0) {
                    state.ai.money += incomePerMinute;
                    console.log(`[实时收益] AI获得了 ${incomePerMinute} 金币，当前余额：${state.ai.money}`);

                    // 如果当前在钱包界面，立即更新显示
                    const walletScreen = document.getElementById('wallet-screen');
                    if (walletScreen && walletScreen.style.display !== 'none') {
                        WalletScreen.render();
                    }

                    // 保存状态
                    await Database.saveWorldState();
                }
            }, 60000); // 每60秒执行一次

            // 测试用：每10秒更新一次（可以更快看到效果）
            // 正式使用时可以删除这段
            setInterval(async () => {
                const state = StateManager.get();
                const incomeRule = state.worldBook.find(rule => rule.id === 'rule001');
                const incomePerMinute = incomeRule ? (incomeRule.value || 0) : 0;

                if (incomePerMinute > 0) {
                    // 按比例计算10秒的收益
                    const income10Seconds = Math.floor(incomePerMinute / 6);
                    if (income10Seconds > 0) {
                        state.ai.money += income10Seconds;
                        console.log(`[测试收益] AI获得了 ${income10Seconds} 金币（10秒），当前余额：${state.ai.money}`);

                        // 如果当前在钱包界面，立即更新显示
                        const walletScreen = document.getElementById('wallet-screen');
                        if (walletScreen && walletScreen.style.display !== 'none') {
                            WalletScreen.render();
                        }

                        await Database.saveWorldState();
                    }
                }
            }, 10000); // 每10秒执行一次（测试用）
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            alert('应用启动失败，请刷新页面重试');
        }
    }
    
    // 渲染主屏幕
    function renderHomeScreen() {
        const state = StateManager.get();
        const aiNameDisplay = document.getElementById('ai-name-display');
        if (aiNameDisplay && state.ai) {
            aiNameDisplay.textContent = state.ai.name;
        }

        const playerNameDisplay = document.getElementById('player-name-display');
        if (playerNameDisplay && state.player) {
            playerNameDisplay.textContent = state.player.name || '你';
        }
    }
    
    // 绑定所有事件
    function bindEvents() {
        const state = StateManager.get();
        
        // 全局MQTT应用实例
        let mqttRoomApp = null;
        
        // 锁屏时间更新
        function updateLockScreen() {
            const pad2 = n => String(n).padStart(2, '0');
            const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const d = new Date();
            const hh = pad2(d.getHours()), mm = pad2(d.getMinutes());

            // 更新时间
            const timeEl = document.getElementById('big-time');
            if (timeEl) timeEl.textContent = hh + ':' + mm;

            // 更新日期
            const dateEl = document.getElementById('date-text');
            if (dateEl) {
                const dateLine = (d.getMonth() + 1) + '月' + d.getDate() + '日' + week[d.getDay()];
                dateEl.textContent = dateLine;
            }

            // 更新进度（今日进度和周进度）
            const now = new Date();
            const dayProgress = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
            const weekProgress = ((now.getDay() || 7) - 1 + dayProgress) / 7;

            // 更新周进度
            const weekPercent = Math.round(weekProgress * 100);
            const leftPercentEl = document.getElementById('left-percent');
            if (leftPercentEl) leftPercentEl.textContent = weekPercent + '%';

            // 更新周进度条
            const widgetsEl = document.querySelector('.widgets');
            if (widgetsEl) widgetsEl.style.setProperty('--pct', weekProgress);

            // 更新今日进度环
            const ringEl = document.getElementById('ring');
            if (ringEl) {
                const dayPercent = Math.round(dayProgress * 100);
                ringEl.style.setProperty('--val', dayProgress);
            }
        }

        // 每分钟更新一次
        setInterval(updateLockScreen, 60000);
        updateLockScreen();

        // 锁屏解锁
        Utils.safeBind(document.getElementById('lock-screen'), 'click', async () => {
            Utils.showScreen('home-screen');
            renderHomeScreen();
            await Database.saveWorldState();

            // iOS PWA提示
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isStandalone = window.navigator.standalone === true;
            const lastInstallPrompt = localStorage.getItem('lastInstallPrompt');
            const now = Date.now();
            
            if (isIOS && !isStandalone && (!lastInstallPrompt || now - parseInt(lastInstallPrompt) > 86400000 * 3)) {
                setTimeout(() => {
                    alert('💡 重要提示：将本应用添加到主屏幕可以永久保存您的数据！\n\n' +
                          '请点击Safari底部的"分享"按钮，然后选择"添加到主屏幕"。\n\n' +
                          '否则您的所有聊天记录和设置可能会在7天后被iOS系统自动清除。');
                    localStorage.setItem('lastInstallPrompt', now.toString());
                }, 2000);
            }
        });
        
        // 聊天应用
        Utils.safeBind(document.getElementById('open-chat-app'), 'click', async () => {
            Utils.showScreen('chat-screen');
            ChatScreen.render();

            // 处理离线后的欢迎消息
            if (state.session.minutesAway > 0) {
                // 先检查是否有有效的API配置
                const activePresetId = state.apiConfig.activePresetId;
                const config = state.apiConfig.presets.find(p => p.id === activePresetId);

                if (config && config.apiKey && config.model) {
                    const aiResponse = await AI.getResponse([{text: ''}]);
                    let aiGreeting, thoughtText;

                    if (typeof aiResponse === 'object' && aiResponse.text) {
                        aiGreeting = aiResponse.text;
                        thoughtText = aiResponse.thought;
                    } else {
                        aiGreeting = aiResponse;
                        thoughtText = null;
                    }

                    if (aiGreeting && !aiGreeting.includes('系统提示') && !aiGreeting.includes('调试信息')) {
                        state.chat.history.push({
                            sender: 'ai',
                            content: [{text: aiGreeting}],
                            thoughtText: thoughtText,
                            timestamp: Date.now()
                        });
                        ChatScreen.render();
                    }
                } else {
                    // 如果没有API配置，显示简单的欢迎消息
                    const offlineMessage = `欢迎回来！你离开了${state.session.minutesAway}分钟，我赚了${state.session.moneyEarned}金币呢～`;
                    state.chat.history.push({
                        sender: 'ai',
                        content: [{text: offlineMessage}],
                        timestamp: Date.now()
                    });
                    ChatScreen.render();
                }

                state.session.minutesAway = 0;
                state.session.moneyEarned = 0;
                await Database.saveWorldState();
            }
        });
        
        // MQTT聊天室应用
        Utils.safeBind(document.getElementById('open-mqtt-room-app'), 'click', () => {
            Utils.showScreen('mqtt-room-screen');
            const container = document.getElementById('mqtt-room-container');
            if (container) {
                // 如果应用还没有初始化，则创建新实例
                if (!mqttRoomApp) {
                    mqttRoomApp = createMqttRoomApp({
                        mountEl: container,
                        getPlayerName: () => {
                            const state = StateManager.get();
                            return state.player?.name || '你';
                        },
                        brokerUrl: 'wss://test.mosquitto.org:8081/mqtt'
                    });
                }
            }
        });
        
        // 聊天发送消息
        Utils.safeBind(document.getElementById('chat-input-form'), 'submit', async (event) => {
            event.preventDefault();
            const chatInput = document.getElementById('chat-input');
            const userInput = chatInput.value.trim();
            if (userInput === '') return;
            await ChatScreen.handleSend(userInput);
        });
        
        // 发送图片
        Utils.safeBind(document.getElementById('send-image-btn'), 'click', () => {
            document.getElementById('image-input').click();
        });
        
        Utils.safeBind(document.getElementById('image-input'), 'change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                await ChatScreen.handleImageUpload(file);
                event.target.value = null;
            }
        });
        
        // 返回按钮
        Utils.safeBind(document.getElementById('back-to-home-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        // 钱包应用
        Utils.safeBind(document.getElementById('open-wallet-app'), 'click', () => {
            Utils.showScreen('wallet-screen');
            WalletScreen.render();
        });

        Utils.safeBind(document.getElementById('wallet-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });

        // 钱包刷新按钮
        Utils.safeBind(document.getElementById('wallet-refresh-btn'), 'click', () => {
            WalletScreen.render();
            console.log('钱包余额已刷新');
        });
        
        // 商店应用
        Utils.safeBind(document.getElementById('open-store-app'), 'click', () => {
            Utils.showScreen('store-screen');
            StoreScreen.render();
        });
        
        Utils.safeBind(document.getElementById('store-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        Utils.safeBind(document.getElementById('item-list'), 'click', (event) => {
            if (event.target.classList.contains('buy-btn')) {
                const itemId = event.target.dataset.itemId;
                StoreScreen.buyItem(itemId);
            }
        });
        
        // 背包应用
        Utils.safeBind(document.getElementById('open-backpack-app'), 'click', () => {
            Utils.showScreen('backpack-screen');
            BackpackScreen.render();
        });
        
        Utils.safeBind(document.getElementById('backpack-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        Utils.safeBind(document.getElementById('inventory-list'), 'click', (event) => {
            if (event.target.classList.contains('use-btn')) {
                const itemName = event.target.dataset.itemName;
                BackpackScreen.useItem(itemName);
            }
        });
        
        // 世界书应用
        Utils.safeBind(document.getElementById('open-world-book-app'), 'click', () => {
            Utils.showScreen('world-book-screen');
            WorldBookV2.init();
        });

        Utils.safeBind(document.getElementById('world-book-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });

        // API设置应用
        Utils.safeBind(document.getElementById('open-settings-app'), 'click', () => {
            Utils.showScreen('settings-screen');
            SettingsScreen.render();
        });
        
        Utils.safeBind(document.getElementById('settings-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        Utils.safeBind(document.getElementById('save-settings-btn'), 'click', async () => {
            const button = document.getElementById('save-settings-btn');
            button.textContent = '保存中...';
            button.disabled = true;
            try {
                await SettingsScreen.saveCurrentPreset();
            } finally {
                button.textContent = '保存当前预设';
                button.disabled = false;
            }
        });
        
        Utils.safeBind(document.getElementById('test-api-btn'), 'click', () => {
            SettingsScreen.testApiConnection();
        });
        
        Utils.safeBind(document.getElementById('api-preset-select'), 'change', () => {
            SettingsScreen.selectPreset();
        });
        
        Utils.safeBind(document.getElementById('new-preset-btn'), 'click', () => {
            SettingsScreen.createNewPreset();
        });
        
        Utils.safeBind(document.getElementById('delete-preset-btn'), 'click', () => {
            SettingsScreen.deleteCurrentPreset();
        });
        
        Utils.safeBind(document.getElementById('fetch-models-btn'), 'click', () => {
            SettingsScreen.fetchModels();
        });
        
        // 世界书导入功能
        Utils.safeBind(document.getElementById('wi-btn'), 'click', () => {
            document.getElementById('wi-import').click();
        });
        
        Utils.safeBind(document.getElementById('wi-import'), 'change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                await window.importWorldBookFromFile(file);
            } catch (error) {
                console.error('WorldBook import failed:', error);
            }
            // 清空文件选择器
            event.target.value = '';
        });

        Utils.safeBind(document.getElementById('export-data-btn'), 'click', () => {
            SettingsScreen.exportData();
        });
        
        Utils.safeBind(document.getElementById('import-data-btn'), 'click', () => {
            document.getElementById('import-file-input').click();
        });
        
        Utils.safeBind(document.getElementById('import-file-input'), 'change', (event) => {
            SettingsScreen.importData(event);
        });
        
        // iOS风格设置应用 (新增)
        Utils.safeBind(document.getElementById('open-ios-settings-app'), 'click', () => {
            IOSSettings.show();  // 只调用show，init在内部处理
        });

        // 通用设置应用
        Utils.safeBind(document.getElementById('open-general-settings-app'), 'click', () => {
            Utils.showScreen('general-settings-screen');
            GeneralSettingsScreen.render();
        });
        
        Utils.safeBind(document.getElementById('general-settings-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        // MQTT聊天室返回按钮（使用事件委托，避免时序问题）
        Utils.safeBind(document, 'click', (e) => {
            if (e.target && e.target.id === 'mqtt-back-btn') {
                console.log('主应用中的MQTT返回按钮被点击');
                // 如果MQTT应用存在且连接中，先断开连接
                if (window.currentMqttRoomApp && typeof window.currentMqttRoomApp.leave === 'function') {
                    console.log('正在离开MQTT房间...');
                    window.currentMqttRoomApp.leave();
                }
                console.log('切换到主页面');
                Utils.showScreen('home-screen');
            }
        });
        
        Utils.safeBind(document.getElementById('save-general-settings-btn'), 'click', () => {
            GeneralSettingsScreen.save();
        });

        Utils.safeBind(document.getElementById('chain-of-thought-switch'), 'change', () => {
            GeneralSettingsScreen.toggleChainOfThought();
        });

        Utils.safeBind(document.getElementById('debug-settings-btn'), 'click', () => {
            const state = StateManager.get();
            const settings = state.chats['chat_default'].settings;
            console.log('当前设置状态：', {
                启用思维链: settings.enableChainOfThought,
                显示思维链: settings.showThoughtAsAlert,
                开关状态: {
                    启用开关: document.getElementById('chain-of-thought-switch').checked,
                    显示开关: document.getElementById('show-thought-alert-switch').checked
                }
            });
            alert(`设置状态：\n启用思维链: ${settings.enableChainOfThought}\n显示思维链: ${settings.showThoughtAsAlert}`);
        });

        Utils.safeBind(document.getElementById('fix-data-btn'), 'click', async () => {
            const state = StateManager.get();
            state.chat.history = Utils.upgradeChatHistory(state.chat.history);
            const settings = state.chats['chat_default'].settings;
            settings.enableChainOfThought ??= false;
            settings.showThoughtAsAlert ??= false;
            if (!settings.enableChainOfThought) {
                settings.showThoughtAsAlert = false;
            }
            await Database.saveWorldState();
            GeneralSettingsScreen.render();
            alert('数据修复完成！');
        });

        Utils.safeBind(document.getElementById('clean-thought-btn'), 'click', async () => {
            const state = StateManager.get();

            // 清理所有聊天记录中的思维链标签
            state.chat.history = state.chat.history.map(msg => {
                if (msg.sender === 'ai' && msg.content) {
                    const thoughtPatterns = [
                        /<thought>[\s\S]*?<\/thought>/gi,
                        /<thinking>[\s\S]*?<\/thinking>/gi
                    ];

                    msg.content = msg.content.map(part => {
                        if (part.text) {
                            let cleanText = part.text;
                            for (const pattern of thoughtPatterns) {
                                const match = cleanText.match(pattern);
                                if (match) {
                                    const thoughtMatch = cleanText.match(/<thought>([\s\S]*?)<\/thought>/i) ||
                                                        cleanText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
                                    if (thoughtMatch && thoughtMatch[1] && !msg.thoughtText) {
                                        msg.thoughtText = thoughtMatch[1].trim();
                                    }
                                    cleanText = cleanText.replace(pattern, '').trim();
                                }
                            }
                            part.text = cleanText;
                        }
                        return part;
                    });
                }
                return msg;
            });

            await Database.saveWorldState();
            ChatScreen.render();
            alert('思维链显示问题已清理！');
        });
    }
    
    // 启动应用
    main();
});
