// SVG图标组件，采用类似Dino游戏的像素风格
const SVGIcons = {
    // 恐龙图标
    dino: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="6" width="8" height="6" fill="#535353"/>
        <rect x="6" y="12" width="12" height="6" fill="#535353"/>
        <rect x="4" y="18" width="4" height="2" fill="#535353"/>
        <rect x="16" y="18" width="4" height="2" fill="#535353"/>
        <rect x="10" y="8" width="2" height="2" fill="white"/>
        <rect x="14" y="8" width="2" height="2" fill="white"/>
        <rect x="16" y="10" width="2" height="2" fill="#535353"/>
        <rect x="2" y="14" width="4" height="2" fill="#535353"/>
    </svg>`,
    
    // DNA/进化图标
    evolution: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="2" height="2" fill="#535353"/>
        <rect x="6" y="6" width="2" height="2" fill="#535353"/>
        <rect x="8" y="8" width="2" height="2" fill="#535353"/>
        <rect x="10" y="10" width="2" height="2" fill="#535353"/>
        <rect x="12" y="8" width="2" height="2" fill="#535353"/>
        <rect x="14" y="6" width="2" height="2" fill="#535353"/>
        <rect x="16" y="4" width="2" height="2" fill="#535353"/>
        <rect x="4" y="16" width="2" height="2" fill="#535353"/>
        <rect x="6" y="14" width="2" height="2" fill="#535353"/>
        <rect x="8" y="12" width="2" height="2" fill="#535353"/>
        <rect x="12" y="12" width="2" height="2" fill="#535353"/>
        <rect x="14" y="14" width="2" height="2" fill="#535353"/>
        <rect x="16" y="16" width="2" height="2" fill="#535353"/>
        <rect x="18" y="18" width="2" height="2" fill="#535353"/>
    </svg>`,
    
    // 奖杯图标
    trophy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="4" width="8" height="8" fill="#535353"/>
        <rect x="6" y="6" width="2" height="4" fill="#535353"/>
        <rect x="16" y="6" width="2" height="4" fill="#535353"/>
        <rect x="10" y="12" width="4" height="4" fill="#535353"/>
        <rect x="6" y="16" width="12" height="2" fill="#535353"/>
        <rect x="8" y="18" width="8" height="2" fill="#535353"/>
        <rect x="10" y="6" width="4" height="2" fill="white"/>
    </svg>`,
    
    // 齿轮/设置图标
    gear: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="2" width="4" height="4" fill="#535353"/>
        <rect x="10" y="18" width="4" height="4" fill="#535353"/>
        <rect x="2" y="10" width="4" height="4" fill="#535353"/>
        <rect x="18" y="10" width="4" height="4" fill="#535353"/>
        <rect x="6" y="6" width="2" height="2" fill="#535353"/>
        <rect x="16" y="6" width="2" height="2" fill="#535353"/>
        <rect x="6" y="16" width="2" height="2" fill="#535353"/>
        <rect x="16" y="16" width="2" height="2" fill="#535353"/>
        <rect x="8" y="8" width="8" height="8" fill="#535353"/>
        <rect x="10" y="10" width="4" height="4" fill="white"/>
    </svg>`,
    
    // 大脑图标
    brain: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="4" width="12" height="2" fill="#535353"/>
        <rect x="4" y="6" width="16" height="2" fill="#535353"/>
        <rect x="4" y="8" width="4" height="2" fill="#535353"/>
        <rect x="10" y="8" width="4" height="2" fill="#535353"/>
        <rect x="16" y="8" width="4" height="2" fill="#535353"/>
        <rect x="4" y="10" width="4" height="2" fill="#535353"/>
        <rect x="10" y="10" width="4" height="2" fill="#535353"/>
        <rect x="16" y="10" width="4" height="2" fill="#535353"/>
        <rect x="6" y="12" width="4" height="2" fill="#535353"/>
        <rect x="14" y="12" width="4" height="2" fill="#535353"/>
        <rect x="8" y="14" width="8" height="2" fill="#535353"/>
        <rect x="10" y="16" width="4" height="2" fill="#535353"/>
    </svg>`
};

// 创建SVG图标元素的辅助函数
function createSVGIcon(iconName, className = '') {
    const svgString = SVGIcons[iconName];
    if (!svgString) return '';
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;
    
    if (className) {
        svg.setAttribute('class', className);
    }
    
    return svg.outerHTML;
}

// 将SVG图标插入到指定元素
function insertSVGIcon(elementId, iconName, className = '') {
    const element = document.getElementById(elementId);
    if (element) {
        const iconHTML = createSVGIcon(iconName, className);
        element.innerHTML = iconHTML + ' ' + element.textContent;
    }
}
