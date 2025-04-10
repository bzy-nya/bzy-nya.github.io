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
        
        this.speed = 1; // Default speed set to 1x
        this.lastUpdate = 0;
        this.tickInterval = 500; // 500ms per tick at 1x speed (2 ticks/second)
        
        this.initEventListeners();
        
        // Generate an initial preview map
        this.gameState = "preview";
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
        this.previewMap = new Game(settings);
        
        // Safety check for undefined generalPosition
        for (let i = 0; i < settings.playerCount; i++) {
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
        for (let i = 0; i < settings.playerCount; i++) {
            previewPlayers.push({
                id: i,
                isAlive: true,
                unitCount: this.previewMap.grid[this.previewMap.players[i].generalPosition.y][this.previewMap.players[i].generalPosition.x].units,
                territoryCount: 1
            });
        }
        
        // Initialize UI with preview players
        this.ui.initializePlayerStats(previewPlayers);
        
        // Update UI to preview state
        this.gameState = "preview";
        this.ui.updateGameStatus("preview");
        
        // Render the preview map
        this.renderer.render(this.previewMap);
    }
    
    startSimulation() {
        if (this.game && this.gameState !== "running") {
            return;
        }
        
        if (this.game) {
            this.gameState = "running";
            this.ui.updateGameStatus("running");
            this.lastUpdate = performance.now();
            requestAnimationFrame((ts) => this.gameLoop(ts));
            return;
        }
        
        // Get settings from UI
        const settings = this.ui.getMapSettings();
        
        // Initialize new game (use preview map if available)
        this.game = this.previewMap || new Game(settings);
        
        this.previewMap = null; // Clear preview map
        
        // Create AI players with deliberate pattern of AI types
        this.aiPlayers = [];
        for (let i = 0; i < settings.playerCount; i++) {
            // Distribute AI types in a pattern: aggressive, expansion, defensive, random, repeat
            const aiType = i % 4; 
            this.aiPlayers.push(createAI(aiType, i, this.game));
        }
        
        // Setup UI display
        this.ui.initializePlayerStats(this.game.players);
        
        // Start game loop
        this.gameState = "running";
        this.ui.updateGameStatus("running");
        this.lastUpdate = performance.now();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    togglePause() {
        if (this.gameState === "preview" || this.gameState === "gameover") return;

        this.gameState = this.gameState === "pause" ? "running" : "pause";
        this.ui.updateGameStatus(this.gameState);
        
        if (this.gameState === "running") {
            this.lastUpdate = performance.now();
            requestAnimationFrame((ts) => this.gameLoop(ts));
        }
    }
    
    resetSimulation() {
        this.gameState = "preview";
        this.ui.updateGameStatus("preview");
        this.game = null;
        this.aiPlayers = [];
        this.generateMapPreview();
    }
    
    gameLoop(timestamp) {
        if (this.gameState !== "running") return;
        
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
                this.ui.updateTurnCounter(this.game.tick);
                
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
                this.gameState = "gameover";
                
                // Find the winner
                const winner = this.game.players.find(p => p.isAlive);
                
                // Update UI to game over state with winner data
                this.ui.updateGameStatus("gameover", {
                    winner: winner
                });
                
                // Return early to stop the game loop
                return;
            }
        }
        
        // Render the current state (render at full framerate for smooth animation)
        this.renderer.render(this.game);
        
        // Continue the game loop
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}

// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new GameSimulator();
});
