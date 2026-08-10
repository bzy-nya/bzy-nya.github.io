// 组件路由器实例
let Router = null;
let catAnimationController = null;
let surfaceEffectSequence = 0;
let hiddenTextMosaicSequence = 0;

// 初始化组件路由系统
function initRouter() {
    if (typeof ComponentRouter !== 'function') {
        return;
    }

    Router = new ComponentRouter();
    
    // 配置所有路由 - 纯组件思维，统一管理所有页面元素
    Router
        // 首页：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 首页内容 + 底部
        .register('/', {
            components: ['topbar', 'sidebar', 'profile-card', 'links-card', 'main-content', 'home', 'footer'],
            afterEnter: async () => {
                setHeaderNavigation('home');
            }
        })
        
        // 博客首页：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 博客内容 + 博客导航 + 底部
        .register('/blog', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'blog', 'blog-navigation', 'footer'],
            async beforeEnter({ router }) {
                await tryInitBlogSystem();
            },
            async handler({ onRollback }) {
                const snapshot = window.blogSystem.captureViewState();
                onRollback(() => window.blogSystem.restoreViewState(snapshot));
                await window.blogSystem.showHome();
            },
            async afterEnter() {
                setHeaderNavigation('blog');
            }
        })
        
        // 博客文章：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 博客内容 + 文章目录 + 底部
        .register('/post/:id', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'blog', 'article-toc-card', 'footer'],
            async beforeEnter({ router }) {
                await tryInitBlogSystem();
            },
            async beforeLeave({ to }) {
                if (to.config.pattern !== '/post/:id') {
                    window.blogSystem?.cleanupArticleUI();
                }
            },
            async handler({ params, onRollback }) {
                const snapshot = window.blogSystem.captureViewState();
                onRollback(() => window.blogSystem.restoreViewState(snapshot));
                return window.blogSystem.showPost(params.id);
            },
            async afterEnter() {
                setHeaderNavigation('blog');
            }
        })
        
        // Fun页面：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + Fun内容 + 底部
        .register('/fun', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'fun', 'footer'],
            afterEnter: async () => {
                setHeaderNavigation('fun');
            }
        })

        // 未知 hash 使用站点独立的 404 页面。
        .setFallback({
            redirect: '404.html'
        });
    
    window.Router = Router; // 全局暴露路由器实例
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
    catAnimationController?.stop();

    const cats = Array.from(document.querySelectorAll('.cat-bg'));
    if (cats.length === 0) {
        catAnimationController = null;
        return null;
    }

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let animationFrameId = null;

    const handleMouseMove = (e) => {
        mx = e.clientX; 
        my = e.clientY; 
    };

    const animate = () => {
        cats.forEach((el, i) => {
            const strength = 0.008 + i * 0.002;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const deltaX = (mx - centerX) * strength;
            const deltaY = (my - centerY) * strength;
            el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        });
        animationFrameId = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', handleMouseMove);
    animationFrameId = requestAnimationFrame(animate);

    catAnimationController = {
        stop() {
            document.removeEventListener('mousemove', handleMouseMove);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    };

    return catAnimationController;
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

function pixelEffectHash(seed, step) {
    const value = Math.sin(seed * 91.317 + step * 47.853) * 43758.5453;
    return value - Math.floor(value);
}

function pixelEffectSmoothNoise(time, seed) {
    const step = Math.floor(time);
    const fraction = time - step;
    const eased = fraction * fraction * (3 - 2 * fraction);
    const start = pixelEffectHash(seed, step);
    const end = pixelEffectHash(seed, step + 1);
    return start + (end - start) * eased;
}

function renderHiddenTextMosaic(canvas, context, element, timestamp, effectIndex) {
    // Pixel-glass corner lights render 2x2 logical cells on a 4x canvas scale.
    // Use the same 8px apparent cell size here.
    const pixelSize = 8;
    const elementRect = element.getBoundingClientRect();
    const contentRange = document.createRange();
    contentRange.selectNodeContents(element);
    contentRange.setEndBefore(canvas);
    const contentRect = contentRange.getBoundingClientRect();
    const displayWidth = Math.max(1, contentRect.width);
    const displayHeight = Math.max(1, contentRect.height);
    const targetWidth = Math.max(1, Math.ceil(displayWidth / pixelSize));
    const targetHeight = Math.max(1, Math.ceil(displayHeight / pixelSize));

    canvas.style.left = `${contentRect.left - elementRect.left}px`;
    canvas.style.top = `${contentRect.top - elementRect.top}px`;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.imageSmoothingEnabled = false;
    } else {
        context.clearRect(0, 0, targetWidth, targetHeight);
    }

    const readChannels = (propertyName, fallback) => {
        const channels = getComputedStyle(element)
            .getPropertyValue(propertyName)
            .match(/\d+(?:\.\d+)?/g)
            ?.slice(0, 3)
            .map(Number);
        return channels?.length === 3 && channels.every(Number.isFinite)
            ? channels
            : fallback;
    };
    const sunlightChannels = readChannels('--sunlight-rgb', [255, 254, 242]);
    const [red, green, blue] = sunlightChannels;
    const time = timestamp / 1000 + effectIndex * 0.37;

    for (let x = 0; x < targetWidth; x += 1) {
        for (let y = 0; y < targetHeight; y += 1) {
            const seed = x * 97 + y * 193 + effectIndex * 389;
            const slowNoise = pixelEffectSmoothNoise(time * 0.82, seed + 17);
            const mediumNoise = pixelEffectSmoothNoise(time * 1.47, seed + 41);
            const fastNoise = pixelEffectSmoothNoise(time * 2.31, seed + 83);
            const brightness = Math.max(
                0.04,
                Math.min(0.58, 0.06 + slowNoise * 0.34 + mediumNoise * 0.24 - fastNoise * 0.12)
            );
            const quantizedBrightness = Math.round(brightness * 20) / 20;

            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${quantizedBrightness})`;
            context.fillRect(x, y, 1, 1);
        }
    }
}

function initHiddenTextMosaics(root = document) {
    const selector = '.blog-post-content .hidden-text';
    const elements = [
        ...(root?.matches?.(selector) ? [root] : []),
        ...(root?.querySelectorAll?.(selector) ?? [])
    ];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    elements.forEach((element) => {
        if (element.querySelector(':scope > .hidden-text-mosaic')) {
            return;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        const effectIndex = hiddenTextMosaicSequence++;
        canvas.className = 'hidden-text-mosaic';
        canvas.width = 1;
        canvas.height = 1;
        canvas.dataset.pixelSize = '8';
        canvas.setAttribute('aria-hidden', 'true');
        element.appendChild(canvas);

        let animationFrameId = null;
        let lastUpdate = 0;
        const render = (timestamp) => {
            renderHiddenTextMosaic(canvas, context, element, timestamp, effectIndex);
        };
        const animate = (timestamp) => {
            if (!element.isConnected) {
                animationFrameId = null;
                return;
            }
            if (timestamp - lastUpdate >= 50) {
                render(timestamp);
                lastUpdate = timestamp;
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        if (reduceMotion) {
            render(0);
        } else {
            animationFrameId = requestAnimationFrame(animate);
        }
    });
}

function renderPixelCornerLight(context, canvasSize, timestamp, itemIndex, channels) {
    const [red = 255, green = 254, blue = 242] = channels;
    const time = timestamp / 1000 + itemIndex * 0.37;
    const curvedRatio = 0.65;
    const curvedRatio2 = 0.55;

    context.clearRect(0, 0, canvasSize, canvasSize);
    for (let x = 0; x < canvasSize; x += 2) {
        for (let y = 0; y < canvasSize; y += 2) {
            const fromRight = (canvasSize - 1 - x) / (canvasSize - 1);
            const fromBottom = (canvasSize - 1 - y) / (canvasSize - 1);
            const seed = x * 97 + y * 193 + itemIndex * 389;
            const edgeNoise = pixelEffectSmoothNoise(time * 0.58, seed + 17);
            const curvedBoundary = Math.pow(fromRight, curvedRatio) + Math.pow(fromBottom, curvedRatio);
            const curvedBoundary2 = Math.pow(fromRight, curvedRatio2) + Math.pow(fromBottom, curvedRatio2);

            if (curvedBoundary > 0.97 + edgeNoise * 0.2) {
                continue;
            }

            const slowNoise = pixelEffectSmoothNoise(time * 0.72, seed + 41);
            const fastNoise = pixelEffectSmoothNoise(time * 1.46, seed + 83);
            let brightness = Math.exp(-Math.pow(Math.abs(curvedBoundary2 - 0.5), 2) * 20 - 2) * 2;
            brightness *= Math.exp(-Math.pow(Math.abs(fromRight - 0.35), 2) * 4) * 2;
            brightness *= Math.exp(-Math.pow(Math.abs(fromBottom - 0.35), 2) * 4) * 2;

            if (brightness <= 0.04) {
                continue;
            }

            brightness = Math.min(1, brightness + slowNoise * 0.1 - fastNoise * 0.5);
            const quantizedBrightness = Math.floor(brightness * 20) / 20;

            if (quantizedBrightness <= 0.04) {
                continue;
            }

            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${quantizedBrightness})`;
            context.fillRect(x, y, 2, 2);
        }
    }
}

function renderPixelBorderShadow(canvas, context, rect, timestamp, effectIndex, channels) {
    const shadowPixelSize = 4;
    const shadowInsetCells = 2;
    const shadowSpreadCells = 3;
    const cardWidth = Math.max(1, Math.round(rect.width / shadowPixelSize));
    const cardHeight = Math.max(1, Math.round(rect.height / shadowPixelSize));
    const targetWidth = cardWidth + shadowInsetCells + shadowSpreadCells;
    const targetHeight = cardHeight + shadowInsetCells + shadowSpreadCells;
    const displayWidth = Math.round(rect.width + (shadowInsetCells + shadowSpreadCells) * shadowPixelSize);
    const displayHeight = Math.round(rect.height + (shadowInsetCells + shadowSpreadCells) * shadowPixelSize);

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
    } else {
        context.clearRect(0, 0, targetWidth, targetHeight);
    }

    const [red = 100, green = 100, blue = 100] = channels;
    const time = timestamp / 1000 + effectIndex * 0.43;
    const cardLeft = shadowInsetCells;
    const cardTop = shadowInsetCells;
    const cardRight = cardLeft + cardWidth;
    const cardBottom = cardTop + cardHeight;

    for (let x = 0; x < targetWidth; x += 2) {
        for (let y = 0; y < targetHeight; y += 2) {
            const rightDistance = x - cardRight;
            const bottomDistance = y - cardBottom;
            const inRightBand = rightDistance >= 0
                && rightDistance < shadowSpreadCells
                && y >= cardTop + 2
                && y < cardBottom + shadowSpreadCells;
            const inBottomBand = bottomDistance >= 0
                && bottomDistance < shadowSpreadCells
                && x >= cardLeft + 2
                && x < cardRight + shadowSpreadCells;

            if (!inRightBand && !inBottomBand) {
                continue;
            }

            const distance = Math.min(
                inRightBand ? rightDistance : shadowSpreadCells,
                inBottomBand ? bottomDistance : shadowSpreadCells
            );
            const seed = x * 131 + y * 197 + effectIndex * 433;
            const slowNoise = pixelEffectSmoothNoise(time * 0.58, seed + 211);
            const fastNoise = pixelEffectSmoothNoise(time * 1.24, seed + 367);
            const distanceFalloff = Math.pow(1 - distance / shadowSpreadCells, 1.35);
            const cornerBoost = inRightBand && inBottomBand ? 1.12 : 1;
            const brightness = Math.min(
                0.5,
                (0.4 + slowNoise * 0.17 - fastNoise * 0.5) * distanceFalloff * cornerBoost
            );

            if (brightness < 0.08) {
                continue;
            }

            const quantizedBrightness = Math.round(brightness / 0.02) * 0.02 / 5.5;
            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${quantizedBrightness})`;
            context.fillRect(x, y, 2, 2);
        }
    }
}

function initFunLightEffects() {
    const items = document.querySelectorAll('#fun .fun-item');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const lightCanvasSize = 28;

    items.forEach((item, itemIndex) => {
        const shell = item.closest('.fun-item-shell');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const shadowCanvas = document.createElement('canvas');
        const shadowContext = shadowCanvas.getContext('2d');
        canvas.className = 'fun-light-canvas';
        canvas.width = lightCanvasSize;
        canvas.height = lightCanvasSize;
        canvas.setAttribute('aria-hidden', 'true');
        shadowCanvas.className = 'fun-shadow-canvas';
        shadowCanvas.width = 1;
        shadowCanvas.height = 1;
        shadowCanvas.setAttribute('aria-hidden', 'true');
        shell?.insertBefore(shadowCanvas, item);
        item.appendChild(canvas);

        let animationFrameId = null;
        let lastUpdate = 0;

        const clearLight = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            context.clearRect(0, 0, lightCanvasSize, lightCanvasSize);
            shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
        };

        const getSunlightChannels = () => {
            const rgb = getComputedStyle(item)
                .getPropertyValue('--sunlight-rgb')
                .split(',')
                .map((channel) => Number.parseInt(channel.trim(), 10));
            return rgb.length === 3 ? rgb : [255, 254, 242];
        };

        const getColorChannels = (propertyName, fallback) => {
            const channels = getComputedStyle(item)
                .getPropertyValue(propertyName)
                .match(/\d+(?:\.\d+)?/g)
                ?.slice(0, 3)
                .map(Number);
            return channels?.length === 3 && channels.every(Number.isFinite)
                ? channels
                : fallback;
        };

        const renderLight = (timestamp) => {
            renderPixelCornerLight(
                context,
                lightCanvasSize,
                timestamp,
                itemIndex,
                getSunlightChannels()
            );
        };

        const renderShadow = (timestamp) => {
            renderPixelBorderShadow(
                shadowCanvas,
                shadowContext,
                item.getBoundingClientRect(),
                timestamp,
                itemIndex,
                getColorChannels('--fun-ink-shadow', [100, 100, 100])
            );
        };

        const animateLight = (timestamp) => {
            if (timestamp - lastUpdate >= 50) {
                renderLight(timestamp);
                renderShadow(timestamp);
                lastUpdate = timestamp;
            }
            animationFrameId = requestAnimationFrame(animateLight);
        };

        item.addEventListener('pointerenter', () => {
            if (animationFrameId) {
                return;
            }
            if (reduceMotion) {
                renderLight(0);
                renderShadow(0);
                return;
            }
            animationFrameId = requestAnimationFrame(animateLight);
        });
        item.addEventListener('pointerleave', clearLight);
    });
}

function initHomeSurfaceEffects(root = document) {
    const surfaceSelector = '.home-surface:not(.surface-publications):not(.surface-blog-list):not(.surface-blog-article)';
    const surfaces = [
        ...(root?.matches?.(surfaceSelector) ? [root] : []),
        ...(root?.querySelectorAll?.(surfaceSelector) ?? [])
    ];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const lightCanvasSize = 28;

    surfaces.forEach((surface) => {
        if (surface.querySelector(':scope > .surface-light-canvas')) {
            return;
        }

        const surfaceIndex = surfaceEffectSequence++;

        const lightCanvas = document.createElement('canvas');
        const lightContext = lightCanvas.getContext('2d');
        const shadowCanvas = document.createElement('canvas');
        const shadowContext = shadowCanvas.getContext('2d');
        lightCanvas.className = 'surface-light-canvas';
        lightCanvas.width = lightCanvasSize;
        lightCanvas.height = lightCanvasSize;
        lightCanvas.setAttribute('aria-hidden', 'true');
        shadowCanvas.className = 'surface-shadow-canvas';
        shadowCanvas.width = 1;
        shadowCanvas.height = 1;
        shadowCanvas.setAttribute('aria-hidden', 'true');
        surface.prepend(shadowCanvas);
        surface.appendChild(lightCanvas);

        let animationFrameId = null;
        let lastUpdate = 0;
        let pointerInside = false;

        const getChannels = (propertyName, fallback) => {
            const channels = getComputedStyle(surface)
                .getPropertyValue(propertyName)
                .match(/\d+(?:\.\d+)?/g)
                ?.slice(0, 3)
                .map(Number);
            return channels?.length === 3 && channels.every(Number.isFinite)
                ? channels
                : fallback;
        };

        const clearEffects = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            lightContext.clearRect(0, 0, lightCanvasSize, lightCanvasSize);
            shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
        };

        const renderLight = (timestamp) => {
            renderPixelCornerLight(
                lightContext,
                lightCanvasSize,
                timestamp,
                surfaceIndex,
                getChannels('--sunlight-rgb', [255, 254, 242])
            );
        };

        const renderShadow = (timestamp) => {
            renderPixelBorderShadow(
                shadowCanvas,
                shadowContext,
                surface.getBoundingClientRect(),
                timestamp,
                surfaceIndex,
                getChannels('--surface-shadow-rgb', [184, 230, 211])
            );
        };

        const renderEffects = (timestamp) => {
            renderLight(timestamp);
            renderShadow(timestamp);
        };

        const animateEffects = (timestamp) => {
            if (!surface.isConnected) {
                clearEffects();
                return;
            }
            if (timestamp - lastUpdate >= 50) {
                renderEffects(timestamp);
                lastUpdate = timestamp;
            }
            animationFrameId = requestAnimationFrame(animateEffects);
        };

        const startEffects = () => {
            if (animationFrameId) {
                return;
            }
            if (reduceMotion) {
                renderEffects(0);
                return;
            }
            animationFrameId = requestAnimationFrame(animateEffects);
        };

        const stopEffectsIfInactive = () => {
            if (!pointerInside && !surface.matches(':focus-within')) {
                clearEffects();
            }
        };

        surface.addEventListener('pointerenter', () => {
            pointerInside = true;
            startEffects();
        });
        surface.addEventListener('pointerleave', () => {
            pointerInside = false;
            stopEffectsIfInactive();
        });
        surface.addEventListener('focusin', startEffects);
        surface.addEventListener('focusout', () => {
            requestAnimationFrame(stopEffectsIfInactive);
        });
    });
}

function initHomeRevealEffects() {
    const revealGroups = new Set();
    const configuredGroups = new WeakSet();
    let observer = null;

    const configureGroup = (root, items) => {
        if (!root || configuredGroups.has(root)) {
            return;
        }

        configuredGroups.add(root);
        root.classList.add('stagger-reveal');
        revealGroups.add(root);
        [...new Set(items.filter(Boolean))].forEach((item, index) => {
            const direction = index % 2 === 0 ? -1 : 1;
            const angle = direction * (0.8 + (index % 3) * 0.35);
            item.classList.add('surface-reveal-item');
            item.style.setProperty('--reveal-order', index);
            item.style.setProperty('--reveal-angle', `${angle}deg`);
        });
    };

    const getConnectedGroups = () => {
        revealGroups.forEach((group) => {
            if (!group.isConnected) {
                observer?.unobserve(group);
                revealGroups.delete(group);
            }
        });
        return [...revealGroups];
    };

    const registerBlogRevealGroups = (scope = document) => {
        const selector = [
            '.surface-blog-list',
            '.surface-blog-article',
            '.surface-blog-navigation',
            '.surface-blog-toc',
            '.surface-blog-state'
        ].join(', ');
        const groups = [
            ...(scope?.matches?.(selector) ? [scope] : []),
            ...(scope?.querySelectorAll?.(selector) ?? [])
        ];

        groups.forEach((group) => {
            if (group.matches('.surface-blog-list')) {
                configureGroup(group, [
                    group.querySelector(':scope > .section-title'),
                    group.querySelector(':scope > .pixel-divider'),
                    ...group.querySelectorAll(':scope > .blog-list > .blog-post-item')
                ]);
                return;
            }

            if (group.matches('.surface-blog-article')) {
                configureGroup(group, [
                    group.querySelector(':scope > .blog-nav'),
                    group.querySelector(':scope > .blog-post-header'),
                    group.querySelector(':scope > .pixel-divider'),
                    group.querySelector(':scope > .blog-post-content')
                ]);
                return;
            }

            if (group.matches('.surface-blog-navigation')) {
                configureGroup(group, [
                    group.querySelector(':scope > .blog-nav-title'),
                    group.querySelector(':scope > .blog-stats'),
                    group.querySelector(':scope > .blog-filter-section')
                ]);
                return;
            }

            if (group.matches('.surface-blog-toc')) {
                configureGroup(group, [
                    group.querySelector(':scope > .toc-title'),
                    group.querySelector(':scope > .toc-content')
                ]);
                return;
            }

            configureGroup(group, [
                group.querySelector(':scope > .loading-container'),
                group.querySelector(':scope > .error-container')
            ]);
        });
    };

    const profile = document.getElementById('profile-card');
    configureGroup(profile, [
        profile?.querySelector('.avatar'),
        profile?.querySelector('.profile-copy'),
        profile?.querySelector('.social-links')
    ]);

    const links = document.getElementById('links-card');
    configureGroup(links, [
        links?.querySelector('.sidebar-card-title'),
        links?.querySelector('.card-links')
    ]);

    const biography = document.querySelector('.surface-biography');
    configureGroup(biography, [
        biography?.querySelector('.section-title'),
        biography?.querySelector('.section-content > p'),
        biography?.querySelector('.pixel-divider'),
        ...(biography?.querySelectorAll('.bio-col') ?? [])
    ]);

    const publications = document.querySelector('.surface-publications');
    configureGroup(publications, [
        publications?.querySelector('.section-title'),
        publications?.querySelector('.pixel-divider'),
        ...(publications?.querySelectorAll('.surface-publication') ?? [])
    ]);

    const funGrid = document.querySelector('#fun .fun-grid');
    configureGroup(funGrid, [
        ...(funGrid?.querySelectorAll(':scope > .fun-item-shell') ?? [])
    ]);

    registerBlogRevealGroups();

    observer = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.01,
            rootMargin: '0px 0px -6% 0px'
        })
        : null;

    const replayGroup = (group) => {
        observer?.unobserve(group);
        group.classList.remove('is-revealed');
        void group.offsetHeight;

        if (observer) {
            observer.observe(group);
        } else {
            group.classList.add('is-revealed');
        }
    };

    document.addEventListener('componentrouter:shown', (event) => {
        const component = event.detail?.element;
        if (!component) {
            return;
        }

        initHomeSurfaceEffects(component);
        initHiddenTextMosaics(component);
        registerBlogRevealGroups(component);
        getConnectedGroups()
            .filter((group) => (group.closest('.component') ?? group) === component)
            .forEach((group) => {
                group.classList.remove('is-internal-route-update');
                replayGroup(group);
            });
    });

    document.addEventListener('blog:visual-update', (event) => {
        const root = event.detail?.root;
        if (!root) {
            return;
        }

        initHomeSurfaceEffects(root);
        initHiddenTextMosaics(root);
        registerBlogRevealGroups(root);
        const owner = root.matches?.('.component') ? root : root.closest?.('.component');
        if (!owner?.classList.contains('active')) {
            return;
        }

        getConnectedGroups()
            .filter((group) => (group.closest('.component') ?? group) === owner)
            .forEach((group) => {
                group.classList.add('is-internal-route-update');
                replayGroup(group);
            });
    });

    getConnectedGroups().forEach((group) => {
        if (observer) {
            observer.observe(group);
        } else {
            group.classList.add('is-revealed');
        }
    });
}

function initTopbarCollapse() {
    const topbar = document.getElementById('topbar');
    if (!topbar) {
        return;
    }

    let ticking = false;

    const updateTopbarState = () => {
        ticking = false;
        const shouldCompact = window.innerWidth > 720 && window.scrollY > 144;
        const shouldCollapse = window.innerWidth > 720 && window.scrollY > 320;
        topbar.classList.toggle('is-compact', shouldCompact);
        topbar.classList.toggle('is-collapsed', shouldCollapse);
    };

    const onScrollOrResize = () => {
        if (ticking) {
            return;
        }
        ticking = true;
        requestAnimationFrame(updateTopbarState);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    updateTopbarState();
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
    if (!themeBtn) {
        return;
    }

    const themeIcon = themeBtn.querySelector('.theme-icon use');
    const body = document.body;
    const christmasEffects = typeof window.createChristmasEffectsManager === 'function'
        ? window.createChristmasEffectsManager()
        : null;
    
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
        const savedTheme = localStorage.getItem('theme');
        currentTheme = ['light', 'dark', 'halloween'].includes(savedTheme)
            ? savedTheme
            : getSystemTheme();
    }
    function applyChristmasTheme() {
        body.setAttribute('data-theme', 'christmas');
        if (themeIcon) {
            themeIcon.setAttribute('href', '#px-tree');
        }
        themeBtn.title = 'Merry Christmas! 🎄';
        christmasEffects?.start();
    }
    function applyTheme(theme) {
        if (theme === 'christmas') {
            applyChristmasTheme();
            return;
        }
        
        christmasEffects?.stop();
        
        const catBgs = document.querySelectorAll('.cat-bg use');
        catBgs.forEach(use => {
            use.setAttribute('href', '#px-cat');
        });
        
        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
        } else if (theme === 'halloween') {
            body.setAttribute('data-theme', 'halloween');
        } else {
            body.removeAttribute('data-theme');
        }
        
        // Update theme icon with gentle transition
        if (themeIcon) {
            themeIcon.style.transition = 'opacity 0.3s ease';
            themeIcon.style.opacity = '0';
            setTimeout(() => {
                const iconHref = theme === 'light'
                    ? '#px-sun'
                    : theme === 'halloween'
                        ? '#px-pumpkin'
                        : '#px-moon';
                themeIcon.setAttribute('href', iconHref);
                themeIcon.style.opacity = '1';
            }, 150);
        }
        
        // Save to localStorage
        localStorage.setItem('theme', theme);
        
        // Update button title
        themeBtn.title = theme === 'halloween'
            ? 'Happy Halloween!'
            : `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`;
        
    }

    // Console entry point for previewing seasonal themes during development.
    window.setSeasonalTheme = function (theme) {
        const normalizedTheme = String(theme).toLowerCase();
        if (!['christmas', 'halloween'].includes(normalizedTheme)) {
            throw new TypeError('setSeasonalTheme(theme) expects "christmas" or "halloween".');
        }

        currentTheme = normalizedTheme;
        applyTheme(currentTheme);
        return currentTheme;
    };
    
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

const publicationsDataUrl = 'asset/data/publications.json';

function createPublicationElement(publication, index) {
    if (!publication || typeof publication.title !== 'string') {
        return null;
    }

    const publicationId = String(publication.id || index + 1)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || `publication-${index + 1}`;
    const item = document.createElement('div');
    item.className = 'home-item publication home-surface surface-publication';
    item.dataset.publication = publicationId;

    const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    indicator.classList.add('expand-indicator');
    indicator.setAttribute('aria-hidden', 'true');
    const indicatorUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    indicatorUse.setAttribute('href', '#px-triangle');
    indicator.appendChild(indicatorUse);

    const title = document.createElement('div');
    title.className = 'home-item-title';
    title.textContent = publication.title;
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-expanded', 'false');

    const abstractId = `publication-abstract-${publicationId}`;
    const abstract = document.createElement('div');
    abstract.className = 'abstract';
    abstract.id = abstractId;
    title.setAttribute('aria-controls', abstractId);

    const coauthors = Array.isArray(publication.coauthors) ? publication.coauthors : [];
    if (coauthors.length) {
        const authors = document.createElement('p');
        authors.className = 'publication-authors';
        const label = document.createElement('strong');
        label.textContent = 'Coauthors: ';
        authors.appendChild(label);

        coauthors.forEach((author, authorIndex) => {
            if (authorIndex > 0) {
                authors.appendChild(document.createTextNode(', '));
            }

            const name = typeof author?.name === 'string' ? author.name : '';
            if (typeof author?.url === 'string' && author.url) {
                const link = document.createElement('a');
                link.href = author.url;
                link.textContent = name;
                authors.appendChild(link);
            } else {
                authors.appendChild(document.createTextNode(name));
            }
        });
        authors.appendChild(document.createTextNode('.'));
        abstract.appendChild(authors);
    }

    const abstractParagraphs = Array.isArray(publication.abstract)
        ? publication.abstract
        : [publication.abstract];
    const abstractBody = document.createElement('div');
    abstractBody.className = 'publication-abstract';
    abstractParagraphs
        .filter((paragraph) => typeof paragraph === 'string' && paragraph.trim())
        .forEach((paragraph, paragraphIndex) => {
            const paragraphElement = document.createElement('p');
            if (paragraphIndex === 0) {
                const label = document.createElement('strong');
                label.textContent = 'Abstract: ';
                paragraphElement.appendChild(label);
            }
            paragraphElement.appendChild(document.createTextNode(paragraph));
            abstractBody.appendChild(paragraphElement);
        });
    abstract.appendChild(abstractBody);

    const metadata = publication.metadata && typeof publication.metadata === 'object'
        ? publication.metadata
        : {};
    const meta = document.createElement('div');
    meta.className = 'home-item-meta';
    const type = typeof metadata.type === 'string' && /^[a-z0-9-]+$/i.test(metadata.type)
        ? metadata.type.toLowerCase()
        : 'submitted';
    const typeMarker = document.createElement('span');
    typeMarker.className = `pub-type ${type}`;
    typeMarker.setAttribute('aria-hidden', 'true');
    meta.appendChild(typeMarker);

    if (typeof metadata.venue === 'string' && metadata.venue) {
        const venue = document.createElement('span');
        venue.textContent = metadata.venue;
        meta.appendChild(venue);
    }

    const links = Array.isArray(metadata.links) ? metadata.links : [];
    links.forEach((linkData) => {
        if (typeof linkData?.label !== 'string' || typeof linkData?.url !== 'string') {
            return;
        }
        const link = document.createElement('a');
        link.href = linkData.url;
        link.textContent = linkData.label;
        meta.appendChild(link);
    });

    item.append(indicator, title, abstract, meta);
    return item;
}

async function loadPublications() {
    const publicationList = document.getElementById('publication-list');
    if (!publicationList) {
        return;
    }

    publicationList.setAttribute('aria-busy', 'true');
    try {
        const response = await fetch(publicationsDataUrl);
        if (!response.ok) {
            throw new Error(`Unable to load publications (${response.status})`);
        }

        const payload = await response.json();
        const publications = Array.isArray(payload?.publications) ? payload.publications : [];
        const elements = publications
            .map(createPublicationElement)
            .filter(Boolean);
        if (!elements.length) {
            throw new Error('No valid publication metadata was found');
        }

        publicationList.replaceChildren(...elements);
        initPublicationExpand(publicationList);
    } catch (error) {
        console.error('Failed to render publications:', error);
        const message = document.createElement('div');
        message.className = 'home-item publication-load-error';
        message.textContent = 'Publications are temporarily unavailable.';
        publicationList.replaceChildren(message);
    } finally {
        publicationList.removeAttribute('aria-busy');
    }
}

// Publication expand/collapse functionality
function initPublicationExpand(root = document) {
    const publications = root.querySelectorAll('.home-item.publication');
    
    publications.forEach(item => {
        const abstract = item.querySelector('.abstract');
        if (!abstract) {
            return;
        }

        const title = item.querySelector('.home-item-title');
        const setExpandedState = (expanded) => {
            title?.setAttribute('aria-expanded', String(expanded));
        };

        abstract.style.height = item.classList.contains('expanded') ? 'auto' : '0px';
        setExpandedState(item.classList.contains('expanded'));
        abstract.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'height' && item.classList.contains('expanded')) {
                abstract.style.height = 'auto';
            }
        });

        const togglePublication = () => {
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
        };

        item.addEventListener('click', (e) => {
            if (window.getSelection()?.toString()) return;
            if (e.target.closest('a, .abstract')) return;
            if (!e.target.closest('.home-item-title, .expand-indicator')) return;
            togglePublication();
        });

        title?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            togglePublication();
        });
    });
    
    function expandAbstract(item) {
        const abstract = item.querySelector('.abstract');
        if (!abstract) return;

        const currentHeight = abstract.getBoundingClientRect().height;
        abstract.style.height = `${currentHeight}px`;
        item.classList.add('expanded');
        item.querySelector('.home-item-title')?.setAttribute('aria-expanded', 'true');
        const targetHeight = abstract.scrollHeight;

        requestAnimationFrame(() => {
            abstract.style.height = `${targetHeight}px`;
        });
    }
    
    function collapseAbstract(item) {
        const abstract = item.querySelector('.abstract');
        if (!abstract) return;
        
        abstract.style.height = `${abstract.getBoundingClientRect().height}px`;
        abstract.offsetHeight;
        item.classList.remove('expanded');
        item.querySelector('.home-item-title')?.setAttribute('aria-expanded', 'false');

        requestAnimationFrame(() => {
            abstract.style.height = '0px';
        });
    }
}

// Math rendering function
function renderMathInHtml() {
    if (typeof renderMathInElement !== 'function') {
        return;
    }

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
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    initNavigation();
    initCatAnimation();
    initAvatarInteraction();
    initFunLightEffects();
    initRouter();
    await loadPublications();
    initHiddenTextMosaics();
    initHomeSurfaceEffects();
    initHomeRevealEffects();
    initTopbarCollapse();
    initThemeSwitcher();
    
    // Initialize KaTeX math rendering
    renderMathInHtml();
});
