import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { createAI } from './ai.js';

class GameSimulator {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        
        // Set initial canvas size with CSS
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        this.renderer = new Renderer(this.canvas);
        this.ui = new UI();
        
        this.game = null;
        this.previewMap = null; // For map preview before starting
        this.aiPlayers = [];
        
        this.isRunning = false;
        this.speed = 1; // Default speed set to 1x
        this.lastUpdate = 0;
        this.tickInterval = 500; // 500ms per tick at 1x speed (2 ticks/second)
        
        this.initEventListeners();
        
        // Generate an initial preview map
        this.generateMapPreview();
    }
    
    initEventListeners() {
        window.addEventListener('resize', () => {
            // Reset offset initialization flag to recenter map after resize
            this.renderer.offsetInitialized = false;
            
            // Just trigger a re-render, the renderer will handle proper sizing
            this.renderer.render(this.game || this.previewMap);
        });
        
        document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetSimulation());
        
        // Set up speed change callback
        this.ui.setSpeedChangeCallback((speed) => {
            this.speed = speed;
        });
    }
    
    generateMapPreview() {
        // Get settings from UI
        const settings = this.ui.getMapSettings();
        
        // Create a new game for preview purposes
        this.previewMap = new Game(
            settings.width, 
            settings.height, 
            settings.aiCount, 
            settings.mountainDensity,
            settings.cityDensity
        );
        
        // Safety check for undefined generalPosition
        for (let i = 0; i < settings.aiCount; i++) {
            if (!this.previewMap.players[i] || !this.previewMap.players[i].generalPosition) {
                console.warn("General position not properly initialized for player", i);
                // Set a default position if missing
                if (this.previewMap.players[i]) {
                    this.previewMap.players[i].generalPosition = { x: 0, y: 0 };
                }
            }
        }
        
        // Create preview AI players for UI display
        const previewPlayers = [];
        for (let i = 0; i < settings.aiCount; i++) {
            previewPlayers.push({
                id: i,
                isAlive: true,
                unitCount: this.previewMap.grid[this.previewMap.players[i].generalPosition.y][this.previewMap.players[i].generalPosition.x].units,
                territoryCount: 1
            });
        }
        
        // Initialize UI with preview players
        this.ui.initializePlayerStats(previewPlayers);
        
        // Render the preview map
        this.renderer.render(this.previewMap);
    }
    
    startSimulation() {
        if (this.game && this.isRunning) {
            return;
        }
        
        if (this.game) {
            this.isRunning = true;
            this.ui.setGameExists(true); // Track that game exists
            this.ui.updateGameControls(this.isRunning);
            this.lastUpdate = performance.now();
            requestAnimationFrame((ts) => this.gameLoop(ts));
            return;
        }
        
        // Get settings from UI
        const settings = this.ui.getMapSettings();
        
        // Initialize new game (use preview map if available)
        this.game = this.previewMap || new Game(
            settings.width, 
            settings.height, 
            settings.aiCount, 
            settings.mountainDensity,
            settings.cityDensity
        );
        
        this.previewMap = null; // Clear preview map
        
        // Create AI players with deliberate pattern of AI types
        this.aiPlayers = [];
        for (let i = 0; i < settings.aiCount; i++) {
            // Distribute AI types in a pattern: aggressive, expansion, defensive, random, repeat
            const aiType = i % 4; 
            this.aiPlayers.push(createAI(aiType, i, this.game));
        }
        
        // Setup UI display
        this.ui.initializePlayerStats(this.game.players);
        
        // Start game loop
        this.isRunning = true;
        this.ui.setGameExists(true); // Track that game exists
        this.ui.updateGameControls(this.isRunning);
        this.lastUpdate = performance.now();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    togglePause() {
        if (!this.game) return; // Can't pause if no game exists
        
        this.isRunning = !this.isRunning;
        this.ui.updateGameControls(this.isRunning);
        
        if (this.isRunning) {
            this.lastUpdate = performance.now();
            requestAnimationFrame((ts) => this.gameLoop(ts));
        }
    }
    
    resetSimulation() {
        this.isRunning = false;
        this.ui.setGameExists(false); // Track that no game exists
        this.ui.updateGameControls(this.isRunning);
        this.game = null;
        this.aiPlayers = [];
        this.generateMapPreview();
        
        // Hide game over UI if visible
        const gameOverUI = document.getElementById('gameOverUI');
        gameOverUI.classList.add('hidden');
        
        // Ensure all players have valid general positions
        if (this.game) {
            for (let i = 0; i < this.game.players.length; i++) {
                if (!this.game.players[i].generalPosition) {
                    console.warn("Missing general position for player", i);
                    // Find an owned cell for this player
                    for (let y = 0; y < this.game.height; y++) {
                        for (let x = 0; x < this.game.width; x++) {
                            if (this.game.grid[y][x].owner === i && this.game.grid[y][x].type === 'general') {
                                this.game.players[i].generalPosition = { x, y };
                                break;
                            }
                        }
                        if (this.game.players[i].generalPosition) break;
                    }
                }
            }
        }
    }
    
    gameLoop(timestamp) {
        if (!this.isRunning || !this.game) return;
        
        // Control tick rate based on speed
        const currentTickInterval = this.tickInterval / this.speed;
        const elapsed = timestamp - this.lastUpdate;
        
        // Only update game state at the appropriate interval
        if (elapsed >= currentTickInterval) {
            this.lastUpdate = timestamp - (elapsed % currentTickInterval);
            
            // Update game state
            if (!this.game.isGameOver()) {
                // Update game state
                this.game.update();
                
                // Update turn counter - now based on ticks directly
                // since units are added every 2 ticks = 1 second
                this.ui.updateTurnCounter(Math.floor(this.game.tick / 2));
                
                // Let AIs make moves
                this.aiPlayers.forEach(ai => {
                    if (ai.isActive) {
                        const move = ai.getNextMove();
                        if (move) {
                            this.game.makeMove(ai.playerId, move.from, move.to, move.splitMove);
                        }
                    }
                });
                
                // Update UI with current stats
                this.ui.updatePlayerStats(this.game.players);
            } else {
                this.isRunning = false;
                this.ui.updateGameControls(this.isRunning);
                this.showGameOver(this.game);
                return;
            }
        }
        
        // Render the current state (render at full framerate for smooth animation)
        this.renderer.render(this.game);
        
        // Continue the game loop
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    showGameOver(game) {
        const gameOverUI = document.getElementById('gameOverUI');
        const winnerNameElement = document.getElementById('winnerName');
        const newGameBtn = document.getElementById('newGameBtn');
        
        // Find the winner
        const winner = game.players.find(p => p.isAlive);
        
        if (winner) {
            // Set winner name with their color
            winnerNameElement.textContent = winner.aiName;
            winnerNameElement.style.color = this.ui.getPlayerColorCSS(winner.id);
        } else {
            winnerNameElement.textContent = "平局";
            winnerNameElement.style.color = "#FFFFFF";
        }
        
        // Show the UI
        gameOverUI.classList.remove('hidden');
        
        // Handle new game button
        newGameBtn.onclick = () => {
            gameOverUI.classList.add('hidden');
            this.resetSimulation();
        };
    }
}

// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new GameSimulator();
    // Make sure UI reflects initial state correctly
    simulator.ui.setGameExists(false); 
    simulator.ui.updateGameControls(false);
});
