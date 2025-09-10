// WorldBook TypeScript Types

export interface Entry {
  id: string;
  name?: string;
  keys: string[];
  content: string;
  enabled?: boolean;
  
  // Position control
  position?: 'before_char' | 'after_char' | 'before_example' | 'after_example' | 'before_an' | 'after_an' | 'at_depth';
  
  // Priority and ordering
  priority?: number;
  order?: number;
  
  // Activation logic
  constant?: boolean;
  selectiveLogic?: string;
  minActivations?: number;
  
  // Filtering
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  optionalFilter?: {
    keys: string[];
    logic: 'AND_ALL' | 'NOT_ANY' | 'NOT_ALL' | 'AND_ANY';
  };
  
  // Group behavior
  group?: string;
  probability?: number;
  
  // Recursion and sticky behavior
  recursive?: boolean;
  sticky?: number;
  cooldown?: number;
  delay?: number;
  nonRecursable?: boolean;
  blockFurther?: boolean;
  delayLevel?: number;
  maxRecursionSteps?: number;
}

export interface WorldBook {
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

export interface WorldBookSettings {
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

export interface ActivationSettings {
  scanDepth?: number;
  recursive?: boolean;
  minActivations?: number;
  maxDepth?: number;
  maxRecursionSteps?: number;
  tokenBudget?: number;
  matchWholeWords?: boolean;
  caseSensitive?: boolean;
  contextPercent?: number;
  useGroupScoring?: boolean;
  prioritizeInclusion?: boolean;
}

export interface ActivatedEntry extends Entry {
  matchedKeys: string[];
  depth: number;
  activationScore: number;
  groupScore?: number;
  activationTime?: number;
  stickyUntil?: number;
  cooldownUntil?: number;
}

export interface InsertionSlot {
  position: string;
  entries: ActivatedEntry[];
}

export interface ProcessResult {
  slots: InsertionSlot[];
  activatedEntries: ActivatedEntry[];
  totalTokens?: number;
  processTime?: number;
}

export interface EngineContext {
  text: string;
  chatHistory?: any[];
  generationType?: string;
  currentTime?: number;
}