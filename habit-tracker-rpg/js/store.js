/**
 * store.js
 * State Management & Persistence using Module Pattern.
 * Adapted for Global Scope.
 */

const STORAGE_KEY = 'habit_rpg_data_v4';

// Initial state factory to allow lazy access to window.RPG
function getInitialState() {
    const { calculateNextLevelExp, CHARACTER_STATUS } = window.RPG;
    return {
        character: {
            level: 1,
            currentExp: 0,
            maxExp: calculateNextLevelExp(1),
            hp: 50,
            maxHp: 50,
            gold: 0, // Will need to cheat this for testing
            status: CHARACTER_STATUS.NORMAL,
            lastFaintedTimestamp: null,
            debuff: null, // { expMultiplier: 0.5, expiresAt: <ts>, stabilized: false }
            passiveUpgrades: {
                vitalCore: 0,
                learningAmplifier: 0,
                failureDampener: 0
            }
        },
        habits: [
            { id: 'h1', name: 'Code for 1 hour', difficulty: 'HARD', streak: 0 },
            { id: 'h2', name: 'Drink Water', difficulty: 'TRIVIAL', streak: 0 },
            { id: 'h3', name: 'Read Documentation', difficulty: 'MEDIUM', streak: 0 }
        ],
        logs: [
            { id: Date.now(), timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), message: 'SYSTEM: Welcome to Habit-Core RPG v4.0. Core Augmentation Online.', type: 'system' }
        ]
    };
}

let state = null;
let listeners = [];

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaults = getInitialState();

    if (raw) {
        try {
            state = JSON.parse(raw);
            // Ensure data integrity (merge with defaults)
            if (!state.character) state.character = { ...defaults.character };
            // Ensure debuff field exists if migrating from older version (though we changed key)
            if (state.character.debuff === undefined) state.character.debuff = null;
            if (!state.character.passiveUpgrades) state.character.passiveUpgrades = { ...defaults.character.passiveUpgrades };

            if (!state.habits) state.habits = [...defaults.habits];
            if (!state.logs) state.logs = [...defaults.logs];
        } catch (e) {
            console.error('Failed to parse save data', e);
            state = JSON.parse(JSON.stringify(defaults));
        }
    } else {
        state = JSON.parse(JSON.stringify(defaults));
    }

    // Check for passive recovery on load
    const { checkStatusRecovery } = window.RPG;
    const recoveredChar = checkStatusRecovery(state.character);
    if (recoveredChar !== state.character) {
        state.character = recoveredChar;
        addLog('SYSTEM: You have recovered from fainting.', 'system');
        save();
    }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
}

function notify() {
    listeners.forEach(cb => cb(state));
}

/**
 * Public API
 */
window.Store = {
    init() {
        // Ensure RPG is loaded
        if (!window.RPG) {
            console.error('FATAL: window.RPG not found during Store init');
            return null;
        }
        load();

        // Bind visibility change to auto-validate
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                window.Store.validateState();
            }
        });

        // Validate immediately on init just in case
        this.validateState();

        return state;
    },

    getState() {
        return state;
    },

    subscribe(callback) {
        listeners.push(callback);
        if (state) callback(state);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        }
    },

    updateCharacter(newCharacterState) {
        state.character = newCharacterState;
        save();
    },

    triggerStabilizer() {
        // Validate state first to prevent wasted gold
        this.validateState();

        // Use Guard Function
        const char = state.character;
        if (!window.RPG.canUseNeuralStabilizer(char)) {
            // Specific feedback based on why it failed
            if (char.status !== window.RPG.CHARACTER_STATUS.FAINTED) {
                addLog(`SYSTEM: Stabilizer aborted. Neural patterns already normalized.`, 'system');
            } else if (char.debuff && char.debuff.stabilized) {
                addLog(`SYSTEM: Stabilizer aborted. Already active.`, 'system');
            } else if (char.gold < window.RPG.NEURAL_STABILIZER_COST) {
                addLog(`SYSTEM: Stabilizer aborted. Insufficient resources.`, 'failure');
            }
            return; // Stop execution
        }

        const { useNeuralStabilizer } = window.RPG;
        const result = useNeuralStabilizer(char);

        if (result.success) {
            state.character = result.character;
            addLog(`SYSTEM: Neural Stabilizer activated. EXP penalty reduced.`, 'success');
            save(); // Triggers notify
        } else {
            addLog(`SYSTEM: Stabilizer failed. ${result.reason}`, 'failure');
            notify(); // Ensure UI reflects any attempt
        }
    },

    purchaseUpgrade(type) {
        this.validateState(); // Ensure stats are fresh

        // Use Guard Function
        const char = state.character;
        // Note: Logic inside purchaseUpgrade also checks this, but Store shouldn't call it if invalid.
        if (!window.RPG.canPurchaseUpgrade(char, type)) {
            addLog(`SYSTEM: Authorization denied. Criteria met for ${type}? [NEGATIVE]`, 'failure');
            notify();
            return;
        }

        const { purchaseUpgrade } = window.RPG;
        const result = purchaseUpgrade(char, type);

        if (result.success) {
            state.character = result.character;
            addLog(`SYSTEM: Core Augmentation installed: ${result.upgradeName} (Lvl ${result.newLevel})`, 'success');
            save();
        } else {
            addLog(`SYSTEM: Upgrade Error: ${result.reason}`, 'failure');
            notify();
        }
    },

    /**
     * Centralized State Validation
     * Checks time-based recovery and ensures consistency.
     */
    validateState() {
        if (!state || !state.character) return false;

        const { checkStatusRecovery } = window.RPG;
        const oldChar = state.character;
        const newChar = checkStatusRecovery(oldChar);

        if (newChar !== oldChar) {
            state.character = newChar;
            addLog('SYSTEM: Temporal synchronization complete. Biological functions restored.', 'system');
            save();
            return true;
        }
        return false;
    },

    addLogEntry(message, type = 'system') {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            message,
            type
        };
        state.logs.push(entry);
        if (state.logs.length > 50) state.logs.shift(); // Remove oldest (from front)
        save();
    },

    addHabit(habitData) {
        state.habits.push(habitData);
        save();
        notify(); // Triggers UI re-render
    },

    reset() {
        state = JSON.parse(JSON.stringify(getInitialState()));
        save();
    }
};

// Internal helper 
function addLog(msg, type) {
    if (window.Store && window.Store.addLogEntry) {
        window.Store.addLogEntry(msg, type);
    }
}
