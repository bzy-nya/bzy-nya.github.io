// DOM references
import { TH00_INPUT_STATE, TH00_MODE_MAP } from '../core/config.js';
import { game, preloadGameAssets, setBulletGenerator, setGameCallbacks } from '../core/game.js';
import { playSound } from './audio.js';

let canvas_dom, game_container_dom, scr, grz_dom, fps_dom, info_dom, control_hint_dom;
let isStartingGame = false;
let previousGamepadButtons = {
    shoot: false,
    pause: false
};

const CONTROL_HINTS = {
    keyboard: '键盘：Z 开始 / 射击 / 继续，方向键或 WASD 移动，Shift 精准移动，Esc 暂停。',
    mouse: '鼠标：移动鼠标控制位置，按住左键开始 / 射击 / 继续，Esc 暂停。',
    gamepad: '手柄：A / 按钮 0 开始 / 射击 / 继续，左摇杆移动，L2 精准移动，Start 暂停。'
};

// Initialize UI
export function initUI() {
    // Get DOM references
    canvas_dom = document.getElementById("canvas");
    game_container_dom = document.querySelector('.game-container');
    scr = canvas_dom.getContext("2d");
    grz_dom = document.getElementById("graze");
    fps_dom = document.getElementById("fps");
    info_dom = document.getElementById("info");
    control_hint_dom = document.getElementById("control_hint");
    updateControlHint();

    // Set up event listeners
    setupEventListeners();
    pollGamepadControls();
}

// Set up all event listeners
function setupEventListeners() {
    // Keyboard events
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleGameControls);
    
    // Mouse events
    canvas_dom.addEventListener("mousemove", handleMouseMove);
    game_container_dom.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    game_container_dom.addEventListener("contextmenu", (e) => e.preventDefault());
    
    // Gamepad events
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
}

// Keyboard event handlers
function handleKeyUp(e) {
    TH00_INPUT_STATE.keys[e.keyCode] = false;
    game.scene.player.precisionMode = e.shiftKey;
}

function handleKeyDown(e) {
    if(37 <= e.keyCode && e.keyCode <= 40) {
        e.preventDefault();
    }
    if (e.keyCode === 27 || e.keyCode === "Z".charCodeAt(0)) {
        e.preventDefault();
    }
    TH00_INPUT_STATE.keys[e.keyCode] = true;
    game.scene.player.precisionMode = e.shiftKey;
}

function clearGameEffects() {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.remove();
    }

    const effectsContainer = document.querySelector('.effects-container');
    if (effectsContainer) {
        effectsContainer.remove();
    }
}

async function startOrResumeGame() {
    if (isStartingGame) return;
    clearGameEffects();

    if (!game.state.hasStarted || game.state.isGameOver || game.state.isStageClear) {
        isStartingGame = true;
        info_dom.innerHTML = '资源加载中...';
        try {
            await preloadGameAssets();
            game.stop();
            game.init(scr);
            info_dom.innerHTML = `Cirno 玩耍中...`;
        } catch (error) {
            console.error(error);
            info_dom.innerHTML = '资源加载失败，请刷新后重试。';
        } finally {
            isStartingGame = false;
        }
        return;
    }

    if (game.state.isPaused) {
        game.resume();
        info_dom.innerHTML = `Cirno 玩耍中...`;
    }
}

function handleGameControls(e) {
    if (e.repeat && (e.keyCode === "Z".charCodeAt(0) || e.keyCode === 27)) {
        return;
    }

    if(e.keyCode == "Z".charCodeAt(0) && game.settings.inputMode !== "mouse") {
        startOrResumeGame();
    }

    if(e.keyCode === 27) {
        if (game.state.isRunning) {
            game.pause();
            info_dom.innerHTML = "已暂停。按 Z 继续。";
        }
    }
}

function updateMousePosition(e) {
    const rect = canvas_dom.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    TH00_INPUT_STATE.mouseX = mouseX * (canvas_dom.width / rect.width);
    TH00_INPUT_STATE.mouseY = mouseY * (canvas_dom.height / rect.height);
}

// Mouse event handler
function handleMouseMove(e) {
    if(game.settings.inputMode === "mouse") {
        updateMousePosition(e);
    }
}

function handleMouseDown(e) {
    if (game.settings.inputMode !== "mouse" || e.button !== 0) return;

    e.preventDefault();
    updateMousePosition(e);
    TH00_INPUT_STATE.mouseDown = true;
    startOrResumeGame();
}

function handleMouseUp() {
    TH00_INPUT_STATE.mouseDown = false;
}

// Gamepad event handlers
function handleGamepadConnected(e) {
    const gamepad = e.gamepad || getActiveGamepad();
    if (!gamepad) return;
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

function getActiveGamepad() {
    return Array.from(get_gamepad()).find((pad) => pad && pad.connected !== false) || null;
}

function isGamepadButtonPressed(gamepad, index) {
    return !!(gamepad?.buttons?.[index]?.pressed);
}

function pollGamepadControls() {
    const gamepad = game.settings.inputMode === "gamepad" ? getActiveGamepad() : null;
    const shootPressed = isGamepadButtonPressed(gamepad, 0);
    const pausePressed = isGamepadButtonPressed(gamepad, 9);

    if (shootPressed && !previousGamepadButtons.shoot) {
        startOrResumeGame();
    }

    if (pausePressed && !previousGamepadButtons.pause && game.state.isRunning) {
        game.pause();
        info_dom.innerHTML = "已暂停。按 A / 按钮 0 继续。";
    }

    previousGamepadButtons.shoot = shootPressed;
    previousGamepadButtons.pause = pausePressed;
    requestAnimationFrame(pollGamepadControls);
}

function setActiveButton(selector, activeId) {
    document.querySelectorAll(selector).forEach((element) => {
        element.classList.toggle('active', element.id === activeId);
    });
}

function setExclusiveMode(settingName, buttonId, value, excludedSettingName, excludedButtonId) {
    if (excludedSettingName && value && game.settings[excludedSettingName]) {
        game.settings[excludedSettingName] = false;
        document.getElementById(excludedButtonId).classList.remove('active');
    }

    game.settings[settingName] = value;
    document.getElementById(buttonId).classList.toggle('active', value);
}

function updateControlHint() {
    if (!control_hint_dom) return;
    control_hint_dom.innerHTML = CONTROL_HINTS[game.settings.inputMode] || CONTROL_HINTS.keyboard;
}

// Game mode and settings functions
function set_mode(modeNumber) {
    const generatorName = TH00_MODE_MAP[modeNumber];
    if (!generatorName || !setBulletGenerator(generatorName)) return;

    setActiveButton('.mode', `mode${modeNumber}`);
}

function set_observe() {
    setExclusiveMode('observer', 'show_only', !game.settings.observer, 'autoplay', 'auto_play');
}

function set_autoplay() {
    setExclusiveMode('autoplay', 'auto_play', !game.settings.autoplay, 'observer', 'show_only');
}

function setInputMode(modeName, cursor) {
    game.settings.inputMode = modeName;
    canvas_dom.style.cursor = cursor;
    TH00_INPUT_STATE.mouseDown = false;
    setActiveButton('.input', `input_${modeName}`);
    updateControlHint();
}

function set_keyboard() { setInputMode('keyboard', 'default'); }

function set_mouse() { setInputMode('mouse', 'none'); }

function set_gamepad() {
    const activeGamepad = getActiveGamepad();
    
    if (!activeGamepad) {
        info_dom.innerHTML = "未探测到手柄，请确保已连接并按任意按钮激活";
        return;
    }
    
    setInputMode('gamepad', 'default');
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
        game_container_dom.appendChild(container);
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
    
    effect.addEventListener('animationend', () => {
        effect.remove();
        if (container.children.length === 0) {
            container.remove();
        }
    }, { once: true });

    // Add sound effect if available - now throttled
    if (typeof playSound === 'function') {
        playSound('graze', game.performance.frameCount);
    }
}

// Game over handler
function onGameOver(x, y) {
    const restartHint = game.settings.inputMode === "mouse"
        ? "按左键重新开始"
        : "按 Z 重新开始";
    const seconds = Math.max(0, game.scene.stageFrame / 60);

    // Update info text
    info_dom.innerHTML = `Cirno >_<`;
    
    // Create game over text overlay with ID for later removal
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay result-overlay result-overlay--fail';
    overlay.id = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="result-copy">
            <span class="result-title">满身疮痍</span>
            <div class="result-line">
                <span>Graze       ${game.graze}</span>
                <span>Survive       ${formatTime(seconds)}</span>
            </div>
            <small class="result-hint">${restartHint}</small>
        </div>
    `;
    game_container_dom.appendChild(overlay);
    
    // Add sound effect if available
    if (typeof playSound === 'function') {
        playSound('gameOver');
    }
}

function onStageClear(result) {
    const seconds = Math.max(0, result.frame / 60);
    info_dom.innerHTML = `Cirno Happy! ^_^`;

    let container = document.querySelector('.effects-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'effects-container';
        game_container_dom.appendChild(container);
    }

    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay result-overlay result-overlay--clear';
    overlay.id = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="result-copy">
            <span class="result-title">Stage Clear</span>
            <div class="result-line">
                <span>Graze ${result.graze}</span>
            </div>
        </div>
    `;
    game_container_dom.appendChild(overlay);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
}

// Game update callback handler
function onGameStatUpdate(fps, graze) {
    // Update graze counter every frame
    grz_dom.innerHTML = `Graze: ${graze}`;
    
    if (game.performance.frameCount % 10 === 0) {
        fps_dom.innerHTML = `FPS: ${fps}`;
    }
};

// Explicitly make functions available globally for HTML onclick handlers
window.set_mode = set_mode;
window.set_observe = set_observe;
window.set_autoplay = set_autoplay;
window.set_keyboard = set_keyboard;
window.set_mouse = set_mouse;
window.set_gamepad = set_gamepad;

setGameCallbacks({
    onGameOver,
    onGameStatUpdate,
    onStageClear,
    showGrazeEffect,
    getGamepad: get_gamepad
});
