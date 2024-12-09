const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Function to apply theme
function applyTheme(theme) {
    console.log('Applying theme in preload:', theme);
    
    // Log current state
    console.log('Before theme update:', {
        bodyClasses: document.body.className,
        documentClasses: document.documentElement.className,
        bodyTheme: document.body.getAttribute('data-theme'),
        documentTheme: document.documentElement.getAttribute('data-theme')
    });

    // Try both class and attribute approaches
    document.body.className = theme === 'light' ? 'theme-light' : 'theme-dark';
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Force style recalculation
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
    
    console.log('After theme update:', {
        bodyClasses: document.body.className,
        documentClasses: document.documentElement.className,
        bodyTheme: document.body.getAttribute('data-theme'),
        documentTheme: document.documentElement.getAttribute('data-theme'),
        computedBg: getComputedStyle(document.body).getPropertyValue('--theme-bg'),
        computedText: getComputedStyle(document.body).getPropertyValue('--theme-text')
    });
}

// Inject CSS when the window loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('Preferences window loaded');
    
    // Inject our CSS with !important rules
    const cssFile = path.join(__dirname, 'preferences.css');
    console.log('Loading CSS from:', cssFile);
    const cssContent = fs.readFileSync(cssFile, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    console.log('CSS injected');

    // Get and apply initial theme
    ipcRenderer.invoke('get-theme').then(theme => {
        console.log('Got initial theme:', theme);
        applyTheme(theme);
    }).catch(err => {
        console.error('Error getting initial theme:', err);
    });
});

// Listen for theme changes via IPC
ipcRenderer.on('update-theme', (event, theme) => {
    console.log('Theme update received via IPC:', theme);
    applyTheme(theme);
});
