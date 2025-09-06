// 通用设置界面模块
const GeneralSettingsScreen = {
    render() {
        const state = StateManager.get();
        const activeChat = state.chats['chat_default'];
        if (!activeChat || !activeChat.settings) return;
        
        // AI人格设置
        const aiPersonaTextarea = document.getElementById('ai-persona-textarea');
        if (aiPersonaTextarea) {
            aiPersonaTextarea.value = activeChat.settings.aiPersona;
        }
        
        // 用户人格设置
        const myPersonaTextarea = document.getElementById('my-persona-textarea');
        if (myPersonaTextarea) {
            myPersonaTextarea.value = activeChat.settings.myPersona;
        }
        
        // 思维链开关
        const chainOfThoughtSwitch = document.getElementById('chain-of-thought-switch');
        if (chainOfThoughtSwitch) {
            chainOfThoughtSwitch.checked = activeChat.settings.enableChainOfThought;
        }
        
        // 显示思维过程开关（弹窗 + 对话框）
        const showThoughtAlertSwitch = document.getElementById('show-thought-alert-switch');
        if (showThoughtAlertSwitch) {
            showThoughtAlertSwitch.checked = activeChat.settings.showThoughtAsAlert;
            showThoughtAlertSwitch.disabled = !chainOfThoughtSwitch.checked;
        }
        
        // 世界书关联
        const worldBookLinkingContainer = document.getElementById('world-book-linking-container');
        if (worldBookLinkingContainer) {
            worldBookLinkingContainer.innerHTML = '';
            
            if (state.worldBook && state.worldBook.length > 0) {
                state.worldBook.forEach(rule => {
                    const isChecked = activeChat.settings.linkedWorldBookIds && 
                                    activeChat.settings.linkedWorldBookIds.includes(rule.id);
                    
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = rule.id;
                    checkbox.checked = isChecked;
                    
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${rule.name} (${rule.category})`));
                    worldBookLinkingContainer.appendChild(label);
                });
            } else {
                worldBookLinkingContainer.innerHTML = 
                    '<p style="color: #888; font-size: 14px;">还没有创建任何世界书规则。</p>';
            }
        }
    },
    
    toggleChainOfThought() {
        const chainOfThoughtSwitch = document.getElementById('chain-of-thought-switch');
        const showThoughtAlertSwitch = document.getElementById('show-thought-alert-switch');
        
        if (showThoughtAlertSwitch) {
            showThoughtAlertSwitch.disabled = !chainOfThoughtSwitch.checked;
            if (!chainOfThoughtSwitch.checked) {
                showThoughtAlertSwitch.checked = false;
            }
        }
    },
    
    async save() {
        const state = StateManager.get();
        const activeChat = state.chats['chat_default'];
        if (!activeChat) return;
        
        const saveButton = document.getElementById('save-general-settings-btn');
        saveButton.textContent = '保存中...';
        saveButton.disabled = true;
        
        try {
            // 保存AI人格
            const aiPersonaTextarea = document.getElementById('ai-persona-textarea');
            activeChat.settings.aiPersona = aiPersonaTextarea.value;
            
            // 保存用户人格
            const myPersonaTextarea = document.getElementById('my-persona-textarea');
            activeChat.settings.myPersona = myPersonaTextarea.value;
            
            // 保存思维链设置
            const chainOfThoughtSwitch = document.getElementById('chain-of-thought-switch');
            activeChat.settings.enableChainOfThought = chainOfThoughtSwitch.checked;
            
            const showThoughtAlertSwitch = document.getElementById('show-thought-alert-switch');
            activeChat.settings.showThoughtAsAlert = showThoughtAlertSwitch.checked;
            
            // 保存世界书关联
            const selectedBookIds = [];
            const worldBookLinkingContainer = document.getElementById('world-book-linking-container');
            const checkboxes = worldBookLinkingContainer.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(cb => selectedBookIds.push(cb.value));
            activeChat.settings.linkedWorldBookIds = selectedBookIds;
            
            await Database.saveWorldState();
            alert('通用设置已保存！');
            
        } finally {
            saveButton.textContent = '保存通用设置';
            saveButton.disabled = false;
        }
    }
};