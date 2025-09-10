import { WorldBook, Entry, ActivatedEntry, InsertionSlot, ProcessResult, ActivationSettings, EngineContext } from './types.js';

export class WorldBookEngine {
  private settings: ActivationSettings;
  private activationHistory: Map<string, { time: number; stickyUntil?: number; cooldownUntil?: number }> = new Map();

  constructor(options: ActivationSettings = {}) {
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

  process(worldbook: WorldBook, context: string | EngineContext): ProcessResult {
    const startTime = performance.now();
    const ctx: EngineContext = typeof context === 'string' 
      ? { text: context, currentTime: Date.now() } 
      : { currentTime: Date.now(), ...context };

    // Apply worldbook settings as defaults
    const effectiveSettings = { ...this.settings, ...worldbook.settings };
    this.settings = effectiveSettings;

    // Phase 1: Candidate selection (ALWAYS/ON_KEY)
    const candidates = this.selectCandidates(worldbook.entries, ctx);

    // Phase 2: Trigger/role/source filtering
    const filtered = this.applyFilters(candidates, ctx);

    // Phase 3: Time-based filtering (sticky/cooldown/delay)
    const timeFiltered = this.applyTimeFilters(filtered, ctx);

    // Phase 4: Group scoring and prioritization
    const scored = this.applyScoring(timeFiltered, ctx);

    // Phase 5: Probability filtering (skip if sticky)
    const probabilityFiltered = this.applyProbabilityFilter(scored, ctx);

    // Phase 6: Recursion handling
    const withRecursion = this.handleRecursion(probabilityFiltered, worldbook.entries, ctx);

    // Phase 7: Budget truncation
    const budgetFiltered = this.applyBudgetLimits(withRecursion);

    // Phase 8: Position organization
    const slots = this.organizeByPosition(budgetFiltered);

    const endTime = performance.now();
    
    return {
      slots,
      activatedEntries: budgetFiltered,
      totalTokens: this.calculateTotalTokens(budgetFiltered),
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
        const f = entry.optionalFilter;
        const keys = f.keys || [];
        const matches = keys.map(k => this.textMatch(ctx.text, k, {
          caseSensitive: entry.caseSensitive ?? this.settings.caseSensitive ?? false,
          wholeWords: false
        }));
        
        const ok = 
          f.logic === 'AND_ALL' ? matches.every(Boolean) :
          f.logic === 'NOT_ANY' ? !matches.some(Boolean) :
          f.logic === 'NOT_ALL' ? !matches.every(Boolean) :
          /* AND_ANY */ matches.some(Boolean);
        
        if (!ok) return false;
      }

      return true;
    });
  }

  private applyTimeFilters(candidates: ActivatedEntry[], ctx: EngineContext): ActivatedEntry[] {
    const currentTime = ctx.currentTime ?? Date.now();
    const filtered: ActivatedEntry[] = [];

    for (const entry of candidates) {
      const history = this.activationHistory.get(entry.id);
      
      // Check cooldown
      if (history?.cooldownUntil && currentTime < history.cooldownUntil) {
        continue;
      }

      // Check delay
      if (entry.delay && (!history || currentTime - history.time < entry.delay * 1000)) {
        continue;
      }

      // Apply sticky behavior
      if (entry.sticky && history?.stickyUntil && currentTime < history.stickyUntil) {
        entry.activationScore = (entry.activationScore || 0) + 1000; // Boost sticky entries
      }

      filtered.push(entry);
    }

    return filtered;
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

  private applyProbabilityFilter(candidates: ActivatedEntry[], ctx: EngineContext): ActivatedEntry[] {
    const currentTime = ctx.currentTime ?? Date.now();
    
    return candidates.filter(entry => {
      // Skip probability check if entry is sticky and still active
      const history = this.activationHistory.get(entry.id);
      if (entry.sticky && history?.stickyUntil && currentTime < history.stickyUntil) {
        return true;
      }

      // Apply probability filter
      if (entry.probability !== undefined && Math.random() > entry.probability) {
        return false;
      }

      return true;
    });
  }

  private handleRecursion(candidates: ActivatedEntry[], allEntries: Entry[], ctx: EngineContext, depth = 0): ActivatedEntry[] {
    if (!this.settings.recursive || depth >= (this.settings.maxDepth ?? 3)) {
      return candidates;
    }

    const result = [...candidates];
    const maxRecursionSteps = this.settings.maxRecursionSteps ?? 10;

    for (const entry of candidates) {
      if (entry.nonRecursable || depth >= maxRecursionSteps) continue;

      // Recursive activation on entry content
      if (entry.recursive !== false && entry.content) {
        const recursiveCtx: EngineContext = { ...ctx, text: entry.content };
        const recursiveCandidates = this.selectCandidates(allEntries, recursiveCtx);
        const recursiveFiltered = this.applyFilters(recursiveCandidates, recursiveCtx);
        
        for (const recursive of recursiveFiltered) {
          recursive.depth = depth + 1;
          result.push(recursive);
        }

        // Handle blockFurther
        if (entry.blockFurther) break;
      }
    }

    // Apply minimum activations if no recursion happened
    if (result.length === candidates.length && this.settings.minActivations) {
      const minActivated = this.ensureMinimumActivations(allEntries, ctx);
      result.push(...minActivated);
    }

    return result;
  }

  private applyBudgetLimits(candidates: ActivatedEntry[]): ActivatedEntry[] {
    const budget = this.settings.tokenBudget ?? 2000;
    const contextPercent = this.settings.contextPercent ?? 0.7;
    const maxTokens = Math.floor(budget * contextPercent);

    let currentTokens = 0;
    const result: ActivatedEntry[] = [];

    // Apply group limits first
    const groups: Record<string, ActivatedEntry[]> = {};
    const ungrouped: ActivatedEntry[] = [];

    for (const entry of candidates) {
      if (entry.group) {
        if (!groups[entry.group]) groups[entry.group] = [];
        groups[entry.group].push(entry);
      } else {
        ungrouped.push(entry);
      }
    }

    // Take best from each group
    for (const [groupName, groupEntries] of Object.entries(groups)) {
      groupEntries.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));
      if (groupEntries.length > 0) {
        const tokens = this.estimateTokens(groupEntries[0].content);
        if (currentTokens + tokens <= maxTokens) {
          result.push(groupEntries[0]);
          currentTokens += tokens;
        }
      }
    }

    // Add ungrouped entries
    for (const entry of ungrouped) {
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

  private organizeByPosition(entries: ActivatedEntry[]): InsertionSlot[] {
    const slots: Record<string, ActivatedEntry[]> = {
      'before_char': [],
      'after_char': [],
      'before_example': [],
      'after_example': [],
      'before_an': [],
      'after_an': [],
      'at_depth': []
    };

    for (const entry of entries) {
      const position = entry.position || 'after_char';
      if (slots[position]) {
        slots[position].push(entry);
      } else {
        slots['after_char'].push(entry);
      }
    }

    // Sort by order within each position
    for (const position in slots) {
      slots[position].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return Object.entries(slots)
      .filter(([_, entries]) => entries.length > 0)
      .map(([position, entries]) => ({ position, entries }));
  }

  private createActivatedEntry(entry: Entry, matchedKeys: string[], depth: number, ctx: EngineContext): ActivatedEntry {
    const activated: ActivatedEntry = {
      ...entry,
      matchedKeys,
      depth,
      activationScore: this.calculateActivationScore(entry, ctx.text, matchedKeys),
      activationTime: ctx.currentTime
    };

    // Update activation history
    const currentTime = ctx.currentTime ?? Date.now();
    const history = {
      time: currentTime,
      stickyUntil: entry.sticky ? currentTime + (entry.sticky * 1000) : undefined,
      cooldownUntil: entry.cooldown ? currentTime + (entry.cooldown * 1000) : undefined
    };
    this.activationHistory.set(entry.id, history);

    return activated;
  }

  private matchKeys(entry: Entry, text: string): string[] {
    const matched: string[] = [];
    const caseSensitive = entry.caseSensitive ?? this.settings.caseSensitive ?? false;
    const wholeWords = entry.matchWholeWords ?? this.settings.matchWholeWords ?? false;

    for (const key of entry.keys || []) {
      if (this.textMatch(text, key, { caseSensitive, wholeWords })) {
        matched.push(key);
      }
    }

    return matched;
  }

  private textMatch(text: string, key: string, options: { caseSensitive?: boolean; wholeWords?: boolean } = {}): boolean {
    const { caseSensitive = false, wholeWords = false } = options;
    
    const t = caseSensitive ? text : this.toHalfWidth(text).toLowerCase();
    const k = caseSensitive ? key : this.toHalfWidth(key).toLowerCase();

    // Handle regex keys
    if (k.startsWith('/') && k.lastIndexOf('/') > 0) {
      try {
        const i = k.lastIndexOf('/');
        const pattern = k.slice(1, i);
        const flags = k.slice(i + 1) || (caseSensitive ? '' : 'i');
        return new RegExp(pattern, flags).test(text);
      } catch (e) {
        return false;
      }
    }

    // CJK text: no word boundaries, direct inclusion match
    if (this.hasCJK(k) || this.hasCJK(t)) {
      return t.includes(k);
    }

    // English: use word boundaries if wholeWords is true
    if (wholeWords) {
      const regex = new RegExp(`\\b${this.escapeRegex(k)}\\b`, caseSensitive ? '' : 'i');
      return regex.test(text);
    }
    
    return t.includes(k);
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

  private ensureMinimumActivations(entries: Entry[], ctx: EngineContext): ActivatedEntry[] {
    // Simplified minimum activation logic
    return [];
  }

  private calculateTotalTokens(entries: ActivatedEntry[]): number {
    return entries.reduce((total, entry) => total + this.estimateTokens(entry.content), 0);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private toHalfWidth(s: string): string {
    return s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
            .replace(/\u3000/g, ' ');
  }

  private hasCJK(s: string): boolean {
    return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(s || '');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}