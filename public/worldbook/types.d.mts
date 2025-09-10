interface Entry {
    id: string;
    name?: string;
    keys: string[];
    content: string;
    enabled?: boolean;
    position?: 'before_char' | 'after_char' | 'before_example' | 'after_example' | 'before_an' | 'after_an' | 'at_depth';
    role?: string;
    priority?: number;
    order?: number;
    constant?: boolean;
    selectiveLogic?: string;
    minActivations?: number;
    caseSensitive?: boolean;
    matchWholeWords?: boolean;
    optionalFilter?: {
        keys: string[];
        logic: 'AND_ALL' | 'NOT_ANY' | 'NOT_ALL' | 'AND_ANY';
    };
    group?: string;
    probability?: number;
    useGroupScoring?: boolean;
    prioritizeInclusion?: boolean;
    groupWeight?: number;
    recursive?: boolean;
    sticky?: number;
    cooldown?: number;
    delay?: number;
    nonRecursable?: boolean;
    blockFurther?: boolean;
    delayLevel?: number;
    maxRecursionSteps?: number;
}
interface WorldBook {
    name?: string;
    description?: string;
    version?: string;
    entries: Entry[];
    settings?: WorldBookSettings;
    metadata?: {
        created?: string;
        author?: string;
        tags?: string[];
        totalEntries?: number;
    };
}
interface WorldBookSettings {
    defaultScanDepth?: number;
    defaultRecursive?: boolean;
    defaultMinActivations?: number;
    defaultMaxDepth?: number;
    defaultMaxRecursionSteps?: number;
    defaultTokenBudget?: number;
    matchWholeWords?: boolean;
    caseSensitive?: boolean;
    contextPercent?: number;
    useGroupScoring?: boolean;
    prioritizeInclusion?: boolean;
}
interface ActivationSettings {
    scanDepth?: number;
    recursive?: boolean;
    recursiveScan?: boolean;
    minActivations?: number;
    maxDepth?: number;
    maxRecursionSteps?: number;
    tokenBudget?: number;
    matchWholeWords?: boolean;
    caseSensitive?: boolean;
    contextPercent?: number;
    useGroupScoring?: boolean;
    prioritizeInclusion?: boolean;
    chatHistory?: any[];
}
interface ActivatedEntry extends Entry {
    matchedKeys: string[];
    depth: number;
    activationScore: number;
    groupScore?: number;
    activationTime?: number;
    stickyUntil?: number;
    cooldownUntil?: number;
    stickyRemaining?: number;
    recursionLevel?: number;
}
interface InsertionSlot {
    position: string;
    entries: ActivatedEntry[];
    depth?: number;
    role?: string;
}
interface ProcessResult {
    slots: InsertionSlot[];
    activatedEntries: ActivatedEntry[];
    totalTokens?: number;
    processTime?: number;
}
interface EngineContext {
    text: string;
    chatHistory?: any[];
    generationType?: string;
    currentTime?: number;
}

export type { ActivatedEntry, ActivationSettings, EngineContext, Entry, InsertionSlot, ProcessResult, WorldBook, WorldBookSettings };
