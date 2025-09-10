(function(global) {
    'use strict';

    class WorldBookEngine {
        constructor(options = {}) {
            this.scanDepth = options.scanDepth !== undefined ? options.scanDepth : 1000;
            this.recursive = options.recursive !== undefined ? options.recursive : true;
            this.minActivations = options.minActivations !== undefined ? options.minActivations : 1;
            this.maxDepth = options.maxDepth !== undefined ? options.maxDepth : 3;
            this.maxRecursionSteps = options.maxRecursionSteps !== undefined ? options.maxRecursionSteps : 10;
            this.tokenBudget = options.tokenBudget !== undefined ? options.tokenBudget : 2000;
            this.matchWholeWords = options.matchWholeWords !== undefined ? options.matchWholeWords : false;
        }

        setOptions(options) {
            Object.assign(this, options);
        }

        process(worldbook, context) {
            if (!worldbook || !worldbook.entries) {
                return { slots: {}, activatedEntries: [] };
            }

            this.worldbookSettings = worldbook.settings || {};
            const activatedEntries = this._activateEntries(worldbook.entries, context);
            const slots = this._organizeByPosition(activatedEntries);

            return { slots, activatedEntries };
        }

        _activateEntries(entries, context, depth = 0) {
            if (depth >= this.maxDepth) {
                return [];
            }

            const activated = [];
            const contextWords = context.split(/\s+/);
            let currentTokenCount = 0;

            for (const entry of entries) {
                if (currentTokenCount >= this.tokenBudget) {
                    break;
                }

                if (this._shouldActivateEntry(entry, context, contextWords)) {
                    const activatedEntry = {
                        ...entry,
                        matchedKeys: this._getMatchedKeys(entry, context, contextWords),
                        depth: depth,
                        activationScore: this._calculateActivationScore(entry, context, contextWords)
                    };

                    activated.push(activatedEntry);
                    currentTokenCount += this._estimateTokens(entry.content || '');

                    if (this.recursive && entry.content && depth < this.maxRecursionSteps) {
                        const recursiveActivated = this._activateEntries(entries, entry.content, depth + 1);
                        activated.push(...recursiveActivated);
                    }
                }
            }

            return this._applyPriorityAndLimits(activated);
        }

        _shouldActivateEntry(entry, context, contextWords) {
            if (!entry.keys || entry.keys.length === 0) {
                return false;
            }

            if (entry.constant === true) {
                return true;
            }

            const matched = this._matchKeys(entry, context, this.worldbookSettings);
            const matchCount = matched.length;

            if (entry.selectiveLogic) {
                const minMatches = entry.selectiveLogic.includes('AND') ? entry.keys.length : 1;
                return matchCount >= minMatches;
            }

            return matchCount >= (this.minActivations || 1);
        }

        _getMatchedKeys(entry, context, contextWords) {
            return this._matchKeys(entry, context, this.worldbookSettings);
        }

        // ===== CJK-safe matching helpers =====
        _toHalfWidth(s) {
            return s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0xFEE0))
                    .replace(/\u3000/g,' ');
        }
        
        _hasCJK(s) { 
            return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(s || ''); 
        }
        
        _escRe(str) { 
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
        }

        _textMatch(text, key, {caseSensitive=false, wholeWords=true}={}) {
            const t = caseSensitive ? text : this._toHalfWidth(text).toLowerCase();
            const k = caseSensitive ? key  : this._toHalfWidth(key).toLowerCase();

            // 正则键（/.../flags）保持原样
            if (k.startsWith('/') && k.lastIndexOf('/')>0){
                try { 
                    const i = k.lastIndexOf('/');
                    const pat = k.slice(1, i);
                    const fl = k.slice(i + 1) || (caseSensitive ? '' : 'i');
                    return new RegExp(pat, fl).test(text); 
                } catch(e) { 
                    return false; 
                }
            }

            // 中文或包含 CJK：不用 \b，直接包含匹配
            if (this._hasCJK(k) || this._hasCJK(t)) {
                return t.includes(k);
            }

            // 英文：按 wholeWords 决定是否 \b
            if (wholeWords){
                const re = new RegExp(`\\b${this._escRe(k)}\\b`, caseSensitive ? '' : 'i');
                return re.test(text);
            }
            return t.includes(k);
        }

        _matchKeys(entry, text, settings) {
            const matched = [];
            const caseSensitive = entry.caseSensitive ?? settings?.caseSensitive ?? false;
            const wholeWords = entry.matchWholeWords ?? settings?.matchWholeWords ?? false; // 默认 false
            
            // 遍历 entry.keys 时，用 textMatch 替换原先的匹配代码
            for (const key of (entry.keys || [])) {
                if (this._textMatch(text, key, {caseSensitive, wholeWords})) {
                    matched.push(key);
                }
            }
            
            // Optional Filter（保持原来的逻辑，或用最简单的包含判断）
            if (entry.optionalFilter && matched.length) {
                const f = entry.optionalFilter, keys = f.keys || [];
                const tf = (k) => this._textMatch(text, k, {caseSensitive, wholeWords: false});
                const arr = keys.map(tf);
                const ok =
                    f.logic === 'AND_ALL' ? arr.every(Boolean) :
                    f.logic === 'NOT_ANY' ? !arr.some(Boolean) :
                    f.logic === 'NOT_ALL' ? !arr.every(Boolean) :
                    /* AND_ANY */ arr.some(Boolean);
                if (!ok) return [];
            }
            return matched;
        }

        _calculateActivationScore(entry, context, contextWords) {
            let score = 0;
            
            if (entry.constant) {
                score += 1000;
            }

            score += (entry.priority || 0) * 100;
            score += (entry.order || 0) * 10;

            const matched = this._matchKeys(entry, context, this.worldbookSettings);
            for (const key of matched) {
                score += key.length;
            }

            if (entry.probability !== undefined) {
                score += entry.probability * 50;
            }

            return score;
        }

        _applyPriorityAndLimits(entries) {
            entries.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));

            const filtered = [];
            const groups = {};

            for (const entry of entries) {
                if (entry.probability !== undefined && Math.random() > entry.probability) {
                    continue;
                }

                if (entry.group) {
                    if (!groups[entry.group]) {
                        groups[entry.group] = [];
                    }
                    groups[entry.group].push(entry);
                } else {
                    filtered.push(entry);
                }
            }

            for (const [groupName, groupEntries] of Object.entries(groups)) {
                groupEntries.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));
                filtered.push(groupEntries[0]);
            }

            return filtered.slice(0, Math.floor(this.tokenBudget / 100));
        }

        _organizeByPosition(entries) {
            const slots = {
                'top': [],
                'afterSystem': [],
                'afterExample': [],
                'beforeMain': [],
                'afterMain': [],
                'bottom': [],
                'floating': [],
                'unknown': []
            };

            for (const entry of entries) {
                const position = entry.position || 'floating';
                if (slots[position]) {
                    slots[position].push(entry);
                } else {
                    slots['unknown'].push(entry);
                }
            }

            for (const position in slots) {
                slots[position].sort((a, b) => (a.order || 0) - (b.order || 0));
            }

            return slots;
        }

        _estimateTokens(text) {
            return Math.ceil(text.length / 4);
        }
    }

    // 通用编码检测和BOM移除函数
    async function decodeFileToText(file) {
        const buf = await file.arrayBuffer();
        const tryList = [
            {enc:'utf-8', bom:true},
            {enc:'utf-16le', bom:true},
            {enc:'utf-16be', bom:true},
            {enc:'gb18030'},
            {enc:'gbk'},
            {enc:'big5'},
        ];
        for (const opt of tryList) {
            try {
                let t = new TextDecoder(opt.enc, {fatal:false}).decode(buf);
                t = stripBOM(t);
                JSON.parse(t); // 试解析
                return t;      // 成功就返回
            } catch (e) { /* try next */ }
        }
        // 都不行时，最后再用 utf-8 宽松解码返回（给用户提示）
        return stripBOM(new TextDecoder('utf-8').decode(buf));
    }

    function stripBOM(str){ return str.replace(/^\uFEFF/, ''); }

    class WorldBookImporter {
        static async fromFile(file) {
            try {
                const text = await decodeFileToText(file);
                const data = JSON.parse(text);
                return data;
            } catch (error) {
                throw new Error('Invalid JSON format: ' + error.message);
            }
        }

        static async fromURL(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                throw new Error('Failed to fetch worldbook: ' + error.message);
            }
        }

        static fromJSON(jsonString) {
            try {
                return JSON.parse(jsonString);
            } catch (error) {
                throw new Error('Invalid JSON format: ' + error.message);
            }
        }

        static import(raw) {
            if (!raw || typeof raw !== 'object') {
                throw new Error('Invalid worldbook data');
            }

            let book = { ...raw };

            // 英文键自动扩展中文同义词映射表
            const EN_TO_CN_MAP = {
                weather: ['天气','气候','下雨','台风','温度','预报','预警'],
                restaurant: ['餐厅','美食','吃饭','餐馆','饭店','小吃'],
                travel: ['旅行','旅游','行程','出行'],
                tips: ['注意事项','贴士','提示'],
                safety: ['安全','风险','危险','预警'],
                attraction: ['景点','公园','海湾','沙滩','玩'],
                shopping: ['购物','免税店','特产'],
                food: ['美食','菜','小吃','特色'],
                hainan: ['海南','海口','三亚','亚龙湾'],
                haikou: ['海南','海口','三亚','亚龙湾'],  
                sanya: ['海南','海口','三亚','亚龙湾'],
                yalong: ['海南','海口','三亚','亚龙湾']
            };

            function expandEnglishKeys(keys) {
                const expanded = [...keys];
                for (const key of keys) {
                    const lowerKey = key.toLowerCase();
                    if (EN_TO_CN_MAP[lowerKey]) {
                        expanded.push(...EN_TO_CN_MAP[lowerKey]);
                    }
                }
                // 去重和规范化
                return [...new Set(expanded.map(k => k.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/\u3000/g,' ').trim()))].filter(k => k.length > 0);
            }

            // 兜底规则：如果是 {worldbook:[...]} 格式，转换为 {entries:[...]}
            if (book.worldbook && Array.isArray(book.worldbook) && !book.entries) {
                book.entries = book.worldbook;
                delete book.worldbook;
            }

            // 确保有 entries 数组
            if (!Array.isArray(book.entries)) {
                book.entries = [];
            }

            // 规范化每个条目
            book.entries = book.entries.map((entry, index) => {
                const normalized = { ...entry };

                // 处理 keys/key 字段 - 支持多种格式和备用字段
                let rawKeys = [];
                
                // 尝试从多个字段获取keys
                const keyFields = ['keys', 'key', 'keywords', 'primary_keys', '关键词', '触发词'];
                for (const field of keyFields) {
                    if (normalized[field]) {
                        if (typeof normalized[field] === 'string') {
                            // 字符串形式，用更宽松的分隔符分割
                            rawKeys.push(...normalized[field].split(/[,\s、，;；|\/]+/)
                                .map(k => k.trim())
                                .filter(k => k.length > 0));
                        } else if (Array.isArray(normalized[field])) {
                            rawKeys.push(...normalized[field]);
                        } else if (typeof normalized[field] === 'object' && normalized[field].primary) {
                            // 对象形式 {primary:[], secondary:[]}
                            const primary = Array.isArray(normalized[field].primary) ? normalized[field].primary : [];
                            const secondary = Array.isArray(normalized[field].secondary) ? normalized[field].secondary : [];
                            
                            rawKeys.push(...primary);
                            if (secondary.length > 0) {
                                normalized.optionalFilter = normalized.optionalFilter || {};
                                normalized.optionalFilter.keys = secondary;
                            }
                        }
                        if (field !== 'keys') delete normalized[field];
                    }
                }
                
                // 扩展英文键为中文同义词并规范化
                normalized.keys = rawKeys.length > 0 ? expandEnglishKeys(rawKeys) : [];

                // 处理 content/entry/text 字段
                if (!normalized.content && normalized.content !== '') {
                    if (normalized.entry) {
                        normalized.content = normalized.entry;
                        delete normalized.entry;
                    } else if (normalized.text) {
                        normalized.content = normalized.text;
                        delete normalized.text;
                    } else {
                        normalized.content = '';
                    }
                }

                // 默认 enabled 为 true
                if (normalized.enabled === undefined) {
                    normalized.enabled = true;
                }

                // 映射 position 数字/旧枚举
                if (typeof normalized.position === 'number') {
                    const positionMap = {
                        0: 'before_char',
                        1: 'after_char', 
                        2: 'before_example',
                        3: 'after_example',
                        4: 'before_an',
                        5: 'after_an',
                        6: 'at_depth'
                    };
                    normalized.position = positionMap[normalized.position] || 'after_char';
                } else if (typeof normalized.position === 'string') {
                    // 映射旧的position名称
                    const oldPositionMap = {
                        'before_char': 'beforeMain',
                        'after_char': 'afterMain', 
                        'before_example': 'afterExample',
                        'after_example': 'afterExample',
                        'before_an': 'beforeMain',
                        'after_an': 'afterMain',
                        'at_depth': 'floating'
                    };
                    normalized.position = oldPositionMap[normalized.position] || normalized.position;
                } else if (!normalized.position) {
                    normalized.position = 'after_char';
                }

                // 确保 id 存在
                if (!normalized.id && normalized.id !== 0) {
                    normalized.id = `entry_${index}`;
                }

                return normalized;
            });

            return book;
        }

        static validate(worldbook) {
            if (!worldbook || typeof worldbook !== 'object') {
                return { valid: false, errors: ['Worldbook must be an object'] };
            }

            if (!Array.isArray(worldbook.entries)) {
                return { valid: false, errors: ['Worldbook must have an entries array'] };
            }

            const errors = [];
            worldbook.entries.forEach((entry, index) => {
                if (!entry.id && entry.id !== 0) {
                    errors.push(`Entry at index ${index} is missing id`);
                }
                if (!Array.isArray(entry.keys)) {
                    errors.push(`Entry at index ${index} is missing keys array`);
                }
                if (!entry.content && entry.content !== '') {
                    errors.push(`Entry at index ${index} is missing content`);
                }
            });

            return { valid: errors.length === 0, errors };
        }
    }

    global.WorldBookKit = {
        WorldBookEngine,
        WorldBookImporter
    };

})(typeof window !== 'undefined' ? window : this);