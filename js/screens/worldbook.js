// 世界书增强模块
const WorldBookScreen = {
    // 数据存储键
    BOOKS_KEY: 'worldbook.books',
    ENTRIES_KEY: 'worldbook.entries',
    SETTINGS_KEY: 'worldbook.settings',

    // 当前状态
    currentView: 'shelf',
    currentBookId: null,
    editingEntry: null,

    // 初始化
    init() {
        this.ensureDefaultBooks();
        this.loadSettings();
        this.bindEvents();
    },

    // 确保有默认书本
    ensureDefaultBooks() {
        let books = this.loadBooks();
        if (books.length === 0) {
            books = [
                {
                    id: 'book.global',
                    name: '全局世界书',
                    scope: 'global',
                    persona: '',
                    desc: '全局设定、规则、口吻和氛围',
                    entryCount: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                {
                    id: 'book.char.fang',
                    name: '方亦楷·世界书',
                    scope: 'char',
                    persona: 'fang',
                    desc: '方亦楷的角色设定和专属规则',
                    entryCount: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                {
                    id: 'book.char.ai',
                    name: `${StateManager.get().ai.name}·世界书`,
                    scope: 'char',
                    persona: 'ai',
                    desc: 'AI角色的设定和规则',
                    entryCount: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                {
                    id: 'book.event',
                    name: '事件世界书',
                    scope: 'event',
                    persona: '',
                    desc: '特殊事件、场景和状态',
                    entryCount: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            ];
            this.saveBooks(books);

            // 迁移旧数据
            this.migrateOldData();
        }
    },

    // 迁移旧世界书数据
    migrateOldData() {
        const state = StateManager.get();
        if (state.worldBook && state.worldBook.length > 0) {
            const entries = [];
            state.worldBook.forEach(oldRule => {
                // 判断应该归属哪本书
                let bookId = 'book.global';
                let scope = 'global';
                let speaker = 'any';

                if (oldRule.category === '角色') {
                    bookId = 'book.char.ai';
                    scope = 'char';
                } else if (oldRule.category === '事件') {
                    bookId = 'book.event';
                    scope = 'event';
                }

                const entry = {
                    id: oldRule.id || `wb.migrated.${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    bookId: bookId,
                    title: oldRule.name || '未命名条目',
                    scope: scope,
                    speaker: speaker,
                    keys: oldRule.triggers || [],
                    filters: [],
                    content: oldRule.content || '',
                    order: oldRule.priority || 100,
                    position: oldRule.position || 'after_char_defs',
                    strategy: oldRule.constant ? 'always' : 'trigger',
                    timing: {
                        delay: 0,
                        sticky: 0,
                        cooldown: 0
                    },
                    recursion: {
                        allow: true,
                        maxSteps: 2
                    },
                    tags: [`迁移自旧版`, `category:${oldRule.category}`],
                    enabled: oldRule.enabled !== false,
                    _meta: {
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                };

                entries.push(entry);
            });

            if (entries.length > 0) {
                this.saveEntries(entries);
                this.updateBookCounts();
                console.log(`成功迁移 ${entries.length} 个旧世界书条目`);
            }
        }
    },

    // 数据加载和保存
    loadBooks() {
        try {
            const data = localStorage.getItem(this.BOOKS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载世界书失败:', e);
            return [];
        }
    },

    saveBooks(books) {
        localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
    },

    loadEntries() {
        try {
            const data = localStorage.getItem(this.ENTRIES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载条目失败:', e);
            return [];
        }
    },

    saveEntries(entries) {
        localStorage.setItem(this.ENTRIES_KEY, JSON.stringify(entries));
    },

    loadSettings() {
        try {
            const data = localStorage.getItem(this.SETTINGS_KEY);
            return data ? JSON.parse(data) : this.getDefaultSettings();
        } catch (e) {
            return this.getDefaultSettings();
        }
    },

    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    },

    getDefaultSettings() {
        return {
            scanDepth: 8,
            minActivations: 0,
            maxRecursion: 3,
            budgetPercent: 15,
            includeNames: true,
            caseSensitive: false,
            wholeWords: true,
            overflowAlert: true
        };
    },

    // 界面渲染
    render() {
        this.showView('shelf');
    },

    showView(viewName) {
        this.currentView = viewName;

        // 隐藏所有视图
        document.querySelectorAll('.wb-view').forEach(v => v.style.display = 'none');

        // 显示指定视图
        const viewId = `wb-${viewName}-view`;
        const view = document.getElementById(viewId);
        if (view) {
            view.style.display = 'block';

            // 根据视图渲染内容
            switch(viewName) {
                case 'shelf':
                    this.renderShelf();
                    document.getElementById('wb-screen-title').textContent = '世界书';
                    break;
                case 'book':
                    this.renderBook();
                    break;
                case 'settings':
                    this.renderSettings();
                    document.getElementById('wb-screen-title').textContent = '激活设置';
                    break;
                case 'sandbox':
                    this.renderSandbox();
                    document.getElementById('wb-screen-title').textContent = '测试沙盒';
                    break;
            }
        }
    },

    // 渲染书架
    renderShelf() {
        const container = document.getElementById('wb-books-grid');
        if (!container) return;

        container.innerHTML = '';
        const books = this.loadBooks();

        books.forEach(book => {
            const card = document.createElement('div');
            card.className = 'wb-book-card';
            card.onclick = () => this.openBook(book.id);

            const icon = this.getBookIcon(book.scope);

            card.innerHTML = `
                <div class="wb-book-icon">${icon}</div>
                <div class="wb-book-info">
                    <h3>${book.name}</h3>
                    <p>${book.entryCount || 0}个条目 · ${this.getScopeLabel(book.scope)}作用域</p>
                    <p style="font-size:12px;color:#999;">${book.desc || ''}</p>
                </div>
            `;

            container.appendChild(card);
        });
    },

    // 获取书本图标
    getBookIcon(scope) {
        const icons = {
            'global': '🌍',
            'char': '👤',
            'event': '⚡'
        };
        return icons[scope] || '📚';
    },

    // 获取作用域标签
    getScopeLabel(scope) {
        const labels = {
            'global': '全局',
            'char': '角色',
            'event': '事件'
        };
        return labels[scope] || scope;
    },

    // 打开书本
    openBook(bookId) {
        this.currentBookId = bookId;
        this.showView('book');
    },

    // 渲染书本详情
    renderBook() {
        if (!this.currentBookId) return;

        const book = this.loadBooks().find(b => b.id === this.currentBookId);
        if (!book) return;

        // 更新标题
        document.getElementById('wb-current-book-name').textContent = book.name;
        document.getElementById('wb-current-book-info').textContent =
            `${this.getScopeLabel(book.scope)} · ${book.persona || '通用'}`;

        // 渲染条目列表
        this.renderEntries();
    },

    // 渲染条目列表
    renderEntries() {
        const tbody = document.getElementById('wb-entries-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        // 获取搜索和排序参数
        const searchTerm = (document.getElementById('wb-entry-search')?.value || '').toLowerCase();
        const sortBy = document.getElementById('wb-entry-sort')?.value || 'order-desc';

        // 筛选条目
        let entries = this.loadEntries().filter(e => e.bookId === this.currentBookId);

        // 搜索过滤
        if (searchTerm) {
            entries = entries.filter(e => {
                const searchableText = `${e.id} ${e.title} ${e.keys.join(' ')} ${e.tags?.join(' ')}`.toLowerCase();
                return searchableText.includes(searchTerm);
            });
        }

        // 排序
        entries.sort((a, b) => {
            switch(sortBy) {
                case 'order-desc': return b.order - a.order;
                case 'order-asc': return a.order - b.order;
                case 'title': return (a.title || '').localeCompare(b.title || '');
                case 'updated': return (b._meta?.updatedAt || 0) - (a._meta?.updatedAt || 0);
                default: return 0;
            }
        });

        // 渲染每个条目
        entries.forEach(entry => {
            const tr = document.createElement('tr');

            const statusClass = entry.enabled ? 'wb-tag-active' : 'wb-tag-disabled';
            const statusText = entry.enabled ? '启用' : '禁用';

            tr.innerHTML = `
                <td>
                    <div style="font-weight:500;">${entry.id}</div>
                    <div style="font-size:12px;color:#666;">${entry.title || '无标题'}</div>
                </td>
                <td>${entry.order}</td>
                <td style="font-size:12px;">${this.getPositionLabel(entry.position)}</td>
                <td>
                    <span class="wb-tag wb-tag-${entry.scope}">${this.getScopeLabel(entry.scope)}</span>
                    <span class="wb-tag ${statusClass}">${statusText}</span>
                </td>
                <td style="font-size:12px;">${entry.keys.slice(0, 3).join(', ')}${entry.keys.length > 3 ? '...' : ''}</td>
                <td>
                    <div class="wb-entry-actions">
                        <button onclick="WorldBookScreen.editEntry('${entry.id}')">编辑</button>
                        <button onclick="WorldBookScreen.duplicateEntry('${entry.id}')">复制</button>
                        <button onclick="WorldBookScreen.deleteEntry('${entry.id}')">删除</button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">暂无条目</td></tr>';
        }
    },

    // 获取位置标签
    getPositionLabel(position) {
        const labels = {
            'after_char_defs': '角色定义后',
            'before_char_defs': '角色定义前',
            'an_top': '作者注顶部',
            'an_bottom': '作者注底部',
            'depth0_system': '@Depth=0(系统)',
            'depth0_user': '@Depth=0(用户)',
            'depth0_assistant': '@Depth=0(助手)'
        };
        return labels[position] || position;
    },

    // 创建新书
    createBook() {
        const name = prompt('请输入世界书名称：');
        if (!name) return;

        const scope = prompt('请选择作用域 (global/char/event)：', 'global') || 'global';
        const desc = prompt('请输入描述（可选）：') || '';

        const book = {
            id: `book.${Date.now()}`,
            name: name,
            scope: scope,
            persona: '',
            desc: desc,
            entryCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (scope === 'char') {
            book.persona = prompt('请输入角色代号（如: fang）：') || '';
        }

        const books = this.loadBooks();
        books.push(book);
        this.saveBooks(books);

        this.renderShelf();
        alert('世界书创建成功！');
    },

    // 创建新条目
    createEntry() {
        if (!this.currentBookId) return;

        const book = this.loadBooks().find(b => b.id === this.currentBookId);
        if (!book) return;

        this.editingEntry = {
            id: '',
            bookId: this.currentBookId,
            title: '',
            scope: book.scope,
            speaker: book.persona || 'any',
            keys: [],
            filters: [],
            content: '',
            order: 60,
            position: 'after_char_defs',
            strategy: 'trigger',
            timing: { delay: 0, sticky: 0, cooldown: 0 },
            recursion: { allow: true, maxSteps: 2 },
            tags: [],
            enabled: true,
            _meta: { createdAt: Date.now(), updatedAt: Date.now() }
        };

        this.openDrawer();
    },

    // 编辑条目
    editEntry(entryId) {
        const entry = this.loadEntries().find(e => e.id === entryId);
        if (!entry) return;

        this.editingEntry = { ...entry };
        this.openDrawer();
    },

    // 打开编辑抽屉
    openDrawer() {
        const drawer = document.getElementById('wb-entry-drawer');
        if (!drawer) return;

        drawer.classList.add('open');

        // 填充表单
        const e = this.editingEntry;
        document.getElementById('wb-entry-id').value = e.id || '';
        document.getElementById('wb-entry-title').value = e.title || '';
        document.getElementById('wb-entry-scope').value = e.scope || 'global';
        document.getElementById('wb-entry-speaker').value = e.speaker || 'any';
        document.getElementById('wb-entry-keys').value = e.keys?.join(', ') || '';
        document.getElementById('wb-entry-filters').value = e.filters?.join(', ') || '';
        document.getElementById('wb-entry-content').value = e.content || '';
        document.getElementById('wb-entry-order').value = e.order || 60;
        document.getElementById('wb-entry-position').value = e.position || 'after_char_defs';
        document.getElementById('wb-entry-strategy').value = e.strategy || 'trigger';
        document.getElementById('wb-entry-delay').value = e.timing?.delay || 0;
        document.getElementById('wb-entry-sticky').value = e.timing?.sticky || 0;
        document.getElementById('wb-entry-cooldown').value = e.timing?.cooldown || 0;
        document.getElementById('wb-entry-recursion').checked = e.recursion?.allow !== false;
        document.getElementById('wb-entry-max-steps').value = e.recursion?.maxSteps || 2;
        document.getElementById('wb-entry-tags').value = e.tags?.join(', ') || '';
        document.getElementById('wb-entry-enabled').checked = e.enabled !== false;
    },

    // 关闭编辑抽屉
    closeDrawer() {
        const drawer = document.getElementById('wb-entry-drawer');
        if (drawer) {
            drawer.classList.remove('open');
        }
        this.editingEntry = null;
    },

    // 保存条目
    saveEntry() {
        const id = document.getElementById('wb-entry-id').value.trim();
        if (!id) {
            alert('请输入条目ID！');
            return;
        }

        const content = document.getElementById('wb-entry-content').value.trim();
        if (!content) {
            alert('请输入条目内容！');
            return;
        }

        const entry = {
            id: id,
            bookId: this.currentBookId,
            title: document.getElementById('wb-entry-title').value,
            scope: document.getElementById('wb-entry-scope').value,
            speaker: document.getElementById('wb-entry-speaker').value,
            keys: document.getElementById('wb-entry-keys').value
                .split(',')
                .map(k => k.trim())
                .filter(k => k),
            filters: document.getElementById('wb-entry-filters').value
                .split(',')
                .map(f => f.trim())
                .filter(f => f),
            content: content,
            order: parseInt(document.getElementById('wb-entry-order').value) || 60,
            position: document.getElementById('wb-entry-position').value,
            strategy: document.getElementById('wb-entry-strategy').value,
            timing: {
                delay: parseInt(document.getElementById('wb-entry-delay').value) || 0,
                sticky: parseInt(document.getElementById('wb-entry-sticky').value) || 0,
                cooldown: parseInt(document.getElementById('wb-entry-cooldown').value) || 0
            },
            recursion: {
                allow: document.getElementById('wb-entry-recursion').checked,
                maxSteps: parseInt(document.getElementById('wb-entry-max-steps').value) || 2
            },
            tags: document.getElementById('wb-entry-tags').value
                .split(',')
                .map(t => t.trim())
                .filter(t => t),
            enabled: document.getElementById('wb-entry-enabled').checked,
            _meta: {
                createdAt: this.editingEntry?._meta?.createdAt || Date.now(),
                updatedAt: Date.now()
            }
        };

        // 保存条目
        let entries = this.loadEntries();
        const existingIndex = entries.findIndex(e => e.id === id);

        if (existingIndex >= 0) {
            entries[existingIndex] = entry;
        } else {
            entries.push(entry);
        }

        this.saveEntries(entries);
        this.updateBookCounts();
        this.closeDrawer();
        this.renderEntries();

        alert('条目保存成功！');
    },

    // 删除条目
    deleteEntry(entryId) {
        if (!confirm(`确定要删除条目 "${entryId}" 吗？`)) return;

        let entries = this.loadEntries();
        entries = entries.filter(e => e.id !== entryId);
        this.saveEntries(entries);

        this.updateBookCounts();
        this.renderEntries();

        alert('条目已删除！');
    },

    // 复制条目
    duplicateEntry(entryId) {
        const entry = this.loadEntries().find(e => e.id === entryId);
        if (!entry) return;

        const newEntry = {
            ...entry,
            id: `${entry.id}_copy_${Date.now()}`,
            title: `${entry.title || ''}（副本）`,
            _meta: {
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        };

        const entries = this.loadEntries();
        entries.push(newEntry);
        this.saveEntries(entries);

        this.updateBookCounts();
        this.renderEntries();

        alert('条目复制成功！');
    },

    // 更新书本条目计数
    updateBookCounts() {
        const books = this.loadBooks();
        const entries = this.loadEntries();

        books.forEach(book => {
            book.entryCount = entries.filter(e => e.bookId === book.id && e.enabled).length;
        });

        this.saveBooks(books);
    },

    // 返回书架
    backToShelf() {
        this.currentBookId = null;
        this.showView('shelf');
    },

    // 导出功能
    exportAll() {
        const data = {
            books: this.loadBooks(),
            entries: this.loadEntries(),
            settings: this.loadSettings(),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `worldbook_all_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportBook() {
        if (!this.currentBookId) return;

        const book = this.loadBooks().find(b => b.id === this.currentBookId);
        const entries = this.loadEntries().filter(e => e.bookId === this.currentBookId);

        const data = {
            book: book,
            entries: entries,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `worldbook_${book.name}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // 导入功能
    importAll() {
        const input = document.getElementById('wb-import-file');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (data.books) {
                    this.saveBooks(data.books);
                }
                if (data.entries) {
                    this.saveEntries(data.entries);
                }
                if (data.settings) {
                    this.saveSettings(data.settings);
                }

                this.updateBookCounts();
                this.renderShelf();
                alert('导入成功！');
            } catch (err) {
                alert('导入失败：' + err.message);
            }

            input.value = '';
        };
        input.click();
    },

    importToBook() {
        if (!this.currentBookId) return;

        const input = document.getElementById('wb-import-file');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (data.entries && Array.isArray(data.entries)) {
                    let entries = this.loadEntries();

                    // 将导入的条目强制设置为当前书本
                    data.entries.forEach(entry => {
                        entry.bookId = this.currentBookId;

                        // 检查是否已存在
                        const existingIndex = entries.findIndex(e => e.id === entry.id);
                        if (existingIndex >= 0) {
                            entries[existingIndex] = entry;
                        } else {
                            entries.push(entry);
                        }
                    });

                    this.saveEntries(entries);
                    this.updateBookCounts();
                    this.renderEntries();
                    alert(`成功导入 ${data.entries.length} 个条目！`);
                } else {
                    alert('文件格式错误！');
                }
            } catch (err) {
                alert('导入失败：' + err.message);
            }

            input.value = '';
        };
        input.click();
    },

    // 渲染激活设置
    renderSettings() {
        const settings = this.loadSettings();

        document.getElementById('wb-scan-depth').value = settings.scanDepth;
        document.getElementById('wb-min-activations').value = settings.minActivations;
        document.getElementById('wb-max-recursion').value = settings.maxRecursion;
        document.getElementById('wb-budget-percent').value = settings.budgetPercent;
        document.getElementById('wb-budget-display').textContent = settings.budgetPercent + '%';
        document.getElementById('wb-include-names').checked = settings.includeNames;
        document.getElementById('wb-case-sensitive').checked = settings.caseSensitive;
        document.getElementById('wb-whole-words').checked = settings.wholeWords;
        document.getElementById('wb-overflow-alert').checked = settings.overflowAlert;

        // 绑定滑块事件
        document.getElementById('wb-budget-percent').oninput = (e) => {
            document.getElementById('wb-budget-display').textContent = e.target.value + '%';
        };
    },

    // 保存设置
    saveSettingsToStorage() {
        const settings = {
            scanDepth: parseInt(document.getElementById('wb-scan-depth').value),
            minActivations: parseInt(document.getElementById('wb-min-activations').value),
            maxRecursion: parseInt(document.getElementById('wb-max-recursion').value),
            budgetPercent: parseInt(document.getElementById('wb-budget-percent').value),
            includeNames: document.getElementById('wb-include-names').checked,
            caseSensitive: document.getElementById('wb-case-sensitive').checked,
            wholeWords: document.getElementById('wb-whole-words').checked,
            overflowAlert: document.getElementById('wb-overflow-alert').checked
        };

        this.saveSettings(settings);
        alert('设置已保存！');
    },

    // 渲染测试沙盒
    renderSandbox() {
        // 清空结果区域
        document.getElementById('wb-injected-list').innerHTML = '';
        document.getElementById('wb-delayed-list').innerHTML = '';
        document.getElementById('wb-cooldown-list').innerHTML = '';
        document.getElementById('wb-truncated-list').innerHTML = '';
    },

    // 运行测试
    runTest() {
        const context = document.getElementById('wb-test-context').value;
        const input = document.getElementById('wb-test-input').value;

        if (!input) {
            alert('请输入测试文本！');
            return;
        }

        const settings = this.loadSettings();
        const entries = this.loadEntries().filter(e => e.enabled);

        // 构建扫描文本
        const scanText = context + '\n' + input;

        // 匹配条目
        const matched = [];
        entries.forEach(entry => {
            let isMatched = false;

            // 策略判断
            if (entry.strategy === 'always') {
                isMatched = true;
            } else if (entry.keys && entry.keys.length > 0) {
                // 检查触发词
                for (const key of entry.keys) {
                    if (this.testKey(key, scanText, settings)) {
                        isMatched = true;
                        break;
                    }
                }
            }

            if (isMatched) {
                matched.push(entry);
            }
        });

        // 按优先级排序
        matched.sort((a, b) => b.order - a.order);

        // 模拟预算限制（简化版）
        const budget = 1000; // 假设总预算1000 tokens
        const budgetLimit = Math.floor(budget * settings.budgetPercent / 100);
        let usedBudget = 0;

        const injected = [];
        const truncated = [];
        const delayed = [];
        const cooldown = [];

        matched.forEach(entry => {
            // 估算token数（简化：字符数/4）
            const tokens = Math.ceil(entry.content.length / 4);

            // 时序判断（简化版）
            if (entry.timing?.cooldown > 0) {
                cooldown.push(entry);
            } else if (entry.timing?.delay > 0) {
                delayed.push(entry);
            } else if (usedBudget + tokens <= budgetLimit) {
                injected.push(entry);
                usedBudget += tokens;
            } else {
                truncated.push(entry);
            }
        });

        // 显示结果
        this.renderTestResults('wb-injected-list', injected, '✅');
        this.renderTestResults('wb-delayed-list', delayed, '⏳');
        this.renderTestResults('wb-cooldown-list', cooldown, '🧊');
        this.renderTestResults('wb-truncated-list', truncated, '✂️');

        if (settings.overflowAlert && truncated.length > 0) {
            alert(`⚠️ 预算溢出警告：有 ${truncated.length} 个条目被裁剪！`);
        }
    },

    // 测试关键词
    testKey(key, text, settings) {
        // 检查是否是正则表达式
        if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
            try {
                const lastSlash = key.lastIndexOf('/');
                const pattern = key.substring(1, lastSlash);
                const flags = key.substring(lastSlash + 1);
                const regex = new RegExp(pattern, flags);
                return regex.test(text);
            } catch (e) {
                console.error('正则表达式错误:', e);
                return false;
            }
        }

        // 普通关键词匹配
        if (!settings.caseSensitive) {
            key = key.toLowerCase();
            text = text.toLowerCase();
        }

        if (settings.wholeWords) {
            const regex = new RegExp(`\\b${key}\\b`);
            return regex.test(text);
        }

        return text.includes(key);
    },

    // 渲染测试结果
    renderTestResults(containerId, entries, icon) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (entries.length === 0) {
            container.innerHTML = '<div style="color:#999;font-size:12px;">无</div>';
            return;
        }

        entries.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'wb-result-item';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${icon} ${entry.id}</span>
                    <span style="font-size:11px;color:#666;">优先级: ${entry.order}</span>
                </div>
                <div style="font-size:12px;color:#666;margin-top:4px;">
                    ${entry.title || '无标题'} | ${this.getPositionLabel(entry.position)}
                </div>
            `;
            container.appendChild(div);
        });
    },

    // 绑定事件
    bindEvents() {
        // 搜索框
        const searchInput = document.getElementById('wb-entry-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderEntries());
        }

        // 排序选择
        const sortSelect = document.getElementById('wb-entry-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.renderEntries());
        }
    }
};

