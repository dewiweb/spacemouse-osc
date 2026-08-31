// Initialize event listeners and UI components
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mode select
    const modeSelect = document.getElementById('mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', (event) => window.modeChange(event));
    }

    // Initialize bypass button
    const bypassBtn = document.getElementById('byp_0');
    if (bypassBtn) {
        bypassBtn.addEventListener('click', (event) => window.byp_0(event));
    }

    // Initialize send rate input
    const sendRateInput = document.getElementById('sendRate');
    if (sendRateInput) {
        sendRateInput.addEventListener('change', (event) => window.sendRateChange(event));
    }

    // Initialize preferences button
    const preferencesBtn = document.getElementById('preferencesBtn');
    if (preferencesBtn) {
        preferencesBtn.addEventListener('click', () => window.showPreferences());
    }

    // Initialize visualization toggle
    const viewvisBtn = document.getElementById('viewvis');
    if (viewvisBtn) {
        viewvisBtn.addEventListener('click', () => window.toggleVisualization());
    }

    // Initialize log toggle
    const viewlogBtn = document.getElementById('viewlog');
    if (viewlogBtn) {
        viewlogBtn.addEventListener('click', () => window.viewlogs());
    }

    // Initialize clear log button
    const clearlogBtn = document.getElementById('clearlog');
    if (clearlogBtn) {
        clearlogBtn.addEventListener('click', () => window.clearLog());
    }
});
