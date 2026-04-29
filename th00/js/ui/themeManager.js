const themeToggleBtn = document.getElementById('theme-toggle-btn');

const moonIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.7 14.1A7.8 7.8 0 0 1 9.9 4.3a8.2 8.2 0 1 0 9.8 9.8Z"/>
    </svg>
`;

const sunIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0-4.6 1.1 2.6h-2.2L12 2.5Zm0 19-1.1-2.6h2.2L12 21.5ZM2.5 12l2.6-1.1v2.2L2.5 12Zm19 0-2.6 1.1v-2.2l2.6 1.1ZM5.3 5.3l2.6 1.1-1.5 1.5-1.1-2.6Zm13.4 13.4-2.6-1.1 1.5-1.5 1.1 2.6Zm0-13.4-1.1 2.6-1.5-1.5 2.6-1.1ZM5.3 18.7l1.1-2.6 1.5 1.5-2.6 1.1Z"/>
    </svg>
`;

function setTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
    themeToggleBtn.innerHTML = isDark ? sunIcon : moonIcon;
    themeToggleBtn.title = isDark ? '切换到浅色模式' : '切换到深色模式';
    themeToggleBtn.setAttribute('aria-label', themeToggleBtn.title);
    localStorage.setItem('theme', theme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    setTheme(savedTheme === 'dark' ? 'dark' : 'light');
}

function handleThemeToggle() {
    setTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    themeToggleBtn.addEventListener('click', handleThemeToggle);
});
