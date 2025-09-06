// API设置界面模块
const SettingsScreen = {
    render() {
        const state = StateManager.get();
        const apiPresetSelect = document.getElementById('api-preset-select');
        if (!apiPresetSelect) return;
        
        // 填充预设列表
        apiPresetSelect.innerHTML = '';
        state.apiConfig.presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            apiPresetSelect.appendChild(option);
        });
        apiPresetSelect.value = state.apiConfig.activePresetId;
        
        // 显示当前预设的信息
        const activePreset = state.apiConfig.presets.find(p => p.id === state.apiConfig.activePresetId);
        if (activePreset) {
            document.getElementById('preset-name-input').value = activePreset.name;
            document.getElementById('api-provider-select').value = activePreset.provider;
            document.getElementById('api-endpoint-input').value = activePreset.endpoint;
            document.getElementById('api-key-input').value = activePreset.apiKey;
            document.getElementById('api-model-input').value = activePreset.model;
            
            const apiModelsList = document.getElementById('api-models-list');
            if (apiModelsList) {
                apiModelsList.innerHTML = `<option value="${activePreset.model}"></option>`;
            }
        }
    },
    
    selectPreset() {
        const state = StateManager.get();
        const apiPresetSelect = document.getElementById('api-preset-select');
        state.apiConfig.activePresetId = apiPresetSelect.value;
        this.render();
    },
    
    async saveCurrentPreset() {
        const state = StateManager.get();
        const preset = state.apiConfig.presets.find(p => p.id === state.apiConfig.activePresetId);
        if (preset) {
            preset.name = document.getElementById('preset-name-input').value.trim() || '未命名预设';
            preset.provider = document.getElementById('api-provider-select').value;
            preset.endpoint = document.getElementById('api-endpoint-input').value.trim();
            preset.apiKey = document.getElementById('api-key-input').value.trim();
            preset.model = document.getElementById('api-model-input').value.trim();
            
            state.apiConfig.presets = state.apiConfig.presets.map(p => 
                p.id === preset.id ? preset : p
            );
            
            await Database.saveWorldState();
            this.render();
            alert('当前预设已保存！');
        }
    },
    
    async createNewPreset() {
        const state = StateManager.get();
        const newId = `preset_${Date.now()}`;
        const newPreset = {
            id: newId,
            name: '新预设',
            provider: 'gemini',
            endpoint: '',
            apiKey: '',
            model: 'gemini-1.5-flash-latest'
        };
        
        state.apiConfig.presets.push(newPreset);
        state.apiConfig.activePresetId = newId;
        await Database.saveWorldState();
        this.render();
    },
    
    async deleteCurrentPreset() {
        const state = StateManager.get();
        if (state.apiConfig.presets.length <= 1) {
            alert('这是最后一个预设，不能删除！');
            return;
        }
        
        if (confirm('确定要删除当前预设吗？')) {
            const activeId = state.apiConfig.activePresetId;
            state.apiConfig.presets = state.apiConfig.presets.filter(p => p.id !== activeId);
            state.apiConfig.activePresetId = state.apiConfig.presets[0].id;
            await Database.saveWorldState();
            this.render();
        }
    },
    
    async fetchModels() {
        const indicator = document.getElementById('api-status-indicator');
        indicator.textContent = '拉取中...';
        indicator.className = '';
        
        const provider = document.getElementById('api-provider-select').value;
        let endpoint = document.getElementById('api-endpoint-input').value.trim();
        const apiKey = document.getElementById('api-key-input').value.trim();
        
        if (!apiKey) {
            indicator.textContent = '失败: 请先填写API密钥。';
            indicator.className = 'error';
            return;
        }
        
        let fetchUrl;
        let headers = { 'Content-Type': 'application/json' };
        
        if (provider === 'gemini') {
            fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        } else {
            if (endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.replace('/chat/completions', '');
            }
            if (!endpoint.endsWith('/v1')) {
                endpoint = endpoint.replace(/\/$/, '') + '/v1';
            }
            fetchUrl = `${endpoint}/models`;
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        try {
            const response = await fetch(fetchUrl, { headers: headers });
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status}`);
            }
            
            const data = await response.json();
            const apiModelsList = document.getElementById('api-models-list');
            if (!apiModelsList) {
                indicator.textContent = '❌ 找不到模型列表元素';
                indicator.className = 'error';
                return;
            }
            apiModelsList.innerHTML = '';
            
            const models = provider === 'gemini' ? data.models : data.data;
            models.forEach(model => {
                const modelId = provider === 'gemini' 
                    ? model.name.replace('models/', '') 
                    : model.id;
                    
                if (provider === 'gemini' && 
                    !model.supportedGenerationMethods.includes('generateContent')) {
                    return;
                }
                
                const option = document.createElement('option');
                option.value = modelId;
                apiModelsList.appendChild(option);
            });
            
            indicator.textContent = `✅ 成功拉取模型！`;
            indicator.className = 'success';
        } catch (error) {
            indicator.textContent = `❌ 拉取失败: ${error.message}`;
            indicator.className = 'error';
        }
    },
    
    async testApiConnection() {
        const indicator = document.getElementById('api-status-indicator');
        indicator.textContent = '测试中...';
        indicator.className = '';
        
        const config = {
            provider: document.getElementById('api-provider-select').value,
            endpoint: document.getElementById('api-endpoint-input').value.trim(),
            apiKey: document.getElementById('api-key-input').value.trim(),
            model: document.getElementById('api-model-input').value
        };
        
        if (!config.apiKey) {
            indicator.textContent = '失败: 密钥不能为空。';
            indicator.className = 'error';
            return;
        }
        
        let testUrl, testBody, testHeaders;
        const testUserInput = "你好，这是一个连接测试。";
        
        if (config.provider === 'gemini') {
            testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            testHeaders = { 'Content-Type': 'application/json' };
            testBody = { contents: [{ parts: [{ text: testUserInput }] }] };
        } else {
            testUrl = config.endpoint;
            if (!testUrl.endsWith('/chat/completions')) {
                testUrl = testUrl.replace(/\/$/, '') + '/chat/completions';
            }
            testHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };
            testBody = {
                model: config.model,
                messages: [{ role: 'user', content: testUserInput }]
            };
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: testHeaders,
                body: JSON.stringify(testBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }
            
            indicator.textContent = '✅ 连接成功！';
            indicator.className = 'success';
        } catch (error) {
            indicator.textContent = `❌ 连接失败: ${error.message}`;
            indicator.className = 'error';
        }
    },
    
    exportData() {
        const state = StateManager.get();
        const dataToSave = {};
        for (const key in state) {
            if (typeof state[key] !== 'function') {
                dataToSave[key] = state[key];
            }
        }
        
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `虚拟手机备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const confirmed = confirm('警告：导入备份将覆盖所有当前数据，此操作不可撤销！确定要继续吗？');
        if (!confirmed) return;
        
        try {
            const text = await file.text();
            const importedData = JSON.parse(text);
            
            // 清空数据库
            const db = Database.db;
            await Promise.all(db.tables.map(table => table.clear()));
            
            // 导入数据
            if (importedData.player) await db.player.put({ id: 'main', ...importedData.player });
            if (importedData.ai) await db.ai.put({ id: 'main', ...importedData.ai });
            if (importedData.chat && importedData.chat.history) {
                await db.chatHistory.bulkAdd(importedData.chat.history);
            }
            
            // 处理世界书格式升级
            if (importedData.worldBook) {
                const upgradedWorldBook = Utils.upgradeWorldBook(importedData.worldBook);
                await db.worldBook.bulkPut(upgradedWorldBook);
            }
            
            if (importedData.events) await db.events.put({ id: 'main', ...importedData.events });
            if (importedData.apiConfig) await db.apiConfig.put({ id: 'main', ...importedData.apiConfig });
            if (importedData.chats) {
                for (const chatId in importedData.chats) {
                    if (importedData.chats[chatId].settings) {
                        const settings = importedData.chats[chatId].settings;
                        if (typeof settings.enableChainOfThought !== 'boolean') {
                            settings.enableChainOfThought = false;
                        }
                        if (typeof settings.showThoughtAsAlert !== 'boolean') {
                            settings.showThoughtAsAlert = false;
                        }
                        if (!settings.enableChainOfThought) {
                            settings.showThoughtAsAlert = false;
                        }
                        await db.chatSettings.put({
                            id: chatId,
                            settings
                        });
                    }
                }
            }
            
            alert('数据导入成功！页面即将刷新以应用更改。');
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            alert('导入失败：文件格式错误或已损坏。');
            console.error("导入错误:", e);
        } finally {
            event.target.value = '';
        }
    }
};
