// iOS风格设置界面模块
const IOSSettings = {
    // 标记是否已初始化
    initialized: false,

    // 安全区CSS变量映射
    safeAreaConfig: {
        'home-screen': '--home-safe-area-color',
        'chat-screen': '--chat-safe-area-color',
        'wallet-screen': '--wallet-safe-area-color',
        'store-screen': '--store-safe-area-color',
        'backpack-screen': '--backpack-safe-area-color',
        'settings-screen': '--settings-safe-area-color'
    },

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
                Utils.showScreen('appearance-settings');
                this.initAppearanceSettings();
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
    },

    // 初始化外观设置
    initAppearanceSettings() {
        const screenSelector = document.getElementById('screen-selector');
        const colorSectionTitle = document.getElementById('color-section-title');
        const resetBtnText = document.getElementById('reset-btn-text');
        const preview = document.getElementById('color-preview');

        // 默认颜色配置
        const defaultColors = {
            'lock-screen': 'default', // 星空背景
            'home-screen': '#f9f9f9',
            'chat-screen': '#ffffff',
            'wallet-screen': '#ffffff',
            'store-screen': '#ffffff',
            'settings-screen': '#f8f8f8'
        };

        // 界面名称映射
        const screenNames = {
            'lock-screen': '锁屏',
            'home-screen': '主界面',
            'chat-screen': '聊天界面',
            'wallet-screen': '钱包',
            'store-screen': '商店',
            'settings-screen': '设置'
        };

        // 切换界面时更新UI
        if (screenSelector) {
            screenSelector.addEventListener('change', () => {
                const screen = screenSelector.value;
                const savedColor = localStorage.getItem(`screen-color-${screen}`) || defaultColors[screen];

                // 更新标题
                if (colorSectionTitle) {
                    colorSectionTitle.textContent = `🎨 ${screenNames[screen]}背景颜色`;
                }
                if (resetBtnText) {
                    resetBtnText.textContent = `恢复${screenNames[screen]}默认颜色`;
                }

                // 更新颜色按钮状态
                document.querySelectorAll('.color-btn').forEach(btn => {
                    btn.classList.remove('color-btn-active');
                    if (btn.dataset.color === savedColor) {
                        btn.classList.add('color-btn-active');
                    }
                });

                // 更新预览
                this.updatePreview(screen, savedColor);
            });
        }

        // 颜色按钮事件
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const screen = screenSelector.value;
                const color = btn.dataset.color;
                this.setScreenColor(screen, color);

                // 更新激活状态
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('color-btn-active'));
                btn.classList.add('color-btn-active');
            });
        });

        // 自定义颜色
        const applyBtn = document.getElementById('apply-custom-color');
        const hexInput = document.getElementById('custom-color-hex');
        if (applyBtn && hexInput) {
            applyBtn.addEventListener('click', () => {
                const screen = screenSelector.value;
                const color = hexInput.value;
                if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
                    this.setScreenColor(screen, color);
                    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('color-btn-active'));
                } else {
                    alert('请输入正确的颜色编码，如 #ff6b6b');
                }
            });
        }

        // 重置当前界面颜色
        const resetBtn = document.getElementById('reset-screen-color');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const screen = screenSelector.value;
                this.setScreenColor(screen, defaultColors[screen]);
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('color-btn-active'));
                const defaultBtn = document.querySelector(`[data-color="${defaultColors[screen]}"]`);
                if (defaultBtn) defaultBtn.classList.add('color-btn-active');
            });
        }

        // 重置所有颜色
        const resetAllBtn = document.getElementById('reset-all-colors');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                Object.keys(defaultColors).forEach(screen => {
                    localStorage.removeItem(`screen-color-${screen}`);
                    this.applyScreenColor(screen, defaultColors[screen]);
                });
                alert('所有界面颜色已重置');
                screenSelector.dispatchEvent(new Event('change'));
            });
        }

        // 初始加载时触发一次
        screenSelector.dispatchEvent(new Event('change'));
    },

    // 设置界面颜色
    setScreenColor(screen, color) {
        localStorage.setItem(`screen-color-${screen}`, color);
        this.applyScreenColor(screen, color);
        this.updatePreview(screen, color);
    },

    // 应用界面颜色
    applyScreenColor(screen, color) {
        const element = document.getElementById(screen);
        if (!element) return;

        if (screen === 'lock-screen') {
            // 锁屏特殊处理
            if (color === 'default') {
                element.style.background = `radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.28), transparent 60%),
                                           linear-gradient(180deg, #060d22 0%, #0a173f 55%, #0a1a4a 100%)`;
                // PWA模式下同步更新容器背景
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    document.documentElement.style.setProperty('--mobile-container-bg',
                        'linear-gradient(180deg, #060d22 0%, #0a173f 55%, #0a1a4a 100%)');
                }
            } else {
                element.style.background = color;
                // PWA模式下同步更新容器背景，解决底部白条
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    document.documentElement.style.setProperty('--mobile-container-bg', color);
                }
            }
        } else {
            // 其他界面
            element.style.backgroundColor = color;
        }
    },

    // 更新预览
    updatePreview(screen, color) {
        const preview = document.getElementById('color-preview');
        if (!preview) return;

        if (screen === 'lock-screen' && color === 'default') {
            preview.style.background = `radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.28), transparent 60%),
                                       linear-gradient(180deg, #060d22 0%, #0a173f 55%, #0a1a4a 100%)`;
        } else {
            preview.style.background = color;
        }
    },

    // 加载所有保存的颜色
    loadSavedColors() {
        const screens = ['lock-screen', 'home-screen', 'chat-screen', 'wallet-screen', 'store-screen', 'backpack-screen', 'settings-screen'];

        screens.forEach(screen => {
            const savedColor = localStorage.getItem(`safe-area-${screen}`);
            if (!savedColor) return;

            if (screen === 'lock-screen') {
                if (savedColor === 'default') {
                    localStorage.removeItem(`safe-area-${screen}`);
                } else {
                    document.documentElement.style.setProperty('--lock-screen-bg', savedColor);
                }
                return;
            }

            const variable = this.safeAreaConfig[screen];
            if (!variable) return;

            if (savedColor === 'default') {
                document.documentElement.style.removeProperty(variable);
                localStorage.removeItem(`safe-area-${screen}`);
            } else {
                document.documentElement.style.setProperty(variable, savedColor);
            }
        });

        // 同时加载背景图片
        this.loadSavedBackgroundImages();
    },

    // 打开单个界面的安全区设置
    openScreenSettings(screenName) {
        Utils.showScreen('screen-color-settings');

        // 更新标题
        const titleEl = document.getElementById('screen-color-title');
        const screenNames = {
            'lock-screen': '锁屏',
            'home-screen': '主页',
            'chat-screen': '聊天',
            'wallet-screen': '钱包',
            'store-screen': '商店',
            'backpack-screen': '背包',
            'settings-screen': '设置'
        };

        if (titleEl) {
            titleEl.textContent = `${screenNames[screenName] || screenName}底部安全区`;
        }

        // 保存当前编辑的界面名称和临时颜色
        this.currentScreen = screenName;
        this.tempColor = localStorage.getItem(`safe-area-${screenName}`) || 'default';

        // 更新颜色按钮状态
        this.updateColorButtons(this.tempColor);

        // 更新预览
        this.updateSafeAreaPreview(this.tempColor);

        // 绑定颜色按钮事件
        this.bindColorButtonEvents();

        // 绑定自定义颜色输入
        this.bindCustomColorInput();

        // 绑定保存按钮
        this.bindSaveButton();

        // 绑定重置按钮
        this.bindResetButton();

        // 如果是主页或锁屏，显示背景图片选项
        const bgImageGroup = document.getElementById('bg-image-group');
        if (bgImageGroup) {
            if (screenName === 'home-screen' || screenName === 'lock-screen') {
                bgImageGroup.style.display = 'block';
                this.loadBackgroundImage(screenName);
            } else {
                bgImageGroup.style.display = 'none';
            }
        }
    },

    // 更新颜色按钮选中状态
    updateColorButtons(activeColor) {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('color-btn-active');
            if (btn.dataset.color === activeColor) {
                btn.classList.add('color-btn-active');
            }
        });

        // 如果是自定义颜色，更新输入框
        if (activeColor !== 'default' && activeColor.startsWith('#')) {
            const input = document.getElementById('custom-safe-area-color');
            if (input) input.value = activeColor;
        }
    },

    // 更新预览
    updateSafeAreaPreview(color) {
        const previewEl = document.getElementById('preview-safe-area');
        if (!previewEl) return;

        if (color === 'default') {
            // 默认使用渐变背景
            if (this.currentScreen === 'lock-screen') {
                previewEl.style.background = 'linear-gradient(180deg, #060d22 0%, #0a173f 55%, #0a1a4a 100%)';
            } else {
                previewEl.style.background = '#f9f9f9';
            }
        } else {
            previewEl.style.background = color;
        }
    },

    // 绑定颜色按钮事件
    bindColorButtonEvents() {
        const buttons = document.querySelectorAll('.color-btn');
        buttons.forEach(btn => {
            // 使用新的事件处理器，避免重复绑定
            btn.onclick = (e) => {
                const color = e.currentTarget.dataset.color;
                this.tempColor = color; // 保存到临时颜色
                this.updateColorButtons(color);
                this.updateSafeAreaPreview(color);
            };
        });
    },

    // 绑定自定义颜色输入
    bindCustomColorInput() {
        const applyBtn = document.getElementById('apply-safe-area-color');
        if (applyBtn) {
            applyBtn.onclick = () => {
                const input = document.getElementById('custom-safe-area-color');
                if (!input) return;

                const color = input.value.trim();
                if (!color) return;

                // 验证颜色格式
                if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    alert('请输入正确的颜色编码，如 #667eea');
                    return;
                }

                this.tempColor = color; // 保存到临时颜色
                this.updateColorButtons(color);
                this.updateSafeAreaPreview(color);
            };
        }
    },

    // 绑定保存按钮
    bindSaveButton() {
        const saveBtn = document.getElementById('save-safe-area-color');
        if (saveBtn) {
            saveBtn.onclick = () => {
                // 保存颜色到localStorage并应用到实际界面
                this.applySafeAreaColor(this.currentScreen, this.tempColor);

                // 如果是主页或锁屏，也保存背景图片
                if (this.currentScreen === 'home-screen' || this.currentScreen === 'lock-screen') {
                    this.saveBackgroundImage();
                }

                alert('设置已保存！');
            };
        }
    },

    // 绑定重置按钮
    bindResetButton() {
        const resetBtn = document.getElementById('reset-safe-area-color');
        if (resetBtn) {
            resetBtn.onclick = () => {
                this.tempColor = 'default'; // 重置为默认
                this.updateColorButtons('default');
                this.updateSafeAreaPreview('default');

                // 清空自定义颜色输入
                const input = document.getElementById('custom-safe-area-color');
                if (input) input.value = '';
            };
        }
    },

    // 应用安全区颜色到实际界面
    applySafeAreaColor(screenName, color) {
        // 根据界面类型设置不同的CSS变量
        if (screenName === 'lock-screen') {
            if (color === 'default') {
                localStorage.removeItem(`safe-area-${screenName}`);
            } else {
                localStorage.setItem(`safe-area-${screenName}`, color);
            }

            // 锁屏特殊处理 - 设置整体背景
            if (color === 'default') {
                const defaultBg = 'radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,.28), transparent 60%), linear-gradient(180deg, #060d22 0%, #0a173f 55%, #0a1a4a 100%)';
                document.documentElement.style.setProperty('--lock-screen-bg', defaultBg);
            } else {
                document.documentElement.style.setProperty('--lock-screen-bg', color);
            }
        } else {
            const variable = this.safeAreaConfig[screenName];
            if (!variable) return;

            if (color === 'default') {
                localStorage.removeItem(`safe-area-${screenName}`);
                document.documentElement.style.removeProperty(variable);
                return;
            }

            localStorage.setItem(`safe-area-${screenName}`, color);

            // 其他界面设置安全区颜色（导航栏、输入框等）
            document.documentElement.style.setProperty(variable, color);
        }
    },

    // 重置所有界面主题
    resetAllThemes() {
        if (!confirm('确定要重置所有界面的美化设置吗？')) return;

        const screens = [
            'lock-screen',
            'home-screen',
            'chat-screen',
            'wallet-screen',
            'store-screen',
            'backpack-screen',
            'settings-screen'
        ];

        screens.forEach(screen => {
            localStorage.removeItem(`safe-area-${screen}`);
            this.applySafeAreaColor(screen, 'default');
        });

        alert('所有美化设置已重置！');
    },

    // 切换日夜间模式（预留功能）
    toggleDarkMode(isDark) {
        if (isDark) {
            // 夜间模式配色方案（预留）
            console.log('切换到夜间模式');
            // 这里可以应用暗色主题
            // document.body.classList.add('dark-mode');
            localStorage.setItem('dark-mode', 'true');
        } else {
            // 日间模式配色方案（预留）
            console.log('切换到日间模式');
            // document.body.classList.remove('dark-mode');
            localStorage.setItem('dark-mode', 'false');
        }

        // 提示用户功能待完善
        alert('日夜间模式功能正在开发中，敬请期待！');
    },

    // 初始化日夜间模式开关状态
    initDarkModeToggle() {
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            const isDark = localStorage.getItem('dark-mode') === 'true';
            toggle.checked = isDark;
        }
    },

    // 选择背景图片
    selectBackgroundImage() {
        const input = document.getElementById('bg-image-input');
        if (input) {
            input.click();
        }
    },

    // 处理背景图片选择
    handleBackgroundImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 限制文件大小（2MB）
        if (file.size > 2 * 1024 * 1024) {
            alert('图片太大！请选择小于2MB的图片。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 压缩图片
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 设置最大宽高
                const maxWidth = 1920;
                const maxHeight = 1080;
                let width = img.width;
                let height = img.height;

                // 计算缩放比例
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // 转为base64（质量0.8）
                const base64 = canvas.toDataURL('image/jpeg', 0.8);

                // 显示预览
                this.showImagePreview(base64);

                // 暂存图片（点击保存时才真正保存）
                this.tempBgImage = base64;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // 显示图片预览
    showImagePreview(base64) {
        const preview = document.getElementById('bg-image-preview');
        const previewImg = document.getElementById('bg-image-preview-img');
        if (preview && previewImg) {
            previewImg.src = base64;
            preview.style.display = 'block';
        }
    },

    // 加载背景图片
    loadBackgroundImage(screenName) {
        const storageKey = `bg-image-${screenName}`;
        const savedImage = localStorage.getItem(storageKey);

        if (savedImage) {
            this.showImagePreview(savedImage);
            this.tempBgImage = savedImage;
        } else {
            // 隐藏预览
            const preview = document.getElementById('bg-image-preview');
            if (preview) {
                preview.style.display = 'none';
            }
            this.tempBgImage = null;
        }
    },

    // 移除背景图片
    removeBackgroundImage() {
        // 清除临时图片
        this.tempBgImage = null;

        // 隐藏预览
        const preview = document.getElementById('bg-image-preview');
        if (preview) {
            preview.style.display = 'none';
        }

        alert('背景图片已移除，点击保存生效');
    },

    // 保存背景图片（在保存按钮点击时调用）
    saveBackgroundImage() {
        if (!this.currentScreen) return;

        const storageKey = `bg-image-${this.currentScreen}`;
        const cssVar = this.currentScreen === 'home-screen' ? '--home-bg-image' : '--lock-bg-image';

        if (this.tempBgImage) {
            // 保存图片到localStorage
            localStorage.setItem(storageKey, this.tempBgImage);
            // 应用到CSS变量
            document.documentElement.style.setProperty(cssVar, `url("${this.tempBgImage}")`);
        } else {
            // 移除图片
            localStorage.removeItem(storageKey);
            document.documentElement.style.setProperty(cssVar, 'none');
        }
    },

    // 加载所有保存的背景图片（在页面加载时调用）
    loadSavedBackgroundImages() {
        // 加载主页背景
        const homeBg = localStorage.getItem('bg-image-home-screen');
        if (homeBg) {
            document.documentElement.style.setProperty('--home-bg-image', `url("${homeBg}")`);
        }

        // 加载锁屏背景
        const lockBg = localStorage.getItem('bg-image-lock-screen');
        if (lockBg) {
            document.documentElement.style.setProperty('--lock-bg-image', `url("${lockBg}")`);
        }
    }
};

// 暴露到全局
window.IOSSettings = IOSSettings;