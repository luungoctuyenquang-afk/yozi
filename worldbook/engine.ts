import { WorldBook, Entry, ActivatedEntry, InsertionSlot, ProcessResult, ActivationSettings, EngineContext } from './types.js';

export class WorldBookEngine {
  private settings: ActivationSettings;
  private timedEffectsState: Map<string, { stickyRemaining: number; cooldownRemaining: number; messagesSeen: number }> = new Map();
  private rand: () => number = Math.random;

  constructor(options: ActivationSettings & { seed?: number; random?: () => number } = {}) {
    if (options?.random) this.rand = options.random;
    else if (typeof options?.seed === 'number') {
      let s = (options.seed >>> 0) || 1;
      this.rand = () => ((s = (1664525 * s + 1013904223) >>> 0) & 0xffffffff) / 0x100000000;
    } else {
      this.rand = Math.random;
    }

    this.settings = {
      scanDepth: 1000,
      recursive: true,
      minActivations: 1,
      maxDepth: 3,
      maxRecursionSteps: 10,
      tokenBudget: 2000,
      matchWholeWords: false,
      caseSensitive: false,
      contextPercent: 0.7,
      useGroupScoring: true,
      prioritizeInclusion: false,
      ...options
    };
  }

  setOptions(options: ActivationSettings): void {
    this.settings = { ...this.settings, ...options };
  }

  private tickTimedEffects(): void {
    for (const s of this.timedEffectsState.values()) {
      if (s.stickyRemaining > 0) s.stickyRemaining--;
      if (s.cooldownRemaining > 0) s.cooldownRemaining--;
    }
  }

  private commitTimedEffects(activated: ActivatedEntry[]): void {
    for (const e of activated) {
      const st = this.timedEffectsState.get(e.id) || { stickyRemaining: 0, cooldownRemaining: 0, messagesSeen: 0 };
      if (e.sticky) st.stickyRemaining = e.sticky;
      if (e.cooldown) st.cooldownRemaining = e.cooldown;
      this.timedEffectsState.set(e.id, st);
    }
  }

  process(worldbook: WorldBook, context: string | EngineContext): ProcessResult {
    const startTime = performance.now();
    this.tickTimedEffects();
    
    const ctx: EngineContext = typeof context === 'string' 
      ? { text: context, currentTime: Date.now() } 
      : { currentTime: Date.now(), ...context };

    // Apply worldbook settings as defaults
    const effectiveSettings = { ...this.settings, ...worldbook.settings };
    this.settings = effectiveSettings;

    let candidates = this.selectCandidates(worldbook.entries, ctx);
    candidates = this.applyFilters(candidates, ctx);
    candidates = this.applyTimedEffects(candidates, ctx);
    candidates = this.applyProbability(candidates);
    
    candidates = this.applyBudget(candidates, this.settings);
    
    // Check for top-level blockFurther before recursion
    const topLevelBlocked = candidates.some(e => e.blockFurther);
    
    // Handle recursion vs minActivations mutually exclusively
    const recursionOn = !!this.settings.recursiveScan && (this.settings.maxRecursionSteps ?? 0) !== 0;
    if (!topLevelBlocked && recursionOn) {
      candidates = this.recursiveScan(candidates, worldbook, ctx, this.settings);
    } else if (!recursionOn && (this.settings.minActivations ?? 0) > 0) {
      candidates = this.minActivationScan(candidates, worldbook, ctx, this.settings);
    }
    
    this.commitTimedEffects(candidates);
    
    const slots = this.distributeToSlots(candidates);

    const endTime = performance.now();
    
    return {
      slots,
      activatedEntries: candidates,
      totalTokens: this.calculateTotalTokens(candidates),
      processTime: endTime - startTime
    };
  }

  private selectCandidates(entries: Entry[], ctx: EngineContext): ActivatedEntry[] {
    const candidates: ActivatedEntry[] = [];

    for (const entry of entries) {
      if (!entry.enabled) continue;

      // Always activate constants
      if (entry.constant) {
        candidates.push(this.createActivatedEntry(entry, [], 0, ctx));
        continue;
      }

      // Key-based activation
      const matchedKeys = this.matchKeys(entry, ctx.text);
      if (matchedKeys.length > 0) {
        const minActivations = entry.minActivations ?? this.settings.minActivations ?? 1;
        
        if (entry.selectiveLogic) {
          const minMatches = entry.selectiveLogic.includes('AND') ? entry.keys.length : 1;
          if (matchedKeys.length >= minMatches) {
            candidates.push(this.createActivatedEntry(entry, matchedKeys, 0, ctx));
          }
        } else if (matchedKeys.length >= minActivations) {
          candidates.push(this.createActivatedEntry(entry, matchedKeys, 0, ctx));
        }
      }
    }

    return candidates;
  }

  private applyFilters(candidates: ActivatedEntry[], ctx: EngineContext): ActivatedEntry[] {
    return candidates.filter(entry => {
      // Optional filter logic
      if (entry.optionalFilter) {
        const filter = entry.optionalFilter;
        const caseSensitive = entry.caseSensitive ?? this.settings.caseSensitive ?? false;
        const text = ctx.text;
        
        const T = caseSensitive ? text : text.toLowerCase();
        const okArr = filter.keys.map((k: string) => caseSensitive ? k : k.toLowerCase())
                           .map((k: string) => T.includes(k));
        
        const ok = 
          filter.logic === 'AND_ALL' ? okArr.every(Boolean) :
          filter.logic === 'NOT_ANY' ? !okArr.some(Boolean) :
          filter.logic === 'NOT_ALL' ? !okArr.every(Boolean) :
          /* AND_ANY */ okArr.some(Boolean);
        
        if (!ok) return false;
      }

      return true;
    });
  }

  private applyTimedEffects(cands: ActivatedEntry[], ctx?: ActivationSettings): ActivatedEntry[] {
    const res: ActivatedEntry[] = [];
    const msgCount = ctx?.chatHistory?.length ?? 0;
    for (const e of cands) {
      const st = this.timedEffectsState.get(e.id) || { stickyRemaining: 0, cooldownRemaining: 0, messagesSeen: 0 };
      if (e.delay && msgCount < e.delay) continue;
      if (st.cooldownRemaining > 0) continue;
      const copy = { ...e };
      if (st.stickyRemaining > 0) copy.stickyRemaining = st.stickyRemaining;
      res.push(copy);
    }
    return res;
  }

  private applyScoring(candidates: ActivatedEntry[], ctx: EngineContext): ActivatedEntry[] {
    for (const entry of candidates) {
      let score = 0;

      // Base scores
      if (entry.constant) score += 1000;
      score += (entry.priority || 0) * 100;
      score += (entry.order || 0) * 10;

      // Key match bonus
      for (const key of entry.matchedKeys) {
        score += key.length;
      }

      // Probability bonus
      if (entry.probability !== undefined) {
        score += entry.probability * 50;
      }

      entry.activationScore = score;

      // Group scoring
      if (this.settings.useGroupScoring && entry.group) {
        const groupBonus = this.calculateGroupBonus(entry, candidates);
        entry.groupScore = groupBonus;
        entry.activationScore += groupBonus;
      }
    }

    return candidates.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));
  }

  private applyProbability(cands: ActivatedEntry[]): ActivatedEntry[] {
    return cands.filter(e => {
      if (e.stickyRemaining && e.stickyRemaining > 0) return true;
      let p = e.probability;
      if (p == null || Number.isNaN(p as any)) p = 100;
      p = Math.max(0, Math.min(100, Number(p)));
      return (this.rand() * 100) <= p;
    });
  }

  private recursiveScan(initial: ActivatedEntry[], book: WorldBook, context: EngineContext, settings: ActivationSettings): ActivatedEntry[] {
    const result: ActivatedEntry[] = [...initial];
    const seen = new Set(result.map(e => e.id));
    let level = 1; 
    let stop = false;
    
    while (!stop && level <= (settings.maxRecursionSteps ?? 2)) {
      const buffer = result.map(e => e.content).join('\n');
      const levelCands: ActivatedEntry[] = [];
      
      for (const entry of book.entries) {
        if (seen.has(entry.id)) continue;
        if (entry.nonRecursable) continue;
        if (entry.delayLevel && level < entry.delayLevel) continue;
        
        const matched = this.matchKeys(entry, buffer);
        if (matched.length > 0) {
          levelCands.push({ 
            ...entry, 
            matchedKeys: matched, 
            recursionLevel: level, 
            activationScore: matched.length,
            depth: level
          });
        }
      }
      
      if (levelCands.length === 0) break;
      
      let chosen = this.resolveInclusionGroups(levelCands);
      chosen = this.applyProbability(chosen);
      
      result.push(...chosen);
      chosen.forEach(e => seen.add(e.id));
      
      if (chosen.some(e => e.blockFurther)) { stop = true; }
      level++;
    }
    
    return result;
  }

  private applyBudget(candidates: ActivatedEntry[], settings: ActivationSettings): ActivatedEntry[] {
    const budget = settings.tokenBudget ?? 2000;
    const contextPercent = settings.contextPercent ?? 0.7;
    const maxTokens = Math.floor(budget * contextPercent);

    let currentTokens = 0;
    const result: ActivatedEntry[] = [];

    candidates.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));

    for (const entry of candidates) {
      const tokens = this.estimateTokens(entry.content);
      if (currentTokens + tokens <= maxTokens) {
        result.push(entry);
        currentTokens += tokens;
      } else {
        break;
      }
    }

    return result;
  }

  private distributeToSlots(entries: ActivatedEntry[]): InsertionSlot[] {
    const slots = new Map<string, InsertionSlot>();
    const positionMap: Record<string, string> = {
      'before_char': 'before_char',
      'after_char': 'after_char',
      'before_example': 'before_example',
      'after_example': 'after_example',
      'before_an': 'before_an',
      'after_an': 'after_an',
      'at_depth': 'at_depth'
    };

    for (const entry of entries) {
      const position = entry.position || 'after_char';
      const slotKey = positionMap[position] || 'after_char';
      
      if (!slots.has(slotKey)) {
        slots.set(slotKey, { 
          position: slotKey, 
          entries: [],
          depth: entry.depth,
          role: entry.role
        });
      }
      slots.get(slotKey)!.entries.push(entry);
    }

    const posRank = (s: InsertionSlot) => {
      const roleRank = (r?: string) => r === 'system' ? 0 : (r === 'user' ? 1 : 2);
      switch (s.position) {
        case 'before_an': return 0;
        case 'before_char': return 1;
        case 'before_example': return 2;
        case 'at_depth': return 3 + (s.depth ?? 0) * 0.01 + roleRank(s.role) * 0.001;
        case 'after_example': return 4;
        case 'after_char': return 5;
        case 'after_an': return 6;
        default: return 5;
      }
    };
    
    // 槽内：order 升序，tie→id 升序
    for (const slot of slots.values()) {
      slot.entries.sort((a,b)=>{ const oa=a.order??0, ob=b.order??0; if(oa!==ob) return oa-ob; return (a.id??'').localeCompare(b.id??''); });
    }
    
    // 槽间：明确 rank + depth + roleRank + 生成序
    const roleRank = (r?: string) => r==='system'?0: r==='user'?1:2;
    const posOrder:Record<string,number>={before_an:0,before_char:1,before_example:2,at_depth:3,after_example:4,after_char:5,after_an:6};
    let seq=0; const meta=new Map<InsertionSlot,number>(); for (const s of slots.values()) meta.set(s, seq++);
    const ordered = Array.from(slots.values()).sort((a,b)=>{
      const ra=posOrder[a.position as any]??5, rb=posOrder[b.position as any]??5; if(ra!==rb) return ra-rb;
      const da=a.depth??0, db=b.depth??0; if(da!==db) return da-db;
      const rr=roleRank(a.role)-roleRank(b.role); if(rr!==0) return rr;
      return (meta.get(a)!-meta.get(b)!);
    });
    return ordered;
  }

  private createActivatedEntry(entry: Entry, matchedKeys: string[], depth: number, ctx: EngineContext): ActivatedEntry {
    const activated: ActivatedEntry = {
      ...entry,
      matchedKeys,
      depth,
      activationScore: this.calculateActivationScore(entry, ctx.text, matchedKeys),
      activationTime: ctx.currentTime
    };

    return activated;
  }

  private matchKeys(entry: Entry, text: string): string[] {
    const matched: string[] = [];
    const caseSensitive = entry.caseSensitive ?? this.settings.caseSensitive ?? false;
    const wholeWords = entry.matchWholeWords ?? this.settings.matchWholeWords ?? false;

    for (const key of entry.keys || []) {
      const TEXT = caseSensitive ? text : text.toLowerCase();
      const KEY = caseSensitive ? key : key.toLowerCase();
      if (wholeWords) { 
        const re = this.makeWholeWordRegex(KEY, caseSensitive); 
        if (re.test(text)) matched.push(key); 
      } else { 
        if (TEXT.includes(KEY)) matched.push(key); 
      }
    }

    return matched;
  }

  private containsCJK(s: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s);
  }
  
  private makeWholeWordRegex(k: string, cs: boolean): RegExp {
    const flags = cs ? 'g' : 'gi';
    if (this.containsCJK(k)) return new RegExp(this.escapeRegex(k), flags); // CJK: 子串
    return new RegExp(`(^|\\W)${this.escapeRegex(k)}(\\W|$)`, flags);
  }

  private textMatch(text: string, key: string, options: { caseSensitive?: boolean; wholeWords?: boolean } = {}): boolean {
    const { caseSensitive = false, wholeWords = false } = options;
    
    // Handle regex keys
    if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
      try {
        const i = key.lastIndexOf('/');
        const pattern = key.slice(1, i);
        const flags = key.slice(i + 1) || (caseSensitive ? '' : 'i');
        return new RegExp(pattern, flags).test(text);
      } catch (e) {
        return false;
      }
    }

    const t = caseSensitive ? text : text.toLowerCase();
    const k = caseSensitive ? key : key.toLowerCase();
    if (wholeWords) {
      const re = this.makeWholeWordRegex(k, caseSensitive);
      if (re.test(text)) return true;
    } else {
      if (t.includes(k)) return true;
    }
    
    return false;
  }

  private calculateActivationScore(entry: Entry, text: string, matchedKeys: string[]): number {
    let score = 0;
    
    if (entry.constant) score += 1000;
    score += (entry.priority || 0) * 100;
    score += (entry.order || 0) * 10;

    for (const key of matchedKeys) {
      score += key.length;
    }

    if (entry.probability !== undefined) {
      score += entry.probability * 50;
    }

    return score;
  }

  private calculateGroupBonus(entry: ActivatedEntry, candidates: ActivatedEntry[]): number {
    if (!entry.group) return 0;
    
    const groupMembers = candidates.filter(e => e.group === entry.group);
    return groupMembers.length * 10;
  }

  private resolveInclusionGroups(cands: ActivatedEntry[]): ActivatedEntry[] {
    const grouped = new Map<string, ActivatedEntry[]>(), solo: ActivatedEntry[] = [];
    for (const e of cands) (e.inclusionGroup ? (grouped.get(e.inclusionGroup) ?? grouped.set(e.inclusionGroup, []).get(e.inclusionGroup)!).push(e) : solo.push(e));
    const winners: ActivatedEntry[] = [];
    for (const [, arr] of grouped) { const w = this.selectFromGroup(arr); if (w) winners.push(w); }
    return [...winners, ...solo];
  }

  private selectFromGroup(entries: ActivatedEntry[]): ActivatedEntry | null {
    if (!entries.length) return null;
    if (entries.length === 1) return entries[0];
    const useScore = entries.some(e => e.useGroupScoring);
    const usePrior = entries.some(e => e.prioritizeInclusion);
    let pool = entries;
    if (useScore) {
      const m = Math.max(...pool.map(e => e.score ?? 0));
      pool = pool.filter(e => (e.score ?? 0) === m);
    }
    if (usePrior) return pool.reduce((a,b)=>( (b.order??0)>(a.order??0)?b:a ));
    const total = pool.reduce((s,e)=>s+(e.groupWeight??100),0);
    let r = this.rand()*total; for (const e of pool){ r -= (e.groupWeight??100); if (r<=0) return e; }
    return pool[0];
  }

  private minActivationScan(candidates: ActivatedEntry[], worldbook: WorldBook, context: EngineContext, settings: ActivationSettings): ActivatedEntry[] {
    const minRequired = settings.minActivations ?? 1;
    if (candidates.length >= minRequired) return candidates;
    
    const needed = minRequired - candidates.length;
    const allEntries = worldbook.entries.filter(e => e.enabled && !candidates.some(c => c.id === e.id));
    
    // Select highest priority entries that weren't already activated
    allEntries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    const additional: ActivatedEntry[] = [];
    for (let i = 0; i < Math.min(needed, allEntries.length); i++) {
      const entry = allEntries[i];
      additional.push(this.createActivatedEntry(entry, [], 0, context));
    }
    
    return [...candidates, ...additional];
  }

  private calculateTotalTokens(entries: ActivatedEntry[]): number {
    return entries.reduce((total, entry) => total + this.estimateTokens(entry.content), 0);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }


  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}