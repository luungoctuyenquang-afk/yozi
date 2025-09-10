import { ActivationSettings, WorldBook, EngineContext, ProcessResult } from './types.js';

declare class WorldBookEngine {
    private settings;
    private timedEffectsState;
    private rand;
    constructor(options?: ActivationSettings & {
        seed?: number;
        random?: () => number;
    });
    setOptions(options: ActivationSettings): void;
    private tickTimedEffects;
    private commitTimedEffects;
    process(worldbook: WorldBook, context: string | EngineContext): ProcessResult;
    private selectCandidates;
    private applyFilters;
    private applyTimedEffects;
    private applyScoring;
    private applyProbability;
    private recursiveScan;
    private applyBudget;
    private distributeToSlots;
    private createActivatedEntry;
    private matchKeys;
    private containsCJK;
    private makeWholeWordRegex;
    private textMatch;
    private calculateActivationScore;
    private calculateGroupBonus;
    private resolveInclusionGroups;
    private selectFromGroup;
    private minActivationScan;
    private calculateTotalTokens;
    private estimateTokens;
    private escapeRegex;
}

export { WorldBookEngine };
