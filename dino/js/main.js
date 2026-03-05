// 全局变量
let game;
let currentSpeedMultiplier = 1;

// DOM元素缓存
const dom = {};

// 模式配置：统一管理 UI 文案与参数滑动条映射，减少分支重复
const MODE_CONFIG = {
    GA: {
        toggleText: 'GA → RL',
        bodyClass: '',
        title: ' Dino Game - 进化算法演示',
        evolutionTitle: '进化统计',
        evolutionIcon: 'evolution',
        startBtnText: '开始进化',
        individualText: '最佳个体',
        generationLabel: '当前世代:',
        avgScoreLabel: '平均分数:',
        params: ['种群大小:', '变异率:', '交叉率:', '精英保留:'],
        sliderRanges: {
            population: { min: 10, max: 50, step: 1, defaultValue: 20 },
            mutation:   { min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.1 },
            crossover:  { min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.8 },
            elitism:    { min: 1, max: 10, step: 1, defaultValue: 2 }
        },
        sliders: {
            population: {
                display: (v) => Math.round(v),
                trainerValue: (v) => Math.round(v),
                format: (v) => Math.round(v).toString(),
                apply: (t, v) => t.setPopulationSize(v),
                fromTrainer: (s) => s.populationSize
            },
            mutation: {
                display: (v) => v,
                trainerValue: (v) => v,
                format: (v) => v.toFixed(3),
                apply: (t, v) => t.setMutationRate(v),
                fromTrainer: (s) => s.mutationRate
            },
            crossover: {
                display: (v) => v,
                trainerValue: (v) => v,
                format: (v) => v.toFixed(2),
                apply: (t, v) => t.setCrossoverRate(v),
                fromTrainer: (s) => s.crossoverRate
            },
            elitism: {
                display: (v) => Math.round(v),
                trainerValue: (v) => Math.round(v),
                format: (v) => Math.round(v).toString(),
                apply: (t, v) => t.setElitismCount(v),
                fromTrainer: (s) => s.elitismCount
            }
        }
    },
    RL: {
        toggleText: 'RL → GA',
        bodyClass: 'rl-mode',
        title: ' Dino Game - 强化学习演示',
        evolutionTitle: '学习统计',
        evolutionIcon: 'trophy',
        startBtnText: '开始学习',
        individualText: '当前个体',
        generationLabel: '回合数:',
        avgScoreLabel: '当前分数:',
        params: ['Agent数量:', '学习速度:', '奖励系数:', '折扣因子γ:'],
        sliderRanges: {
            population: { min: 1, max: 20, step: 1, defaultValue: 8 },
            mutation:   { min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.15 },
            crossover:  { min: 0.1, max: 1.0, step: 0.1, defaultValue: 1.0 },
            elitism:    { min: 1, max: 10, step: 1, defaultValue: 9 }
        },
        sliders: {
            population: {
                display: (v) => Math.round(v),
                trainerValue: (v) => Math.round(v),
                format: (v) => Math.round(v).toString(),
                apply: (t, v) => t.setPopulationSize(v),
                fromTrainer: (s) => s.populationSize
            },
            mutation: {
                display: (v) => v * 0.2,
                trainerValue: (v) => v * 0.2,
                format: (v) => v.toFixed(4),
                apply: (t, v) => t.setLearningRate(v),
                fromTrainer: (s) => (s.learningRate || 0) / 0.2
            },
            crossover: {
                display: (v) => v * 0.2,
                trainerValue: (v) => v * 0.2,
                format: (v) => v.toFixed(3),
                apply: (t, v) => t.setRewardScale(v),
                fromTrainer: (s) => (s.rewardScale || 0) / 0.2
            },
            elitism: {
                display: (v) => 0.9 + (v - 1) * 0.01,
                trainerValue: (v) => 0.9 + (v - 1) * 0.01,
                format: (v) => v.toFixed(2),
                apply: (t, v) => t.setGamma(v),
                fromTrainer: (s) => 1 + ((s.gamma || 0.9) - 0.9) / 0.01
            }
        }
    }
};

let currentModeConfig = MODE_CONFIG.GA;
const sliderStateByMode = { GA: {}, RL: {} };
const sliderActiveState = { population: false, mutation: false, crossover: false, elitism: false };

// 滑动条 DOM 映射（值显示与输入元素）
const SLIDER_VALUE_FIELDS = {
    population: 'populationSize',
    mutation: 'mutationRate',
    crossover: 'crossoverRate',
    elitism: 'elitismCount'
};

const SLIDER_INPUT_FIELDS = {
    population: 'populationSlider',
    mutation: 'mutationSlider',
    crossover: 'crossoverSlider',
    elitism: 'elitismSlider'
};

// 初始化游戏
document.addEventListener('DOMContentLoaded', function() {
    // 缓存DOM元素
    cacheDOMElements();
    
    // 初始化SVG图标
    initSVGIcons();
    
    // 创建游戏实例
    game = new DinoGame('gameCanvas');

    applyModeConfig(game.aiMode);

    // 设置控制按钮
    setupControls();
    
    // 设置参数滑动条
    setupParameterControls();

    // 按当前模式刷新参数展示并同步到 trainer
    refreshParameterDisplay(true);
    
    // 开始UI更新循环
    startUIUpdateLoop();
});

// 缓存所有DOM元素
function cacheDOMElements() {
    // 按钮
    dom.startBtn = document.getElementById('startBtn');
    dom.pauseBtn = document.getElementById('pauseBtn');
    dom.resetBtn = document.getElementById('resetBtn');
    dom.speedBtn = document.getElementById('speedBtn');
    dom.manualBtn = document.getElementById('manualBtn');
    dom.modeToggle = document.getElementById('modeToggle');
    
    // 统计显示
    dom.generation = document.getElementById('generation');
    dom.alive = document.getElementById('alive');
    dom.highScore = document.getElementById('highScore');
    dom.avgScore = document.getElementById('avgScore');
    dom.generationProgress = document.getElementById('generationProgress');
    
    // 参数显示
    dom.populationSize = document.getElementById('populationSize');
    dom.mutationRate = document.getElementById('mutationRate');
    dom.crossoverRate = document.getElementById('crossoverRate');
    dom.elitismCount = document.getElementById('elitismCount');
    
    // Canvas
    dom.bestIndividualCanvas = document.getElementById('bestIndividualCanvas');
    dom.geneticTreeCanvas = document.getElementById('geneticTreeCanvas');
    
    // 标题和文本
    dom.mainTitle = document.getElementById('main-title');
    dom.evolutionTitle = document.getElementById('evolution-title');
    dom.individualTitleText = document.getElementById('individual-title-text');
    
    // 参数标签
    dom.param1Label = document.getElementById('param1-label');
    dom.param2Label = document.getElementById('param2-label');
    dom.param3Label = document.getElementById('param3-label');
    dom.param4Label = document.getElementById('param4-label');
    
    // 参数滑动条
    dom.populationSlider = document.getElementById('populationSlider');
    dom.mutationSlider = document.getElementById('mutationSlider');
    dom.crossoverSlider = document.getElementById('crossoverSlider');
    dom.elitismSlider = document.getElementById('elitismSlider');
}

// 初始化SVG图标
function initSVGIcons() {
    if (dom.mainTitle) {
        dom.mainTitle.innerHTML = createSVGIcon('dino', 'title-icon') + ' ' + dom.mainTitle.textContent;
    }
    if (dom.evolutionTitle) {
        dom.evolutionTitle.innerHTML = createSVGIcon('evolution', 'panel-icon') + ' ' + dom.evolutionTitle.textContent;
    }
    
    const bestTitle = document.getElementById('best-title');
    if (bestTitle) {
        bestTitle.innerHTML = createSVGIcon('trophy', 'panel-icon') + ' ' + bestTitle.textContent;
    }
    
    const paramsTitle = document.getElementById('params-title');
    if (paramsTitle) {
        paramsTitle.innerHTML = createSVGIcon('gear', 'panel-icon') + ' ' + paramsTitle.textContent;
    }
    
    const treeTitle = document.getElementById('tree-title');
    if (treeTitle) {
        treeTitle.innerHTML = createSVGIcon('evolution', 'panel-icon') + ' ' + treeTitle.textContent;
    }
}

// 应用模式配置：统一更新文案/主题，并重算滑动条显示
function applyModeConfig(mode) {
    currentModeConfig = MODE_CONFIG[mode] || MODE_CONFIG.GA;
    const cfg = currentModeConfig;

    if (dom.modeToggle) dom.modeToggle.textContent = cfg.toggleText;
    document.body.className = cfg.bodyClass;

    if (dom.mainTitle) dom.mainTitle.innerHTML = createSVGIcon('dino', 'title-icon') + cfg.title;
    if (dom.evolutionTitle) dom.evolutionTitle.innerHTML = createSVGIcon(cfg.evolutionIcon, 'panel-icon') + ' ' + cfg.evolutionTitle;
    if (dom.startBtn) dom.startBtn.textContent = cfg.startBtnText;
    if (dom.individualTitleText) dom.individualTitleText.textContent = cfg.individualText;

    const genLabel = dom.evolutionTitle?.parentElement?.querySelector('.stat-item:nth-child(2) span:first-child');
    const avgLabel = dom.evolutionTitle?.parentElement?.querySelector('.stat-item:nth-child(5) span:first-child');
    if (genLabel) genLabel.textContent = cfg.generationLabel;
    if (avgLabel) avgLabel.textContent = cfg.avgScoreLabel;

    [dom.param1Label, dom.param2Label, dom.param3Label, dom.param4Label].forEach((label, i) => {
        if (label && cfg.params[i]) label.textContent = cfg.params[i];
    });

    // 恢复该模式上次的滑动条值（若无记录则使用默认值）
    const saved = sliderStateByMode[mode] || {};
    Object.keys(SLIDER_INPUT_FIELDS).forEach((key) => {
        const slider = dom[SLIDER_INPUT_FIELDS[key]];
        if (!slider) return;
        const range = cfg.sliderRanges ? cfg.sliderRanges[key] : null;
        const savedValue = saved[key];
        if (Number.isFinite(savedValue)) {
            slider.value = savedValue;
        } else if (range && range.defaultValue !== undefined) {
            slider.value = range.defaultValue;
        }
    });

    // 根据模式调整滑动条可选范围，避免 UI 显示与实际生效上限不一致
    if (cfg.sliderRanges) {
        Object.entries(cfg.sliderRanges).forEach(([key, range]) => {
            const slider = dom[SLIDER_INPUT_FIELDS[key]];
            if (!slider) return;
            if (range.min !== undefined) slider.min = range.min;
            if (range.max !== undefined) slider.max = range.max;
            if (range.step !== undefined) slider.step = range.step;

            // 如果当前值越界则回落到范围内的默认值/边界值
            const current = parseFloat(slider.value);
            let clamped = current;
            if (!Number.isFinite(current)) clamped = range.defaultValue ?? range.min ?? 0;
            if (range.min !== undefined) clamped = Math.max(range.min, clamped);
            if (range.max !== undefined) clamped = Math.min(range.max, clamped);
            if (current !== clamped) slider.value = clamped;
        });
    }

    // 切换模式后立即刷新滑动条展示（并可选择同步到 trainer）
    refreshParameterDisplay(true);
}

// 统一处理滑动条值的显示与应用
function handleSliderChange(key, rawValue, applyToTrainer = true) {
    const cfg = currentModeConfig.sliders[key];
    const valueEl = dom[SLIDER_VALUE_FIELDS[key]];
    const numeric = Number(rawValue);
    if (!cfg || !Number.isFinite(numeric)) return;

    const displayValue = cfg.display(numeric);
    if (valueEl) {
        valueEl.textContent = cfg.format ? cfg.format(displayValue) : (Number.isFinite(displayValue) ? displayValue.toString() : '0');
    }

    if (applyToTrainer && game && game.trainer && typeof cfg.apply === 'function') {
        const trainerValue = cfg.trainerValue ? cfg.trainerValue(numeric) : displayValue;
        cfg.apply(game.trainer, trainerValue);
    }
}

function refreshParameterDisplay(applyToTrainer = false) {
    Object.keys(SLIDER_INPUT_FIELDS).forEach((key) => {
        const slider = dom[SLIDER_INPUT_FIELDS[key]];
        if (!slider) return;
        handleSliderChange(key, parseFloat(slider.value), applyToTrainer);
    });
}

function persistSliderValues(mode) {
    const bag = sliderStateByMode[mode] || {};
    Object.keys(SLIDER_INPUT_FIELDS).forEach((key) => {
        const slider = dom[SLIDER_INPUT_FIELDS[key]];
        if (!slider) return;
        const v = parseFloat(slider.value);
        if (Number.isFinite(v)) bag[key] = v;
    });
    sliderStateByMode[mode] = bag;
}

function syncSlidersFromTrainer(trainerStats) {
    if (!trainerStats) return;
    Object.keys(SLIDER_INPUT_FIELDS).forEach((key) => {
        if (sliderActiveState[key]) return;
        const cfg = currentModeConfig.sliders[key];
        if (!cfg || typeof cfg.fromTrainer !== 'function') return;
        const slider = dom[SLIDER_INPUT_FIELDS[key]];
        if (!slider) return;

        const range = currentModeConfig.sliderRanges ? currentModeConfig.sliderRanges[key] : null;
        let nextValue = Number(cfg.fromTrainer(trainerStats));
        if (!Number.isFinite(nextValue)) return;

        if (range && range.min !== undefined) nextValue = Math.max(range.min, nextValue);
        if (range && range.max !== undefined) nextValue = Math.min(range.max, nextValue);

        const current = Number(slider.value);
        if (!Number.isFinite(current) || Math.abs(current - nextValue) > 1e-6) {
            slider.value = nextValue;
            handleSliderChange(key, nextValue, false);
        }
    });
}

function syncSpeedDisplay() {
    if (!dom.speedBtn || !game) return;
    const actual = Number(game.speedMultiplier);
    if (!Number.isFinite(actual)) return;
    if (actual !== currentSpeedMultiplier) {
        currentSpeedMultiplier = actual;
        dom.speedBtn.textContent = `速度: ${currentSpeedMultiplier}x`;
    }
}

// 设置控制按钮
function setupControls() {
    // 模式切换按钮
    document.getElementById('modeToggle').addEventListener('click', function() {
        toggleAIMode();
    });
    
    // 开始进化按钮
    document.getElementById('startBtn').addEventListener('click', function() {
        if (!game.isRunning) {
            startSimulation();
        }
    });
    
    // 暂停按钮
    document.getElementById('pauseBtn').addEventListener('click', function() {
        togglePause();
    });
    
    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', function() {
        resetGame();
    });
    
    // 速度按钮
    document.getElementById('speedBtn').addEventListener('click', function() {
        cycleSpeed();
    });
    
    // 手动游戏按钮
    document.getElementById('manualBtn').addEventListener('click', function() {
        startManualGame();
    });
    
    // 键盘事件
    document.addEventListener('keydown', function(e) {
        switch(e.key) {
            case 'r':
            case 'R':
                if (game.gameMode === 'MANUAL' && game.manualDino && game.manualDino.isDead) {
                    startManualGame();
                }
                break;
            case 'p':
            case 'P':
                togglePause();
                break;
            case 'Escape':
                resetGame();
                break;
        }
    });
}

// 开始模拟（AI训练：GA 或 RL）
function startSimulation() {
    game.startSimulation();
    dom.startBtn.disabled = true;
    dom.pauseBtn.disabled = false;
    dom.manualBtn.disabled = true;
}

// 开始手动游戏
function startManualGame() {
    game.startManualGame();
    dom.startBtn.disabled = true;
    dom.pauseBtn.disabled = false;
    dom.manualBtn.disabled = true;
}

// 切换AI模式
function toggleAIMode() {
    persistSliderValues(game.aiMode);
    const newMode = game.aiMode === 'GA' ? 'RL' : 'GA';
    game.setAIMode(newMode);

    applyModeConfig(newMode);

    if (game.isRunning && game.gameMode === 'AI') resetGame();
}

// 切换暂停状态
function togglePause() {
    game.togglePause();
    dom.pauseBtn.textContent = game.isPaused ? '继续' : '暂停';
}

// 重置游戏
function resetGame() {
    game.reset();
    currentSpeedMultiplier = 1;
    
    dom.startBtn.disabled = false;
    dom.pauseBtn.disabled = true;
    dom.pauseBtn.textContent = '暂停';
    dom.manualBtn.disabled = false;
    dom.speedBtn.textContent = '速度: 1x';

    // 新 trainer 会在 reset 内重建，确保参数沿用当前滑动条设定
    refreshParameterDisplay(true);

    updateStatsDisplay();
}

// 循环切换速度
function cycleSpeed() {
    const speeds = [1, 2, 4, 8];
    currentSpeedMultiplier = speeds[(speeds.indexOf(currentSpeedMultiplier) + 1) % speeds.length];
    game.setSpeedMultiplier(currentSpeedMultiplier);
    dom.speedBtn.textContent = `速度: ${currentSpeedMultiplier}x`;
}

// UI更新循环
function startUIUpdateLoop() {
    function update() {
        updateStatsDisplay();
        updateNetworkVisualization();
        requestAnimationFrame(update);
    }
    update();
}

// 更新统计显示
function updateStatsDisplay() {
    const stats = game.getStats();
    const trainerStats = game.trainer ? game.trainer.getStats() : null;
    syncSpeedDisplay();
    if (!trainerStats) return;

    // 通用统计
    dom.generation.textContent = stats.iteration || 0;
    dom.alive.textContent = game.dinos.filter(d => !d.isDead).length;
    dom.highScore.textContent = Math.floor(stats.highScore || 0);

    if (game.aiMode === 'GA') {
        renderGAStats(stats, trainerStats);
    } else {
        renderRLStats(stats, trainerStats);
    }

    syncSlidersFromTrainer(trainerStats);
    
    // 绘制个体预览
    if (game.gameMode === 'AI' && game.dinos.length > 0) {
        const dino = game.aiMode === 'GA' 
            ? game.dinos.reduce((best, d) => d.fitness > best.fitness ? d : best)
            : game.dinos[0];
        drawIndividualPreview(dino);
    }
}

function renderGAStats(stats, trainerStats) {
    dom.avgScore.textContent = Math.floor(Number.isFinite(stats.averageScore) ? stats.averageScore : 0);
    if (game.gameMode === 'AI' && dom.generationProgress) {
        const population = Math.max(1, trainerStats.populationSize || 1);
        const completed = Math.max(0, population - stats.aliveCount);
        dom.generationProgress.style.width = (completed / population * 100) + '%';
    }
    dom.populationSize.textContent = trainerStats.populationSize;
    dom.mutationRate.textContent = trainerStats.mutationRate.toFixed(3);
    dom.crossoverRate.textContent = trainerStats.crossoverRate.toFixed(2);
    dom.elitismCount.textContent = trainerStats.elitismCount;
}

function renderRLStats(stats, trainerStats) {
    dom.avgScore.textContent = Math.floor(trainerStats.currentMaxScore || 0);
    dom.populationSize.textContent = trainerStats.populationSize;
    dom.mutationRate.textContent = trainerStats.learningRate.toFixed(4);
    dom.crossoverRate.textContent = trainerStats.rewardScale.toFixed(3);
    dom.elitismCount.textContent = trainerStats.gamma.toFixed(2);
}

// 确保Canvas的CSS尺寸在首次使用时固定，避免因修改width/height属性导致显示尺寸不断变化
function ensureCanvasCSSSize(canvas, defaultW, defaultH) {
    if (!canvas) return;
    if (canvas.dataset && canvas.dataset.cssSized === '1') return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width || defaultW);
    const h = Math.round(rect.height || defaultH);

    // 固定CSS尺寸，后续仅调整绘图缓冲大小
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    if (canvas.dataset) canvas.dataset.cssSized = '1';
}

// 绘制个体预览（统一的GA/RL预览）
function drawIndividualPreview(dino) {
    const canvas = dom.bestIndividualCanvas;
    if (!canvas || !dino) return;

    ensureCanvasCSSSize(canvas, 200, 200);

    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 200;
    const displayHeight = rect.height || 200;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(displayWidth * dpr);
    const targetH = Math.round(displayHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const dinoWidth = Math.floor(displayWidth * 0.4);
    const networkWidth = displayWidth - dinoWidth;

    // 绘制恐龙
    const dinoSize = 1.5;
    const dinoX = Math.floor((dinoWidth - 44 * dinoSize) / 2);
    const dinoY = Math.floor((displayHeight - 47 * dinoSize) / 2);
    
    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.scale(dinoSize, dinoSize);
    drawPreviewDinoBody(ctx, dinoX / dinoSize, dinoY / dinoSize, dino.color, dino.isJumping, dino.isCrouching, dino.isDead);
    ctx.restore();

    // 绘制神经网络
    if (dino.brain) {
        const extracted = dino.getNetworkInputs(game.gameSpeed, game.obstacleManager.getObstacles());
        const activations = dino.brain.getDetailedActivations(extracted.inputs);
        drawDinoStyleNetwork(ctx, dino.brain, dinoWidth + 6, 0, networkWidth - 12, displayHeight, activations);
    }
}

// 绘制Dino风格的像素化神经网络
function drawDinoStyleNetwork(ctx, brain, startX, startY, width, height, activations = null) {
    if (!brain) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(0.5, 0.5);

    const nodeSize = 8;
    const weightThreshold = 0.12; // 过滤弱连接，降低密度

    // Use the actual network architecture for layout.
    const inputCount = Number.isFinite(brain.inputNodes) ? brain.inputNodes : 7;
    const hiddenCount = Number.isFinite(brain.hiddenNodes) ? brain.hiddenNodes : 12;
    const outputCount = Number.isFinite(brain.outputNodes) ? brain.outputNodes : 3;

    // Place layers within the provided width (avoid spilling out when width is narrow).
    const xInput = Math.floor(startX + nodeSize);
    const xHidden = Math.floor(startX + Math.max(nodeSize * 2, width * 0.5));
    const xOutput = Math.floor(startX + Math.max(nodeSize * 3, width - nodeSize * 2));

    const clamp01 = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(1, n));
    };

    // Encode weight sign via grayscale: positive => darker, negative => lighter.
    const weightToGray = (w) => {
        const n = Number(w);
        if (!Number.isFinite(n)) return 180;
        const abs = Math.abs(n);
        const mag = Math.max(0, Math.min(1, abs / 1.5));

        if (n >= 0) {
            // strong positive => darker
            return Math.floor(200 - mag * 140); // 60..200
        }
        // strong negative => lighter
        return Math.floor(200 + mag * 40); // 200..240
    };

    const inputNodes = [];
    const hiddenNodes = [];
    const outputNodes = [];

    // Input layer
    for (let i = 0; i < inputCount; i++) {
        const yCenter = startY + Math.floor(((i + 1) * height) / (inputCount + 1));
        inputNodes.push({ x: xInput, y: Math.floor(yCenter - nodeSize / 2) });
    }

    // Hidden layer
    for (let i = 0; i < hiddenCount; i++) {
        const yCenter = startY + Math.floor(((i + 1) * height) / (hiddenCount + 1));
        hiddenNodes.push({ x: xHidden, y: Math.floor(yCenter - nodeSize / 2) });
    }

    // Output layer
    for (let i = 0; i < outputCount; i++) {
        const yCenter = startY + Math.floor(((i + 1) * height) / (outputCount + 1));
        outputNodes.push({ x: xOutput, y: Math.floor(yCenter - nodeSize / 2) });
    }

    // 输入->隐藏 连接（跳过极弱权重）
    for (let i = 0; i < inputNodes.length; i++) {
        for (let j = 0; j < hiddenNodes.length; j++) {
            const weight = (brain.weightsInputHidden && brain.weightsInputHidden[j]) ? brain.weightsInputHidden[j][i] : 0;
            const absWeight = Math.abs(weight || 0);
            if (absWeight < weightThreshold) continue;
            const grayValue = weightToGray(weight);
            ctx.strokeStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
            ctx.lineWidth = absWeight > 0.6 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(inputNodes[i].x + nodeSize, inputNodes[i].y + nodeSize / 2);
            ctx.lineTo(hiddenNodes[j].x, hiddenNodes[j].y + nodeSize / 2);
            ctx.stroke();
        }
    }

    // 隐藏->输出 连接
    for (let i = 0; i < hiddenNodes.length; i++) {
        for (let j = 0; j < outputNodes.length; j++) {
            const weight = (brain.weightsHiddenOutput && brain.weightsHiddenOutput[j]) ? brain.weightsHiddenOutput[j][i] : 0;
            const absWeight = Math.abs(weight || 0);
            if (absWeight < weightThreshold) continue;
            const grayValue = weightToGray(weight);
            ctx.strokeStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
            ctx.lineWidth = absWeight > 0.6 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(hiddenNodes[i].x + nodeSize, hiddenNodes[i].y + nodeSize / 2);
            ctx.lineTo(outputNodes[j].x, outputNodes[j].y + nodeSize / 2);
            ctx.stroke();
        }
    }

    // 节点 - 根据激活度着色
    if (activations) {
        // 输入节点
        for (let i = 0; i < inputNodes.length; i++) {
            const activation = clamp01(activations.inputs && activations.inputs[i]);
            const intensity = Math.floor(activation * 255);
            ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
            ctx.fillRect(inputNodes[i].x, inputNodes[i].y, nodeSize, nodeSize);
        }
        
        // 隐藏层节点
        for (let i = 0; i < hiddenNodes.length; i++) {
            const activation = clamp01(activations.hidden && activations.hidden[i]);
            const intensity = Math.floor(activation * 255);
            ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
            ctx.fillRect(hiddenNodes[i].x, hiddenNodes[i].y, nodeSize, nodeSize);
        }
        
        // 输出节点 - 最大值为粉色渐变，其他为天蓝色
        // 找到最大值的索引
        let maxIndex = 0;
        let maxValue = clamp01(activations.outputs && activations.outputs[0]);
        for (let i = 1; i < outputNodes.length; i++) {
            const value = clamp01(activations.outputs && activations.outputs[i]);
            if (value > maxValue) {
                maxValue = value;
                maxIndex = i;
            }
        }
        
        for (let i = 0; i < outputNodes.length; i++) {
            const activation = clamp01(activations.outputs && activations.outputs[i]);
            
            if (i === maxIndex) {
                // 最大值输出节点：从 #f5abb9 到 #ffffff 的插值
                const baseR = 0xf5; // 245
                const baseG = 0xab; // 171  
                const baseB = 0xb9; // 185

                const r = Math.floor(baseR + (255 - baseR) * (1 - activation));
                const g = Math.floor(baseG + (255 - baseG) * (1 - activation));
                const b = Math.floor(baseB + (255 - baseB) * (1 - activation));

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            } else {
                const baseR = 0x5b; // 91
                const baseG = 0xcf; // 207
                const baseB = 0xfa; // 250
                
                const r = Math.floor(baseR + (255 - baseR) * (1 - activation));
                const g = Math.floor(baseG + (255 - baseG) * (1 - activation));
                const b = Math.floor(baseB + (255 - baseB) * (1 - activation));

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            }
            
            ctx.globalAlpha = 1.0;
            ctx.fillRect(outputNodes[i].x, outputNodes[i].y, nodeSize, nodeSize);
        }
        ctx.globalAlpha = 1.0; // 重置透明度
        
    } else {
        // 默认颜色
        ctx.fillStyle = '#535353';
        for (let node of inputNodes) ctx.fillRect(node.x, node.y, nodeSize, nodeSize);
        ctx.fillStyle = '#757575';
        for (let node of hiddenNodes) ctx.fillRect(node.x, node.y, nodeSize, nodeSize);
        ctx.fillStyle = '#999999';
        for (let node of outputNodes) ctx.fillRect(node.x, node.y, nodeSize, nodeSize);
    }

    ctx.restore();
}

// 绘制预览恐龙身体
function drawPreviewDinoBody(ctx, x, y, color, isJumping = false, isCrouching = false, isDead = false) {
    // 恐龙的基本形状（类似Google Dino）
    ctx.fillStyle = color;
    
    if (isCrouching) {
        // 蹲下状态 - 更扁平的形状
        // 头部（向前伸）
        ctx.fillRect(x + 25, y + 5, 22, 15);
        
        // 眼睛
        ctx.fillStyle = 'white';
        ctx.fillRect(x + 33, y + 8, 6, 4);
        ctx.fillStyle = 'black';
        ctx.fillRect(x + 35, y + 9, 2, 2);
        
        // 嘴部
        ctx.fillStyle = color;
        ctx.fillRect(x + 47, y + 12, 2, 3);
        
        // 身体（压扁）
        ctx.fillRect(x + 6, y + 15, 35, 10);
        
        // 腿部（贴地）
        ctx.fillRect(x + 10, y + 20, 8, 5);
        ctx.fillRect(x + 25, y + 20, 8, 5);
        
        // 手臂（向前）
        ctx.fillRect(x + 5, y + 17, 6, 4);
        ctx.fillRect(x + 35, y + 17, 6, 4);
        
    } else {
        // 正常状态
        // 头部
        ctx.fillRect(x + 22, y, 22, 22);
        
        // 眼睛
        ctx.fillStyle = 'white';
        ctx.fillRect(x + 30, y + 6, 6, 6);
        ctx.fillStyle = 'black';
        ctx.fillRect(x + 32, y + 8, 2, 2);
        
        // 嘴部
        ctx.fillStyle = color;
        ctx.fillRect(x + 44, y + 10, 2, 4);
        
        // 身体
        ctx.fillRect(x + 6, y + 22, 30, 25);
        
        // 尾巴
        ctx.fillRect(x, y + 25, 8, 8);
        
        // 腿部（静态）
        ctx.fillRect(x + 14, y + 40, 6, 7);
        ctx.fillRect(x + 26, y + 40, 6, 7);
        
        // 手臂
        if (isJumping) {
            // 跳跃时手臂向上
            ctx.fillRect(x + 8, y + 26, 4, 8);
            ctx.fillRect(x + 32, y + 26, 4, 8);
        } else {
            // 正常手臂
            ctx.fillRect(x + 8, y + 30, 4, 6);
            ctx.fillRect(x + 32, y + 30, 4, 6);
        }
    }
    
    // 如果是死亡状态，绘制X眼睛
    if (isDead) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        
        const eyeX = x + 30;
        const eyeY = y + 6;
        
        // 绘制X
        ctx.beginPath();
        ctx.moveTo(eyeX, eyeY);
        ctx.lineTo(eyeX + 6, eyeY + 6);
        ctx.moveTo(eyeX + 6, eyeY);
        ctx.lineTo(eyeX, eyeY + 6);
        ctx.stroke();
    }
}

// 更新遗传树可视化
function updateNetworkVisualization() {
    if (game.gameMode !== 'AI' || game.aiMode !== 'GA') return;
    
    const canvas = dom.geneticTreeCanvas;
    if (!canvas) return;

    ensureCanvasCSSSize(canvas, 600, 300);

    const stats = game.trainer.getStats();
    if (!stats || !stats.lineageHistory || stats.lineageHistory.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 600;
    const displayHeight = rect.height || 300;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    drawGeneticTree(ctx, stats, displayWidth, displayHeight);
}

// 绘制遗传树
function drawGeneticTree(ctx, stats, canvasWidth, canvasHeight) {
    const padding = 20;
    const generations = stats.lineageHistory;
    const colWidth = Math.max(20, Math.floor((canvasWidth - padding * 2) / stats.populationSize));
    const rowHeight = Math.max(18, Math.floor((canvasHeight - padding * 2) / (generations.length + 1)));
    const startX = padding;
    const startY = padding;

    ctx.imageSmoothingEnabled = false;

    // 绘制网格点
    ctx.fillStyle = '#e0e0e0';
    for (let c = 0; c < stats.populationSize; c++) {
        const x = startX + Math.floor(colWidth * (c + 0.5));
        for (let r = 0; r <= generations.length; r++) {
            ctx.fillRect(x, startY + Math.floor(rowHeight * r), 1, 1);
        }
    }

    const nodeSize = 4;
    for (let gen = 0; gen < generations.length; gen++) {
        const lineage = generations[gen];
        for (let i = 0; i < lineage.length; i++) {
            const nodeX = startX + Math.floor(colWidth * (i + 0.5)) - Math.floor(nodeSize / 2);
            const nodeY = startY + Math.floor(rowHeight * gen) - Math.floor(nodeSize / 2);

            ctx.fillStyle = '#535353';
            ctx.fillRect(nodeX, nodeY, nodeSize, nodeSize);

            if (gen < generations.length - 1) {
                const child = generations[gen + 1][i];
                if (!child || !child.from || child.from[0] == null) continue;
                
                const pIndex = child.from[0];
                const x1 = startX + Math.floor(colWidth * (pIndex + 0.5));
                const y1 = startY + Math.floor(rowHeight * gen);
                const x2 = startX + Math.floor(colWidth * (i + 0.5));
                const y2 = startY + Math.floor(rowHeight * (gen + 1));

                const colors = {elite: '#757575', crossover: '#999999'};
                drawPixelLine(ctx, x1, y1, x2, y2, colors[child.method] || '#535353');

                if (child.method === 'crossover' && child.from[1] != null) {
                    const x1b = startX + Math.floor(colWidth * (child.from[1] + 0.5));
                    drawPixelLine(ctx, x1b, y1, x2, y2, '#b0b0b0');
                }
            }
        }
    }
}

// 绘制像素化直线
function drawPixelLine(ctx, x1, y1, x2, y2, color) {
    ctx.fillStyle = color;
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    let x = x1;
    let y = y1;
    
    while (true) {
        ctx.fillRect(x, y, 1, 1);
        
        if (x === x2 && y === y2) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}

// 设置参数滑动条
function setupParameterControls() {
    Object.keys(SLIDER_INPUT_FIELDS).forEach((key) => {
        const slider = dom[SLIDER_INPUT_FIELDS[key]];
        if (!slider) return;
        slider.addEventListener('input', function() {
            handleSliderChange(key, parseFloat(this.value), true);
        });

        const setActive = (active) => {
            sliderActiveState[key] = active;
            if (!active) {
                persistSliderValues(game.aiMode);
            }
        };

        slider.addEventListener('pointerdown', () => setActive(true));
        slider.addEventListener('pointerup', () => setActive(false));
        slider.addEventListener('pointercancel', () => setActive(false));
        slider.addEventListener('mousedown', () => setActive(true));
        slider.addEventListener('mouseup', () => setActive(false));
        slider.addEventListener('touchstart', () => setActive(true), { passive: true });
        slider.addEventListener('touchend', () => setActive(false));
        slider.addEventListener('change', () => setActive(false));
    });
}
