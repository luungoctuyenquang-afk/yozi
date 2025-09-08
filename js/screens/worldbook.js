// 世界书模块 V2 - 参照SillyTavern设计
const WorldBookV2 = {
    // 当前状态
    currentBook: null,
    currentEntry: null,
    books: [],
    entries: [],
    
    // 初始化
    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },
    
    // 加载数据
    loadData() {
        // 尝试迁移旧数据
        this.migrateOldData();

        // 加载世界书列表
        const booksData = localStorage.getItem('worldbook.books.v2');
        this.books = booksData ? JSON.parse(booksData) : [];

        // 加载条目
        const entriesData = localStorage.getItem('worldbook.entries.v2');
        this.entries = entriesData ? JSON.parse(entriesData) : [];

        // 如果没有世界书，创建默认的
        if (this.books.length === 0) {
            this.createDefaultBook();
        }
    },

    // 数据迁移方法
    migrateOldData() {
        // 检查是否有旧版本数据
        const oldWorldBook = StateManager.get()?.worldBook;
        if (!oldWorldBook || oldWorldBook.length === 0) return;

        // 检查是否已经迁移过
        if (localStorage.getItem('worldbook.migrated.v2')) return;

        console.log('开始迁移旧世界书数据...');

        // 创建默认世界书
        const defaultBook = {
            id: 'migrated_' + Date.now(),
            name: '迁移的世界书',
            description: '从旧版本迁移的世界书条目',
            scope: 'global',
            character: null,
            scanDepth: 2,
            tokenBudget: 2048,
            recursive: true,
            caseSensitive: false,
            matchWholeWords: false,
            createdAt: Date.now()
        };

        // 迁移条目
        const migratedEntries = oldWorldBook.map((rule, index) => ({
            id: rule.id || `migrated_entry_${index}`,
            bookId: defaultBook.id,
            name: rule.name || rule.key || '迁移的条目',
            keys: rule.triggers || [rule.key || ''],
            secondaryKeys: [],
            content: rule.content || rule.description || '',
            order: rule.priority || 100,
            depth: 4,
            logic: 'AND_ANY',
            selective: false,
            constant: rule.constant || false,
            probability: 100,
            position: rule.position || 'after_char',
            disableRecursion: false,
            scanDepth: false,
            recursionDepth: 2,
            bindType: 'global',
            characters: [],
            excludeMode: false,
            enabled: rule.enabled !== false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }));

        // 保存迁移的数据
        this.books = [defaultBook];
        this.entries = migratedEntries;
        this.saveData();

        // 标记已迁移
        localStorage.setItem('worldbook.migrated.v2', 'true');

        console.log(`成功迁移 ${migratedEntries.length} 个条目`);
        alert(`已从旧版本迁移 ${migratedEntries.length} 个世界书条目！`);
    },
    
    // 保存数据
    saveData() {
        localStorage.setItem('worldbook.books.v2', JSON.stringify(this.books));
        localStorage.setItem('worldbook.entries.v2', JSON.stringify(this.entries));
    },
    
    // 创建默认世界书
    createDefaultBook() {
        const defaultBook = {
            id: 'default',
            name: '默认世界书',
            description: '系统默认的世界书',
            scope: 'global',
            character: null,
            scanDepth: 2,
            tokenBudget: 2048,
            recursive: true,
            caseSensitive: false,
            matchWholeWords: false,
            createdAt: Date.now()
        };
        
        this.books.push(defaultBook);
        this.currentBook = defaultBook;
        this.saveData();
    },
    
    // 渲染主界面
    render() {
        this.renderBookSelector();
        this.renderEntries();
    },
    
    // 渲染世界书选择器
    renderBookSelector() {
        const selector = document.getElementById('wb-current-book');
        if (!selector) return;

        selector.innerHTML = '<option value="">选择世界书...</option>';

        this.books.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.textContent = book.name;
            if (this.currentBook && this.currentBook.id === book.id) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    },
    
    // 渲染条目（简化版）
    renderEntries() {
        const container = document.getElementById('wb-entries-list');
        const emptyState = document.getElementById('wb-empty-state');
        if (!container || !this.currentBook) return;

        const bookEntries = this.entries.filter(e => e.bookId === this.currentBook.id);

        const searchTerm = (document.getElementById('wb-search')?.value || '').toLowerCase();
        let filteredEntries = bookEntries;
        if (searchTerm) {
            filteredEntries = bookEntries.filter(e => {
                const searchText = `${e.name} ${e.keys.join(' ')} ${e.content}`.toLowerCase();
                return searchText.includes(searchTerm);
            });
        }

        filteredEntries.sort((a, b) => b.order - a.order);

        container.innerHTML = '';

        if (filteredEntries.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            container.style.display = 'block';
            emptyState.style.display = 'none';

            filteredEntries.forEach(entry => {
                const item = document.createElement('div');
                const isSelected = this.selectedEntryIds.has(entry.id);
                item.className = 'wb-entry-item wb-swipeable' +
                    (entry.enabled === false ? ' disabled' : '') +
                    (isSelected ? ' selected' : '');

                const keys = entry.keys.slice(0, 2).join(', ');
                const content = entry.content.substring(0, 80) + (entry.content.length > 80 ? '...' : '');

                // 创建内容区域
                const contentDiv = document.createElement('div');
                contentDiv.className = 'wb-entry-content';

                // 创建checkbox
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.style.cssText = 'display: flex; align-items: flex-start; gap: 8px;';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'wb-entry-checkbox';
                checkbox.checked = isSelected;
                checkbox.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleEntrySelection(entry.id);
                };

                // 创建主内容
                const mainContent = document.createElement('div');
                mainContent.style.flex = '1';

                const header = document.createElement('div');
                header.className = 'wb-entry-header';

                const title = document.createElement('div');
                title.className = 'wb-entry-title';
                title.textContent = entry.name || '未命名条目';

                const badge = document.createElement('div');
                badge.className = 'wb-entry-badge';
                badge.textContent = (entry.constant ? '常驻' : '触发') + (entry.enabled === false ? ' · 已禁用' : '');

                const preview = document.createElement('div');
                preview.className = 'wb-entry-preview';
                preview.textContent = (keys ? '🔑 ' + keys + ' ' : '') + content;

                // 组装内容结构
                header.appendChild(title);
                header.appendChild(badge);
                mainContent.appendChild(header);
                mainContent.appendChild(preview);
                checkboxWrapper.appendChild(checkbox);
                checkboxWrapper.appendChild(mainContent);
                contentDiv.appendChild(checkboxWrapper);

                // 创建操作按钮区域
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'wb-swipe-actions';

                const editBtn = document.createElement('button');
                editBtn.className = 'wb-swipe-edit';
                editBtn.textContent = '编辑';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'wb-swipe-delete';
                deleteBtn.textContent = '删除';

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);

                // 添加到item
                item.appendChild(contentDiv);
                item.appendChild(actionsDiv);

                // 存储entry数据
                item.entryData = entry;

                // 添加点击事件（确保可靠触发）
                let isMoving = false;
                let touchStartTime = 0;

                // 触摸开始记录时间
                contentDiv.addEventListener('touchstart', () => {
                    isMoving = false;
                    touchStartTime = Date.now();
                });

                // 触摸移动设置标志
                contentDiv.addEventListener('touchmove', () => {
                    isMoving = true;
                });

                // 点击编辑（移动端）
                contentDiv.addEventListener('touchend', (e) => {
                    const touchDuration = Date.now() - touchStartTime;
                    // 如果不是滑动且点击时间小于300ms，认为是点击
                    if (!isMoving && touchDuration < 300 && e.target !== checkbox) {
                        this.editEntry(entry);
                    }
                });

                // 点击编辑（桌面端）
                contentDiv.addEventListener('click', (e) => {
                    // 确保不是checkbox
                    if (e.target !== checkbox && !e.target.classList.contains('wb-entry-checkbox')) {
                        this.editEntry(entry);
                    }
                });

                // 编辑按钮事件
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.editEntry(entry);
                });

                // 删除按钮事件
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.quickDeleteEntry(entry.id);
                });

                // 添加滑动手势
                this.addSwipeGesture(item, entry);
                container.appendChild(item);
            });

            // 更新批量操作栏
            this.updateBatchBar();
        }
    },

    // 展开内容编辑
    expandContent() {
        const content = document.getElementById('entry-content').value;
        document.getElementById('expand-content').value = content;
        document.getElementById('wb-content-expand').style.display = 'flex';
    },

    // 关闭展开内容
    closeExpandContent() {
        document.getElementById('wb-content-expand').style.display = 'none';
    },

    // 保存展开内容
    saveExpandContent() {
        const content = document.getElementById('expand-content').value;
        document.getElementById('entry-content').value = content;
        this.updatePreview();
        this.closeExpandContent();
    },

    // 切换绑定类型
    toggleBindType() {
        const characterRadio = document.getElementById('entry-bind-character');
        const container = document.getElementById('character-select-container');

        if (characterRadio && characterRadio.checked) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            // 清空选择
            document.querySelectorAll('input[name="entry-characters"]').forEach(cb => {
                cb.checked = false;
            });
            const exclude = document.getElementById('entry-exclude-mode');
            if (exclude) exclude.checked = false;
        }
    },

    // 保留旧方法名兼容
    toggleCharacterBind() {
        this.toggleBindType();
    },

    // 导入条目
    importEntry() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.name) document.getElementById('entry-name').value = data.name;
                if (data.id) document.getElementById('entry-id').value = data.id;
                if (data.keys) document.getElementById('entry-keys').value = data.keys.join(', ');
                if (data.content) document.getElementById('entry-content').value = data.content;
                alert('条目导入成功！');
            } catch (err) {
                alert('导入失败：' + err.message);
            }
        };
        input.click();
    },

    // 导出条目
    exportEntry() {
        if (!this.currentEntry) return;
        const blob = new Blob([JSON.stringify(this.currentEntry, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entry_${this.currentEntry.name || 'unnamed'}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // 添加新条目
    addEntry() {
        if (!this.currentBook) {
            alert('请先选择一个世界书！');
            return;
        }
        
        this.currentEntry = {
            id: `entry_${Date.now()}`,
            bookId: this.currentBook.id,
            name: '',
            keys: [],
            secondaryKeys: [],
            content: '',
            order: 100,
            depth: 4,
            logic: 'AND_ANY',
            selective: false,
            selectiveLogic: '',
            constant: false,
            probability: 100,
            position: 'after_char',
            disableRecursion: false,
            scanDepth: false,
            recursionDepth: 2,
            bindType: 'inherit',
            characters: [],
            excludeMode: false,
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.openPanel();
    },
    
    // 编辑条目
    editEntry(entry) {
        this.currentEntry = { ...entry };
        this.openPanel();
    },
    
    // 打开编辑面板
    openPanel() {
        const panel = document.getElementById('wb-entry-panel');
        if (!panel || !this.currentEntry) return;

        panel.classList.add('open');

        document.getElementById('entry-name').value = this.currentEntry.name || '';
        document.getElementById('entry-id').value = this.currentEntry.id || '';
        document.getElementById('entry-keys').value = this.currentEntry.keys.join(', ');
        document.getElementById('entry-secondary-keys').value = (this.currentEntry.secondaryKeys || []).join(', ');
        document.getElementById('entry-content').value = this.currentEntry.content || '';
        this.updatePreview();
        document.getElementById('entry-order').value = this.currentEntry.order || 100;
        document.getElementById('entry-depth').value = this.currentEntry.depth || 4;
        document.getElementById('entry-logic').value = this.currentEntry.logic || 'AND_ANY';
        document.getElementById('entry-selective').checked = this.currentEntry.selective || false;
        document.getElementById('entry-constant').checked = this.currentEntry.constant || false;
        document.getElementById('entry-probability').value = this.currentEntry.probability ?? 100;
        document.getElementById('prob-value').textContent = (this.currentEntry.probability ?? 100) + '%';
        document.getElementById('entry-position').value = this.currentEntry.position || 'after_char';
        document.getElementById('entry-disable-recursion').checked = this.currentEntry.disableRecursion || false;
        document.getElementById('entry-scan-depth').checked = this.currentEntry.scanDepth || false;
        document.getElementById('entry-recursion-depth').value = this.currentEntry.recursionDepth || 2;

        // 动态生成角色列表
        this.updateCharacterList();

        // 加载绑定设置
        const inheritRadio = document.getElementById('entry-bind-inherit');
        const globalRadio = document.getElementById('entry-bind-global');
        const characterRadio = document.getElementById('entry-bind-character');
        const charContainer = document.getElementById('character-select-container');

        // 确定绑定类型
        let bindType = this.currentEntry.bindType;
        if (!bindType) {
            // 兼容旧数据
            if (Array.isArray(this.currentEntry.characters) && this.currentEntry.characters.length > 0) {
                bindType = 'character';
            } else if (this.currentEntry.character) {
                bindType = 'character';
                this.currentEntry.characters = [this.currentEntry.character];
            } else {
                bindType = 'global';
            }
        }

        // 设置单选按钮
        if (bindType === 'character') {
            if (characterRadio) characterRadio.checked = true;
            if (globalRadio) globalRadio.checked = false;
            if (inheritRadio) inheritRadio.checked = false;
            if (charContainer) charContainer.style.display = 'block';

            // 已在updateCharacterList中处理选中状态
            document.getElementById('entry-exclude-mode').checked = this.currentEntry.excludeMode || false;
        } else if (bindType === 'global') {
            if (globalRadio) globalRadio.checked = true;
            if (characterRadio) characterRadio.checked = false;
            if (inheritRadio) inheritRadio.checked = false;
            if (charContainer) charContainer.style.display = 'none';
        } else {
            // 默认继承
            if (inheritRadio) inheritRadio.checked = true;
            if (globalRadio) globalRadio.checked = false;
            if (characterRadio) characterRadio.checked = false;
            if (charContainer) charContainer.style.display = 'none';
        }

        const probSlider = document.getElementById('entry-probability');
        if (probSlider) {
            probSlider.oninput = (e) => {
                document.getElementById('prob-value').textContent = e.target.value + '%';
            };
        }
    },
    
    // 关闭编辑面板
    closePanel() {
        const panel = document.getElementById('wb-entry-panel');
        if (panel) {
            panel.classList.remove('open');
        }
        this.currentEntry = null;
    },
    
    // 保存条目
    saveEntry() {
        if (!this.currentEntry) return;
        
        // 从表单获取值
        this.currentEntry.name = document.getElementById('entry-name').value;
        const newId = document.getElementById('entry-id').value.trim();
        if (newId) this.currentEntry.id = newId;
        this.currentEntry.keys = document.getElementById('entry-keys').value
            .split(',')
            .map(k => k.trim())
            .filter(k => k);
        this.currentEntry.secondaryKeys = document.getElementById('entry-secondary-keys').value
            .split(',')
            .map(k => k.trim())
            .filter(k => k);
        this.currentEntry.content = document.getElementById('entry-content').value;
        this.currentEntry.order = parseInt(document.getElementById('entry-order').value) || 100;
        this.currentEntry.depth = parseInt(document.getElementById('entry-depth').value) || 4;
        this.currentEntry.logic = document.getElementById('entry-logic').value;
        this.currentEntry.selective = document.getElementById('entry-selective').checked;
        this.currentEntry.constant = document.getElementById('entry-constant').checked;
        this.currentEntry.probability = parseInt(document.getElementById('entry-probability').value);
        this.currentEntry.position = document.getElementById('entry-position').value;
        this.currentEntry.disableRecursion = document.getElementById('entry-disable-recursion').checked;
        this.currentEntry.scanDepth = document.getElementById('entry-scan-depth').checked;
        this.currentEntry.recursionDepth = parseInt(document.getElementById('entry-recursion-depth').value);
        // 保存绑定类型
        const bindType = document.querySelector('input[name="entry-bind-type"]:checked')?.value || 'inherit';
        this.currentEntry.bindType = bindType;

        // 如果是角色绑定，保存选中的角色
        if (bindType === 'character') {
            const selectedChars = Array.from(document.querySelectorAll('input[name="entry-characters"]:checked'))
                .map(cb => cb.value);
            this.currentEntry.characters = selectedChars;
            this.currentEntry.excludeMode = document.getElementById('entry-exclude-mode').checked;
        } else {
            delete this.currentEntry.characters;
            delete this.currentEntry.excludeMode;
        }

        // 清理旧的character字段
        delete this.currentEntry.character;
        this.currentEntry.updatedAt = Date.now();
        
        // 保存到列表
        const existingIndex = this.entries.findIndex(e => e.id === this.currentEntry.id);
        if (existingIndex >= 0) {
            this.entries[existingIndex] = this.currentEntry;
        } else {
            this.entries.push(this.currentEntry);
        }
        
        this.saveData();
        this.renderEntries();
        this.closePanel();
        
        alert('条目已保存！');
    },

    // 删除条目
    deleteEntry() {
        if (!this.currentEntry) return;
        
        if (confirm('确定要删除这个条目吗？')) {
            this.entries = this.entries.filter(e => e.id !== this.currentEntry.id);
            this.saveData();
            this.renderEntries();
            this.closePanel();
        }
    },
    
    // 更新内容预览
    updatePreview() {
        const content = document.getElementById('entry-content').value;
        const preview = document.getElementById('content-preview');
        if (!preview) return;
        
        if (!content) {
            preview.textContent = '在上方输入内容...';
            return;
        }
        
        // 调用已有的变量替换功能
        try {
            const processed = window.replaceVariables ? window.replaceVariables(content) : content;
            preview.innerHTML = processed.replace(/\n/g, '<br>');
        } catch (e) {
            preview.textContent = content;
        }
    },

    // 更新角色列表
    updateCharacterList() {
        const container = document.getElementById('character-checkboxes-container');
        if (!container) return;

        // 获取当前系统中的角色
        const state = StateManager.get();
        const characters = [
            { id: 'user', name: state.player?.name || '用户' },
            { id: 'ai', name: state.ai?.name || 'AI' },
            { id: 'narrator', name: '旁白' },
            { id: 'system', name: '系统' }
        ];

        // 清空容器
        container.innerHTML = '';

        // 生成checkbox（安全方式）
        characters.forEach(char => {
            const label = document.createElement('label');
            label.className = 'wb-switch';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'entry-characters';
            checkbox.value = char.id;

            const span = document.createElement('span');
            span.textContent = char.name;  // 使用textContent防止XSS

            label.appendChild(checkbox);
            label.appendChild(span);
            container.appendChild(label);
        });

        // 如果当前条目有选中的角色，恢复选中状态
        if (this.currentEntry && this.currentEntry.characters) {
            this.currentEntry.characters.forEach(charId => {
                const checkbox = container.querySelector(`input[value="${charId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    },

    // 测试条目
    testEntry() {
        if (!this.currentEntry) return;

        const dialog = document.getElementById('wb-test-dialog');
        if (dialog) {
            dialog.style.display = 'flex';
        }
    },
    
    // 运行测试
    runTest() {
        const testText = document.getElementById('test-text').value;
        if (!testText || !this.currentEntry) return;
        
        const results = document.getElementById('test-results');
        const matches = document.getElementById('test-matches');
        
        results.style.display = 'block';
        matches.innerHTML = '';
        
        // 测试关键词匹配
        let isMatch = false;
        const matchedKeys = [];
        
        for (const key of this.currentEntry.keys) {
            if (this.testKey(key, testText)) {
                matchedKeys.push(key);
                isMatch = true;
            }
        }
        
        if (this.currentEntry.constant) {
            isMatch = true;
            matchedKeys.push('(常驻条目)');
        }
        
        // 显示结果
        const matchDiv = document.createElement('div');
        matchDiv.className = 'test-match' + (isMatch ? ' active' : '');
        
        if (isMatch) {
            matchDiv.innerHTML = `
                <strong>✅ 条目已激活</strong><br>
                匹配的关键词: ${matchedKeys.join(', ')}<br>
                将注入内容 (${this.currentEntry.content.length} 字符)
            `;
        } else {
            matchDiv.innerHTML = `
                <strong>❌ 条目未激活</strong><br>
                没有匹配的关键词
            `;
        }
        
        matches.appendChild(matchDiv);
    },
    
    // 测试单个关键词
    testKey(key, text) {
        // 检查是否是正则表达式
        if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
            try {
                const lastSlash = key.lastIndexOf('/');
                const pattern = key.substring(1, lastSlash);
                const flags = key.substring(lastSlash + 1);
                const regex = new RegExp(pattern, flags);
                return regex.test(text);
            } catch (e) {
                return false;
            }
        }
        
        // 普通文本匹配
        return text.includes(key);
    },
    
    // 关闭测试对话框
    closeTestDialog() {
        const dialog = document.getElementById('wb-test-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    },
    
    // 创建新世界书
    createNewBook() {
        const name = prompt('请输入世界书名称：');
        if (!name) return;
        
        const book = {
            id: `book_${Date.now()}`,
            name: name,
            description: '',
            scope: 'global',
            character: null,
            scanDepth: 2,
            tokenBudget: 2048,
            recursive: true,
            caseSensitive: false,
            matchWholeWords: false,
            createdAt: Date.now()
        };
        
        this.books.push(book);
        this.currentBook = book;
        this.saveData();
        this.render();
    },
    
    // 编辑世界书设置
    editBookSettings() {
        if (!this.currentBook) {
            alert('请先选择一个世界书！');
            return;
        }
        
        const dialog = document.getElementById('wb-book-settings');
        if (!dialog) return;

        dialog.style.display = 'flex';

        document.getElementById('book-name').value = this.currentBook.name;
        document.getElementById('book-description').value = this.currentBook.description || '';
        document.getElementById('book-scope').value = this.currentBook.scope || 'global';
    },
    
    // 保存世界书设置
    saveBookSettings() {
        if (!this.currentBook) return;
        
        this.currentBook.name = document.getElementById('book-name').value;
        this.currentBook.description = document.getElementById('book-description').value;
        this.currentBook.scope = document.getElementById('book-scope').value;
        
        this.saveData();
        this.render();
        this.closeBookSettings();
        
        alert('设置已保存！');
    },
    
    // 关闭设置对话框
    closeBookSettings() {
        const dialog = document.getElementById('wb-book-settings');
        if (dialog) {
            dialog.style.display = 'none';
        }
    },
    
    // 删除世界书
    deleteBook() {
        if (!this.currentBook) return;
        
        if (confirm(`确定要删除世界书"${this.currentBook.name}"及其所有条目吗？`)) {
            // 删除相关条目
            this.entries = this.entries.filter(e => e.bookId !== this.currentBook.id);
            
            // 删除世界书
            this.books = this.books.filter(b => b.id !== this.currentBook.id);
            
            this.currentBook = this.books[0] || null;
            this.saveData();
            this.render();
            this.closeBookSettings();
        }
    },
    
    // 导出世界书
    exportBook() {
        if (!this.currentBook) return;
        
        const bookEntries = this.entries.filter(e => e.bookId === this.currentBook.id);
        const exportData = {
            book: this.currentBook,
            entries: bookEntries,
            version: '2.0',
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `worldbook_${this.currentBook.name}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // 绑定事件
    bindEvents() {
        // 世界书选择
        const bookSelector = document.getElementById('wb-current-book');
        if (bookSelector) {
            bookSelector.addEventListener('change', (e) => {
                const bookId = e.target.value;
                this.currentBook = this.books.find(b => b.id === bookId) || null;
                // 清空之前的选择，避免跨世界书操作
                this.selectedEntryIds.clear();
                this.render();
            });
        }

        // 搜索
        const searchInput = document.getElementById('wb-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderEntries());
        }

        // 概率滑块
        const probSlider = document.getElementById('entry-probability');
        if (probSlider) {
            probSlider.addEventListener('input', (e) => {
                document.getElementById('prob-value').textContent = e.target.value + '%';
            });
        }

        // 已移除右滑返回功能，避免与条目操作冲突
    },

    // ========== 批量操作功能 ==========

    // 选中的条目ID集合
    selectedEntryIds: new Set(),

    // 切换单个条目选中状态
    toggleEntrySelection(entryId) {
        if (this.selectedEntryIds.has(entryId)) {
            this.selectedEntryIds.delete(entryId);
        } else {
            this.selectedEntryIds.add(entryId);
        }
        this.updateBatchBar();
        this.renderEntries();
    },

    // 全选/取消全选
    toggleSelectAll() {
        const bookEntries = this.entries.filter(e => e.bookId === this.currentBook.id);
        const allSelected = bookEntries.every(e => this.selectedEntryIds.has(e.id));

        if (allSelected) {
            // 取消全选
            this.selectedEntryIds.clear();
        } else {
            // 全选当前世界书的所有条目
            bookEntries.forEach(e => this.selectedEntryIds.add(e.id));
        }

        // 更新全选checkbox状态
        const selectAllCheckbox = document.getElementById('wb-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = !allSelected;
        }

        this.updateBatchBar();
        this.renderEntries();
    },

    // 批量启用/禁用
    batchEnable(enable) {
        if (this.selectedEntryIds.size === 0) {
            alert('请先选择要操作的条目');
            return;
        }

        const count = this.selectedEntryIds.size;

        // 更新选中条目的启用状态
        this.entries = this.entries.map(entry => {
            if (this.selectedEntryIds.has(entry.id)) {
                entry.enabled = enable;
                entry.updatedAt = Date.now();
            }
            return entry;
        });

        this.saveData();
        this.selectedEntryIds.clear();
        this.updateBatchBar();
        this.renderEntries();

        alert(`已${enable ? '启用' : '禁用'} ${count} 个条目`);
    },

    // 批量删除
    batchDelete() {
        if (this.selectedEntryIds.size === 0) {
            alert('请先选择要删除的条目');
            return;
        }

        if (!confirm(`确定要删除选中的 ${this.selectedEntryIds.size} 个条目吗？`)) {
            return;
        }

        // 删除选中的条目
        this.entries = this.entries.filter(entry => !this.selectedEntryIds.has(entry.id));

        this.saveData();
        this.selectedEntryIds.clear();
        this.updateBatchBar();
        this.renderEntries();

        alert('已删除选中的条目');
    },

    // 更新批量操作栏显示
    updateBatchBar() {
        const batchBar = document.getElementById('wb-batch-bar');
        const selectedCount = document.getElementById('wb-selected-count');
        const bookEntries = this.entries.filter(e => e.bookId === this.currentBook.id);

        if (!batchBar) return;

        // 只有当前世界书有条目时才显示批量操作栏
        if (bookEntries.length > 0) {
            batchBar.style.display = 'flex';

            // 更新选中数量显示
            if (selectedCount) {
                const selectedInCurrentBook = bookEntries.filter(e =>
                    this.selectedEntryIds.has(e.id)
                ).length;
                selectedCount.textContent = `已选: ${selectedInCurrentBook}`;
            }

            // 更新全选checkbox状态
            const selectAllCheckbox = document.getElementById('wb-select-all');
            if (selectAllCheckbox) {
                const allSelected = bookEntries.length > 0 &&
                    bookEntries.every(e => this.selectedEntryIds.has(e.id));
                selectAllCheckbox.checked = allSelected;
            }
        } else {
            batchBar.style.display = 'none';
        }
    },

    // 添加滑动手势
    addSwipeGesture(element, entry) {
        let startX = 0;
        let currentX = 0;
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let isHorizontalSwipe = null;
        const threshold = 50;

        const content = element.querySelector('.wb-entry-content');
        const actions = element.querySelector('.wb-swipe-actions');

        // 重置其他条目的滑动状态
        const resetOtherItems = () => {
            document.querySelectorAll('.wb-entry-item').forEach(otherItem => {
                if (otherItem !== element) {
                    const otherContent = otherItem.querySelector('.wb-entry-content');
                    const otherActions = otherItem.querySelector('.wb-swipe-actions');
                    if (otherContent) otherContent.style.transform = 'translateX(0)';
                    if (otherActions) {
                        otherActions.classList.remove('visible');
                        otherActions.style.opacity = '0';
                    }
                }
            });
        };

        // 触摸开始
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            currentY = startY;
            isDragging = true;
            isHorizontalSwipe = null;
        }, { passive: true });

        // 触摸移动
        element.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;

            const diffX = startX - currentX;
            const diffY = Math.abs(startY - currentY);

            // 判断滑动方向
            if (isHorizontalSwipe === null && (Math.abs(diffX) > 5 || diffY > 5)) {
                isHorizontalSwipe = Math.abs(diffX) > diffY;
            }

            // 只处理水平滑动
            if (isHorizontalSwipe === false) return;

            // 阻止垂直滚动
            if (isHorizontalSwipe === true) {
                e.preventDefault();

                // 重置其他条目
                resetOtherItems();

                // 左滑显示操作按钮
                if (diffX > 0) {
                    const translateX = Math.min(diffX, 120);
                    content.style.transform = `translateX(-${translateX}px)`;
                    actions.style.opacity = translateX / 120;
                }
                // 右滑恢复
                else if (diffX < -10) {
                    content.style.transform = 'translateX(0)';
                    actions.style.opacity = 0;
                }
            }
        }, { passive: false });

        // 触摸结束
        element.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;

            const diffX = startX - currentX;

            // 只处理水平滑动
            if (isHorizontalSwipe === true) {
                // 左滑超过阈值，显示操作
                if (diffX > threshold) {
                    content.style.transform = 'translateX(-120px)';
                    actions.classList.add('visible');
                    actions.style.opacity = '1';
                }
                // 否则复原
                else {
                    content.style.transform = 'translateX(0)';
                    actions.classList.remove('visible');
                    actions.style.opacity = '0';
                }
            }

            isHorizontalSwipe = null;
        }, { passive: true });

        // 触摸取消
        element.addEventListener('touchcancel', () => {
            isDragging = false;
            isHorizontalSwipe = null;
            content.style.transform = 'translateX(0)';
            actions.classList.remove('visible');
            actions.style.opacity = '0';
        });
    },

    // 快速删除条目
    quickDeleteEntry(entryId) {
        if (confirm('确定删除这个条目吗？')) {
            this.entries = this.entries.filter(e => e.id !== entryId);
            this.saveData();
            this.renderEntries();
        }
    },

    // 获取激活的世界书条目（为AI集成准备）
    getActiveEntries(text) {
        if (!this.currentBook) return [];

        const activeEntries = [];
        const bookEntries = this.entries.filter(e =>
            e.bookId === this.currentBook.id && e.enabled !== false
        );

        bookEntries.forEach(entry => {
            // 常驻条目总是激活
            if (entry.constant) {
                activeEntries.push(entry);
                return;
            }

            // 检查关键词匹配
            for (const key of entry.keys) {
                if (this.testKey(key, text)) {
                    activeEntries.push(entry);
                    break;
                }
            }
        });

        // 按优先级排序
        activeEntries.sort((a, b) => b.order - a.order);

        return activeEntries;
    },

    // 构建世界书上下文（为AI注入准备）
    buildWorldBookContext(text) {
        const entries = this.getActiveEntries(text);
        let context = '';

        entries.forEach(entry => {
            // 处理变量替换
            let content = entry.content;
            if (window.replaceVariables) {
                content = window.replaceVariables(content);
            }
            context += content + '\n\n';
        });

        return context.trim();
    }
};

// 暴露到全局
window.WorldBookV2 = WorldBookV2;
