/**
 * ui.js
 * DOM Rendering logic.
 * Adapted for Global Scope.
 */

let elements = {};

window.UI = {
    init() {
        elements = {
            charLevel: document.getElementById('char-level'),
            charGold: document.getElementById('char-gold'),
            charStatus: document.getElementById('char-status'),
            hpText: document.getElementById('hp-text'),
            hpBar: document.getElementById('hp-bar'),
            expText: document.getElementById('exp-text'),
            expBar: document.getElementById('exp-bar'),
            habitList: document.getElementById('habit-list'),
            actionLog: document.getElementById('action-log')
        };
        console.log('UI Initialized. Elements found:', !!elements.habitList);
    },

    render(state) {
        if (!state) return;
        renderDashboard(state.character);
        renderHabits(state.habits);
        renderLogs(state.logs);
    },

    toggleMemoryCore() {
        const core = document.getElementById('memory-core');
        if (core) {
            core.classList.toggle('collapsed');
            core.classList.toggle('active');
        }
    },

    /**
     * Transaction Safety Wrapper
     * Prevents accidental purchases.
     */
    safeTransaction(btn, callback) {
        if (btn.dataset.confirming) {
            // Confirmed execute
            callback();
            // Reset UI state (though re-render usually wipes it)
            btn.removeAttribute('data-confirming');
            btn.innerHTML = btn.dataset.originalText;
            btn.classList.remove('cy-btn-warn');
        } else {
            // First click - Ask confirmation
            btn.dataset.confirming = 'true';
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = 'CONFIRM?';
            btn.classList.add('cy-btn-warn'); // Assumes we add this CSS or reuse existing

            // Auto-reset after 3s
            setTimeout(() => {
                if (btn && btn.parentNode) { // Check if still in DOM
                    btn.removeAttribute('data-confirming');
                    btn.innerHTML = btn.dataset.originalText;
                    btn.classList.remove('cy-btn-warn');
                }
            }, 3000);
        }
    }
};

// Render functions
function renderDashboard(char) {
    if (!elements.charLevel) return; // Guard

    // Use Derived State Selector
    const viewState = window.RPG.getCharacterViewState(char);

    // Basic Info
    elements.charLevel.textContent = String(char.level).padStart(2, '0');
    elements.charGold.innerHTML = `${char.gold} <button onclick="window.UI.toggleAugmentationPanel(true)" style="background:none; border:none; color:var(--cy-neon-gold); cursor:pointer; font-weight:bold; font-size:1.2em; vertical-align:middle;">+</button>`;

    // Status Logic
    let statusText = char.status;
    if (viewState.isStabilized) statusText = "STABILIZED";
    elements.charStatus.textContent = statusText;

    // Status Style
    if (viewState.isFainted) {
        elements.charStatus.className = viewState.isStabilized ? 'cy-badge stabilized' : 'cy-badge fainted';
        elements.charStatus.style.borderColor = viewState.isStabilized ? 'var(--cy-neon-gold)' : 'var(--cy-neon-red)';
        elements.charStatus.style.color = viewState.isStabilized ? 'var(--cy-neon-gold)' : 'var(--cy-neon-red)';
    } else {
        elements.charStatus.className = 'cy-badge';
        elements.charStatus.removeAttribute('style');
    }

    // HP Bar
    elements.hpBar.style.width = `${viewState.hpPercent}%`;
    elements.hpText.textContent = `${char.hp} / ${viewState.maxHp}`;

    // Apply glitch effect if low HP
    if (char.hp < (viewState.maxHp * 0.2)) {
        elements.hpBar.classList.add('critical');
    } else {
        elements.hpBar.classList.remove('critical');
    }

    // EXP Bar
    elements.expBar.style.width = `${viewState.expPercent}%`;
    const penaltySuffix = viewState.isFainted
        ? (viewState.isStabilized
            ? ' <span style="color:var(--cy-neon-gold); font-size:0.6em;">[-25% GAIN]</span>'
            : ' <span style="color:var(--cy-neon-red); font-size:0.6em;">[-50% GAIN]</span>')
        : '';
    elements.expText.innerHTML = `${Math.floor(char.currentExp)}/${Math.floor(char.maxExp)}${penaltySuffix}`;

    // Global Visual Feedback
    document.body.classList.toggle('is-fainted', viewState.isFainted);
    const dashboard = document.querySelector('.dashboard');
    if (dashboard) dashboard.classList.toggle('is-fainted', viewState.isFainted);

    // Conditional UI for Stabilizer
    let stabilizerBtn = document.getElementById('btn-stabilizer');

    if (viewState.canUseStabilizer) {
        if (!stabilizerBtn) {
            stabilizerBtn = document.createElement('button');
            stabilizerBtn.id = 'btn-stabilizer';
            stabilizerBtn.className = 'cy-btn cy-btn-stabilizer';
            stabilizerBtn.innerHTML = 'ACTIVATE STABILIZER [200G]';
            stabilizerBtn.style.width = '100%';
            stabilizerBtn.style.marginTop = '10px';
            stabilizerBtn.style.borderColor = 'var(--cy-neon-gold)';
            stabilizerBtn.style.color = 'var(--cy-neon-gold)';
            stabilizerBtn.onclick = (e) => window.UI.safeTransaction(e.target, () => window.Store.triggerStabilizer());

            // Append to char-info
            const container = document.querySelector('.char-info');
            if (container) container.appendChild(stabilizerBtn);
        }
    } else {
        if (stabilizerBtn) stabilizerBtn.remove();
    }
}

function renderHabits(habits) {
    if (!elements.habitList) return;

    // PRESERVE GHOSTS:
    // Identify any existing elements with .is-ghost class.
    // Detach them from DOM to prevent destruction during innerHTML = ''
    const ghosts = Array.from(elements.habitList.querySelectorAll('.is-ghost'));

    // Clear List (Wipes standard habits)
    elements.habitList.innerHTML = '';

    // RE-ATTACH GHOSTS (At the top)
    ghosts.forEach(ghost => {
        elements.habitList.appendChild(ghost);
    });

    // Render Stored Habits
    habits.forEach(habit => {
        const el = document.createElement('div');
        el.className = 'habit-item';
        el.innerHTML = `
            <div class="habit-info">
                <span class="habit-name">${habit.name}</span>
                <span class="habit-meta">[${habit.difficulty}] Streak: ${habit.streak}</span>
            </div>
            <div class="habit-actions">
                <button class="cy-btn cy-btn-abort" data-id="${habit.id}" data-action="abort">ABORT</button>
                <button class="cy-btn cy-btn-exec" data-id="${habit.id}" data-action="exec">EXECUTE</button>
            </div>
        `;
        elements.habitList.appendChild(el);
    });
}

let lastLogCount = 0;
let isUserScrolling = false;

function renderLogs(logs) {
    if (!elements.actionLog) return;

    // Auto-scroll Detection Setup (One-time)
    if (!elements.actionLog._scrollListenerAttached) {
        elements.actionLog.addEventListener('scroll', () => {
            // Logic: If user is close to bottom (within 20px), auto-scroll is ON.
            // If user scrolls up, auto-scroll is OFF.
            const { scrollTop, scrollHeight, clientHeight } = elements.actionLog;
            const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
            isUserScrolling = distanceToBottom > 20;
        });
        elements.actionLog._scrollListenerAttached = true;
    }

    // Incremental Update
    if (logs.length < lastLogCount) {
        elements.actionLog.innerHTML = '';
        lastLogCount = 0;
    }

    const newLogs = logs.slice(lastLogCount);
    if (newLogs.length === 0) return;

    const fragment = document.createDocumentFragment();
    newLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-entry';

        // Handle Legacy Logs vs New Structure
        const time = log.time || log.timestamp;
        const msg = log.message;
        const category = log.category || 'SYSTEM';
        const severity = log.severity || (log.type === 'failure' ? 'ERROR' : 'INFO');

        // Color Coding
        let color = 'var(--cy-text-dim)';
        if (severity === 'SUCCESS') color = 'var(--cy-neon-green)';
        if (severity === 'WARN') color = 'var(--cy-neon-gold)';
        if (severity === 'ERROR' || severity === 'CRITICAL') color = 'var(--cy-neon-red)';

        div.style.color = color;
        div.innerHTML = `<span class="log-time" style="opacity:0.6">[${time}]</span> <span style="font-weight:bold; opacity:0.8">[${category}]</span> ${msg}`;
        fragment.appendChild(div);
    });

    elements.actionLog.appendChild(fragment);
    lastLogCount = logs.length;

    // Auto-Scroll Logic
    if (!isUserScrolling) {
        elements.actionLog.scrollTop = elements.actionLog.scrollHeight;
    }
}

// Event Delegation setup helper
window.setupEventListeners = function (handler) {
    if (!elements.habitList) return;
    elements.habitList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (id && action) {
            handler(action, id);
        }
    });

    // Add Global Listeners for Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.UI.toggleAugmentationPanel(false);
    });
}

// Augmentation UI Logic
window.UI.toggleAugmentationPanel = function (show) {
    let modal = document.getElementById('augmentation-modal');

    if (show) {
        if (!modal) {
            modal = createAugmentationModal();
            document.body.appendChild(modal);
        }
        renderAugmentations(window.Store.getState().character);
        modal.style.display = 'flex';
    } else {
        if (modal) modal.style.display = 'none';
    }
};

function createAugmentationModal() {
    const div = document.createElement('div');
    div.id = 'augmentation-modal';
    div.className = 'modal-overlay';
    div.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span>:: CORE AUGMENTATIONS</span>
                <button class="close-btn" onclick="window.UI.toggleAugmentationPanel(false)">×</button>
            </div>
            <div class="modal-body" id="augmentation-list">
                <!-- Items injected here -->
            </div>
        </div>
    `;
    return div;
}

function renderAugmentations(character) {
    const list = document.getElementById('augmentation-list');
    if (!list) return;

    const { UPGRADE_TYPES, getUpgradeCost } = window.RPG;
    list.innerHTML = '';

    Object.keys(UPGRADE_TYPES).forEach(type => {
        const upgrade = UPGRADE_TYPES[type];
        const currentLevel = (character.passiveUpgrades && character.passiveUpgrades[type]) || 0;
        const cost = getUpgradeCost(type, currentLevel);
        const canAfford = character.gold >= cost;
        const isMaxed = currentLevel >= upgrade.maxLevel;

        const el = document.createElement('div');
        el.className = 'upgrade-item';

        // Dynamic Label logic
        let costLabel = isMaxed ? 'MAXED' : `${cost} G`;
        let btnDisabled = isMaxed || !canAfford;

        el.innerHTML = `
            <div class="upgrade-info">
                <span class="upgrade-name">${upgrade.name}</span>
                <span class="upgrade-desc">${upgrade.description}</span>
                <span class="upgrade-meta">Lvl ${currentLevel}/${upgrade.maxLevel}</span>
            </div>
            <button class="upgrade-btn" 
                onclick="window.UI.safeTransaction(this, () => { window.Store.purchaseUpgrade('${type}'); window.UI.refreshAugmentations(); })"
                ${btnDisabled ? 'disabled' : ''}>
                ${costLabel}
            </button>
        `;
        list.appendChild(el);
    });
}

// Helper to refresh panel without closing it
window.UI.refreshAugmentations = function () {
    renderAugmentations(window.Store.getState().character);
    // Also refresh dashboard to show Gold change
    renderDashboard(window.Store.getState().character);
};
