// DOM references
let canvas_dom, scr, grz_dom, fps_dom, info_dom;
let mx = 0, my = 0;
let key_pressed = Array(256);

// FPS detection variables
let detected_fps = 60;
let s_time = 0;
let t_time = 0;
let detect_frame = 100;

// Sound management variables
const soundThrottles = {
    graze: {
        lastPlayed: 0,
        minDelay: 80, // Minimum 80ms between graze sounds
        maxConcurrent: 10 // Maximum 10 concurrent graze sounds
    }
};
const activeSounds = {
    graze: []
};

// Initialize UI
function initUI() {
    // Get DOM references
    canvas_dom = document.getElementById("canvas");
    scr = canvas_dom.getContext("2d");
    grz_dom = document.getElementById("graze");
    fps_dom = document.getElementById("fps");
    info_dom = document.getElementById("info");
    
    // Make these available to game.js
    window.mx = mx;
    window.my = my;
    window.key_pressed = key_pressed;
    
    // Set up event listeners
    setupEventListeners();
    
    // Detect FPS
    detect_fps();
}

// Set up all event listeners
function setupEventListeners() {
    // Keyboard events
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleGameControls);
    
    // Mouse events
    canvas_dom.addEventListener("mousemove", handleMouseMove);
    
    // Gamepad events
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
}

// Keyboard event handlers
function handleKeyUp(e) {
    key_pressed[e.keyCode] = false;
    game.player.isShift = e.shiftKey;
}

function handleKeyDown(e) {
    if(37 <= e.keyCode && e.keyCode <= 40) {
        e.preventDefault();
    }
    key_pressed[e.keyCode] = true;
    game.player.isShift = e.shiftKey;
}

function handleGameControls(e) {
    if(e.keyCode == "R".charCodeAt(0)) {
        // Remove any existing game over overlay
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Clean up any effects
        const effectsContainer = document.querySelector('.effects-container');
        if (effectsContainer) {
            effectsContainer.remove();
        }
        
        game.stop();
        game.init(scr);
    }
    if(e.keyCode == "E".charCodeAt(0)) {
        game.stop();
    }
}

// Mouse event handler
function handleMouseMove(e) {
    if(game.settings.inputMode === "mouse") {
        // Get the canvas bounding rectangle for accurate coordinates
        let rect = canvas_dom.getBoundingClientRect();
        mx = e.clientX - rect.left;
        my = e.clientY - rect.top;
        
        // Scale coordinates if canvas is displayed at a different size
        mx = mx * (canvas_dom.width / rect.width);
        my = my * (canvas_dom.height / rect.height);
        
        // Update global references
        window.mx = mx;
        window.my = my;
    }
}

// Gamepad event handlers
function handleGamepadConnected(e) {
    const gamepad = navigator.getGamepads()[e.gamepad.index];
    info_dom.innerHTML = 
        `已连接到手柄：${gamepad.id}。共有 ${gamepad.buttons.length} 个按钮，${gamepad.axes.length} 个摇杆坐标轴。`;
}

function handleGamepadDisconnected(e) {
    info_dom.innerHTML = "手柄已断开";
}

// Gamepad utilities
function get_gamepad() {
    // Use standard API first, fallback to WebKit if needed
    const gamepads = navigator.getGamepads 
        ? navigator.getGamepads() 
        : (navigator.webkitGetGamepads 
            ? navigator.webkitGetGamepads() 
            : []);
    
    // Return the array of gamepads or an empty array if none available
    return gamepads || [];
}

// UI utility functions
function detect_fps() {
    if(detect_frame === 100) {
        info_dom.innerHTML = `计算中...`;
        s_time = performance.now();
    }
    detect_frame--;
    if(detect_frame === 0) {
        t_time = performance.now();
        const elapsed = t_time - s_time;
        detected_fps = 100000 / elapsed;
        const fpss = [30, 60, 120, 144, 180, 240];
        detected_fps = fpss.reduce((closest, fps) => 
            Math.abs(fps - detected_fps) < Math.abs(closest - detected_fps) ? fps : closest, 
            fpss[0]);
                
        info_dom.innerHTML = 
            `探测到屏幕刷新率为 ${detected_fps} Hz 
            <button id="fps-detect-btn">重新测量</button>`;
        
        // Add event listener to the button
        document.getElementById("fps-detect-btn").addEventListener("click", () => {
            detect_frame = 100;
            detect_fps();
        });
    } else {
        requestAnimationFrame(detect_fps);
    }
}

// Game mode and settings functions
function set_mode(_mode) {
    game.mode = _mode;

    const list = document.getElementsByClassName('mode');
    
    for(let element of list) {
        element.classList.remove('active');
    }

    document.getElementById(`mode${game.mode}`).classList.add('active');
}

function set_observe() {
    if(game.settings.observer){
        game.settings.observer = false;
        document.getElementById("show_only").classList.remove('active');
    } else {
        if(game.settings.autoplay) set_autoplay();
        game.settings.observer = true;
        document.getElementById("show_only").classList.add('active');
    }
}

function set_autoplay() {
    if(game.settings.autoplay) {
        game.settings.autoplay = false;
        document.getElementById("auto_play").classList.remove('active');
    } else {
        if(game.settings.observer) set_observe();
        game.settings.autoplay = true;
        document.getElementById("auto_play").classList.add('active');
    }
}

function disable_inputs() {
    const list = document.getElementsByClassName('input');
    
    for(let element of list) {
        element.classList.remove('active');
    }
}

function set_keyboard() {
    game.settings.inputMode = "keyboard";
    disable_inputs();
    canvas_dom.style.cursor = "default"; 
    document.getElementById(`input_keyboard`).classList.add('active');
}

function set_mouse() {
    game.settings.inputMode = "mouse";
    disable_inputs();
    canvas_dom.style.cursor = "none"; 
    document.getElementById("input_mouse").classList.add('active');
}

function set_gamepad() {
    const gamepads = get_gamepad();
    
    // Find the first connected gamepad
    const activeGamepad = Array.from(gamepads).find(pad => pad !== null);
    
    if (!activeGamepad) {
        info_dom.innerHTML = "未探测到手柄，请确保已连接并按任意按钮激活";
        return;
    }
    
    // Set input mode to gamepad and update UI
    game.settings.inputMode = "gamepad";
    disable_inputs();
    canvas_dom.style.cursor = "default"; 
    document.getElementById("input_gamepad").classList.add('active');
    info_dom.innerHTML = 
        `使用手柄：${activeGamepad.id}。按钮数：${activeGamepad.buttons.length}，坐标轴：${activeGamepad.axes.length}。`;
}

// Enhanced graze effect with color parameter
function showGrazeEffect(x, y, color = 'rgba(255,255,255,0.8)') {
    // Create container if it doesn't exist
    let container = document.querySelector('.effects-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'effects-container';
        document.querySelector('.game-container').appendChild(container);
    }
    
    // Create the effect element
    const effect = document.createElement('div');
    effect.className = 'graze-effect';
    
    // Position it at the bullet's location
    const rect = canvas_dom.getBoundingClientRect();
    const scaleX = canvas_dom.width / rect.width;
    const scaleY = canvas_dom.height / rect.height;
    
    effect.style.left = `${x / scaleX}px`;
    effect.style.top = `${y / scaleY}px`;
    
    // Use the bullet's color for the effect or default to white
    effect.style.background = `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 70%)`;
    
    // Add to container
    container.appendChild(effect);
    
    // Remove the effect after animation completes
    setTimeout(() => {
        effect.remove();
        // Clean up container if empty
        if (container.children.length === 0) {
            container.remove();
        }
    }, 500);

    // Add sound effect if available - now throttled
    if (typeof playSound === 'function') {
        playSound('graze');
    }
}

// Game over handler
function onGameOver(x, y) {
    // Update info text
    info_dom.innerHTML = "满身疮痍！按 R 重新开始";
    
    // Create visual effects
    // Create container if it doesn't exist
    let container = document.querySelector('.effects-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'effects-container';
        document.querySelector('.game-container').appendChild(container);
    }
    
    // Create expanding circle effect
    const explosion = document.createElement('div');
    explosion.className = 'game-over-effect';
    
    // Position at player
    const rect = canvas_dom.getBoundingClientRect();
    const scaleX = canvas_dom.width / rect.width;
    const scaleY = canvas_dom.height / rect.height;
    
    explosion.style.left = `${x / scaleX}px`;
    explosion.style.top = `${y / scaleY}px`;
    
    container.appendChild(explosion);
    
    // Create game over text overlay with ID for later removal
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.id = 'game-over-overlay';
    overlay.innerHTML = '<span>满身疮痍</span>';
    document.querySelector('.game-container').appendChild(overlay);
    
    // Add sound effect if available
    if (typeof playSound === 'function') {
        playSound('gameOver');
    }
}

// Updated sound effects with better management
const sounds = {    
    graze: new Audio('th00/se_graze.wav'),
    gameOver: new Audio('th00/Touhou_Death_Sound.ogg')
};

// Create a pool of audio elements for frequently used sounds
function createSoundPool(soundName, poolSize = 5) {
    const pool = [];
    
    // Original sound to clone from
    const originalSound = sounds[soundName];
    if (!originalSound) return pool;
    
    // Create pool of clones
    for (let i = 0; i < poolSize; i++) {
        const clone = originalSound.cloneNode(true);
        clone.volume = originalSound.volume;
        pool.push({
            element: clone,
            inUse: false
        });
    }
    
    return pool;
}

// Initialize pools for sounds that need them
const soundPools = {
    graze: createSoundPool('graze', 5)
};

// Improved sound playing function with throttling and pooling
function playSound(soundName) {
    const now = performance.now();
    
    // Special handling for graze sounds to prevent audio spam
    if (soundName === 'graze') {
        const throttleInfo = soundThrottles.graze;
        
        // Check if we need to throttle
        if (now - throttleInfo.lastPlayed < throttleInfo.minDelay) {
            return; // Skip this sound, it's too soon
        }
        
        // Update last played time
        throttleInfo.lastPlayed = now;
        
        // Find an available sound from the pool
        const soundPool = soundPools.graze;
        
        // Try to find a sound that's not in use
        const availableSound = soundPool.find(sound => !sound.inUse);
        
        if (availableSound) {
            availableSound.inUse = true;
            
            // Play the sound
            availableSound.element.play()
                .then(() => {
                    // Mark as available when finished
                    availableSound.element.onended = () => {
                        availableSound.inUse = false;
                    };
                })
                .catch(e => {
                    // Handle errors and still mark as available
                    console.log("Sound couldn't play: ", e.message);
                    availableSound.inUse = false;
                });
        }
        // If no sound available in the pool, we just skip this one
        return;
    }
    
    // Standard handling for other sounds
    if (sounds[soundName]) {
        sounds[soundName].cloneNode(true).play().catch(e => {
            // Silence errors for browsers that block autoplay
            console.log("Sound couldn't play: ", e.message);
        });
    }
}

// Game update callback handler
function onGameStatUpdate(fps, graze) {
    // Update graze counter every frame
    grz_dom.innerHTML = `Graze: ${graze}`;
    
    // Update FPS display less frequently to make it more readable
    // Only update every 10 frames or about 6 times per second at 60fps
    if (game.performance.frameCount % 10 === 0) {
        fps_dom.innerHTML = `FPS: ${fps.toFixed(1)}`; // Show one decimal place for more precision
    }
};

// Make callback functions available to game.js
window.onGameStatUpdate = onGameStatUpdate;
window.onGameOver = onGameOver;

// Make the visual effect functions globally available
window.showGrazeEffect = showGrazeEffect;
window.playSound = playSound;

// Explicitly make functions available globally for HTML onclick handlers
window.detect_fps = detect_fps;
window.set_mode = set_mode;
window.set_observe = set_observe;
window.set_autoplay = set_autoplay;
window.set_keyboard = set_keyboard;
window.set_mouse = set_mouse;
window.set_gamepad = set_gamepad;

// Make the get_gamepad function available to game.js
window.get_gamepad = get_gamepad;
