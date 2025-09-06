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
                item.className = 'wb-entry-item' + (entry.enabled === false ? ' disabled' : '');
                item.onclick = () => this.editEntry(entry);
                const keys = entry.keys.slice(0, 2).join(', ');
                const content = entry.content.substring(0, 80) + (entry.content.length > 80 ? '...' : '');
                item.innerHTML = `
                    <div class="wb-entry-header">
                        <div class="wb-entry-title">${entry.name || '未命名条目'}</div>
                        <div class="wb-entry-badge">${entry.constant ? '常驻' : '触发'}</div>
                    </div>
                    <div class="wb-entry-preview">${keys ? '🔑 ' + keys : ''} ${content}</div>
                `;
                container.appendChild(item);
            });
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
        this.closeExpandContent();
    },

    // 切换角色绑定
    toggleCharacterBind() {
        const checkbox = document.getElementById('entry-bind-character');
        const select = document.getElementById('entry-character');
        if (checkbox.checked) {
            select.style.display = 'block';
        } else {
            select.style.display = 'none';
        }
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

        const bindCheckbox = document.getElementById('entry-bind-character');
        const charSelect = document.getElementById('entry-character');
        if (this.currentEntry.character) {
            bindCheckbox.checked = true;
            charSelect.style.display = 'block';
            charSelect.value = this.currentEntry.character;
        } else {
            bindCheckbox.checked = false;
            charSelect.style.display = 'none';
            charSelect.value = '';
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
        if (document.getElementById('entry-bind-character').checked) {
            this.currentEntry.character = document.getElementById('entry-character').value;
        } else {
            delete this.currentEntry.character;
        }
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
    }
};

// 暴露到全局
window.WorldBookV2 = WorldBookV2;
