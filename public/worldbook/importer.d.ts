import { WorldBook } from './types.js';

declare class WorldBookImporter {
    static import(raw: any): WorldBook;
    private static expandEnglishKeys;
    static validate(worldbook: WorldBook): {
        valid: boolean;
        errors: string[];
    };
    static export(worldbook: WorldBook): any;
}

export { WorldBookImporter };
