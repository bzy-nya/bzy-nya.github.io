import { SVGIcons } from './svgIcons.js';

// Color constants for easier customization
const COLORS = {
    // Player colors (from generals.io)
    PLAYERS: [
        'rgba(255,0,0,0.7)',        // P1 - Red
        'rgba(39,146,255,0.7)',     // P2 - Blue
        'rgba(0,128,0,0.7)',        // P3 - Green
        'rgba(0,128,128,0.7)',      // P4 - Teal
        'rgba(250,140,1,0.7)',      // P5 - Orange
        'rgba(240,50,230,0.7)',     // P6 - Pink
        'rgba(128,0,128,0.7)',      // P7 - Purple
        'rgba(155,1,1,0.7)',        // P8 - Dark Red
        'rgba(179,172,50,0.7)',     // P9 - Yellow
        'rgba(154,94,36,0.7)',      // P10 - Brown
        'rgba(16,49,255,0.7)',      // P11 - Dark Blue
        'rgba(89,76,165,0.7)',      // P12 - Lavender
        'rgba(133,169,28,0.7)',     // P13 - Lime
        'rgba(255,102,104,0.7)',    // P14 - Light Red
        'rgba(180,127,202,0.7)',    // P15 - Mauve
        'rgba(180,153,113,0.7)'     // P16 - Tan
    ],
    
    // Terrain colors
    TERRAIN: {
        CITY: '#555',      // Darkest
        MOUNTAIN: '#acacac',  // Medium
        EMPTY: '#ddd',     // Lightest
        NEUTRAL: '#555'    // For neutral entities
    },
    
    // UI colors
    UI: {
        GRID_LINES: '#333',
        CELL_BORDER: '#111',
        TEXT: '#FFFFFF',
        TEXT_SHADOW: 'rgba(0, 0, 0, 0.7)',
        GAME_OVER_OVERLAY: 'rgba(0, 0, 0, 0.7)',
        BACKGROUND: '#111',
        ZOOM_BUTTON_BG: 'rgba(30, 30, 40, 0.75)',
        ZOOM_BUTTON_HOVER: 'rgba(50, 50, 60, 0.85)'
    }
};

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Get the device pixel ratio
        this.pixelRatio = window.devicePixelRatio || 1;
        
        this.cellSize = 0;
        this.baseZoom = 1; // Base zoom level
        this.zoomFactor = 1; // Current zoom factor
        this.offsetX = 0;
        this.offsetY = 0;
        this.dragging = false;
        this.lastMousePosition = { x: 0, y: 0 };
        
        // Initialize SVG icons
        this.svgIcons = {};
        this.iconsLoaded = false;
        this.loadSVGIcons();
        
        // Set up interaction event listeners
        this.setupInteractions();
        
        // Create zoom controls
        this.createZoomControls();
    }
    
    loadSVGIcons() {
        // Convert SVG strings to images for better performance
        let loadedCount = 0;
        const totalIcons = Object.keys(SVGIcons).length;
        
        for (const [key, svg] of Object.entries(SVGIcons)) {
            const img = new Image();
            
            // Add load event listener
            img.onload = () => {
                loadedCount++;
                if (loadedCount === totalIcons) {
                    this.iconsLoaded = true;
                    // Trigger a re-render if we have an active game or preview
                    if (this.lastRenderedGame) {
                        this.render(this.lastRenderedGame);
                    }
                }
            };
            
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            img.src = URL.createObjectURL(blob);
            this.svgIcons[key] = img;
        }
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    render(game) {
        // Store reference to the game for potential re-renders after icons load
        this.lastRenderedGame = game;
        
        // Ensure proper resolution before rendering
        this.ensureHighResolution();
        
        if (!game) {
            this.clear();
            this.renderWelcomeScreen();
            return;
        }
        
        this.clear();
        
        // Calculate cell size and offset to center the grid
        this.calculateDimensions(game);
        
        // Draw the grid
        this.renderGrid(game);
        
        // Draw units and territory borders
        this.renderUnits(game);
        
        // Draw grid lines
        this.renderGridLines(game);
        
        // If game is over, render victory screen
        if (game.isGameOver && game.isGameOver()) {
            this.renderGameOver(game);
        }
    }
    
    setupInteractions() {
        // Mouse events for dragging
        this.canvas.addEventListener('mousedown', (e) => {
            this.dragging = true;
            this.lastMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            this.canvas.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mouseup', () => {
            this.dragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.dragging) return;
            
            const deltaX = e.clientX - this.lastMousePosition.x;
            const deltaY = e.clientY - this.lastMousePosition.y;
            
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            
            this.lastMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            
            // Re-render with new offsets
            if (this.lastRenderedGame) {
                this.render(this.lastRenderedGame);
            }
        });
        
        // Touch events for dragging on mobile
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                this.dragging = true;
                this.lastMousePosition = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
        });
        
        document.addEventListener('touchend', () => {
            this.dragging = false;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!this.dragging || e.touches.length !== 1) return;
            
            const deltaX = e.touches[0].clientX - this.lastMousePosition.x;
            const deltaY = e.touches[0].clientY - this.lastMousePosition.y;
            
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            
            this.lastMousePosition = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            
            // Re-render with new offsets
            if (this.lastRenderedGame) {
                this.render(this.lastRenderedGame);
            }
        });
        
        // Set initial cursor style
        this.canvas.style.cursor = 'grab';
    }
    
    createZoomControls() {
        // Create zoom container
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'zoom-controls';
        zoomContainer.style.position = 'absolute';
        zoomContainer.style.bottom = '20px';
        zoomContainer.style.right = '20px';
        zoomContainer.style.zIndex = '100';
        zoomContainer.style.display = 'flex';
        zoomContainer.style.flexDirection = 'column';
        zoomContainer.style.gap = '5px';
        
        // Zoom in button
        const zoomInBtn = document.createElement('button');
        zoomInBtn.textContent = '+';
        zoomInBtn.className = 'zoom-button';
        zoomInBtn.addEventListener('click', () => this.adjustZoom(0.2));
        
        // Zoom out button
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.textContent = '−';  // Using a proper minus sign
        zoomOutBtn.className = 'zoom-button';
        zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.2));
        
        // Reset zoom button
        const resetZoomBtn = document.createElement('button');
        resetZoomBtn.textContent = '⟲';  // Reset symbol
        resetZoomBtn.className = 'zoom-button';
        resetZoomBtn.addEventListener('click', () => this.resetZoom());
        
        // Add buttons to container
        zoomContainer.appendChild(zoomInBtn);
        zoomContainer.appendChild(zoomOutBtn);
        zoomContainer.appendChild(resetZoomBtn);
        
        // Style the buttons
        const style = document.createElement('style');
        style.textContent = `
            .zoom-button {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: none;
                background-color: ${COLORS.UI.ZOOM_BUTTON_BG};
                color: white;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: background-color 0.2s;
            }
            .zoom-button:hover {
                background-color: ${COLORS.UI.ZOOM_BUTTON_HOVER};
            }
            .zoom-button:active {
                transform: translateY(1px);
            }
        `;
        
        // Add style and container to the document
        document.head.appendChild(style);
        document.body.appendChild(zoomContainer);
    }
    
    adjustZoom(delta) {
        // Change zoom factor with min/max limits
        this.zoomFactor = Math.max(0.5, Math.min(3, this.zoomFactor + delta));
        
        // Re-render with the new zoom
        if (this.lastRenderedGame) {
            this.render(this.lastRenderedGame);
        }
    }
    
    resetZoom() {
        this.zoomFactor = 1;
        
        // Reset position too
        if (this.lastRenderedGame) {
            this.calculateDimensions(this.lastRenderedGame);
            this.render(this.lastRenderedGame);
        }
    }
    
    // Add this new method to handle high resolution displays
    ensureHighResolution() {
        // Get current canvas display size
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        // Check if canvas display size matches actual size
        if (this.canvas.width !== displayWidth * this.pixelRatio || 
            this.canvas.height !== displayHeight * this.pixelRatio) {
            
            // Set the canvas to the correct size in pixels
            this.canvas.width = displayWidth * this.pixelRatio;
            this.canvas.height = displayHeight * this.pixelRatio;
            
            // Scale the context for sharp rendering
            this.ctx.scale(this.pixelRatio, this.pixelRatio);
        }
    }
    
    calculateDimensions(game) {
        // Calculate ideal cell size to fit the grid on screen with some padding
        const maxCellWidth = (this.canvas.width * 0.8) / game.width;
        const maxCellHeight = (this.canvas.height * 0.8) / game.height;
        this.baseZoom = Math.floor(Math.min(maxCellWidth, maxCellHeight));
        
        // Apply zoom factor to cell size
        this.cellSize = this.baseZoom * this.zoomFactor;
        
        // Calculate offsets to center the grid only on first render or reset
        if (!this.offsetInitialized) {
            this.offsetX = Math.floor((this.canvas.width - (game.width * this.cellSize)) / 2);
            this.offsetY = Math.floor((this.canvas.height - (game.height * this.cellSize)) / 2);
            this.offsetInitialized = true;
        }
    }
    
    renderGrid(game) {
        for (let y = 0; y < game.height; y++) {
            for (let x = 0; x < game.width; x++) {
                const cell = game.grid[y][x];
                const screenX = this.offsetX + x * this.cellSize;
                const screenY = this.offsetY + y * this.cellSize;
                
                // Draw cell background with updated color scheme
                this.ctx.fillStyle = this.getCellColor(cell);
                this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);
                
                // Draw cell border with increased width
                this.ctx.strokeStyle = COLORS.UI.CELL_BORDER;
                this.ctx.lineWidth = 2; // Increased from 1 to 2
                this.ctx.strokeRect(screenX, screenY, this.cellSize, this.cellSize);
            }
        }
    }
    
    renderUnits(game) {
        // Render terrain SVG icons first
        for (let y = 0; y < game.height; y++) {
            for (let x = 0; x < game.width; x++) {
                const cell = game.grid[y][x];
                const screenX = this.offsetX + x * this.cellSize + this.cellSize / 2;
                const screenY = this.offsetY + y * this.cellSize + this.cellSize / 2;
                
                // Draw SVG icons for all terrain types, including in preview mode
                if (cell.type === "mountain" || cell.type === "city" || cell.type === "general") {
                    // Use owner for color if available, or a default if in preview mode
                    const color = cell.owner >= 0 ? this.getPlayerColor(cell.owner) : COLORS.UI.TEXT;
                    this.drawCellIcon(cell.type, screenX, screenY, color);
                }
            }
        }
        
        // Then render numbers on top with thinner font
        const fontSize = Math.max(10, this.cellSize / 2.2); // Slightly smaller font
        this.ctx.font = `${fontSize}px Arial`; // Removed "bold" to make font thinner
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        for (let y = 0; y < game.height; y++) {
            for (let x = 0; x < game.width; x++) {
                const cell = game.grid[y][x];
                
                if (cell.type === "mountain") continue; // Skip rendering units for mountains
                
                const screenX = this.offsetX + x * this.cellSize + this.cellSize / 2;
                const screenY = this.offsetY + y * this.cellSize + this.cellSize / 2;
                
                // Draw unit count if > 0
                if (cell.units > 0) {
                    // Use a small shadow to make text more readable over SVGs
                    this.ctx.fillStyle = COLORS.UI.TEXT;
                    this.ctx.shadowColor = COLORS.UI.TEXT_SHADOW;
                    this.ctx.shadowBlur = 2;
                    this.ctx.fillText(cell.units.toString(), screenX, screenY);
                    this.ctx.shadowBlur = 0;
                }
            }
        }
    }
    
    drawCellIcon(type, x, y, color) {
        // Increase icon size from 0.7 to 0.9 of cell size
        const iconSize = this.cellSize * 0.9;
        const icon = this.svgIcons[type];
        
        // Check if the icon exists and is loaded
        if (icon && (icon.complete || this.iconsLoaded)) {
            // Make icons fully opaque for better visibility
            this.ctx.globalAlpha = 1.0;
            this.ctx.drawImage(
                icon,
                x - iconSize/2,
                y - iconSize/2,
                iconSize,
                iconSize
            );
            this.ctx.globalAlpha = 1;
        } else if (icon && !icon.complete) {
            // If icon is not loaded, draw a placeholder instead
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.5;
            
            // Simple placeholders based on terrain type
            if (type === "mountain") {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - iconSize/3);
                this.ctx.lineTo(x - iconSize/3, y + iconSize/3);
                this.ctx.lineTo(x + iconSize/3, y + iconSize/3);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (type === "city") {
                this.ctx.fillRect(x - iconSize/4, y - iconSize/4, iconSize/2, iconSize/2);
            } else if (type === "general") {
                this.ctx.beginPath();
                this.ctx.arc(x, y, iconSize/4, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.globalAlpha = 1;
        }
    }
    
    renderGridLines(game) {
        this.ctx.strokeStyle = COLORS.UI.GRID_LINES;
        this.ctx.lineWidth = 1;
        
        // Draw horizontal lines
        for (let y = 0; y <= game.height; y++) {
            const screenY = this.offsetY + y * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(this.offsetX, screenY);
            this.ctx.lineTo(this.offsetX + game.width * this.cellSize, screenY);
            this.ctx.stroke();
        }
        
        // Draw vertical lines
        for (let x = 0; x <= game.width; x++) {
            const screenX = this.offsetX + x * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, this.offsetY);
            this.ctx.lineTo(screenX, this.offsetY + game.height * this.cellSize);
            this.ctx.stroke();
        }
    }
    
    getCellColor(cell) {
        // Player territories
        if (cell.owner >= 0) {
            return this.getPlayerColor(cell.owner);
        }
        
        // Neutral or empty territories
        if (cell.owner === -2) { // OWNER_NEUTRAL
            return COLORS.TERRAIN.NEUTRAL;
        }
        
        // Terrain types
        switch(cell.type) {
            case "city":
                return COLORS.TERRAIN.CITY;
            case "mountain":
                return COLORS.TERRAIN.MOUNTAIN;
            default: // empty
                return COLORS.TERRAIN.EMPTY;
        }
    }
    
    getPlayerColor(playerId) {
        // Use the player colors array with wrapping
        return COLORS.PLAYERS[playerId % COLORS.PLAYERS.length];
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    renderWelcomeScreen() {
        this.ctx.fillStyle = COLORS.UI.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = COLORS.UI.TEXT;
        this.ctx.font = "30px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("Generals.io Simulator", this.canvas.width / 2, this.canvas.height / 2 - 40);
        
        this.ctx.font = "20px Arial";
        this.ctx.fillText("Configure settings and press Start to begin", this.canvas.width / 2, this.canvas.height / 2 + 20);
    }
    
    renderGameOver(game) {
        // Find the winner
        const winner = game.players.find(p => p.isAlive);
        
        // Full-canvas semi-transparent overlay
        this.ctx.fillStyle = COLORS.UI.GAME_OVER_OVERLAY;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate center position (use canvas dimensions not grid)
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Game over text
        this.ctx.fillStyle = COLORS.UI.TEXT;
        this.ctx.font = "40px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("Game Over", centerX, centerY - 50);
        
        if (winner) {
            this.ctx.fillStyle = this.getPlayerColor(winner.id);
            this.ctx.font = "30px Arial";
            this.ctx.fillText(`Player ${winner.id + 1} (${winner.aiName}) Wins!`, centerX, centerY + 20);
        } else {
            this.ctx.font = "30px Arial";
            this.ctx.fillText("Draw!", centerX, centerY + 20);
        }
    }
}
