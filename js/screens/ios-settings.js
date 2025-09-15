// iOS风格设置界面模块
const IOSSettings = {
    // 标记是否已初始化
    initialized: false,

    // 初始化
    init() {
        // 防止重复初始化
        if (this.initialized) return;

        this.bindEvents();
        this.updateProfile();

        // 应用保存的状态栏模式
        const savedMode = localStorage.getItem('statusbar-mode') || 'light';
        this.applyStatusBarMode(savedMode);

        this.initialized = true;
    },

    // 绑定事件
    bindEvents() {
        const root = document.querySelector('#ios-settings-minimal');
        if (!root) {
            console.warn('IOSSettings: 找不到根元素 #ios-settings-minimal');
            return;
        }

        // 返回按钮
        const backBtn = root.querySelector('.iosm-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                Utils.showScreen('home-screen');  // 修正为正确的主屏幕ID
            });
        }

        // 搜索功能
        const searchInput = root.querySelector('#iosm-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 所有设置项点击事件
        root.querySelectorAll('[data-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-key');
                this.navigateTo(key);
            });
        });
    },

    // 导航到具体设置页面
    navigateTo(key) {
        console.log('导航到:', key);

        switch(key) {
            case 'profile':
                // 个人资料设置
                this.showProfileSettings();
                break;

            case 'api':
                // 跳转到原有的API设置界面
                Utils.showScreen('settings');
                break;

            case 'general':
                // 跳转到原有的通用设置界面
                Utils.showScreen('general-settings');
                break;

            case 'worldbook':
                // 跳转到世界书界面
                Utils.showScreen('worldbook');
                break;

            case 'chat':
                // 跳转到聊天界面
                Utils.showScreen('chat');
                break;

            case 'data':
                // 数据管理功能
                this.showDataManagement();
                break;

            case 'wallet':
                // 跳转到钱包界面
                Utils.showScreen('wallet');
                break;

            case 'store':
                // 跳转到商店界面
                Utils.showScreen('store');
                break;

            case 'backpack':
                // 跳转到背包界面
                Utils.showScreen('backpack');
                break;

            case 'mqtt':
                // 跳转到MQTT聊天室
                if (window.MqttRoomApp) {
                    MqttRoomApp.show();
                } else {
                    alert('MQTT聊天室功能未加载');
                }
                break;

            case 'appearance':
                // 外观主题设置
                this.showAppearanceSettings();
                break;

            case 'cache':
                // 清理缓存
                this.clearCache();
                break;

            default:
                console.log('未实现的功能:', key);
        }
    },

    // 更新个人资料显示
    updateProfile() {
        const state = StateManager.get();
        const nameEl = document.querySelector('#iosm-name');
        const subEl = document.querySelector('#iosm-sub');
        const avatarEl = document.querySelector('#iosm-avatar');

        if (nameEl) {
            nameEl.textContent = state.ai?.name || '虚拟助手';
        }

        if (subEl) {
            subEl.textContent = `金币: ${state.player?.money || 0}`;
        }

        // 可以设置自定义头像
        if (avatarEl && state.ai?.avatar) {
            avatarEl.src = state.ai.avatar;
        }
    },

    // 显示个人资料设置
    showProfileSettings() {
        const state = StateManager.get();
        const newName = prompt('设置AI名称:', state.ai?.name || '虚拟助手');

        if (newName && newName.trim()) {
            StateManager.update('ai.name', newName.trim());
            Database.saveWorldState();
            this.updateProfile();
            alert('名称已更新！');
        }
    },

    // 数据管理
    showDataManagement() {
        const choice = confirm('选择操作:\n确定 = 导出数据\n取消 = 导入数据');

        if (choice) {
            // 导出数据
            this.exportData();
        } else {
            // 导入数据
            this.importData();
        }
    },

    // 导出数据
    exportData() {
        const state = StateManager.get();
        const exportData = {
            version: '2.0',
            timestamp: Date.now(),
            data: state
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtual_phone_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('数据已导出！');
    },

    // 导入数据
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importData = JSON.parse(text);

                if (!importData.data) {
                    throw new Error('无效的备份文件');
                }

                if (confirm('确定要恢复这个备份吗？当前数据将被覆盖！')) {
                    StateManager.set(importData.data);
                    await Database.saveWorldState();
                    location.reload();
                }
            } catch (err) {
                alert('导入失败: ' + err.message);
            }
        };

        input.click();
    },

    // 外观设置
    showAppearanceSettings() {
        // 获取当前状态栏模式
        const currentStatusBarMode = localStorage.getItem('statusbar-mode') || 'light';

        const message = `
外观设置

状态栏模式：
${currentStatusBarMode === 'light' ? '☀️ 日间模式（白色状态栏）' : '🌙 夜间模式（黑色状态栏）'}

选择操作：
1. 切换日夜间模式
2. 取消
        `.trim();

        const choice = prompt(message, '1');

        if (choice === '1') {
            // 切换日夜间模式
            const newMode = currentStatusBarMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('statusbar-mode', newMode);
            this.applyStatusBarMode(newMode);
            alert(`已切换为${newMode === 'light' ? '日间' : '夜间'}模式`);
        }
    },

    // 应用状态栏模式
    applyStatusBarMode(mode) {
        const themeColorMeta = document.getElementById('theme-color-meta');
        if (themeColorMeta) {
            // 日间模式用白色，夜间模式用黑色
            themeColorMeta.setAttribute('content', mode === 'light' ? '#ffffff' : '#000000');
        }

        // 更新CSS变量供其他组件使用
        document.documentElement.style.setProperty('--statusbar-mode', mode);
    },

    // 应用主题
    applyTheme(theme) {
        const root = document.documentElement;

        switch(theme) {
            case '暗黑':
                root.style.setProperty('--primary-color', '#1a1a1a');
                root.style.setProperty('--bg-color', '#000000');
                root.style.setProperty('--text-color', '#ffffff');
                break;

            case '护眼绿':
                root.style.setProperty('--primary-color', '#4a7c59');
                root.style.setProperty('--bg-color', '#e8f5e9');
                root.style.setProperty('--text-color', '#1b5e20');
                break;

            case '粉色':
                root.style.setProperty('--primary-color', '#e91e63');
                root.style.setProperty('--bg-color', '#fce4ec');
                root.style.setProperty('--text-color', '#880e4f');
                break;

            default:
                // 恢复默认
                root.style.removeProperty('--primary-color');
                root.style.removeProperty('--bg-color');
                root.style.removeProperty('--text-color');
        }
    },

    // 清理缓存
    clearCache() {
        if (confirm('确定要清理所有缓存吗？\n这不会删除你的数据，只清理临时文件。')) {
            // 清理localStorage中的临时数据
            const keysToKeep = [
                'worldState',
                'worldbook',
                'app-theme',
                'api-config'
            ];

            const allKeys = Object.keys(localStorage);
            let cleared = 0;

            allKeys.forEach(key => {
                // 只清理不在保留列表中的键
                if (!keysToKeep.some(keep => key.includes(keep))) {
                    localStorage.removeItem(key);
                    cleared++;
                }
            });

            // 清理Service Worker缓存
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }

            alert(`缓存清理完成！\n清理了 ${cleared} 个临时项目。`);
        }
    },

    // 搜索功能
    handleSearch(query) {
        const q = query.toLowerCase().trim();
        const rows = document.querySelectorAll('.iosm-row');

        rows.forEach(row => {
            const label = row.querySelector('.iosm-label');
            if (label) {
                const text = label.textContent.toLowerCase();
                if (q === '' || text.includes(q)) {
                    row.style.display = 'flex';
                } else {
                    row.style.display = 'none';
                }
            }
        });

        // 如果没有搜索内容，显示所有分组
        const groups = document.querySelectorAll('.iosm-group');
        groups.forEach(group => {
            const visibleRows = group.querySelectorAll('.iosm-row[style*="flex"]');
            if (q === '' || visibleRows.length > 0) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });
    },

    // 显示设置界面
    show() {
        // 确保初始化
        if (!this.initialized) {
            this.init();
        }

        Utils.showScreen('ios-settings-minimal');
        this.updateProfile();
    },

    // 隐藏设置界面
    hide() {
        const root = document.querySelector('#ios-settings-minimal');
        if (root) {
            root.style.display = 'none';
        }
    }
};

// 暴露到全局
window.IOSSettings = IOSSettings;