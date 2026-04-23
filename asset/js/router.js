class ComponentRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.activeComponents = new Set();
        this.isTransitioning = false;
        this.pendingPath = null;
        
        this.init();
    }

    init() {
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * 注册路由配置
     * @param {string|RegExp} pattern - 路由模式
     * @param {Object} config - 路由配置
     */
    register(pattern, config) {
        const routeConfig = {
            pattern,
            components: config.components || [],
            handler: config.handler || null,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null,
            beforeLeave: config.beforeLeave || null,
            ...config
        };

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

    /**
     * 解析当前路由
     */
    parseCurrentHash() {
        var path = window.location.hash.slice(1) || '';

        if (!path.startsWith('/')) path = '/' + path;
        
        return path;
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
        const path = this.parseCurrentHash();
        if (this.isTransitioning) {
            this.pendingPath = path;
            return;
        }

        if (this.currentRoute?.path === path) {
            return;
        }

        const match = this.matchRoute(path);
        
        if (!match) {
            console.warn('[router] No route match for:', path);
            return;
        }
        
        const { config, params } = match;
        
        const didTransition = await this.performTransition(config, params, path);

        if (didTransition) {
            this.currentRoute = { path, config, params };
        }

        const pendingPath = this.pendingPath;
        this.pendingPath = null;

        if (pendingPath && pendingPath !== path) {
            await this.handleRouteChange();
        }
    }

    /**
     * 执行组件切换和路由处理
     */
    async performTransition(config, params, path) {
        this.isTransitioning = true;
        
        try {
            // 1. 执行离开前钩子
            if (this.currentRoute?.config.beforeLeave) {
                await this.currentRoute.config.beforeLeave({
                    from: this.currentRoute,
                    to: { config, params, path }
                });
            }

            // 2. 并行执行：组件切换动画 + 内容更新
            const runHooks = async () => {
                const context = { params, path, router: this };

                if (config.beforeEnter) {
                    await config.beforeEnter(context);
                }
                if (config.handler) {
                    await config.handler(context);
                }
                if (config.afterEnter) {
                    await config.afterEnter(context);
                }
            };
            
            const componentTransition = this.switchComponents(config.components);
            const handler = runHooks();

            await Promise.all([componentTransition, handler]);
            return true;
            
        } catch (error) {
            console.error('[router] Transition error:', error);
            return false;
        } finally {
            this.isTransitioning = false;
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
        var fullPath = path.startsWith('#') ? path : '#' + path;

        if (replace) {
            window.location.replace(fullPath);
        } else {
            window.location.hash = fullPath;
        }
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
