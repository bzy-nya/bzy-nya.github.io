// 全局变量
let game;
let isEvolutionRunning = false;
let currentSpeedMultiplier = 1;
let networkVisualization;

// 初始化游戏
document.addEventListener('DOMContentLoaded', function() {
    console.log('开始初始化游戏...');
    
    // 初始化SVG图标
    initSVGIcons();
    
    // 创建游戏实例
    game = new DinoGame('gameCanvas');
    
    // 初始化神经网络可视化
    initNetworkVisualization();
    
    // 设置控制按钮
    setupControls();
    
    // 设置参数滑动条
    setupParameterControls();
    
    // 开始UI更新循环
    startUIUpdateLoop();
    
    // 添加导出按钮事件监听器
    document.addEventListener('keydown', function(e) {
        if (e.key === 'e' || e.key === 'E') {
            exportEvolutionData();
        }
    });
    
    console.log('Dino进化算法游戏已初始化');
});

// 初始化SVG图标
function initSVGIcons() {
    // 添加恐龙图标到标题
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        mainTitle.innerHTML = createSVGIcon('dino', 'title-icon') + ' ' + mainTitle.textContent;
    }
    
    // 添加图标到统计面板标题
    const evolutionTitle = document.getElementById('evolution-title');
    if (evolutionTitle) {
        evolutionTitle.innerHTML = createSVGIcon('evolution', 'panel-icon') + ' ' + evolutionTitle.textContent;
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

// 设置控制按钮
function setupControls() {
    // 开始进化按钮
    document.getElementById('startBtn').addEventListener('click', function() {
        if (!isEvolutionRunning) {
            startEvolution();
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

// 开始进化
function startEvolution() {
    game.startEvolution();
    isEvolutionRunning = true;
    
    // 更新按钮状态
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('manualBtn').disabled = true;
    
    console.log('开始进化算法训练');
}

// 开始手动游戏
function startManualGame() {
    game.startManualGame();
    isEvolutionRunning = false;
    
    // 更新按钮状态
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('manualBtn').disabled = true;
    
    console.log('开始手动游戏');
}

// 切换暂停状态
function togglePause() {
    game.togglePause();
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (game.isPaused) {
        pauseBtn.textContent = '继续';
    } else {
        pauseBtn.textContent = '暂停';
    }
}

// 重置游戏
function resetGame() {
    game.reset();
    isEvolutionRunning = false;
    currentSpeedMultiplier = 1;
    
    // 重置按钮状态
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = '暂停';
    document.getElementById('manualBtn').disabled = false;
    document.getElementById('speedBtn').textContent = '速度: 1x';
    
    // 重置统计显示
    updateStatsDisplay();
    
    console.log('游戏已重置');
}

// 循环切换速度
function cycleSpeed() {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(currentSpeedMultiplier);
    const nextIndex = (currentIndex + 1) % speeds.length;
    
    currentSpeedMultiplier = speeds[nextIndex];
    game.setSpeedMultiplier(currentSpeedMultiplier);
    
    document.getElementById('speedBtn').textContent = `速度: ${currentSpeedMultiplier}x`;
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
    const geneticStats = game.getGeneticStats();
    
    // 进化统计
    document.getElementById('generation').textContent = stats.currentGeneration;
    document.getElementById('alive').textContent = stats.aliveCount;
    document.getElementById('highScore').textContent = Math.floor(stats.highScore);
    document.getElementById('avgScore').textContent = Math.floor(stats.averageScore);
    
    // 世代进度
    const progress = game.gameMode === 'AI' ? 
        ((geneticStats.populationSize - stats.aliveCount) / geneticStats.populationSize * 100) : 0;
    document.getElementById('generationProgress').style.width = progress + '%';
    
    // 最佳个体 - 只在AI模式下显示  
    if (game.gameMode === 'AI' && game && game.dinos && game.dinos.length > 0) {
        // 找到当前适应度最高的恐龙，优先选择活着的
        let bestDino = null;
        
        // 首先尝试从活着的恐龙中选择
        const aliveDinos = game.dinos.filter(dino => !dino.isDead);
        if (aliveDinos.length > 0) {
            bestDino = aliveDinos.reduce((best, current) => {
                return current.fitness > best.fitness ? current : best;
            });
        } else {
            // 如果没有活着的，从所有恐龙中选择
            bestDino = game.dinos.reduce((best, current) => {
                return current.fitness > best.fitness ? current : best;
            });
        }
        
        if (bestDino) {
            // 绘制合并的最佳个体预览（恐龙+神经网络）
            const gameSpeed = game.gameSpeed || 8;
            const obstacles = game.obstacleManager ? game.obstacleManager.getObstacles() : [];
            drawBestIndividualPreview(bestDino, gameSpeed, obstacles);
        }
    }
    
    // 算法参数（保持滑动条同步）
    document.getElementById('populationSize').textContent = geneticStats.populationSize;
    document.getElementById('mutationRate').textContent = geneticStats.mutationRate.toFixed(3);
    document.getElementById('crossoverRate').textContent = geneticStats.crossoverRate.toFixed(2);
    document.getElementById('elitismCount').textContent = geneticStats.elitismCount;
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

// 绘制最佳个体预览（恐龙+神经网络合并）
function drawBestIndividualPreview(bestDino, gameSpeed, obstacles) {
    const canvas = document.getElementById('bestIndividualCanvas');
    if (!canvas || !bestDino) return;

    // 将默认高度改为200，避免布局未完成时被锁到120px
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

    // 左：恐龙区域 右：网络区域
    const dinoWidth = Math.floor(displayWidth * 0.4);
    const networkWidth = displayWidth - dinoWidth;

    // 恐龙垂直居中
    const dinoSize = 1.5;
    const scaledDinoWidth = Math.round(44 * dinoSize);
    const scaledDinoHeight = Math.round(47 * dinoSize);
    const dinoX = Math.floor((dinoWidth - scaledDinoWidth) / 2);
    const dinoY = Math.floor((displayHeight - scaledDinoHeight) / 2);

    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.scale(dinoSize, dinoSize);
    
    // 绘制恐龙，显示当前动作状态
    drawPreviewDinoBody(ctx, dinoX / dinoSize, dinoY / dinoSize, bestDino.color, bestDino.isJumping, bestDino.isCrouching, bestDino.isDead);
    ctx.restore();

    // 神经网络在整个画布高度内垂直居中（而不是子区域），更容易和恐龙对齐
    if (bestDino.brain) {
        const networkPaddingX = 6;
        
        // 获取当前神经网络的激活值
        let networkActivations = null;
        if (gameSpeed && obstacles) {
            networkActivations = getBestDinoNetworkActivations(bestDino, gameSpeed, obstacles);
        }
        
        drawDinoStyleNetwork(
            ctx,
            bestDino.brain,
            dinoWidth + networkPaddingX,
            0, // 从顶部开始
            Math.max(0, networkWidth - networkPaddingX * 2),
            displayHeight, // 使用全高以保证垂直居中
            networkActivations // 传递激活值
        );
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
    // 更宽的层间距，拉开布局
    const layerSpacing = Math.max(24, Math.floor(width * 0.42));

    const inputNodes = [];
    const hiddenNodes = [];
    const outputNodes = [];

    // 输入层（7个）- 高度、速度、距离、障碍物高度、障碍物宽度、障碍物下边缘、游戏速度
    const inputCount = 7;
    const inputSpacing = Math.floor(height / 7.5); // 调整间距
    const inputStartY = Math.floor((height - inputSpacing * (inputCount - 1)) / 2);
    for (let i = 0; i < inputCount; i++) {
        inputNodes.push({
            x: Math.floor(startX + nodeSize),
            y: Math.floor(startY + inputStartY + inputSpacing * i)
        });
    }

    // 隐藏层（12个）- 更新为新架构
    const hiddenCount = 12;
    const hiddenSpacing = Math.floor(height / 13);
    const hiddenStartY = Math.floor((height - hiddenSpacing * (hiddenCount - 1)) / 2);
    for (let i = 0; i < hiddenCount; i++) {
        hiddenNodes.push({
            x: Math.floor(startX + layerSpacing),
            y: Math.floor(startY + hiddenStartY + hiddenSpacing * i)
        });
    }

    // 输出层（3个）- 跳跃、不动、蹲下
    const outputCount = 3;
    const outputSpacing = Math.floor(height / 4);
    const outputStartY = Math.floor((height - outputSpacing * (outputCount - 1)) / 2);
    for (let i = 0; i < outputCount; i++) {
        outputNodes.push({
            x: Math.floor(startX + layerSpacing * 2),
            y: Math.floor(startY + outputStartY + outputSpacing * i)
        });
    }

    // 输入->隐藏 连接（跳过极弱权重）
    for (let i = 0; i < inputNodes.length; i++) {
        for (let j = 0; j < hiddenNodes.length; j++) {
            const weight = brain.weightsInputHidden[j][i];
            const absWeight = Math.abs(weight);
            if (absWeight < weightThreshold) continue;
            const grayValue = Math.floor(absWeight * 128 + 96); // 稍淡
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
            const weight = brain.weightsHiddenOutput[j][i];
            const absWeight = Math.abs(weight);
            if (absWeight < weightThreshold) continue;
            const grayValue = Math.floor(absWeight * 128 + 96);
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
            const activation = activations.inputs[i] || 0;
            const intensity = Math.floor(activation * 255);
            ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
            ctx.fillRect(inputNodes[i].x, inputNodes[i].y, nodeSize, nodeSize);
        }
        
        // 隐藏层节点
        for (let i = 0; i < hiddenNodes.length; i++) {
            const activation = activations.hidden[i] || 0;
            const intensity = Math.floor(activation * 255);
            ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
            ctx.fillRect(hiddenNodes[i].x, hiddenNodes[i].y, nodeSize, nodeSize);
        }
        
        // 输出节点 - 最大值为粉色渐变，其他为天蓝色
        const actions = ['jump', 'idle', 'crouch'];
        
        // 找到最大值的索引
        let maxIndex = 0;
        let maxValue = activations.outputs[0] || 0;
        for (let i = 1; i < outputNodes.length; i++) {
            const value = activations.outputs[i] || 0;
            if (value > maxValue) {
                maxValue = value;
                maxIndex = i;
            }
        }
        
        for (let i = 0; i < outputNodes.length; i++) {
            const activation = activations.outputs[i] || 0;
            
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

// 初始化遗传树可视化
function initNetworkVisualization() {
    const canvas = document.getElementById('geneticTreeCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // 首次固定CSS显示尺寸
    ensureCanvasCSSSize(canvas, 600, 300);

    networkVisualization = {
        canvas: canvas,
        ctx: ctx,
        generations: [],
        maxGenerations: 10
    };
}

// 更新遗传树可视化
function updateNetworkVisualization() {
    if (!game || game.gameMode !== 'AI') return;

    const canvas = document.getElementById('geneticTreeCanvas');
    if (!canvas) return;

    // 首次固定CSS显示尺寸，避免正反馈放大
    ensureCanvasCSSSize(canvas, 600, 300);

    const ctx = canvas.getContext('2d');
    const stats = game.getGeneticStats();

    // 获取Canvas的CSS显示尺寸
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 600;  // 默认宽度
    const displayHeight = rect.height || 300; // 默认高度

    // 设置Canvas高分辨率（仅设置绘图缓冲大小，不改CSS尺寸）
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(displayWidth * dpr);
    const targetH = Math.round(displayHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    // 重置变换矩阵，防止累积缩放
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // 清空画布
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // 绘制遗传树
    drawGeneticTree(ctx, stats, displayWidth, displayHeight);
}

// 绘制遗传树
function drawGeneticTree(ctx, stats, canvasWidth, canvasHeight) {
    const padding = 20;
    const colWidth = Math.max(20, Math.floor((canvasWidth - padding * 2) / Math.max(1, stats.populationSize)));
    const rowHeight = Math.max(18, Math.floor((canvasHeight - padding * 2) / Math.max(2, stats.lineageHistory.length + 1)));
    const startX = padding;
    const startY = padding;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const generations = stats.lineageHistory;
    if (!generations || generations.length === 0) {
        // 没有谱系信息，保持空
        return;
    }

    // 每一列对应一个个体索引（保持代内的索引位置），每一行对应一代
    // 在行y画方块，在行y与y+1画连线

    // 绘制网格点（淡灰）
    ctx.fillStyle = '#e0e0e0';
    for (let c = 0; c < stats.populationSize; c++) {
        const x = startX + Math.floor(colWidth * (c + 0.5));
        for (let r = 0; r <= generations.length; r++) {
            const y = startY + Math.floor(rowHeight * r);
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // 颜色
    const nodeColor = '#535353';
    const eliteColor = '#757575';
    const crossColor = '#999999';

    const nodeSize = 4;

    // 绘制节点和边
    for (let gen = 0; gen < generations.length; gen++) {
        const lineage = generations[gen];
        for (let i = 0; i < lineage.length; i++) {
            const nodeX = startX + Math.floor(colWidth * (i + 0.5)) - Math.floor(nodeSize / 2);
            const nodeY = startY + Math.floor(rowHeight * gen) - Math.floor(nodeSize / 2);

            // 节点
            ctx.fillStyle = nodeColor;
            ctx.fillRect(nodeX, nodeY, nodeSize, nodeSize);

            // 到下一代连线
            if (gen < generations.length - 1) {
                const child = generations[gen + 1][i];
                if (!child) continue;
                const from = child.from;
                const method = child.method;
                if (from && from[0] != null) {
                    const pIndex = from[0];
                    const x1 = startX + Math.floor(colWidth * (pIndex + 0.5));
                    const y1 = startY + Math.floor(rowHeight * gen);
                    const x2 = startX + Math.floor(colWidth * (i + 0.5));
                    const y2 = startY + Math.floor(rowHeight * (gen + 1));

                    const color = method === 'elite' ? eliteColor : (method === 'crossover' ? crossColor : nodeColor);
                    drawPixelLine(ctx, x1, y1, x2, y2, color);

                    // 若交叉且有第二父母，画一条更浅的线
                    if (method === 'crossover' && from[1] != null) {
                        const p2 = from[1];
                        const x1b = startX + Math.floor(colWidth * (p2 + 0.5));
                        drawPixelLine(ctx, x1b, y1, x2, y2, '#b0b0b0');
                    }
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
    // 种群大小
    const populationSlider = document.getElementById('populationSlider');
    populationSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        document.getElementById('populationSize').textContent = value;
        if (game && game.geneticAlgorithm) {
            game.geneticAlgorithm.populationSize = value;
        }
    });
    
    // 变异率
    const mutationSlider = document.getElementById('mutationSlider');
    mutationSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        document.getElementById('mutationRate').textContent = value.toFixed(3);
        if (game && game.geneticAlgorithm) {
            game.geneticAlgorithm.mutationRate = value;
        }
    });
    
    // 交叉率
    const crossoverSlider = document.getElementById('crossoverSlider');
    crossoverSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        document.getElementById('crossoverRate').textContent = value.toFixed(1);
        if (game && game.geneticAlgorithm) {
            game.geneticAlgorithm.crossoverRate = value;
        }
    });
    
    // 精英保留
    const elitismSlider = document.getElementById('elitismSlider');
    elitismSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        document.getElementById('elitismCount').textContent = value;
        if (game && game.geneticAlgorithm) {
            game.geneticAlgorithm.elitismCount = value;
        }
    });
}

// 导出数据功能
function exportEvolutionData() {
    const stats = game.getGeneticStats();
    const data = {
        timestamp: new Date().toISOString(),
        generation: stats.generation,
        bestFitness: stats.bestFitness,
        averageFitness: stats.averageFitness,
        history: stats.history,
        parameters: {
            populationSize: stats.populationSize,
            mutationRate: stats.mutationRate,
            crossoverRate: stats.crossoverRate,
            elitismCount: stats.elitismCount
        }
    };
}

// 获取最佳恐龙的神经网络激活值
function getBestDinoNetworkActivations(bestDino, gameSpeed, obstacles) {
    if (!bestDino.brain) return null;
    
    // 复制恐龙的makeDecision逻辑来获取输入
    let nearestObstacle = null;
    let minDistance = Infinity;
    
    for (let obstacle of obstacles) {
        const frontDistance = (obstacle.x) - (bestDino.x + bestDino.width);
        if (frontDistance > 0 && frontDistance < minDistance) {
            minDistance = frontDistance;
            nearestObstacle = obstacle;
        }
    }
    
    // 准备神经网络输入
    const inputs = [];
    
    // 输入1: 恐龙当前高度
    const maxJumpHeight = 120;
    const heightAboveGround = Math.max(0, bestDino.groundY - (bestDino.y + bestDino.height));
    const normalizedY = Math.max(0, Math.min(1, heightAboveGround / maxJumpHeight));
    inputs.push(normalizedY);
    
    // 输入2: 垂直速度
    const normalizedVelocity = Math.max(0, Math.min(1, (bestDino.velocityY + 15) / 30));
    inputs.push(normalizedVelocity);
    
    // 输入3: 到最近障碍物的水平距离
    if (nearestObstacle) {
        const normalizedDistance = Math.max(0, Math.min(1, minDistance / 600));
        inputs.push(normalizedDistance);
    } else {
        inputs.push(1);
    }
    
    // 输入4: 最近障碍物高度
    if (nearestObstacle) {
        const normalizedHeight = Math.max(0, Math.min(1, nearestObstacle.height / 80));
        inputs.push(normalizedHeight);
    } else {
        inputs.push(0);
    }
    
    // 输入5: 最近障碍物宽度
    if (nearestObstacle) {
        const normalizedWidth = Math.max(0, Math.min(1, nearestObstacle.width / 100));
        inputs.push(normalizedWidth);
    } else {
        inputs.push(0);
    }
    
    // 输入6: 最近障碍物下边缘高度（与恐龙逻辑一致）
    if (nearestObstacle) {
        if (nearestObstacle.isFlying) {
            // 飞行障碍物：计算下边缘距地面的高度
            const obstacleBottom = nearestObstacle.y + nearestObstacle.height;
            const groundLevel = bestDino.groundY;
            const bottomHeightAboveGround = Math.max(0, groundLevel - obstacleBottom);
            const normalizedBottomHeight = Math.max(0, Math.min(1, bottomHeightAboveGround / 80));
            inputs.push(normalizedBottomHeight);
        } else {
            // 地面障碍物：使用障碍物高度作为特征
            const normalizedObstacleHeight = Math.max(0, Math.min(1, nearestObstacle.height / 50));
            inputs.push(normalizedObstacleHeight);
        }
    } else {
        inputs.push(0);
    }
    
    // 输入7: 游戏速度
    const normalizedSpeed = Math.max(0, Math.min(1, (gameSpeed - 6) / 7));
    inputs.push(normalizedSpeed);
    
    // 计算神经网络的所有层激活值
    const activations = bestDino.brain.getDetailedActivations(inputs);
    return activations;
}
