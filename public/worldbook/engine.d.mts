import { ActivationSettings, WorldBook, EngineContext, ProcessResult } from './types.mjs';

declare class WorldBookEngine {
    private settings;
    private activationHistory;
    constructor(options?: ActivationSettings);
    setOptions(options: ActivationSettings): void;
    process(worldbook: WorldBook, context: string | EngineContext): ProcessResult;
    private selectCandidates;
    private applyFilters;
    private applyTimeFilters;
    private applyScoring;
    private applyProbabilityFilter;
    private handleRecursion;
    private applyBudgetLimits;
    private organizeByPosition;
    private createActivatedEntry;
    private matchKeys;
    private textMatch;
    private calculateActivationScore;
    private calculateGroupBonus;
    private ensureMinimumActivations;
    private calculateTotalTokens;
    private estimateTokens;
    private toHalfWidth;
    private hasCJK;
    private escapeRegex;
}

export { WorldBookEngine };
