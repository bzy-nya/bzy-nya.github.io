// 组件路由器实例
let Router = null;

// 初始化组件路由系统
function initRouter() {
    Router = new ComponentRouter();
    
    // 配置所有路由 - 纯组件思维，统一管理所有页面元素
    Router
        // 首页：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 首页内容 + 底部
        .register('/', {
            components: ['topbar', 'sidebar', 'profile-card', 'links-card', 'main-content', 'home', 'footer'],
            handler: async ({ router }) => {
                setHeaderNavigation('home');
            }
        })
        
        // 博客首页：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 博客内容 + 博客导航 + 底部
        .register('/blog', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'blog', 'blog-navigation', 'footer'],
            async beforeEnter({ router }) {
                await tryInitBlogSystem();
            },
            async handler({ router }) {
                await window.blogSystem.showHome();
                setHeaderNavigation('blog');
            }
        })
        
        // 博客文章：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 博客内容 + 文章目录 + 底部
        .register('/post/:id', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'blog', 'article-toc-card', 'footer'],
            async beforeEnter({ router }) {
                await tryInitBlogSystem();
            },
            async handler({ params, router }) {
                await window.blogSystem.showPost(params.id);
                setHeaderNavigation('blog');
            }
        })
        
        // Fun页面：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + Fun内容 + 底部
        .register('/fun', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'fun', 'footer'],
            handler: async ({ router }) => {
                setHeaderNavigation('fun');
            }
        });
    
    window.Router = Router; // 全局暴露路由器实例
    console.log('[router] Initialization complete');
}

// Initialize navigation system
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');

    // Add click listeners
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pageId = btn.getAttribute('data-page');
            
            e.preventDefault();
            
            // 使用组件路由器导航
            if (pageId === 'home') {
                Router.navigate('');
            } else if (pageId === 'blog') {
                Router.navigate('blog');
            } else if (pageId === 'fun') {
                Router.navigate('fun');
            }
        });
    });
}

// Background cats mouse follow effect
function initCatAnimation() {
    const cats = Array.from(document.querySelectorAll('.cat-bg'));
    let mx = 0, my = 0;
    
    document.addEventListener('mousemove', (e) => { 
        mx = e.clientX; 
        my = e.clientY; 
    });
    
    setInterval(() => {
        cats.forEach((el, i) => {
            const strength = 0.008 + i * 0.002;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const deltaX = (mx - centerX) * strength;
            const deltaY = (my - centerY) * strength;
            el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        });
    }, 100);
}

// Avatar click interaction
function initAvatarInteraction() {
    const avatar = document.getElementById('avatar-face');
    let isClicked = false;
    
    avatar?.addEventListener('click', () => {
        isClicked = !isClicked;
        avatar.style.transform = isClicked ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)';
        setTimeout(() => {
            avatar.style.transform = 'scale(1) rotate(0deg)';
        }, 200);
    });
}

// Function to set navigation state
function setHeaderNavigation(activePageId) {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[data-page="${activePageId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Theme switching functionality
function initThemeSwitcher() {
    const themeBtn = document.getElementById('theme-btn');
    const themeIcon = themeBtn.querySelector('.theme-icon use');
    const body = document.body;
    
    // Function to detect system theme preference
    function getSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Check if it's Christmas season (December 15 - December 31)
    function isChristmasSeason() {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const day = now.getDate();
        return month === 11 && day >= 15; // December (11) and day >= 15
    }
    
    // Check if it's Christmas season first
    let currentTheme;
    if (isChristmasSeason()) {
        // During Christmas season, always use Christmas theme
        currentTheme = 'christmas';
    } else {
        // Outside Christmas season, use saved preference or system theme
        currentTheme = localStorage.getItem('theme') || getSystemTheme();
    }
    console.log('[theme] Initial theme:', currentTheme);
    
    // 只允许代码调用的 Halloween 主题切换
    window.setHalloweenTheme = function() {
        body.setAttribute('data-theme', 'halloween');
        localStorage.setItem('theme', 'halloween');
        if (themeIcon) {
            themeIcon.setAttribute('href', '#px-pumpkin');
        }
        themeBtn.title = 'Happy Halloween!';
        console.log('🎃 Halloween theme activated!');
    }

    // 只允许代码调用的 Christmas 主题切换
    window.setChristmasTheme = function() {
        body.setAttribute('data-theme', 'christmas');
        localStorage.setItem('theme', 'christmas');
        if (themeIcon) {
            themeIcon.setAttribute('href', '#px-tree');
        }
        themeBtn.title = 'Merry Christmas! 🎄';
        
        // 替换背景图标为圣诞装饰
        const bgIcons = ['#px-snowflake', '#px-bell', '#px-gift', '#px-tree'];
        const catBgs = document.querySelectorAll('.cat-bg use');
        catBgs.forEach((use, i) => {
            use.setAttribute('href', bgIcons[i % bgIcons.length]);
        });
        
        console.log('🎄🎅❄️ Christmas theme activated!');
        
        // 启动圣诞彩蛋效果
        startChristmasEasterEggs();
    }
    
    // Christmas Easter Eggs
    let christmasInterval = null;
    let clickSparkleEnabled = false;
    let clickCount = 0;
    let nextFireworkClick = Math.floor(Math.random() * 5) + 3; // 3-7次点击后触发烟花
    
    function startChristmasEasterEggs() {
        // 停止之前的效果
        stopChristmasEasterEggs();
        
        // 启动雪花飘落效果（每2-4秒一片雪花）
        christmasInterval = setInterval(() => {
            createFallingSnowflake();
        }, 2000 + Math.random() * 2000);
        
        // 启动点击火花效果
        clickSparkleEnabled = true;
        clickCount = 0;
        nextFireworkClick = Math.floor(Math.random() * 5) + 3;
        document.addEventListener('click', christmasClickHandler);
        
        // 启动网格光源效果
        document.addEventListener('mousemove', updateMouseLight);
        initGridLightEffect();
    }
    
    // 鼠标位置追踪
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    
    function updateMouseLight(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
    
    // 柏林噪声生成器
    function perlinNoise(x, y, seed) {
        // 简单的伪随机噪声函数
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        
        const hash = (x, y) => {
            let h = seed + x * 374761393 + y * 668265263;
            h = (h ^ (h >> 13)) * 1274126177;
            return (h ^ (h >> 16)) & 255;
        };
        
        const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
        const lerp = (a, b, t) => a + t * (b - a);
        
        const u = fade(xf);
        const v = fade(yf);
        
        const a = hash(X, Y);
        const b = hash(X + 1, Y);
        const c = hash(X, Y + 1);
        const d = hash(X + 1, Y + 1);
        
        return lerp(
            lerp(a, b, u),
            lerp(c, d, u),
            v
        ) / 255;
    }
    
    // 网格光源效果
    let lightAnimationFrame = null;
    let gridCanvas = null;
    let gridCtx = null;
    
    function initGridLightEffect() {
        // 创建canvas作为光源覆盖层（不隐藏原始网格）
        gridCanvas = document.createElement('canvas');
        gridCanvas.className = 'bg-grid-canvas';
        
        // 设置canvas尺寸 - 使用8px网格对齐原始背景
        const pixelSize = 8; // 与CSS var(--px)保持一致
        gridCanvas.width = Math.ceil(window.innerWidth / pixelSize);
        gridCanvas.height = Math.ceil(window.innerHeight / pixelSize);
        gridCanvas.style.width = window.innerWidth + 'px';
        gridCanvas.style.height = window.innerHeight + 'px';
        gridCanvas.style.imageRendering = 'pixelated';
        
        gridCtx = gridCanvas.getContext('2d');
        
        // 添加到body，层叠在bg-grid之上
        document.body.appendChild(gridCanvas);
        
        // 启动动画
        animateGridLight();
        
        // 窗口大小变化时重新调整
        window.addEventListener('resize', () => {
            gridCanvas.width = Math.ceil(window.innerWidth / pixelSize);
            gridCanvas.height = Math.ceil(window.innerHeight / pixelSize);
            gridCanvas.style.width = window.innerWidth + 'px';
            gridCanvas.style.height = window.innerHeight + 'px';
        });
    }
    
    function animateGridLight() {
        if (!gridCanvas || !gridCtx) return;
        
        const time = Date.now() / 1000;
        const w = gridCanvas.width;
        const h = gridCanvas.height;
        const pixelSize = window.innerWidth / w;
        
        gridCtx.clearRect(0, 0, w, h);
        
        // 计算鼠标在网格中的位置
        const mouseGridX = mouseX / pixelSize;
        const mouseGridY = mouseY / pixelSize;
        
        // 绘制每个网格 - pixel shader方式处理所有像素
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                // 计算与鼠标的距离
                const dx = x - mouseGridX;
                const dy = y - mouseGridY;
                const distance = Math.pow(Math.abs(dx * dx * dx) + Math.abs(dy * dy * dy), 1/3); // 立方根距离
                
                // 基于距离的亮度衰减（不设硬性边界，自然衰减）
                const falloff = 15; // 衰减速度（更小=梯度更陡）
                const distanceFactor = 1 / (1 + distance / falloff);
                
                // 柏林噪声（随时间和位置变化）
                const noiseValue = perlinNoise(
                    x * 0.1 + time * 0.5,
                    y * 0.1 + time * 0.3,
                    12345
                );
                
                // 多层噪声叠加
                const noise2 = perlinNoise(
                    x * 0.05 + time * 0.8,
                    y * 0.05 + time * 0.6,
                    54321
                );
                
                // 综合计算亮度
                let brightness = distanceFactor * (0.8 + noiseValue * 0.1 + noise2 * 0.1);
                brightness = Math.max(0, Math.min(1, brightness));
                brightness = Math.floor(brightness * 20) / 20; // 保留一位小数
                if (brightness > 0.01) {
                    // 根据距离归一化选择颜色（中心金色，外层红色）
                    const normalizedDist = distance / 40; // 颜色过渡范围
                    let r, g, b;
                    
                    if (normalizedDist < 0.4) {
                        // 中心：金色
                        r = 244; g = 162; b = 97;
                    } else if (normalizedDist < 0.7) {
                        // 过渡
                        const t = (normalizedDist - 0.4) / 0.3;
                        r = Math.floor(244 + (230 - 244) * t);
                        g = Math.floor(162 + (57 - 162) * t);
                        b = Math.floor(97 + (70 - 97) * t);
                    } else {
                        // 外层：红色
                        r = 230; g = 57; b = 70;
                    }
                    
                    const alpha = brightness * 1;
                    gridCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    gridCtx.fillRect(x, y, 1, 1);
                }
            }
        }
        
        lightAnimationFrame = requestAnimationFrame(animateGridLight);
    }
    
    // 圣诞祝福消息
    const christmasMessages = [
        '🎄 Merry Christmas!',
        '❄️ Let it snow!',
        '🎅 Ho Ho Ho!',
        '⭐ Season\'s Greetings!',
        '🎁 Joy to the world!',
        '🔔 Jingle all the way!',
        '✨ Magic is in the air!',
        '🕯️ Peace on Earth!',
        '🎉 Happy Holidays!',
        '💫 Believe in the magic!'
    ];
    
    function showChristmasMessage() {
        const message = christmasMessages[Math.floor(Math.random() * christmasMessages.length)];
        const messageEl = document.createElement('div');
        messageEl.className = 'christmas-message';
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 4000);
    }
    
    function stopChristmasEasterEggs() {
        if (christmasInterval) {
            clearInterval(christmasInterval);
            christmasInterval = null;
        }
        if (lightAnimationFrame) {
            cancelAnimationFrame(lightAnimationFrame);
            lightAnimationFrame = null;
        }
        clickSparkleEnabled = false;
        document.removeEventListener('click', christmasClickHandler);
        document.removeEventListener('mousemove', updateMouseLight);
        
        // 移除光源canvas覆盖层
        if (gridCanvas) {
            gridCanvas.remove();
            gridCanvas = null;
            gridCtx = null;
        }
        
        // 清除所有现存的彩蛋元素
        document.querySelectorAll('.christmas-snowflake').forEach(el => el.remove());
        document.querySelectorAll('.christmas-sparkle').forEach(el => el.remove());
        document.querySelectorAll('.christmas-message').forEach(el => el.remove());
    }
    
    function createFallingSnowflake() {
        const snowflake = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        snowflake.setAttribute('class', 'christmas-snowflake');
        snowflake.setAttribute('width', '24');
        snowflake.setAttribute('height', '24');
        snowflake.setAttribute('viewBox', '0 0 16 16');
        snowflake.setAttribute('fill', 'currentColor');
        snowflake.style.left = Math.random() * (window.innerWidth - 24) + 'px';
        
        // 随机持续时间 (8-15秒)
        const duration = 8 + Math.random() * 7;
        snowflake.style.animationDuration = duration + 's';
        
        // 创建use元素引用雪花图标
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#px-snowflake');
        snowflake.appendChild(use);
        
        document.body.appendChild(snowflake);
        
        // 动画结束后移除
        setTimeout(() => {
            snowflake.remove();
        }, duration * 1000);
        
        console.log('❄️ Snowflake created');
    }
    
    function christmasClickHandler(e) {
        if (!clickSparkleEnabled) return;
        
        // 不在链接或按钮上触发
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
        
        clickCount++;
        
        // 每10次点击显示祝福消息
        if (clickCount % 10 === 0) {
            showChristmasMessage();
        }
        
        // 检查是否触发烟花彩蛋
        if (clickCount === nextFireworkClick) {
            createFireworkExplosion(e.clientX, e.clientY);
            nextFireworkClick += Math.floor(Math.random() * 5) + 3; // 下一次3-7次点击后
            return;
        }
        
        // 普通火花效果
        for (let i = 0; i < 8; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'christmas-sparkle';
            
            const angle = (i / 8) * 2 * Math.PI;
            const distance = 40 + Math.random() * 30;
            
            sparkle.style.left = e.clientX + 'px';
            sparkle.style.top = e.clientY + 'px';
            sparkle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
            sparkle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
            
            // 随机颜色（红色或金色）
            if (Math.random() > 0.5) {
                sparkle.style.background = 'var(--secondary)';
                sparkle.style.boxShadow = '0 0 10px var(--secondary), 0 0 20px var(--accent)';
            }
            
            document.body.appendChild(sparkle);
            
            // 移除元素
            setTimeout(() => {
                sparkle.remove();
            }, 800);
        }
    }
    
    function createFireworkExplosion(x, y) {
        const particleCount = 30; // 更多粒子
        const colors = ['#e63946', '#f4a261', '#fef6e4', '#2a9d8f', '#e76f51'];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.width = '6px';
            particle.style.height = '6px';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.borderRadius = '50%';
            particle.style.boxShadow = '0 0 8px currentColor';
            
            const angle = (i / particleCount) * 2 * Math.PI;
            const velocity = 150 + Math.random() * 100; // 初始速度
            const gravity = 300; // 重力加速度 px/s²
            const duration = 1.5 + Math.random() * 0.5; // 持续时间
            
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            
            document.body.appendChild(particle);
            
            // 使用requestAnimationFrame实现物理动画
            const startTime = performance.now();
            
            function animate(currentTime) {
                const elapsed = (currentTime - startTime) / 1000; // 转换为秒
                
                if (elapsed >= duration) {
                    particle.remove();
                    return;
                }
                
                // 物理计算: x = x0 + vx*t, y = y0 + vy*t + 0.5*g*t²
                const dx = vx * elapsed;
                const dy = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
                
                particle.style.transform = `translate(${dx}px, ${dy}px)`;
                particle.style.opacity = 1 - (elapsed / duration);
                
                requestAnimationFrame(animate);
            }
            
            requestAnimationFrame(animate);
        }
    }
    
    function applyTheme(theme) {
        console.log('[theme] Applying theme:', theme);
        // Handle Christmas theme
        if (theme === 'christmas') {
            window.setChristmasTheme();
            return;
        }
        
        // 停止圣诞彩蛋效果（如果切换到其他主题）
        stopChristmasEasterEggs();
        
        // 恢复默认主题时还原猫图标
        const catBgs = document.querySelectorAll('.cat-bg use');
        catBgs.forEach(use => {
            use.setAttribute('href', '#px-cat');
        });
        
        // Apply theme to body
        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
        } else {
            body.removeAttribute('data-theme');
        }
        
        // Update theme icon with gentle transition
        if (themeIcon) {
            themeIcon.style.transition = 'opacity 0.3s ease';
            themeIcon.style.opacity = '0';
            setTimeout(() => {
                themeIcon.setAttribute('href', theme === 'light' ? '#px-sun' : '#px-moon');
                themeIcon.style.opacity = '1';
            }, 150);
        }
        
        // Save to localStorage
        localStorage.setItem('theme', theme);
        
        // Update button title
        themeBtn.title = `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`;
        
        // Console log for fun
        //console.log(`🎨 Theme switched to: ${theme === 'light' ? '☀️ Light' : '🌙 Dark'} Mode`);
    }
    
    // Theme switch event listener
    themeBtn.addEventListener('click', () => {    
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(currentTheme);
        
        // Add a little sparkle effect
        createSparkleEffect(themeBtn);
    });
    
    // Create pixel particle effect when switching themes
    function createSparkleEffect(element) {
        const rect = element.getBoundingClientRect();
        const particleCount = 8;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.left = rect.left + rect.width / 2 + 'px';
            particle.style.top = rect.top + rect.height / 2 + 'px';
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = 'var(--secondary)';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.transition = 'all 1s ease-out';
            particle.style.opacity = '1';
            particle.style.borderRadius = '0'; // Keep it square/pixel-like
            
            document.body.appendChild(particle);
            
            // Animate pixels with different directions
            setTimeout(() => {
                const angle = (i / particleCount) * 2 * Math.PI;
                const distance = 60 + Math.random() * 30;
                particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
                particle.style.opacity = '0';
                particle.style.width = '2px';
                particle.style.height = '2px';
            }, 10);
            
            // Remove particle
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }
    
    // Initialize theme
    applyTheme(currentTheme);
}

// Publication expand/collapse functionality
function initPublicationExpand() {
    const publications = document.querySelectorAll('.item.publication');
    
    publications.forEach(item => {
        const abstract = item.querySelector('.abstract');
        
        item.addEventListener('click', (e) => {
            // Don't expand if clicking on links
            if (e.target.tagName === 'A') return;
            
            const isExpanded = item.classList.contains('expanded');
            
            // Close all other publications
            publications.forEach(pub => {
                if (pub !== item && pub.classList.contains('expanded')) {
                    collapseAbstract(pub);
                }
            });
            
            // Toggle current publication
            if (isExpanded) {
                collapseAbstract(item);
            } else {
                expandAbstract(item);
            }
        });
    });
    
    function expandAbstract(item) {
        const abstract = item.querySelector('.abstract');
        
        // Clear any inline styles first
        abstract.style.height = '';
        abstract.style.maxHeight = '';
        abstract.style.opacity = '';
        abstract.style.transform = '';
        abstract.style.marginTop = '';
        
        // Add expanded class to get target values
        item.classList.add('expanded');
        
        // Measure the natural height and other target values
        const targetHeight = abstract.scrollHeight;
        
        // Set initial collapsed state with inline styles
        abstract.style.height = '0px';
        abstract.style.maxHeight = 'none';
        abstract.style.opacity = '0';
        abstract.style.transform = 'translateY(-8px)';
        abstract.style.marginTop = '0px';
        
        // Force reflow
        abstract.offsetHeight;
        
        // Animate to expanded state
        requestAnimationFrame(() => {
            abstract.style.height = targetHeight + 'px';
            abstract.style.opacity = '1';
            abstract.style.transform = 'translateY(0)';
            abstract.style.marginTop = '12px';
            
            // Clean up after animation - let CSS take over
            setTimeout(() => {
                if (item.classList.contains('expanded')) {
                    abstract.style.height = '';
                    abstract.style.maxHeight = '';
                    abstract.style.opacity = '';
                    abstract.style.transform = '';
                    abstract.style.marginTop = '';
                }
            }, 400);
        });
    }
    
    function collapseAbstract(item) {
        const abstract = item.querySelector('.abstract');
        
        // Get current height and set it explicitly
        const currentHeight = abstract.scrollHeight;
        abstract.style.height = currentHeight + 'px';
        abstract.style.maxHeight = 'none';
        
        // Force reflow
        abstract.offsetHeight;
        
        // Start collapse animation - animate height, opacity, and transform together
        requestAnimationFrame(() => {
            abstract.style.height = '0px';
            abstract.style.opacity = '0';
            abstract.style.transform = 'translateY(-8px)';
            abstract.style.marginTop = '0px';
            
            // Remove expanded class immediately to let CSS transitions handle other properties
            item.classList.remove('expanded');
            
            // Clean up inline styles after animation
            setTimeout(() => {
                abstract.style.height = '';
                abstract.style.maxHeight = '';
                abstract.style.opacity = '';
                abstract.style.transform = '';
                abstract.style.marginTop = '';
            }, 400);
        });
    }
}

// Math rendering function
function renderMathInHtml() {
    // Auto-render KaTeX for inline and display math
    renderMathInElement(document.body, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
        errorColor: '#cc0000',
        strict: false
    });
    
    // Also manually render elements with .math class
    document.querySelectorAll('.math').forEach(element => {
        const mathText = element.textContent;
        if (mathText.startsWith('$') && mathText.endsWith('$')) {
            const cleanText = mathText.slice(1, -1); // Remove $ delimiters
            try {
                katex.render(cleanText, element, {
                    throwOnError: false,
                    displayMode: false,
                    errorColor: '#cc0000',
                    strict: false
                });
            } catch (e) {
                console.warn('KaTeX rendering error:', e);
            }
        }
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initCatAnimation();
    initAvatarInteraction();
    initPublicationExpand();
    initThemeSwitcher();
    
    // Initialize KaTeX math rendering
    renderMathInHtml();
    
    // Initialize component router system
    initRouter();
});
