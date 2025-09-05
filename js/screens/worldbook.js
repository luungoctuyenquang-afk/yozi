// 世界书界面模块
const WorldBookScreen = {
    render(editingRuleId = null) {
        const state = StateManager.get();
        const ruleListContainer = document.getElementById('rule-list');
        if (!ruleListContainer) return;
        
        ruleListContainer.innerHTML = '';
        
        // 工具栏
        const toolbar = document.createElement('div');
        toolbar.className = 'world-book-toolbar';
        
        const addBtn = document.createElement('button');
        addBtn.className = 'form-button';
        addBtn.textContent = '➕ 新建条目';
        addBtn.onclick = () => {
            const newRule = {
                id: `rule_${Date.now()}`,
                name: '新条目',
                category: '通用',
                triggers: [],
                content: '',
                enabled: true,
                constant: false,
                position: 'after',
                priority: 100,
                variables: true,
                comment: '',
                isNew: true
            };
            state.worldBook.push(newRule);
            this.render(newRule.id);
        };
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'form-button-secondary';
        exportBtn.textContent = '📤 导出';
        exportBtn.onclick = () => {
            const dataStr = JSON.stringify(state.worldBook, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `世界书_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
        
        const importBtn = document.createElement('button');
        importBtn.className = 'form-button-secondary';
        importBtn.textContent = '📥 导入';
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const rules = JSON.parse(text);
                    if (Array.isArray(rules)) {
                        if (confirm('要替换现有规则还是追加？\n确定=替换，取消=追加')) {
                            state.worldBook = rules;
                        } else {
                            state.worldBook.push(...rules);
                        }
                        await Database.saveWorldState();
                        this.render();
                        alert('导入成功！');
                    }
                } catch (err) {
                    alert('导入失败：' + err.message);
                }
            };
            input.click();
        };
        
        toolbar.appendChild(addBtn);
        toolbar.appendChild(exportBtn);
        toolbar.appendChild(importBtn);
        ruleListContainer.appendChild(toolbar);
        
        // 渲染条目列表
        state.worldBook.sort((a, b) => b.priority - a.priority).forEach(rule => {
            const card = document.createElement('div');
            card.className = 'world-book-entry';
            
            if (rule.id === editingRuleId) {
                // 编辑模式
                this.renderEditForm(card, rule);
            } else {
                // 显示模式
                this.renderDisplayMode(card, rule);
            }
            
            ruleListContainer.appendChild(card);
        });
    },
    
    renderEditForm(card, rule) {
        const form = document.createElement('div');
        form.className = 'wb-edit-form';
        
        // 第一行：名称和分类
        const row1 = document.createElement('div');
        row1.className = 'wb-edit-row';
        row1.innerHTML = `
            <input type="text" id="wb-name-${rule.id}" class="wb-edit-input" value="${rule.name}" placeholder="条目名称">
            <select id="wb-category-${rule.id}" class="wb-edit-select">
                <option value="通用">通用</option>
                <option value="角色">角色</option>
                <option value="场景">场景</option>
                <option value="物品">物品</option>
                <option value="经济">经济</option>
                <option value="事件">事件</option>
            </select>
        `;
        
        // 触发词
        const triggers = document.createElement('input');
        triggers.type = 'text';
        triggers.id = `wb-triggers-${rule.id}`;
        triggers.className = 'wb-edit-input';
        triggers.value = rule.triggers.join(', ');
        triggers.placeholder = '触发词（逗号分隔）';
        
        // 内容
        const content = document.createElement('textarea');
        content.id = `wb-content-${rule.id}`;
        content.className = 'wb-edit-textarea';
        content.rows = 4;
        content.placeholder = '内容（支持变量：{{player.money}} 等）';
        content.value = rule.content;
        
       // 选项
        const options = document.createElement('div');
        options.className = 'wb-edit-checkboxes';
        options.innerHTML = `
            <label><input type="checkbox" id="wb-enabled-${rule.id}" ${rule.enabled ? 'checked' : ''}> 启用</label>
            <label><input type="checkbox" id="wb-constant-${rule.id}" ${rule.constant ? 'checked' : ''}> 始终激活</label>
            <label><input type="checkbox" id="wb-variables-${rule.id}" ${rule.variables ? 'checked' : ''}> 变量替换</label>
            <input type="number" id="wb-priority-${rule.id}" class="wb-edit-priority" value="${rule.priority}" placeholder="优先级">
            ${rule.id === 'rule001' ? `
                <div style="margin-top: 10px;">
                    <label>离线收益值: <input type="number" id="wb-value-${rule.id}" 
                        value="${rule.value || 1}" min="0" style="width: 60px;"> 金币/分钟</label>
                </div>
            ` : ''}
        `;
        
        // 备注
        const comment = document.createElement('input');
        comment.type = 'text';
        comment.id = `wb-comment-${rule.id}`;
        comment.className = 'wb-edit-input';
        comment.value = rule.comment;
        comment.placeholder = '备注（可选）';
        
        // 实时预览
        const previewWrap = document.createElement('div');
        previewWrap.className = 'wb-live-preview';
        previewWrap.innerHTML = `
            <div class="wb-live-title">实时预览</div>
            <div id="wb-preview-${rule.id}" class="wb-live-body"></div>
        `;
        
        // 按钮
        const actions = document.createElement('div');
        actions.className = 'wb-edit-actions';
        actions.innerHTML = `
            <button type="button" class="wb-save-btn" data-rule-id="${rule.id}">保存</button>
            <button type="button" class="wb-cancel-btn" data-rule-id="${rule.id}">取消</button>
            <button type="button" class="wb-delete-btn" data-rule-id="${rule.id}">删除</button>
        `;
        
        form.appendChild(row1);
        form.appendChild(triggers);
        form.appendChild(content);
        form.appendChild(options);
        form.appendChild(previewWrap);
        form.appendChild(comment);
        form.appendChild(actions);
        card.appendChild(form);
        
        // 设置当前值和预览
        setTimeout(() => {
            document.getElementById(`wb-category-${rule.id}`).value = rule.category;
            this.updatePreview(rule.id);
            
            // 绑定预览更新
            content.addEventListener('input', () => this.updatePreview(rule.id));
            document.getElementById(`wb-variables-${rule.id}`)?.addEventListener('change', 
                () => this.updatePreview(rule.id));
        }, 0);
    },
    
    renderDisplayMode(card, rule) {
        const header = document.createElement('div');
        header.className = 'wb-entry-header';
        
        const content = document.createElement('div');
        content.className = 'wb-entry-content';
        
        const title = document.createElement('div');
        title.className = 'wb-entry-title';
        title.innerHTML = `
            <span class="wb-entry-name">${rule.name}</span>
            <span class="wb-entry-category">${rule.category}</span>
            <span>${rule.enabled ? '✅' : '❌'}</span>
            ${rule.constant ? '<span>📌</span>' : ''}
            <span class="wb-entry-priority">优先级: ${rule.priority}</span>
        `;
        
        const triggers = document.createElement('div');
        triggers.className = 'wb-entry-triggers';
        const triggersText = rule.triggers.length > 0 ? rule.triggers.join(', ') : '(无触发词)';
        triggers.innerHTML = `触发词: <code>${triggersText}</code>`;
        
        const text = document.createElement('div');
        text.className = 'wb-entry-text';
        const preview = rule.variables ? Utils.replaceVariables(rule.content) : rule.content;
        text.textContent = preview.substring(0, 100) + (preview.length > 100 ? '...' : '');
        
        content.appendChild(title);
        content.appendChild(triggers);
        content.appendChild(text);
        
        if (rule.comment) {
            const comment = document.createElement('div');
            comment.className = 'wb-entry-comment';
            comment.textContent = rule.comment;
            content.appendChild(comment);
        }
        
        const editBtn = document.createElement('button');
        editBtn.className = 'wb-edit-btn';
        editBtn.textContent = '编辑';
        editBtn.dataset.ruleId = rule.id;
        
        header.appendChild(content);
        header.appendChild(editBtn);
        card.appendChild(header);
    },
    
    updatePreview(ruleId) {
        const pv = document.getElementById(`wb-preview-${ruleId}`);
        const contentEl = document.getElementById(`wb-content-${ruleId}`);
        const useVarsEl = document.getElementById(`wb-variables-${ruleId}`);
        
        if (pv && contentEl) {
            const useVars = useVarsEl?.checked;
            const raw = contentEl.value || '';
            pv.textContent = useVars ? Utils.replaceVariables(raw) : raw;
        }
    },
    
  async saveEntry(ruleId) {
        const state = StateManager.get();
        const rule = state.worldBook.find(r => r.id === ruleId);
        if (!rule) return;
        
        rule.name = document.getElementById(`wb-name-${ruleId}`).value || '未命名';
        rule.category = document.getElementById(`wb-category-${ruleId}`).value;
        rule.triggers = document.getElementById(`wb-triggers-${ruleId}`).value
            .split(',')
            .map(t => t.trim())
            .filter(t => t);
        rule.content = document.getElementById(`wb-content-${ruleId}`).value;
        rule.enabled = document.getElementById(`wb-enabled-${ruleId}`).checked;
        rule.constant = document.getElementById(`wb-constant-${ruleId}`).checked;
        rule.variables = document.getElementById(`wb-variables-${ruleId}`).checked;
        rule.priority = parseInt(document.getElementById(`wb-priority-${ruleId}`).value) || 100;
        rule.comment = document.getElementById(`wb-comment-${ruleId}`).value;
        
        // 特殊处理离线收益规则的value
        if (rule.id === 'rule001') {
            const valueInput = document.getElementById(`wb-value-${ruleId}`);
            if (valueInput) {
                rule.value = parseInt(valueInput.value) || 1;
                // 更新content中的默认值
                rule.content = rule.content.replace(
                    /{{worldBook\.rule001\.value:\d+}}/,
                    `{{worldBook.rule001.value:${rule.value}}}`
                );
            }
        }
        
        delete rule.isNew;
        await Database.saveWorldState();
        this.render();
    },
    
    async deleteEntry(ruleId) {
        if (confirm('确定要删除这个条目吗？')) {
            const state = StateManager.get();
            state.worldBook = state.worldBook.filter(r => r.id !== ruleId);
            await Database.saveWorldState();
            this.render();
        }
    },
    
    async cancelEdit(ruleId) {
        const state = StateManager.get();
        const rule = state.worldBook.find(r => r.id === ruleId);
        if (rule && rule.isNew) {
            state.worldBook = state.worldBook.filter(r => r.id !== ruleId);
            await Database.saveWorldState();
        }
        this.render();
    }
};
