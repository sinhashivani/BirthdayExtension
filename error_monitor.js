// error_monitor.js
// This script runs in the webpage's main world to capture its console errors.

console.log('Error Monitor: Initializing...');

// Store the original console.error function
const originalConsoleError = console.error;

// Override console.error to intercept messages
console.error = function (...args) {
    originalConsoleError.apply(this, args); // Call the original console.error

    const errorMessage = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');

    // Check for specific CSP errors
    if (errorMessage.includes("Refused to evaluate a string as JavaScript because 'unsafe-eval'") ||
        errorMessage.includes("Content Security Policy") && errorMessage.includes("script")) {
        console.warn("Error Monitor: Detected CSP 'unsafe-eval' error:", errorMessage);
        // Send a message to the content script (which has access to chrome.runtime)
        window.postMessage({ type: 'EXTENSION_DETECTED_CSP_ERROR', message: errorMessage }, '*');
    }
    // Add other critical error types you want to detect here
    // if (errorMessage.includes("another critical error pattern")) {
    //    window.postMessage({ type: 'EXTENSION_DETECTED_CRITICAL_ERROR', message: errorMessage }, '*');
    // }
};

// Also listen for uncaught errors
window.addEventListener('error', function (event) {
    const errorMessage = event.message;
    if (errorMessage.includes("Refused to evaluate a string as JavaScript because 'unsafe-eval'") ||
        (event.error && event.error.message && event.error.message.includes("Refused to evaluate"))) {
        console.warn("Error Monitor: Detected uncaught CSP 'unsafe-eval' error:", errorMessage);
        window.postMessage({ type: 'EXTENSION_DETECTED_CSP_ERROR', message: errorMessage }, '*');
    }
    // Prevent default error handling if you want, but generally not recommended unless you know why
    // event.preventDefault();
});

// For unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
    const errorMessage = event.reason.message || event.reason;
    if (errorMessage.includes("Refused to evaluate a string as JavaScript because 'unsafe-eval'")) {
        console.warn("Error Monitor: Detected unhandled promise rejection with CSP 'unsafe-eval' error:", errorMessage);
        window.postMessage({ type: 'EXTENSION_DETECTED_CSP_ERROR', message: errorMessage }, '*');
    }
});

console.log('Error Monitor: Finished initialization.');