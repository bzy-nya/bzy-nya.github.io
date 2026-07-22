class ComponentRouter {
    constructor() {
        this.routes = new Map();
        this.fallbackRoute = null;
        this.currentRoute = null;
        this.activeComponents = new Set();
        this.isTransitioning = false;
        this.pendingPath = null;
        
        this.init();
    }

    init() {
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('popstate', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * 注册路由配置
     * @param {string|RegExp} pattern - 路由模式
     * @param {Object} config - 路由配置
     */
    register(pattern, config) {
        const routeConfig = this.createRouteConfig(pattern, config);

        // 如果是字符串，转换为正则表达式以支持参数
        if (typeof pattern === 'string') {
            const paramNames = [];
            const regexPattern = pattern.replace(/:([^/]+)/g, (match, paramName) => {
                paramNames.push(paramName);
                return '([^/]+)';
            });
            
            routeConfig.regex = new RegExp(`^${regexPattern}$`);
            routeConfig.paramNames = paramNames;
        }

        this.routes.set(pattern, routeConfig);
        return this;
    }

    createRouteConfig(pattern, config) {
        return {
            pattern,
            components: config.components || [],
            handler: config.handler || null,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null,
            beforeLeave: config.beforeLeave || null,
            ...config
        };
    }

    setFallback(config) {
        this.fallbackRoute = this.createRouteConfig(null, config);
        return this;
    }

    /**
     * 解析当前路由
     */
    parseCurrentHash() {
        const rawHash = window.location.hash.slice(1);
        const normalizedHash = rawHash.replace(/^\/+/, '');
        const subHashIndex = normalizedHash.indexOf('#');
        const routeHash = subHashIndex === -1
            ? normalizedHash
            : normalizedHash.slice(0, subHashIndex);
        const subHash = subHashIndex === -1
            ? ''
            : normalizedHash.slice(subHashIndex + 1);
        const canonicalHash = routeHash
            ? `#${routeHash}${subHash ? `#${subHash}` : ''}`
            : '';

        return {
            path: routeHash ? `/${routeHash}` : '/',
            subHash,
            canonicalHash
        };
    }

    /**
     * 匹配路由配置
     */
    matchRoute(path) {
        for (const [pattern, config] of this.routes) {
            let match = null;
            let params = {};
            
            if (typeof pattern === 'string') {
                if (config.regex) {
                    match = path.match(config.regex);
                    if (match && config.paramNames) {
                        config.paramNames.forEach((paramName, index) => {
                            params[paramName] = match[index + 1];
                        });
                    }
                } else {
                    match = path === pattern;
                }
            } else if (pattern instanceof RegExp) {
                match = path.match(pattern);
            }
            
            if (match) {
                return { config, params, path };
            }
        }
        
        return null;
    }

    /**
     * 处理路由变化
     */
    async handleRouteChange() {
        const routeLocation = this.parseCurrentHash();
        const { path, subHash, canonicalHash } = routeLocation;
        const routeKey = `${path}#${subHash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const canonicalUrl = `${window.location.pathname}${window.location.search}${canonicalHash}`;

        if (currentUrl !== canonicalUrl) {
            window.history.replaceState(window.history.state, '', canonicalUrl);
        }

        if (this.isTransitioning) {
            this.pendingPath = { ...routeLocation, routeKey };
            return;
        }

        if (this.currentRoute?.path === path) {
            if (this.currentRoute.subHash !== subHash) {
                this.currentRoute.subHash = subHash;
                this.scrollToSubHash(subHash);
            }
            return;
        }

        const match = this.matchRoute(path) || (this.fallbackRoute
            ? { config: this.fallbackRoute, params: {}, path }
            : null);
        
        if (!match) {
            console.warn('[router] No route match for:', path);
            return;
        }
        
        const { config, params } = match;

        if (config.redirect) {
            window.location.replace(config.redirect);
            return;
        }
        
        const didTransition = await this.performTransition(config, params, path, subHash);

        if (didTransition) {
            this.currentRoute = { path, config, params, subHash };
            this.scrollToSubHash(subHash, 'auto');
        }

        const pendingPath = this.pendingPath;
        this.pendingPath = null;

        if (pendingPath && pendingPath.routeKey !== routeKey) {
            await this.handleRouteChange();
        }
    }

    /**
     * 执行组件切换和路由处理
     */
    async performTransition(config, params, path, subHash = '') {
        this.isTransitioning = true;
        const previousComponents = Array.from(this.activeComponents);
        const rollbackHandlers = [];
        const context = {
            params,
            path,
            subHash,
            router: this,
            onRollback(handler) {
                if (typeof handler === 'function') {
                    rollbackHandlers.push(handler);
                }
            }
        };
        
        try {
            // 先准备目标路由。准备失败时，当前页面仍保持可见。
            if (config.beforeEnter) {
                this.assertTransitionResult(await config.beforeEnter(context), 'beforeEnter');
            }
            if (config.handler) {
                this.assertTransitionResult(await config.handler(context), 'handler');
            }

            // 目标路由准备完成后，再清理旧路由并提交可见组件状态。
            if (this.currentRoute?.config.beforeLeave) {
                this.assertTransitionResult(await this.currentRoute.config.beforeLeave({
                    from: this.currentRoute,
                    to: { config, params, path },
                    router: this,
                    onRollback: context.onRollback
                }), 'beforeLeave');
            }

            await this.switchComponents(config.components);

            if (config.afterEnter) {
                this.assertTransitionResult(await config.afterEnter(context), 'afterEnter');
            }
            return true;
            
        } catch (error) {
            for (let i = rollbackHandlers.length - 1; i >= 0; i--) {
                try {
                    await rollbackHandlers[i]();
                } catch (rollbackError) {
                    console.error('[router] Rollback error:', rollbackError);
                }
            }
            this.restoreComponentVisibility(previousComponents, config.components);
            console.error('[router] Transition error:', error);
            return false;
        } finally {
            this.isTransitioning = false;
        }
    }

    scrollToSubHash(subHash, behavior = 'smooth') {
        if (!subHash) {
            return;
        }

        let targetId = subHash;
        try {
            targetId = decodeURIComponent(subHash);
        } catch (error) {
            console.warn('[router] Invalid sub hash:', subHash, error);
        }

        requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({
                behavior,
                block: 'start'
            });
        });
    }

    assertTransitionResult(result, phase) {
        if (result === false) {
            throw new Error(`[router] ${phase} aborted the transition`);
        }
    }

    /**
     * 切换组件显示状态 - 统一动画管理
     */
    async switchComponents(targetComponents) {
        // 找出需要隐藏和显示的组件
        const toHide = Array.from(this.activeComponents).filter(c => !targetComponents.includes(c));
        const toShow = targetComponents.filter(c => !this.activeComponents.has(c));
        
        // 隐藏组件 - 统一淡出动画
        if (toHide.length > 0) {
            await this.hideComponents(toHide);
        }
        
        // 显示组件 - 统一淡入动画
        if (toShow.length > 0) {
            await this.showComponents(toShow);
        }
        
        // 更新活跃组件集合
        this.activeComponents = new Set(targetComponents);
    }

    restoreComponentVisibility(previousComponents, targetComponents = []) {
        const previousSet = new Set(previousComponents);
        const allComponents = new Set([
            ...previousComponents,
            ...targetComponents,
            ...this.activeComponents
        ]);

        allComponents.forEach((componentId) => {
            const element = document.getElementById(componentId);
            if (!element) return;

            element.classList.remove('fade-out');
            if (previousSet.has(componentId)) {
                element.style.display = this.getElementDisplayMode(element);
                element.classList.add('active');
            } else {
                element.classList.remove('active');
                element.style.display = 'none';
            }
        });

        this.activeComponents = previousSet;
    }

    /**
     * 隐藏组件（淡出动画）
     */
    async hideComponents(componentIds) {
        const promises = componentIds.map(componentId => {
            return new Promise(resolve => {
                const element = document.getElementById(componentId);
                if (!element) {
                    resolve();
                    return;
                }

                // 添加淡出动画类
                element.classList.add('fade-out');
                
                // 等待动画完成后隐藏
                setTimeout(() => {
                    element.classList.remove('active', 'fade-out');
                    element.style.display = 'none';
                    resolve();
                }, 200); // 与CSS动画时间一致
            });
        });
        
        await Promise.all(promises);
    }

    /**
     * 显示组件（淡入动画）
     */
    async showComponents(componentIds) {
        const promises = componentIds.map(componentId => {
            return new Promise(resolve => {
                const element = document.getElementById(componentId);
                if (!element) {
                    resolve();
                    return;
                }

                // 先显示元素
                element.classList.remove('fade-out');
                element.style.display = this.getElementDisplayMode(element);
                
                // 强制重绘确保display生效
                element.offsetHeight;
                
                // 添加激活类触发淡入动画
                element.classList.add('active');
                document.dispatchEvent(new CustomEvent('componentrouter:shown', {
                    detail: { id: componentId, element }
                }));
                
                // 等待动画完成
                setTimeout(() => {
                    resolve();
                }, 200); // 与CSS动画时间一致
            });
        });
        
        await Promise.all(promises);
    }

    getElementDisplayMode(element) {
        if (element.dataset.routerDisplay) {
            return element.dataset.routerDisplay;
        }

        const previousDisplay = element.style.display;
        element.style.display = '';
        const computedDisplay = window.getComputedStyle(element).display;
        element.style.display = previousDisplay;

        const displayMode = computedDisplay === 'none' ? 'block' : computedDisplay;
        element.dataset.routerDisplay = displayMode;
        return displayMode;
    }

    /**
     * 比较两个集合是否相等
     */
    setsEqual(set1, set2) {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    }

    /**
     * 导航到指定路由
     */
    navigate(path, replace = false) {
        const normalizedPath = String(path ?? '')
            .replace(/^#/, '')
            .replace(/^\/+/, '');
        const nextHash = normalizedPath ? `#${normalizedPath}` : '';
        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (nextUrl === currentUrl) {
            this.handleRouteChange();
            return;
        }

        const historyMethod = replace ? 'replaceState' : 'pushState';
        window.history[historyMethod](window.history.state, '', nextUrl);
        this.handleRouteChange();
    }

    /**
     * 获取当前状态
     */
    getCurrentState() {
        return {
            route: this.currentRoute,
            activeComponents: Array.from(this.activeComponents),
            isTransitioning: this.isTransitioning
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.ComponentRouter = ComponentRouter;
}
