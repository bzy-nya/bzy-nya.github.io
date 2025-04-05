// Theme toggle functionality
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// SVG icons for dark and light modes
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
</svg>`;

const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 30 30">
    <path d="M 14.984375 0.98632812 A 1.0001 1.0001 0 0 0 14 2 L 14 5 A 1.0001 1.0001 0 1 0 16 5 L 16 2 A 1.0001 1.0001 0 0 0 14.984375 0.98632812 z M 5.796875 4.7988281 A 1.0001 1.0001 0 0 0 5.1015625 6.515625 L 7.2226562 8.6367188 A 1.0001 1.0001 0 1 0 8.6367188 7.2226562 L 6.515625 5.1015625 A 1.0001 1.0001 0 0 0 5.796875 4.7988281 z M 24.171875 4.7988281 A 1.0001 1.0001 0 0 0 23.484375 5.1015625 L 21.363281 7.2226562 A 1.0001 1.0001 0 1 0 22.777344 8.6367188 L 24.898438 6.515625 A 1.0001 1.0001 0 0 0 24.171875 4.7988281 z M 15 8 A 7 7 0 0 0 8 15 A 7 7 0 0 0 15 22 A 7 7 0 0 0 22 15 A 7 7 0 0 0 15 8 z M 2 14 A 1.0001 1.0001 0 1 0 2 16 L 5 16 A 1.0001 1.0001 0 1 0 5 14 L 2 14 z M 25 14 A 1.0001 1.0001 0 1 0 25 16 L 28 16 A 1.0001 1.0001 0 1 0 28 14 L 25 14 z M 7.9101562 21.060547 A 1.0001 1.0001 0 0 0 7.2226562 21.363281 L 5.1015625 23.484375 A 1.0001 1.0001 0 1 0 6.515625 24.898438 L 8.6367188 22.777344 A 1.0001 1.0001 0 0 0 7.9101562 21.060547 z M 22.060547 21.060547 A 1.0001 1.0001 0 0 0 21.363281 22.777344 L 23.484375 24.898438 A 1.0001 1.0001 0 1 0 24.898438 23.484375 L 22.777344 21.363281 A 1.0001 1.0001 0 0 0 22.060547 21.060547 z M 14.984375 23.986328 A 1.0001 1.0001 0 0 0 14 25 L 14 28 A 1.0001 1.0001 0 1 0 16 28 L 16 25 A 1.0001 1.0001 0 0 0 14.984375 23.986328 z"></path>
</svg>`;

// Check for saved theme preference or respect OS preference
const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = localStorage.getItem('theme');

// Debounce function to prevent multiple rapid executions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Add a special handler to fully recreate GitHub buttons
function recreateGitHubButtons(theme) {
    // The HTML we need to insert
    const lightButtonsHTML = `
        <a class="github-button" href="https://github.com/bzy-nya/bzy-nya.github.io" data-color-scheme="no-preference: light; light: light; dark: light;" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star bzy-nya/bzy-nya.github.io on GitHub">Star</a>
        <a class="github-button" href="https://github.com/bzy-nya/bzy-nya.github.io/issues" data-color-scheme="no-preference: light; light: light; dark: light;" data-icon="octicon-issue-opened" data-size="large" aria-label="Issue bzy-nya/bzy-nya.github.io on GitHub">Bug Report</a>
    `;
    
    const darkButtonsHTML = `
        <a class="github-button" href="https://github.com/bzy-nya/bzy-nya.github.io" data-color-scheme="no-preference: dark; light: dark; dark: dark;" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star bzy-nya/bzy-nya.github.io on GitHub">Star</a>
        <a class="github-button" href="https://github.com/bzy-nya/bzy-nya.github.io/issues" data-color-scheme="no-preference: dark; light: dark; dark: dark;" data-icon="octicon-issue-opened" data-size="large" aria-label="Issue bzy-nya/bzy-nya.github.io on GitHub">Bug Report</a>
    `;
    
    // Replace the content in the github-buttons container
    const githubButtonsContainer = document.querySelector('.github-buttons');
    if (!githubButtonsContainer) return;
    
    // Match the transition timing with body transition (0.3s from CSS)
    githubButtonsContainer.style.transition = 'opacity 0.3s ease';
    githubButtonsContainer.style.opacity = '0.1';
    
    // Check if we need to update - prevents unnecessary DOM changes
    const currentThemeMatches = 
        (theme === 'light' && githubButtonsContainer.getAttribute('data-theme') === 'light') ||
        (theme === 'dark' && githubButtonsContainer.getAttribute('data-theme') === 'dark');
    
    if (currentThemeMatches) {
        // Just restore opacity if no change needed
        githubButtonsContainer.style.opacity = '1';
        return;
    }
    
    // Set theme attribute for future checks
    githubButtonsContainer.setAttribute('data-theme', theme);
    
    // Use a more immediate update to reduce delay
    githubButtonsContainer.innerHTML = theme === 'light' ? lightButtonsHTML : darkButtonsHTML;
    
    try {
        // Only create a new script if the old one is removed successfully
        const oldScript = document.getElementById('github-bjs');
        if (oldScript && oldScript.parentNode) {
            oldScript.parentNode.removeChild(oldScript);
            
            // Create and append the new script immediately
            const newScript = document.createElement('script');
            newScript.src = 'https://buttons.github.io/buttons.js';
            newScript.async = true;
            newScript.defer = true;
            newScript.id = 'github-bjs';
            
            // Restore opacity when script loads, or after transition time matches CSS
            newScript.onload = () => {
                githubButtonsContainer.style.opacity = '1';
            };
            
            // If script takes too long, restore after transition period to match other elements
            setTimeout(() => {
                githubButtonsContainer.style.opacity = '1';
            }, 300); // Match the body transition time
            
            document.body.appendChild(newScript);
        } else {
            // If we can't find the old script or it has no parent, just add a new one
            const newScript = document.createElement('script');
            newScript.src = 'https://buttons.github.io/buttons.js';
            newScript.async = true;
            newScript.defer = true;
            newScript.id = 'github-bjs';
            
            newScript.onload = () => {
                githubButtonsContainer.style.opacity = '1';
            };
            
            setTimeout(() => {
                githubButtonsContainer.style.opacity = '1';
            }, 300); // Match the body transition time
            
            document.body.appendChild(newScript);
        }
    } catch (error) {
        console.error("Error updating GitHub buttons:", error);
        // Restore opacity even if there's an error
        githubButtonsContainer.style.opacity = '1';
        
        // Fallback - just add a new script
        const newScript = document.createElement('script');
        newScript.src = 'https://buttons.github.io/buttons.js';
        newScript.async = true;
        newScript.defer = true;
        newScript.id = 'github-bjs';
        document.body.appendChild(newScript);
    }
}

// Debounced function - sync with main transitions
const debouncedRecreateGitHubButtons = debounce(recreateGitHubButtons, 50); // Lower debounce time as we've increased transition time

// Function to set theme
function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        // Sun icon for light theme (to switch TO dark)
        themeToggleBtn.innerHTML = sunIcon;
        themeToggleBtn.title = "切换到深色模式";
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        // Moon icon for dark theme (to switch TO light)
        themeToggleBtn.innerHTML = moonIcon;
        themeToggleBtn.title = "切换到浅色模式";
        localStorage.setItem('theme', 'dark');
    }
    
    // Update GitHub buttons with debounced function
    debouncedRecreateGitHubButtons(theme);
}

// Initialize theme based on saved preference or system setting
function initializeTheme() {
    if (savedTheme === 'light') {
        setTheme('light');
    } else if (savedTheme === 'dark') {
        setTheme('dark');
    } else {
        // No saved preference, use system preference
        setTheme(prefersDarkMode.matches ? 'dark' : 'light');
    }
}

// Listen for system preference changes if no saved theme
function setupSystemPreferenceListener() {
    // Only apply system preference changes if user hasn't set a preference
    prefersDarkMode.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// Safe way to add event listener without duplicating
const handleThemeToggle = () => {
    const newTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    setTheme(newTheme);
};

// Initialize everything on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initializeTheme();
    
    // Set up system preference listener
    setupSystemPreferenceListener();
    
    // Set up theme toggle button
    themeToggleBtn.removeEventListener('click', handleThemeToggle);
    themeToggleBtn.addEventListener('click', handleThemeToggle);
});

// Initial setup of GitHub buttons when they're ready
window.addEventListener('load', () => {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    recreateGitHubButtons(currentTheme);
});
