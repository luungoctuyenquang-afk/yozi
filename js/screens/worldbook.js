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
        
        // 更新书本信息
        if (this.currentBook) {
            document.getElementById('wb-book-info').style.display = 'flex';
            const typeLabel = this.currentBook.scope === 'global' ? '全局' : '角色绑定';
            document.getElementById('wb-book-type').textContent = typeLabel;
            document.getElementById('wb-book-type').className = 'wb-badge ' + 
                (this.currentBook.scope === 'character' ? 'character' : '');
            
            const entryCount = this.entries.filter(e => e.bookId === this.currentBook.id).length;
            document.querySelector('.wb-entry-count').textContent = `${entryCount} 条目`;
        } else {
            document.getElementById('wb-book-info').style.display = 'none';
        }
    },
    
    // 渲染条目列表
    renderEntries() {
        const container = document.getElementById('wb-entries-list');
        const emptyState = document.getElementById('wb-empty-state');
        
        if (!container || !this.currentBook) return;
        
        // 获取当前书的条目
        const bookEntries = this.entries.filter(e => e.bookId === this.currentBook.id);
        
        // 搜索和排序
        const searchTerm = (document.getElementById('wb-search')?.value || '').toLowerCase();
        const sortBy = document.getElementById('wb-sort')?.value || 'order';
        
        let filteredEntries = bookEntries;
        if (searchTerm) {
            filteredEntries = bookEntries.filter(e => {
                const searchText = `${e.name} ${e.keys.join(' ')} ${e.content}`.toLowerCase();
                return searchText.includes(searchTerm);
            });
        }
        
        // 排序
        filteredEntries.sort((a, b) => {
            if (sortBy === 'order') return b.order - a.order;
            if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
            return 0;
        });
        
        // 渲染
        container.innerHTML = '';
        
        if (filteredEntries.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            container.style.display = 'block';
            emptyState.style.display = 'none';
            
            filteredEntries.forEach(entry => {
                const card = this.createEntryCard(entry);
                container.appendChild(card);
            });
        }
    },
    
    // 创建条目卡片
    createEntryCard(entry) {
        const card = document.createElement('div');
        card.className = 'wb-entry-card' + (entry.enabled === false ? ' disabled' : '');
        card.onclick = () => this.editEntry(entry);
        
        const keysDisplay = entry.keys.slice(0, 3).map(k => `<code>${k}</code>`).join(' ');
        const contentPreview = entry.content.substring(0, 100) + 
            (entry.content.length > 100 ? '...' : '');
        
        card.innerHTML = `
            <div class="wb-entry-header">
                <div class="wb-entry-title">${entry.name || '未命名条目'}</div>
                <div class="wb-entry-meta">
                    <span class="wb-entry-status ${entry.enabled === false ? 'disabled' : ''}"></span>
                    <span class="wb-entry-order">优先级: ${entry.order}</span>
                </div>
            </div>
            <div class="wb-entry-keys">
                触发词: ${keysDisplay || '<span style="color:#999">无</span>'}
                ${entry.keys.length > 3 ? `<span style="color:#999">+${entry.keys.length - 3}</span>` : ''}
            </div>
            <div class="wb-entry-content">${contentPreview}</div>
        `;
        
        return card;
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
        
        // 填充表单
        document.getElementById('entry-name').value = this.currentEntry.name || '';
        document.getElementById('entry-keys').value = this.currentEntry.keys.join(', ');
        document.getElementById('entry-secondary-keys').value = 
            (this.currentEntry.secondaryKeys || []).join(', ');
        document.getElementById('entry-content').value = this.currentEntry.content || '';
        document.getElementById('entry-order').value = this.currentEntry.order || 100;
        document.getElementById('entry-depth').value = this.currentEntry.depth || 4;
        document.getElementById('entry-logic').value = this.currentEntry.logic || 'AND_ANY';
        document.getElementById('entry-selective').checked = this.currentEntry.selective || false;
        document.getElementById('entry-constant').checked = this.currentEntry.constant || false;
        document.getElementById('entry-probability').value = this.currentEntry.probability || 100;
        document.getElementById('entry-probability-value').textContent = 
            (this.currentEntry.probability || 100) + '%';
        document.getElementById('entry-position').value = this.currentEntry.position || 'after_char';
        document.getElementById('entry-disable-recursion').checked = 
            this.currentEntry.disableRecursion || false;
        document.getElementById('entry-scan-depth').checked = this.currentEntry.scanDepth || false;
        document.getElementById('entry-recursion-depth').value = 
            this.currentEntry.recursionDepth || 2;
        
        // 更新启用图标
        document.getElementById('entry-enabled-icon').textContent = 
            this.currentEntry.enabled !== false ? '✅' : '❌';
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
    
    // 切换条目启用状态
    toggleEntryEnabled() {
        if (!this.currentEntry) return;
        
        this.currentEntry.enabled = !this.currentEntry.enabled;
        document.getElementById('entry-enabled-icon').textContent = 
            this.currentEntry.enabled ? '✅' : '❌';
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
    
    // 复制条目
    duplicateEntry() {
        if (!this.currentEntry) return;
        
        const newEntry = {
            ...this.currentEntry,
            id: `entry_${Date.now()}`,
            name: this.currentEntry.name + ' (副本)',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.entries.push(newEntry);
        this.saveData();
        this.renderEntries();
        
        this.currentEntry = newEntry;
        this.openPanel();
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
        
        const dialog = document.getElementById('wb-book-settings-dialog');
        if (!dialog) return;
        
        dialog.style.display = 'flex';
        
        // 填充表单
        document.getElementById('book-name').value = this.currentBook.name;
        document.getElementById('book-description').value = this.currentBook.description || '';
        document.getElementById('book-scope').value = this.currentBook.scope;
        document.getElementById('book-scan-depth').value = this.currentBook.scanDepth;
        document.getElementById('book-token-budget').value = this.currentBook.tokenBudget;
        document.getElementById('book-recursive').checked = this.currentBook.recursive;
        document.getElementById('book-case-sensitive').checked = this.currentBook.caseSensitive;
        document.getElementById('book-match-whole-words').checked = this.currentBook.matchWholeWords;
        
        // 显示/隐藏角色选择
        const charSelect = document.getElementById('book-character-select');
        if (this.currentBook.scope === 'character') {
            charSelect.style.display = 'block';
            document.getElementById('book-character').value = this.currentBook.character || '';
        } else {
            charSelect.style.display = 'none';
        }
    },
    
    // 保存世界书设置
    saveBookSettings() {
        if (!this.currentBook) return;
        
        this.currentBook.name = document.getElementById('book-name').value;
        this.currentBook.description = document.getElementById('book-description').value;
        this.currentBook.scope = document.getElementById('book-scope').value;
        this.currentBook.scanDepth = parseInt(document.getElementById('book-scan-depth').value);
        this.currentBook.tokenBudget = parseInt(document.getElementById('book-token-budget').value);
        this.currentBook.recursive = document.getElementById('book-recursive').checked;
        this.currentBook.caseSensitive = document.getElementById('book-case-sensitive').checked;
        this.currentBook.matchWholeWords = document.getElementById('book-match-whole-words').checked;
        
        if (this.currentBook.scope === 'character') {
            this.currentBook.character = document.getElementById('book-character').value;
        } else {
            this.currentBook.character = null;
        }
        
        this.saveData();
        this.render();
        this.closeBookSettings();
        
        alert('设置已保存！');
    },
    
    // 关闭设置对话框
    closeBookSettings() {
        const dialog = document.getElementById('wb-book-settings-dialog');
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
                this.render();
            });
        }
        
        // 搜索
        const searchInput = document.getElementById('wb-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderEntries());
        }
        
        // 排序
        const sortSelect = document.getElementById('wb-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.renderEntries());
        }
        
        // 概率滑块
        const probSlider = document.getElementById('entry-probability');
        if (probSlider) {
            probSlider.addEventListener('input', (e) => {
                document.getElementById('entry-probability-value').textContent = e.target.value + '%';
            });
        }
        
        // 作用范围切换
        const scopeSelect = document.getElementById('book-scope');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', (e) => {
                const charSelect = document.getElementById('book-character-select');
                if (e.target.value === 'character') {
                    charSelect.style.display = 'block';
                } else {
                    charSelect.style.display = 'none';
                }
            });
        }
        
        // 选择性触发开关
        const selectiveCheck = document.getElementById('entry-selective');
        if (selectiveCheck) {
            selectiveCheck.addEventListener('change', (e) => {
                const logicInput = document.getElementById('entry-selective-logic');
                if (e.target.checked) {
                    logicInput.style.display = 'block';
                } else {
                    logicInput.style.display = 'none';
                }
            });
        }
    }
};

// 暴露到全局
window.WorldBookV2 = WorldBookV2;
