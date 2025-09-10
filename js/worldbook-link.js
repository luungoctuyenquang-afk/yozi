(function() {
    'use strict';

    // 内联示例数据，支持 file:// 场景
    const SAMPLE_BOOK = {
        "name": "Travel World Book",
        "description": "A comprehensive world book for travel scenarios",
        "version": "1.0.0",
        "entries": [
            {
                "id": "wbe_001",
                "name": "Constant Travel Context",
                "keys": [],
                "content": "The world is vast and filled with wonders to explore. Every journey begins with a single step, and every destination holds unique stories and experiences.",
                "constant": true,
                "position": "top",
                "priority": 100,
                "order": 1,
                "comment": "Always active travel context"
            },
            {
                "id": "wbe_002",
                "name": "Paris Location",
                "keys": ["Paris", "Eiffel Tower", "France", "French"],
                "content": "Paris, the City of Light, is renowned for its art, fashion, gastronomy, and culture. The Eiffel Tower stands as its iconic landmark, while the Seine River flows through the heart of the city. Cafés line the streets, and museums like the Louvre house world-famous artworks.",
                "position": "afterSystem",
                "priority": 80,
                "order": 10,
                "group": "locations",
                "probability": 0.9,
                "sticky": true,
                "cooldown": 3,
                "comment": "High priority Paris information"
            },
            {
                "id": "wbe_003", 
                "name": "Tokyo Location",
                "keys": ["Tokyo", "Japan", "Japanese", "Shibuya", "Mount Fuji"],
                "content": "Tokyo is a bustling metropolis where traditional culture meets cutting-edge technology. From the busy crossing at Shibuya to the serene temples, Tokyo offers contrasts at every turn. Mount Fuji can be seen on clear days, and the city's cuisine ranges from street food to Michelin-starred restaurants.",
                "position": "afterSystem",
                "priority": 75,
                "order": 11,
                "group": "locations",
                "probability": 0.85,
                "delay": 2,
                "comment": "Tokyo travel information"
            },
            {
                "id": "wbe_004",
                "name": "New York Location", 
                "keys": ["New York", "NYC", "Manhattan", "Statue of Liberty", "Central Park"],
                "content": "New York City, the Big Apple, never sleeps. Manhattan's skyline is iconic, Central Park provides green respite, and the Statue of Liberty symbolizes freedom. Broadway shows, world-class museums, and diverse neighborhoods make it a cultural melting pot.",
                "position": "afterSystem",
                "priority": 70,
                "order": 12,
                "group": "locations",
                "probability": 0.8,
                "comment": "New York City details"
            },
            {
                "id": "wbe_005",
                "name": "Travel Safety Tips",
                "keys": ["safety", "secure", "dangerous", "risk", "emergency", "安全", "注意事项", "危险"],
                "content": "Travel safety is paramount. Always keep copies of important documents, stay aware of your surroundings, use reputable transportation, and inform someone of your itinerary. Research local customs and potential risks before traveling.",
                "position": "beforeMain",
                "priority": 90,
                "order": 5,
                "selectiveLogic": "AND",
                "minActivations": 1,
                "comment": "Important safety information"
            },
            {
                "id": "wbe_006",
                "name": "Hotel Booking",
                "keys": ["hotel", "accommodation", "booking", "reservation", "stay"],
                "content": "When booking hotels, consider location, amenities, reviews, and cancellation policies. Book in advance for popular destinations and during peak seasons. Compare prices across platforms and read recent guest reviews.",
                "position": "afterExample",
                "priority": 60,
                "order": 20,
                "probability": 0.7,
                "comment": "Hotel booking advice"
            },
            {
                "id": "wbe_007",
                "name": "Flight Information",
                "keys": ["flight", "airplane", "airport", "airline", "departure", "arrival"],
                "content": "Flight planning involves comparing prices, checking baggage policies, and considering departure times. Arrive at airports early, especially for international flights. Check-in online when possible and download airline apps for updates.",
                "position": "afterExample", 
                "priority": 65,
                "order": 21,
                "recursive": true,
                "maxRecursionSteps": 2,
                "comment": "Flight travel information"
            },
            {
                "id": "wbe_008",
                "name": "Local Transportation",
                "keys": ["taxi", "bus", "subway", "metro", "transportation", "public transport"],
                "content": "Local transportation options vary by destination. Research metro/subway systems, bus routes, and taxi services. Consider ride-sharing apps, bike rentals, or walking for short distances. Purchase travel cards for frequent public transport use.",
                "position": "afterMain",
                "priority": 50,
                "order": 30,
                "nonRecursable": true,
                "comment": "Transportation within cities"
            },
            {
                "id": "wbe_009",
                "name": "Currency Exchange",
                "keys": ["money", "currency", "exchange", "ATM", "cash", "credit card"],
                "content": "Handle currency wisely when traveling. Use ATMs for better exchange rates than currency counters. Notify banks of travel plans to avoid card blocks. Carry some cash for places that don't accept cards, but don't carry excessive amounts.",
                "position": "afterMain",
                "priority": 55,
                "order": 31,
                "blockFurther": true,
                "delayLevel": 1,
                "comment": "Financial advice for travelers"
            },
            {
                "id": "wbe_010",
                "name": "Cultural Etiquette",
                "keys": ["culture", "etiquette", "customs", "manners", "respect", "local traditions"],
                "content": "Respect local cultures and customs. Learn basic phrases in the local language, dress appropriately for religious sites, understand tipping customs, and be mindful of photography restrictions. Research cultural norms before visiting.",
                "position": "floating",
                "priority": 40,
                "order": 40,
                "probability": 0.6,
                "maxDepth": 2,
                "comment": "Cultural awareness for respectful travel"
            },
            {
                "id": "wbe_011",
                "name": "Food and Dining",
                "keys": ["food", "restaurant", "cuisine", "dining", "local food", "eating", "餐厅", "美食", "餐厅推荐"],
                "content": "Exploring local cuisine is a highlight of travel. Try street food from reputable vendors, make reservations at popular restaurants, consider dietary restrictions and allergies, and be adventurous with new flavors while being cautious with food safety.",
                "position": "bottom",
                "priority": 45,
                "order": 50,
                "comment": "Culinary travel experiences"
            },
            {
                "id": "wbe_012",
                "name": "Weather Considerations",
                "keys": ["weather", "climate", "temperature", "rain", "season", "forecast", "天气", "气候", "温度"],
                "content": "Weather significantly impacts travel experiences. Check forecasts before departure, pack appropriate clothing for the climate, consider seasonal variations and monsoons, and have backup indoor activities for rainy days.",
                "position": "bottom",
                "priority": 35,
                "order": 51,
                "probability": 0.75,
                "comment": "Weather planning for travel"
            },
            {
                "id": "wbe_013",
                "name": "海南亚龙湾",
                "keys": ["海南", "亚龙湾", "三亚", "Hainan", "Yalong Bay", "Sanya"],
                "content": "海南亚龙湾是中国著名的热带海滨旅游胜地，拥有7公里长的银白色海滩和清澈的海水。这里气候宜人，年平均气温25.5°C，是度假的理想选择。亚龙湾周边有众多度假酒店和水上运动设施。",
                "position": "afterSystem",
                "priority": 85,
                "order": 13,
                "group": "locations",
                "probability": 0.95,
                "sticky": 2,
                "comment": "海南亚龙湾旅游信息"
            }
        ],
        "settings": {
            "defaultScanDepth": 1000,
            "defaultRecursive": true,
            "defaultMinActivations": 1,
            "defaultMaxDepth": 3,
            "defaultMaxRecursionSteps": 10,
            "defaultTokenBudget": 2000,
            "matchWholeWords": false
        },
        "metadata": {
            "created": "2025-09-09",
            "author": "WorldBook System",
            "tags": ["travel", "tourism", "culture", "safety"],
            "totalEntries": 13
        }
    };

    // 检查 WorldBookKit 是否可用
    if (!window.WorldBookKit) {
        console.error('[WorldBook] WorldBookKit not found. Please ensure index.iife.js is loaded.');
        return;
    }

    const { WorldBookEngine, WorldBookImporter } = window.WorldBookKit;

    // 检测引擎可用的方法名
    function detectMethod() {
        const methodNames = ['process', 'run', 'activate', 'evaluate', 'execute', 'activateEntries'];
        const engine = new WorldBookEngine();
        
        for (const methodName of methodNames) {
            if (typeof engine[methodName] === 'function') {
                return methodName;
            }
        }
        
        console.warn('[WorldBook] No recognized method found, falling back to "process"');
        return 'process';
    }

    // 位置映射表和槽位归一化
    const POS_MAP = { top:'before_char', beforeMain:'before_an', afterMain:'after_an', afterSystem:'after_char', afterExample:'after_example', bottom:'after_char', floating:'after_char', unknown:'after_char' };
    
    function normSlots(out){
        const k = p => POS_MAP[p] || p || 'after_char';
        if (Array.isArray(out)) { if (out.length && !out[0]?.entries) return [{ position:'after_char', entries: out }]; return out; }
        if (out?.slots){
            if (Array.isArray(out.slots)) return out.slots.map(s => ({ position: k(s.position), entries: s.entries||[] }));
            if (typeof out.slots === 'object') return Object.entries(out.slots).map(([p,arr]) => ({ position: k(p), entries: Array.isArray(arr)?arr:[] }));
        }
        if (Array.isArray(out?.activatedEntries)) return [{ position:'after_char', entries: out.activatedEntries }];
        return [];
    }

    // 加载世界书数据
    async function loadWorldBook() {
        try {
            // 优先从 localStorage 读取
            const stored = localStorage.getItem('worldbook');
            if (stored) {
                const raw = JSON.parse(stored);
                const book = WorldBookImporter.import(raw);
                if (typeof setCurrentBook === 'function') {
                    setCurrentBook(book);
                }
                console.debug('[WorldBook] Loaded from localStorage and normalized');
                return book;
            }

            // 根据协议选择加载方式
            if (location.protocol === 'file:') {
                // file:// 协议，使用内联数据
                console.debug('[WorldBook] Using inline SAMPLE_BOOK for file:// protocol');
                const book = WorldBookImporter.import(SAMPLE_BOOK);
                if (typeof setCurrentBook === 'function') {
                    setCurrentBook(book);
                }
                return book;
            } else {
                // http(s) 协议，尝试 fetch
                try {
                    const response = await fetch('/worldbook/samples/travel.worldbook.json');
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const raw = await response.json();
                    const book = WorldBookImporter.import(raw);
                    if (typeof setCurrentBook === 'function') {
                        setCurrentBook(book);
                    }
                    console.debug('[WorldBook] Loaded from server and normalized');
                    return book;
                } catch (fetchError) {
                    console.warn('[WorldBook] Fetch failed, falling back to inline data:', fetchError);
                    const book = WorldBookImporter.import(SAMPLE_BOOK);
                    if (typeof setCurrentBook === 'function') {
                        setCurrentBook(book);
                    }
                    return book;
                }
            }
        } catch (error) {
            console.error('[WorldBook] Load error, using fallback:', error);
            const book = WorldBookImporter.import(SAMPLE_BOOK);
            if (typeof setCurrentBook === 'function') {
                setCurrentBook(book);
            }
            return book;
        }
    }

    // 主要的世界书处理函数
    window.buildWorldInfo = async function(scanText, chatHistory) {
        try {
            const book = await loadWorldBook();
            const engine = new WorldBookEngine();

            // 兼容 IIFE 的 API：先设选项，再调用
            if (typeof engine.setOptions === 'function') {
                engine.setOptions({
                    chatHistory: chatHistory || [],
                    generationType: 'Normal',
                    scanDepth: 3,
                    includeNames: true,
                    recursiveScan: true
                });
            }

            const method = detectMethod();
            const raw = engine[method](book, String(scanText || ''));
            const slots = normSlots(raw);
            const text = slots.flatMap(s=>s.entries||[]).map(e=>e.content).join('\n');

            console.debug('[WorldBook] hits:', slots.map(s => ({
                position: s.position,
                count: (s.entries || []).length
            })));

            return { slots, text };
        } catch (error) {
            console.error('[WorldBook] buildWorldInfo error:', error);
            return { slots: [], text: '' };
        }
    };

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

    // 导入世界书文件
    window.importWorldBookFromFile = async function(file) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            const text = await decodeFileToText(file);
            const raw = JSON.parse(text);
            
            // 使用 Importer 进行规范化
            const normalized = WorldBookImporter.import(raw);
            
            // 验证规范化后的数据
            const validation = WorldBookImporter.validate(normalized);
            if (!validation.valid) {
                console.warn('[WorldBook] Import validation warnings:', validation.errors);
            }

            // 保存到 localStorage
            localStorage.setItem('worldbook', JSON.stringify(normalized));
            alert('世界书已导入');
            console.log('[WorldBook] Imported and normalized:', normalized.name || 'Unnamed');
            return normalized;
        } catch (error) {
            const errorMsg = 'Failed to import worldbook: ' + error.message;
            alert(errorMsg);
            throw new Error(errorMsg);
        }
    };

    console.log('[WorldBook] Initialized successfully');
    console.log('[WorldBook] typeof window.WorldBookKit:', typeof window.WorldBookKit);
    console.log('[WorldBook] typeof window.buildWorldInfo:', typeof window.buildWorldInfo);
})();