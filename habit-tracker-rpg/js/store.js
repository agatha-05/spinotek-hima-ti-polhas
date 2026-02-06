/**
 * store.js
 * State Management & Persistence using Module Pattern.
 */

import { calculateNextLevelExp, CHARACTER_STATUS, checkStatusRecovery } from './rpgLogic.js';

const STORAGE_KEY = 'habit_rpg_data_v1';

const INITIAL_STATE = {
    character: {
        level: 1,
        currentExp: 0,
        maxExp: calculateNextLevelExp(1),
        hp: 50,
        maxHp: 50,
        gold: 0,
        status: CHARACTER_STATUS.NORMAL,
        lastFaintedTimestamp: null
    },
    habits: [
        { id: 'h1', name: 'Code for 1 hour', difficulty: 'HARD', streak: 0 },
        { id: 'h2', name: 'Drink Water', difficulty: 'TRIVIAL', streak: 0 },
        { id: 'h3', name: 'Read Documentation', difficulty: 'MEDIUM', streak: 0 }
    ],
    logs: [
        { id: Date.now(), timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), message: 'SYSTEM: Welcome to Habit-Core RPG.', type: 'system' }
    ]
};

let state = null;
let listeners = [];

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = JSON.parse(raw);
            // Ensure data integrity (e.g. if code updates adding new fields)
            if (!state.character) state.character = { ...INITIAL_STATE.character };
            if (!state.habits) state.habits = [...INITIAL_STATE.habits];
            if (!state.logs) state.logs = [...INITIAL_STATE.logs];
        } catch (e) {
            console.error('Failed to parse save data', e);
            state = clone(INITIAL_STATE);
        }
    } else {
        state = clone(INITIAL_STATE);
    }

    // Check for passive recovery on load
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

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function notify() {
    listeners.forEach(cb => cb(state));
}

/**
 * Public API
 */
export const Store = {
    init() {
        load();
        return state;
    },

    getState() {
        return state;
    },

    subscribe(callback) {
        listeners.push(callback);
        // Immediate callback with current state
        if (state) callback(state);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        }
    },

    updateCharacter(newCharacterState) {
        state.character = newCharacterState;
        save();
    },

    addLogEntry(message, type = 'system') {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            message,
            type
        };
        state.logs.unshift(entry); // Add to top
        if (state.logs.length > 50) state.logs.pop(); // Cap log size
        save();
    },

    // Basic habit mutations can also go here for simplicity
    reset() {
        state = clone(INITIAL_STATE);
        save();
    }
};

// Internal helper for logging from within store if needed, 
// but we exposed addLogEntry for the Controller layer (app.js) to use.
function addLog(msg, type) {
    Store.addLogEntry(msg, type);
}
