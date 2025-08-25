// 组件路由器实例
let Router = null;

// 初始化组件路由系统
function initRouter() {
    Router = new ComponentRouter();
    
    // 配置所有路由 - 纯组件思维，统一管理所有页面元素
    Router
        // 首页：顶部导航 + 侧边栏 + 个人卡片 + 主内容 + 首页内容 + 底部
        .register('/', {
            components: ['topbar', 'sidebar', 'profile-card', 'main-content', 'home', 'footer'],
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
    
    // Load saved theme from localStorage or use system preference
    let currentTheme = localStorage.getItem('theme') || getSystemTheme();
    
    // Listen for system theme changes
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('theme')) {
                currentTheme = e.matches ? 'dark' : 'light';
                applyTheme(currentTheme);
            }
        });
    }
        // 只允许代码调用的 Halloween 主题切换
    window.setHalloweenTheme = function() {
        body.setAttribute('data-theme', 'halloween');
        localStorage.setItem('theme', 'halloween');
        if (themeIcon) {
            themeIcon.setAttribute('href', '#px-pumpkin'); // 你可以自定义南瓜icon
        }
        themeBtn.title = 'Happy Halloween!';
        console.log('🎃 Halloween theme activated!');
    }
    
    function applyTheme(theme) {
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
        console.log(`🎨 Theme switched to: ${theme === 'light' ? '☀️ Light' : '🌙 Dark'} Mode`);
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
