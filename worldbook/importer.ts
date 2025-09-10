import { WorldBook, Entry } from './types.js';

// English to Chinese synonym mapping
const EN_TO_CN_MAP: Record<string, string[]> = {
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

export class WorldBookImporter {
  static import(raw: any): WorldBook {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid worldbook data');
    }

    let book: any = { ...raw };

    // Handle {worldbook:[...]} format, convert to {entries:[...]}
    if (book.worldbook && Array.isArray(book.worldbook) && !book.entries) {
      book.entries = book.worldbook;
      delete book.worldbook;
    }

    // Ensure entries array exists
    if (!Array.isArray(book.entries)) {
      book.entries = [];
    }

    // Normalize each entry
    book.entries = book.entries.map((entry: any, index: number) => {
      const normalized: any = { ...entry };

      // Handle keys/key field - support multiple formats and backup fields
      let rawKeys: string[] = [];
      
      // Try to get keys from multiple fields
      const keyFields = ['keys', 'key', 'keywords', 'primary_keys', '关键词', '触发词'];
      for (const field of keyFields) {
        if (normalized[field]) {
          if (typeof normalized[field] === 'string') {
            // String format, split with loose separators
            rawKeys.push(...normalized[field].split(/[,\s、，;；|\/]+/)
              .map(k => k.trim())
              .filter(k => k.length > 0));
          } else if (Array.isArray(normalized[field])) {
            rawKeys.push(...normalized[field]);
          } else if (typeof normalized[field] === 'object' && normalized[field].primary) {
            // Object format {primary:[], secondary:[]}
            const primary = Array.isArray(normalized[field].primary) ? normalized[field].primary : [];
            const secondary = Array.isArray(normalized[field].secondary) ? normalized[field].secondary : [];
            
            rawKeys.push(...primary);
            if (secondary.length > 0) {
              normalized.optionalFilter = normalized.optionalFilter || { keys: [], logic: 'AND_ANY' as const };
              normalized.optionalFilter.keys = secondary;
            }
          }
          if (field !== 'keys') delete normalized[field];
        }
      }
      
      // Expand English keys to Chinese synonyms and normalize
      normalized.keys = rawKeys.length > 0 ? this.expandEnglishKeys(rawKeys) : [];

      // Handle content/entry/text field
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

      // Default enabled to true
      if (normalized.enabled === undefined) {
        normalized.enabled = true;
      }

      // Map position numbers/old enums
      if (typeof normalized.position === 'number') {
        const positionMap: Record<number, string> = {
          0: 'before_char',
          1: 'after_char', 
          2: 'before_example',
          3: 'after_example',
          4: 'before_an',
          5: 'after_an',
          6: 'at_depth'
        };
        normalized.position = positionMap[normalized.position] || 'after_char' as any;
      } else if (typeof normalized.position === 'string') {
        // Map old position names
        const oldPositionMap: Record<string, string> = {
          'before_char': 'before_char',
          'after_char': 'after_char', 
          'before_example': 'before_example',
          'after_example': 'after_example',
          'before_an': 'before_an',
          'after_an': 'after_an',
          'at_depth': 'at_depth',
          // Legacy mappings
          'top': 'before_char',
          'beforeMain': 'before_an',
          'afterMain': 'after_an',
          'afterSystem': 'after_char',
          'bottom': 'after_char',
          'floating': 'after_char',
          'unknown': 'after_char'
        };
        normalized.position = oldPositionMap[normalized.position] || normalized.position as any;
      } else if (!normalized.position) {
        normalized.position = 'after_char';
      }

      // Ensure id exists
      if (!normalized.id && normalized.id !== 0) {
        normalized.id = `entry_${index}`;
      }

      return normalized as Entry;
    });

    return book;
  }

  private static expandEnglishKeys(keys: string[]): string[] {
    const expanded = [...keys];
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if (EN_TO_CN_MAP[lowerKey]) {
        expanded.push(...EN_TO_CN_MAP[lowerKey]);
      }
    }
    // Deduplicate and normalize
    return [...new Set(expanded.map(k => k.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/\u3000/g,' ').trim()))].filter(k => k.length > 0);
  }

  static validate(worldbook: WorldBook): { valid: boolean; errors: string[] } {
    if (!worldbook || typeof worldbook !== 'object') {
      return { valid: false, errors: ['Worldbook must be an object'] };
    }

    if (!Array.isArray(worldbook.entries)) {
      return { valid: false, errors: ['Worldbook must have an entries array'] };
    }

    const errors: string[] = [];
    worldbook.entries.forEach((entry, index) => {
      if (!entry.id && (entry.id as any) !== 0) {
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

  // Export to ST-like format
  static export(worldbook: WorldBook): any {
    return {
      name: worldbook.name,
      description: worldbook.description,
      version: worldbook.version,
      entries: worldbook.entries.map(entry => ({
        id: entry.id,
        name: entry.name,
        keys: entry.keys,
        content: entry.content,
        enabled: entry.enabled,
        position: entry.position,
        priority: entry.priority,
        order: entry.order,
        constant: entry.constant,
        selectiveLogic: entry.selectiveLogic,
        caseSensitive: entry.caseSensitive,
        matchWholeWords: entry.matchWholeWords,
        optionalFilter: entry.optionalFilter,
        group: entry.group,
        probability: entry.probability,
        recursive: entry.recursive,
        sticky: entry.sticky,
        cooldown: entry.cooldown,
        delay: entry.delay,
        nonRecursable: entry.nonRecursable,
        blockFurther: entry.blockFurther,
        delayLevel: entry.delayLevel,
        maxRecursionSteps: entry.maxRecursionSteps
      })),
      settings: worldbook.settings,
      metadata: worldbook.metadata
    };
  }
}