import { BaseAI } from './ai/baseAI.js';
import { AggressiveAI } from './ai/aggressiveAI.js';
import { ExpansionAI } from './ai/expansionAI.js';
import { DefensiveAI } from './ai/defensiveAI.js';
import { RandomAI } from './ai/randomAI.js';

export { BaseAI, AggressiveAI, ExpansionAI, DefensiveAI, RandomAI };

export function createAI(type, playerId, game) {
    switch (type) {
        case 0:
            return new AggressiveAI(playerId, game);
        case 1:
            return new ExpansionAI(playerId, game);
        case 2:
            return new DefensiveAI(playerId, game);
        default:
            return new RandomAI(playerId, game);
    }
}
