import { ActivationSettings, WorldBook, ActivatedEntry, InsertionSlot } from './types.mjs';

declare class WorldBookEngine {
    private settings;
    private timedEffectsState;
    private rand;
    private runtimeOptions;
    constructor(opts?: {
        seed?: number;
        random?: () => number;
    });
    private getDefaultSettings;
    setOptions(o: Partial<ActivationSettings & {
        recursive?: boolean;
    }>): void;
    process(book: WorldBook, scanText: string): {
        activatedEntries: ActivatedEntry[];
        slots: InsertionSlot[];
        finalPrompt: string;
        totalTokens?: number;
    };
    private activate;
    private selectCandidates;
    private applyFilters;
    private tickTimedEffects;
    private commitTimedEffects;
    private applyTimedEffects;
    private applyScoring;
    private getProb;
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
    resolveInclusionGroups(cands: ActivatedEntry[]): ActivatedEntry[];
    private selectFromGroup;
    private minActivationScan;
    private calculateTotalTokens;
    private estimateTokens;
    private escapeRegex;
}

export { WorldBookEngine };
