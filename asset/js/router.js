/**
 * 静态页面路由系统
 * 专为博客系统设计的轻量级路由器
 */
class StaticRouter {
    constructor(options = {}) {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.mode = options.mode || 'hash'; // 仅支持 hash 模式
        this.defaultRoute = options.defaultRoute || '/';
        this.eventListeners = new Map();
        
        // 初始化路由
        this.init();
    }

    /**
     * 初始化路由系统 - 只处理博客相关的hash
     */
    init() {
        // Hash 模式 - 只处理博客相关的hash
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash;
            // 只处理博客相关的hash (以 #/ 开头或者是 #blog)
            if (hash.startsWith('#/') || hash === '#blog') {
                console.log('[Router] Handling blog-related hash:', hash);
                this.handleRouteChange();
            } else {
                console.log('[Router] Ignoring non-blog hash:', hash);
            }
        });
        
        window.addEventListener('load', () => {
            const hash = window.location.hash;
            // 页面加载时也只处理博客相关的hash
            if (hash.startsWith('#/') || hash === '#blog') {
                this.handleRouteChange();
            }
        });

        console.log('[Router] Initialized for blog routes only');
    }

    /**
     * 注册路由
     * @param {string} path - 路由路径
     * @param {function} handler - 路由处理函数
     */
    route(path, handler) {
        // 支持路径参数，如 /post/:id
        const paramNames = [];
        const regexPath = path.replace(/:([^/]+)/g, (match, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)';
        });

        const regex = new RegExp(`^${regexPath}$`);
        
        this.routes.set(path, {
            regex,
            handler,
            paramNames,
            originalPath: path
        });
        
        return this;
    }

    /**
     * 开始路由处理
     */
    start() {
        console.log('[Router] Starting with routes:', Array.from(this.routes.keys()));
        this.handleRouteChange();
        return this;
    }

    /**
     * 添加中间件
     * @param {function} middleware - 中间件函数
     */
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * 导航到指定路径
     * @param {string} path - 目标路径
     * @param {boolean} replace - 是否替换当前历史记录
     */
    navigate(path, replace = false) {
        if (replace) {
            location.replace(`#${path}`);
        } else {
            location.hash = path;
        }
    }

    /**
     * 获取当前路径
     */
    getCurrentPath() {
        return location.hash.slice(1) || this.defaultRoute;
    }

    /**
     * 解析查询参数
     */
    parseQuery() {
        const params = new URLSearchParams(location.search);
        const query = {};
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    /**
     * 处理路由变化
     */
    async handleRouteChange() {
        const path = this.getCurrentPath();
        const query = this.parseQuery();
        
        console.log(`[Router] Navigating to: ${path}`);

        // 查找匹配的路由
        let matchedRoute = null;
        let params = {};

        for (const [routePath, route] of this.routes) {
            const match = path.match(route.regex);
            if (match) {
                matchedRoute = route;
                
                // 提取路径参数
                route.paramNames.forEach((paramName, index) => {
                    params[paramName] = match[index + 1];
                });
                break;
            }
        }

        if (matchedRoute) {
            const context = {
                path,
                params,
                query,
                router: this
            };

            try {
                // 执行中间件
                for (const middleware of this.middlewares) {
                    await middleware(context);
                }

                // 执行路由处理器
                await matchedRoute.handler(context);
                
                this.currentRoute = {
                    path: matchedRoute.originalPath,
                    actualPath: path,
                    params,
                    query
                };

                // 触发路由变化事件
                this.emit('routeChanged', this.currentRoute);

            } catch (error) {
                console.error('[Router] Error handling route:', error);
                this.emit('routeError', { error, context });
            }
        } else {
            console.warn(`[Router] No route found for: ${path}`);
            this.emit('routeNotFound', { path, query });
            
            // 重定向到默认路由
            if (path !== this.defaultRoute) {
                this.navigate(this.defaultRoute, true);
            }
        }
    }

    /**
     * 事件发射器
     */
    emit(eventName, data) {
        if (this.eventListeners.has(eventName)) {
            this.eventListeners.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[Router] Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }

    /**
     * 监听路由事件
     * @param {string} eventName - 事件名称
     * @param {function} callback - 回调函数
     */
    on(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    }

    /**
     * 移除事件监听器
     */
    off(eventName, callback) {
        if (this.eventListeners.has(eventName)) {
            const listeners = this.eventListeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 销毁路由器
     */
    destroy() {
        this.routes.clear();
        this.middlewares = [];
        this.eventListeners.clear();
        this.currentRoute = null;
    }
}

// 全局路由实例
window.router = null;

// 初始化路由的便捷函数
function createRouter(options = {}) {
    if (window.router) {
        console.warn('[Router] Router already exists');
        return window.router;
    }

    window.router = new StaticRouter(options);
    return window.router;
}

// 导出类和函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StaticRouter, createRouter };
}
