import { MapSettings } from './map.js';

export class UI {
    constructor() {
        this.statsContainer = document.getElementById('aiStats');
        this.turnCounter = document.getElementById('turnCounter');
        this.mountainDensityValue = document.getElementById('mountainDensityValue');
        this.cityDensityValue = document.getElementById('cityDensityValue');
        this.mapSettingsPanel = document.getElementById('mapSettingsPanel');
        this.editMapBtn = document.getElementById('editMapBtn');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        
        // Replace aiNames with personality-based name generators
        this.aiNameGenerators = {
            aggressive: [
                "Blitz", "Fury", "Havoc", "Rampage", "Savage", "Striker", "Thunder", "Viper",
                "Warlord", "Berserk", "Crusher", "Dominator", "Attacker", "Ravager", "Slayer"
            ],
            expansion: [
                "Explorer", "Pioneer", "Colonist", "Settler", "Expander", "Growth", "Vista", 
                "Horizon", "Frontier", "Venture", "Conquest", "Emperor", "Domain", "Builder"
            ],
            defensive: [
                "Guardian", "Bastion", "Fortress", "Shield", "Protector", "Bulwark", "Sentinel", 
                "Warden", "Keeper", "Haven", "Citadel", "Defense", "Barrier", "Safeguard"
            ],
            random: [
                "Chaos", "Gambit", "Fortune", "Chance", "Dice", "Wildcard", "Mystery", 
                "Enigma", "Random", "Shuffle", "Crypto", "Joker", "Riddle", "Paradox"
            ]
        };
        
        // Initialize map settings panel (hidden by default)
        this.mapSettingsPanel.classList.add('hidden');
        
        // Initialize range input displays
        document.getElementById('mountainDensity').addEventListener('input', (e) => {
            this.mountainDensityValue.textContent = e.target.value + '%';
        });
        
        document.getElementById('cityDensity').addEventListener('input', (e) => {
            this.cityDensityValue.textContent = e.target.value + '%';
        });
        
        // Initialize edit map button
        this.editMapBtn.addEventListener('click', () => {
            this.toggleMapSettings();
        });
        
        // Initialize speed buttons
        const speedButtons = [
            document.getElementById('speed1x'),
            document.getElementById('speed2x'),
            document.getElementById('speed5x'),
            document.getElementById('speed10x')
        ];
        
        const speedValues = [1, 2, 5, 10];
        
        speedButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.onSpeedChange) {
                    this.onSpeedChange(speedValues[index]);
                }
            });
        });

        // Add reference to bottom controls
        this.bottomControls = document.querySelector('.bottom-controls');

        // Track current game state
        this.gameState = "preview";

        // Fix MutationObserver initialization - proper separation of callback and options
        this.observer = new MutationObserver(() => this.positionTurnCounter());
        
        // Ensure we're observing an existing element with proper options
        const infoPanel = document.querySelector('.game-info-panel');
        this.observer.observe(infoPanel, { 
            attributes: true,
            childList: true,
            subtree: true
        });
        this.positionTurnCounter();
    }
    
    toggleMapSettings() {
        this.mapSettingsPanel.classList.toggle('hidden');
        this.editMapBtn.classList.toggle('active');
    }
    
    setSpeedChangeCallback(callback) {
        this.onSpeedChange = callback;
    }
    
    /**
     * Unified method to update UI based on game state
     * @param {string} state - One of: "preview", "running", "pause", "gameover"
     * @param {Object} data - Additional data required for the state (e.g., winner for gameover)
     */
    updateGameStatus(state, data = {}) {
        this.gameState = state;
        const gameExists = state !== "preview";
        const isRunning = state === "running";
        
        // Update button states
        if (isRunning) {
            this.startBtn.classList.add('active');
            this.pauseBtn.classList.remove('active');
            
            // Make bottom controls more transparent during active gameplay
            this.bottomControls.classList.add('game-active');
        } else {
            this.startBtn.classList.remove('active');
            
            // Only make pause button active if game exists but is paused
            if (gameExists && state === "pause") {
                this.pauseBtn.classList.add('active');
            } else {
                this.pauseBtn.classList.remove('active');
            }
            
            // Restore bottom controls opacity when game is paused or over
            this.bottomControls.classList.remove('game-active');
        }
        
        // Handle game over state
        const gameOverUI = document.getElementById('gameOverUI');
        if (state === "gameover" && data.winner) {
            const winnerNameElement = document.getElementById('winnerName');
            
            // Update winner display
            winnerNameElement.textContent = data.winner.aiName;
            winnerNameElement.style.color = this.getPlayerColorCSS(data.winner.id);
            
            // Show the game over UI with a fade-in effect
            gameOverUI.classList.remove('hidden');
            
            // Setup click handler to dismiss and reset
            gameOverUI.onclick = data.onContinue || (() => {
                gameOverUI.classList.add('hidden');
            });
        } else {
            // Hide game over UI for other states
            gameOverUI.classList.add('hidden');
        }
    }
    
    initializePlayerStats(players) {
        this.clearPlayerStats();
        
        players.forEach((player, index) => {
            // Assign an AI name based on AI type
            player.aiName = this.getAIName(index);
            
            const playerDiv = document.createElement('div');
            playerDiv.id = `player-${player.id}`;
            playerDiv.className = 'ai-player';
            
            // Use a small color indicator instead of full background
            playerDiv.innerHTML = `
                <div class="player-info">
                    <span class="color-indicator" style="background-color: ${this.getPlayerColorCSS(player.id)}"></span>
                    <span class="name">${player.aiName}</span>
                </div>
                <div class="stats">
                    <div class="stats-item territory">${player.territoryCount}</div>
                    <div class="stats-item units">${player.unitCount}</div>
                </div>
            `;
            
            this.statsContainer.appendChild(playerDiv);
        });
        
        // Sort players by unit count initially
        this.sortPlayerStats(players);
    }
    
    getAIName(index) {
        // Determine AI personality type based on the AI type (0=aggressive, 1=expansion, 2=defensive, 3=random)
        // Use a consistent algorithm to assign AI type based on index
        const aiType = index % 4;
        let personalityType;
        
        switch (aiType) {
            case 0: personalityType = "aggressive"; break;
            case 1: personalityType = "expansion"; break;
            case 2: personalityType = "defensive"; break;
            default: personalityType = "random";
        }
        
        // Get name list for this personality
        const nameList = this.aiNameGenerators[personalityType];
        
        // Generate a unique number based on the index to ensure consistent naming
        const nameIndex = (index * 17 + aiType * 7) % nameList.length;
        
        // Add a number suffix if we have more AIs than names
        const suffix = Math.floor(index / nameList.length) > 0 ? `-${Math.floor(index / nameList.length)}` : "";
        
        return nameList[nameIndex] + suffix;
    }
    
    updatePlayerStats(players) {
        // First, filter out eliminated players and remove their elements
        players.forEach(player => {
            const playerDiv = document.getElementById(`player-${player.id}`);
            if (!playerDiv) return;
            
            if (!player.isAlive) {
                // Remove eliminated players from display
                playerDiv.remove();
                return;
            }
            
            // Update stats for surviving players
            const territorySpan = playerDiv.querySelector('.territory');
            const unitsSpan = playerDiv.querySelector('.units');
            
            territorySpan.textContent = player.territoryCount;
            unitsSpan.textContent = player.unitCount;
        });
        
        // Sort remaining players by unit count
        this.sortPlayerStats(players.filter(p => p.isAlive));
}
    
    sortPlayerStats(players) {
        // Create a sorted array of player divs based on unit count
        const sortedPlayers = [...players].sort((a, b) => {
            // Sort by unit count (eliminated players are already filtered out)
            return b.unitCount - a.unitCount;
        });
        
        // Reorder the player divs in the DOM
        for (const player of sortedPlayers) {
            const playerDiv = document.getElementById(`player-${player.id}`);
            if (playerDiv) {
                this.statsContainer.appendChild(playerDiv);
            }
        }
    }
    
    updateTurnCounter(turn) {
        this.turnCounter.textContent = turn;
    }
    
    clearPlayerStats() {
        if (this.statsContainer) {
            this.statsContainer.innerHTML = '';
        }
    }
    
    getMapSettings() {
        const aiCount = parseInt(document.getElementById('aiCount').value);
        const mapSizeSelect = document.getElementById('mapSize').value;
        const mountainDensity = parseInt(document.getElementById('mountainDensity').value) / 100;
        const cityDensity = parseInt(document.getElementById('cityDensity').value) / 100;
        
        // Create a MapSettings object using the static factory method
        return MapSettings.fromSizePreset(aiCount, mapSizeSelect, mountainDensity, cityDensity);
    }
    
    getPlayerColorCSS(playerId) {
        return `var(--map-color-p${(playerId % 16) + 1})`;
    }

    // Add this new method to position the turn counter panel
    positionTurnCounter() {
        const infoPanel = document.querySelector('.game-info-panel');
        const turnPanel = document.querySelector('.turn-counter-panel');
        
        if (infoPanel && turnPanel) {
            // Calculate new position based on current height of info panel
            const infoPanelRect = infoPanel.getBoundingClientRect();
            turnPanel.style.top = (infoPanelRect.bottom + 10) + 'px';
        }
    }
}
