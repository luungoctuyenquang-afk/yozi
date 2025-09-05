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
    }
    
    // 绑定所有事件
    function bindEvents() {
        const state = StateManager.get();
        
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
                const aiResponse = await AI.getResponse([{text: ''}]);
                const aiGreeting = aiResponse.text || aiResponse;
                if (aiGreeting) {
                    state.chat.history.push({
                        sender: 'ai',
                        content: [{text: aiGreeting}],
                        thoughtText: aiResponse.thought || null,
                        timestamp: Date.now()
                    });
                    ChatScreen.render();
                    state.session.minutesAway = 0;
                    state.session.moneyEarned = 0;
                    await Database.saveWorldState();
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
            WorldBookScreen.render();
        });
        
        Utils.safeBind(document.getElementById('world-book-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        Utils.safeBind(document.getElementById('rule-list'), 'click', async (event) => {
            const target = event.target;
            
            // 编辑按钮
            if (target.classList.contains('wb-edit-btn') || target.dataset.ruleId) {
                const ruleId = target.dataset.ruleId;
                if (ruleId) {
                    WorldBookScreen.render(ruleId);
                    return;
                }
            }
            
            // 保存按钮
            if (target.classList.contains('wb-save-btn')) {
                const ruleId = target.dataset.ruleId;
                if (ruleId) {
                    await WorldBookScreen.saveEntry(ruleId);
                }
            }
            
            // 取消按钮
            if (target.classList.contains('wb-cancel-btn')) {
                const ruleId = target.dataset.ruleId;
                if (ruleId) {
                    await WorldBookScreen.cancelEdit(ruleId);
                }
            }
            
            // 删除按钮
            if (target.classList.contains('wb-delete-btn')) {
                const ruleId = target.dataset.ruleId;
                if (ruleId) {
                    await WorldBookScreen.deleteEntry(ruleId);
                }
            }
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
        
        Utils.safeBind(document.getElementById('export-data-btn'), 'click', () => {
            SettingsScreen.exportData();
        });
        
        Utils.safeBind(document.getElementById('import-data-btn'), 'click', () => {
            document.getElementById('import-file-input').click();
        });
        
        Utils.safeBind(document.getElementById('import-file-input'), 'change', (event) => {
            SettingsScreen.importData(event);
        });
        
        // 通用设置应用
        Utils.safeBind(document.getElementById('open-general-settings-app'), 'click', () => {
            Utils.showScreen('general-settings-screen');
            GeneralSettingsScreen.render();
        });
        
        Utils.safeBind(document.getElementById('general-settings-back-btn'), 'click', () => {
            Utils.showScreen('home-screen');
        });
        
        Utils.safeBind(document.getElementById('save-general-settings-btn'), 'click', () => {
            GeneralSettingsScreen.save();
        });
        
        Utils.safeBind(document.getElementById('chain-of-thought-switch'), 'change', () => {
            GeneralSettingsScreen.toggleChainOfThought();
        });
    }
    
    // 启动应用
    main();
});
