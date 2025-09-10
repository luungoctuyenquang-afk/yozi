import { WorldBook, Entry, ActivatedEntry, InsertionSlot, ProcessResult, ActivationSettings, EngineContext } from './types.js';

// Add ActivationContext type for internal use
interface ActivationContext {
  scanText: string;
  chatHistory?: any[];
  generationType?: string;
}

export class WorldBookEngine {
  private settings: ActivationSettings;
  private timedEffectsState: Map<string, { stickyRemaining: number; cooldownRemaining: number; messagesSeen: number }> = new Map();
  private rand: () => number = Math.random;
  private runtimeOptions: Partial<ActivationSettings & { recursive?: boolean }> = {};

  constructor(opts?: { seed?: number; random?: () => number }) {
    if (opts?.random) this.rand = opts.random;
    else if (typeof opts?.seed === 'number') {
      let s = (opts.seed >>> 0) || 1;
      this.rand = () => ((s = (1664525 * s + 1013904223) >>> 0) & 0xffffffff) / 0x100000000;
    }

    this.settings = this.getDefaultSettings();
  }

  private getDefaultSettings(): ActivationSettings {
    return {
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
      recursiveScan: true
    };
  }

  public setOptions(o: Partial<ActivationSettings & { recursive?: boolean }>): void {
    this.runtimeOptions = { ...this.runtimeOptions, ...o };
  }

  public process(book: WorldBook, scanText: string): { activatedEntries: ActivatedEntry[]; slots: InsertionSlot[]; finalPrompt: string; totalTokens?: number } {
    const settings: ActivationSettings = {
      ...this.getDefaultSettings(),
      ...(book.settings || {}),
      ...(this.runtimeOptions || {}),
    };
    // 兼容 tests 里的 recursive 开关命名
    if (typeof (this.runtimeOptions as any)?.recursive === 'boolean') {
      settings.recursiveScan = !!(this.runtimeOptions as any).recursive;
    }
    const slots = this.activate({ ...book, settings }, {
      scanText,
      chatHistory: [],
      generationType: 'Normal',
    });
    const activatedEntries = slots.flatMap(s => s.entries);
    const finalPrompt = activatedEntries.map(e => e.content).join('\n');
    const totalTokens = this.calculateTotalTokens(activatedEntries);
    return { activatedEntries, slots, finalPrompt, totalTokens };
  }

  private activate(book: WorldBook & { settings?: ActivationSettings }, context: ActivationContext): InsertionSlot[] {
    this.tickTimedEffects();
    const settings = book.settings || this.getDefaultSettings();
    
    // 1. Select initial candidates
    let candidates = this.selectCandidates(book.entries, context, settings);
    
    // 2. Apply filters
    candidates = this.applyFilters(candidates, context, settings);
    
    // 3. Apply timed effects
    candidates = this.applyTimedEffects(candidates, settings);
    
    // 4. Apply probability
    candidates = this.applyProbability(candidates);
    
    // 5. Apply inclusion groups
    candidates = this.resolveInclusionGroups(candidates);
    
    // 6. Apply scoring
    candidates = this.applyScoring(candidates, context, settings);
    
    // 7. Apply budget
    candidates = this.applyBudget(candidates, settings);
    
    // 8. Check for recursion blocking
    const topLevelBlocked = candidates.some(e => e.nonRecursable || e.blockFurther);
    
    // 8.5 Commit timed effects
    this.commitTimedEffects(candidates);
    
    // 9. Recursion or min activation scan (mutually exclusive)
    const canRecurse = !!settings.recursiveScan && (settings.maxRecursionSteps ?? 0) > 0;
    if (!topLevelBlocked && canRecurse) {
      candidates = this.recursiveScan(candidates, book, context, settings);
    } else if (!canRecurse && (settings.minActivations ?? 0) > 0) {
      candidates = this.minActivationScan(candidates, book, context, settings);
    }
    
    return this.distributeToSlots(candidates);
  }

  private selectCandidates(entries: Entry[], context: ActivationContext, settings: ActivationSettings): ActivatedEntry[] {
    const candidates: ActivatedEntry[] = [];
    const text = context.scanText || '';

    for (const entry of entries) {
      // Treat undefined as enabled
      const isEnabled = entry.enabled !== false;
      if (!isEnabled) continue;

      // Always activate constants
      if (entry.constant) {
        candidates.push(this.createActivatedEntry(entry, [], 0, context));
        continue;
      }

      // Key-based activation
      const matchedKeys = this.matchKeys(entry, text, settings);
      if (matchedKeys.length > 0) {
        const minActivations = entry.minActivations ?? settings.minActivations ?? 1;
        
        if (entry.selectiveLogic) {
          const minMatches = entry.selectiveLogic.includes('AND') ? entry.keys.length : 1;
          if (matchedKeys.length >= minMatches) {
            candidates.push(this.createActivatedEntry(entry, matchedKeys, 0, context));
          }
        } else if (matchedKeys.length >= minActivations) {
          candidates.push(this.createActivatedEntry(entry, matchedKeys, 0, context));
        }
      }
    }

    return candidates;
  }

  private applyFilters(candidates: ActivatedEntry[], context: ActivationContext, settings: ActivationSettings): ActivatedEntry[] {
    return candidates.filter(entry => {
      // Optional filter logic
      if (entry.optionalFilter) {
        const filter = entry.optionalFilter;
        const caseSensitive = entry.caseSensitive ?? settings.caseSensitive ?? false;
        const text = context.scanText || '';
        
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

  private applyTimedEffects(cands: ActivatedEntry[], settings?: ActivationSettings): ActivatedEntry[] {
    const res: ActivatedEntry[] = [];
    const msgCount = settings?.chatHistory?.length ?? 0;
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

  private applyScoring(candidates: ActivatedEntry[], context: ActivationContext, settings: ActivationSettings): ActivatedEntry[] {
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
      entry.score = score; // Also set score for group logic

      // Group scoring
      if (settings.useGroupScoring && entry.group) {
        const groupBonus = this.calculateGroupBonus(entry, candidates);
        entry.groupScore = groupBonus;
        entry.activationScore += groupBonus;
      }
    }

    return candidates.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));
  }

  private getProb(e: any): number {
    let p = e?.probability ?? e?.useProbability ?? e?.prob;
    if (p == null || p === '' || Number.isNaN(Number(p))) p = 100;
    p = Number(p);
    if (p <= 1 && p >= 0) p = p * 100;               // 兼容 0–1
    p = Math.max(0, Math.min(100, p));               // clamp
    return p;
  }
  
  private applyProbability(cands: ActivatedEntry[]): ActivatedEntry[] {
    return cands.filter(e => {
      if (e.stickyRemaining && e.stickyRemaining > 0) return true; // sticky 期间忽略概率
      return (this.rand() * 100) <= this.getProb(e);               // 含边界
    });
  }

  private recursiveScan(initial: ActivatedEntry[], book: WorldBook, context: ActivationContext, settings: ActivationSettings): ActivatedEntry[] {
    const result: ActivatedEntry[] = [...initial];
    const seen = new Set(result.map(e => e.id));
    let level = 1;
    
    while (level <= (settings.maxRecursionSteps ?? 2)) {
      const buffer = result.map(e => e.content).join('\n');
      const levelCands: ActivatedEntry[] = [];
      
      for (const entry of book.entries) {
        if (seen.has(entry.id)) continue;
        if (entry.delayLevel && level < entry.delayLevel) continue;
        
        const matched = this.matchKeys(entry, buffer, settings);
        if (matched.length > 0) {
          levelCands.push({ 
            ...entry, 
            matchedKeys: matched, 
            recursionLevel: level,
            score: matched.length,
            depth: level,
            activationScore: matched.length
          });
        }
      }
      
      if (levelCands.length === 0) break;
      
      const hasHardBlock = levelCands.some(e => e.nonRecursable || e.blockFurther);
      let chosen = this.resolveInclusionGroups(levelCands);
      chosen = this.applyProbability(chosen);
      
      result.push(...chosen);
      chosen.forEach(e => seen.add(e.id));
      
      if (hasHardBlock || chosen.some(e => e.blockFurther)) break;
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
    for (const e of entries) {
      const key = `${e.position || 'after_char'}_${e.depth || 0}_${e.role || 'system'}`;
      if (!slots.has(key)) slots.set(key, { position: e.position || 'after_char', depth: e.depth, role: e.role, entries: [] });
      slots.get(key)!.entries.push(e);
    }
    // 槽内：order 升序，tie→id 升序
    for (const s of slots.values()) {
      s.entries.sort((a,b)=>{ const oa=a.order??0, ob=b.order??0; if (oa!==ob) return oa-ob; return (a.id??'').localeCompare(b.id??''); });
    }
    // 槽间：稳定排序
    const roleRank = (r?: string) => r==='system'?0: r==='user'?1:2;
    const posOrder: Record<string,number> = { before_an:0,before_char:1,before_example:2,at_depth:3,after_example:4,after_char:5,after_an:6 };
    let seq=0; const meta=new Map<InsertionSlot,number>(); for (const s of slots.values()) meta.set(s, seq++);
    const ordered = Array.from(slots.values()).sort((a,b)=>{
      const ra=posOrder[a.position as any]??5, rb=posOrder[b.position as any]??5; if (ra!==rb) return ra-rb;
      const da=a.depth??0, db=b.depth??0; if (da!==db) return da-db;
      const rr=roleRank(a.role)-roleRank(b.role); if (rr!==0) return rr;
      return (meta.get(a)! - meta.get(b)!);
    });
    return ordered;
  }

  private createActivatedEntry(entry: Entry, matchedKeys: string[], depth: number, context: ActivationContext): ActivatedEntry {
    const activated: ActivatedEntry = {
      ...entry,
      matchedKeys,
      depth,
      activationScore: this.calculateActivationScore(entry, context.scanText || '', matchedKeys),
      activationTime: Date.now()
    };

    return activated;
  }

  private matchKeys(entry: Entry, text: string, settings?: ActivationSettings): string[] {
    const matched: string[] = [];
    const caseSensitive = entry.caseSensitive ?? settings?.caseSensitive ?? false;
    const wholeWords = entry.matchWholeWords ?? settings?.matchWholeWords ?? false;

    for (const key of entry.keys || []) {
      const TEXT = caseSensitive ? text : text.toLowerCase();
      const KEY = caseSensitive ? key : key.toLowerCase();
      if (wholeWords) { 
        const re = this.makeWholeWordRegex(key, caseSensitive); 
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
    const f = cs ? 'g' : 'gi';
    if (this.containsCJK(k)) return new RegExp(this.escapeRegex(k), f); // CJK 无 \b，退化为子串
    return new RegExp(`(^|\\W)${this.escapeRegex(k)}(\\W|$)`, f);
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

  public resolveInclusionGroups(cands: ActivatedEntry[]): ActivatedEntry[] {
    const grouped = new Map<string, ActivatedEntry[]>(), solo: ActivatedEntry[] = [];
    for (const e of cands) {
      const groupKey = (e as any).inclusionGroup || (e as any).group;
      if (groupKey) {
        const arr = grouped.get(groupKey) ?? [];
        arr.push(e); grouped.set(groupKey, arr);
      } else { solo.push(e); }
    }
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
    if (useScore) { const m = Math.max(...pool.map(e => e.score ?? 0)); pool = pool.filter(e => (e.score ?? 0) === m); }
    if (usePrior) { 
      // For priority-based selection, use priority field first, then order
      return pool.reduce((a,b)=>{
        const pa = a.priority ?? 0, pb = b.priority ?? 0;
        if (pa !== pb) return pb > pa ? b : a;
        return (b.order??0)>(a.order??0)?b:a;
      });
    }
    const total = pool.reduce((s,e)=>s+(e.groupWeight??100),0);
    let r = this.rand()*total; for (const e of pool){ r -= (e.groupWeight??100); if (r<=0) return e; }
    return pool[0];
  }

  private minActivationScan(candidates: ActivatedEntry[], worldbook: WorldBook, context: ActivationContext, settings: ActivationSettings): ActivatedEntry[] {
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