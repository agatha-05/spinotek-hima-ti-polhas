/**
 * app.js
 * Entry Point & Controller
 */

import { Store } from './store.js';
import { UI, setupEventListeners } from './ui.js';
import { executeHabit, abortHabit } from './rpgLogic.js';

// Initialize
function init() {
    const state = Store.init();

    // Initial Render
    UI.render(state);

    // Subscribe UI to State changes
    Store.subscribe((newState) => {
        UI.render(newState);
    });

    // Setup Interactions
    setupEventListeners(handleAction);

    console.log('Habit-Core RPG Initialized');
}

function handleAction(actionType, habitId) {
    const state = Store.getState();
    const habit = state.habits.find(h => h.id === habitId);

    if (!habit) return;

    if (actionType === 'exec') {
        const result = executeHabit(state.character, habit.difficulty);
        Store.updateCharacter(result);

        let msg = `+${result.currentExp - state.character.currentExp} EXP from '${habit.name}'`;

        if (result.level > state.character.level) {
            msg += ` | LEVEL UP! Now Level ${result.level}.`;
            Store.addLogEntry(`LEVEL UP: You have reached Level ${result.level}!`, 'system');
        }

        Store.addLogEntry(msg, 'success');

    } else if (actionType === 'abort') {
        const result = abortHabit(state.character, habit.difficulty);
        const hpLost = state.character.hp - result.hp;

        Store.updateCharacter(result);
        Store.addLogEntry(`FAILED '${habit.name}'. -${hpLost} HP.`, 'failure');

        if (result.status === 'FAINTED' && state.character.status !== 'FAINTED') {
            Store.addLogEntry(`CRITICAL: You have fainted! EXP gain reduced by 50%.`, 'failure');
        }
    }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
