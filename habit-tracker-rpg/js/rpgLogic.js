/**
 * rpgLogic.js
 * Pure business logic for the RPG system.
 */

export const DIFFICULTY_TIERS = {
    TRIVIAL: { exp: 5, hpCost: 2 },
    EASY: { exp: 10, hpCost: 5 },
    MEDIUM: { exp: 20, hpCost: 10 },
    HARD: { exp: 50, hpCost: 25 }
};

export const CHARACTER_STATUS = {
    NORMAL: 'NORMAL',
    FAINTED: 'FAINTED'
};

const FAINT_PENALTY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculates the EXP required to reach the NEXT level.
 * Formula: round(0.04 * L^3 + 0.8 * L^2 + 2 * L) * 100
 * Note: The prompt asks for "EXP_Next_Level", implying the total cap for the current level
 * or the threshold to reach level + 1. 
 * Let's interpret this as the Total EXP required to complete the current Level.
 */
export function calculateNextLevelExp(level) {
    const l = level;
    return Math.round(0.04 * Math.pow(l, 3) + 0.8 * Math.pow(l, 2) + 2 * l) * 100;
}

/**
 * Processes a successful habit execution.
 */
export function executeHabit(character, difficultyKey) {
    const rewards = DIFFICULTY_TIERS[difficultyKey] || DIFFICULTY_TIERS.EASY;

    // Check for faint penalty
    let expGain = rewards.exp;
    if (character.status === CHARACTER_STATUS.FAINTED) {
        if (Date.now() - character.lastFaintedTimestamp < FAINT_PENALTY_DURATION_MS) {
            expGain = Math.floor(expGain / 2);
        } else {
            // Penalty expired, auto-recover status could happen here or in a separate check
            // For now, we apply full exp if penalty time is over, assuming status updates on load
            // But let's keep it simple: if still marked FAINTED, check time
            // If time passed, we might want to return a status update flag too.
        }
    }

    // Logic to add EXP
    let newExp = character.currentExp + expGain;
    let newLevel = character.level;
    let newMaxExp = character.maxExp;
    let newHp = character.hp;
    let newMaxHp = character.maxHp;
    let leveledUp = false;

    // Level up loop
    while (newExp >= newMaxExp) {
        newExp -= newMaxExp;
        newLevel++;
        newMaxExp = calculateNextLevelExp(newLevel);
        newMaxHp += 10; // Simple HP growth
        newHp = newMaxHp; // Restore HP on level up
        leveledUp = true;
    }

    return {
        ...character,
        level: newLevel,
        currentExp: newExp,
        maxExp: newMaxExp,
        hp: newHp,
        maxHp: newMaxHp,
        gold: character.gold + (rewards.exp), // 1 Gold per 1 base EXP
    };
}

/**
 * Processes a failed habit execution (Abort).
 */
export function abortHabit(character, difficultyKey) {
    const penalty = DIFFICULTY_TIERS[difficultyKey] || DIFFICULTY_TIERS.EASY;

    let newHp = character.hp - penalty.hpCost;
    let newStatus = character.status;
    let timestamp = character.lastFaintedTimestamp;

    if (newHp <= 0) {
        newHp = 0;
        if (newStatus !== CHARACTER_STATUS.FAINTED) {
            newStatus = CHARACTER_STATUS.FAINTED;
            timestamp = Date.now();
        }
    }

    return {
        ...character,
        hp: newHp,
        status: newStatus,
        lastFaintedTimestamp: timestamp
    };
}

/**
 * Checks if Fainted status should be removed.
 */
export function checkStatusRecovery(character) {
    if (character.status === CHARACTER_STATUS.FAINTED) {
        if (Date.now() - character.lastFaintedTimestamp >= FAINT_PENALTY_DURATION_MS) {
            return {
                ...character,
                status: CHARACTER_STATUS.NORMAL,
                lastFaintedTimestamp: null,
                hp: Math.floor(character.maxHp * 0.5) // Recover to 50% HP
            };
        }
    }
    return character;
}
