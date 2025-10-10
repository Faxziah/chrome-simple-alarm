// Alarm popup script
// Handles snooze, clear, and close functionality

let alarmData = null;

// Get alarm data from URL parameters
function getAlarmDataFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        id: urlParams.get('id'),
        title: 'Simple Alarm',
        description: urlParams.get('title'),
        time: urlParams.get('time') || new Date().toLocaleString()
    };
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    alarmData = getAlarmDataFromUrl();
    
    // Update UI with alarm data
    document.getElementById('alarm-title').textContent = alarmData.title;
    document.getElementById('alarm-description').textContent = alarmData.description;
    document.getElementById('alarm-time').textContent = alarmData.time;
    
    // Center window on screen
    centerWindow();
    
    // Setup event listeners
    setupEventListeners();
    
    // Play alarm sound
    playAlarmSound();
});

function centerWindow() {
    if (window.chrome && window.chrome.windows) {
        // Get current window and center it
        chrome.windows.getCurrent((window) => {
            const screenWidth = screen.width;
            const screenHeight = screen.height;
            const windowWidth = 600;
            const windowHeight = 300;
            
            const left = Math.round((screenWidth - windowWidth) / 2);
            const top = Math.round((screenHeight - windowHeight) / 2);
            
            chrome.windows.update(window.id, {
                left: left,
                top: top
            });
        });
    }
}

function setupEventListeners() {
    // Snooze button
    document.getElementById('snooze').addEventListener('click', handleSnooze);
    
    // Clear snoozes button
    document.getElementById('clear').addEventListener('click', handleClearSnoozes);
    
    // Close button
    document.getElementById('done').addEventListener('click', handleClose);
}

function handleSnooze() {
    const snoozeMinutes = parseInt(document.getElementById('range').value);
    
    // Validate input
    if (isNaN(snoozeMinutes) || snoozeMinutes < 1 || snoozeMinutes > 1440) {
        showFeedback('Please enter a number between 1 and 1440 minutes');
        return;
    }
    
    const snoozeTime = Date.now() + (snoozeMinutes * 60 * 1000);
    
    // Send message to background script to create snooze alarm
    chrome.runtime.sendMessage({
        action: 'snoozeAlarm',
        alarmId: alarmData.id,
        snoozeTime: snoozeTime,
        snoozeMinutes: snoozeMinutes
    });
    
    // Show feedback
    showFeedback(`Alarm snoozed for ${snoozeMinutes} minutes`);
    
    // Close popup after short delay
    setTimeout(() => {
        window.close();
    }, 1000);
}

function handleClearSnoozes() {
    // Send message to background script to clear all snoozes
    chrome.runtime.sendMessage({
        action: 'clearAllSnoozes',
        alarmId: alarmData.id
    });
    
    showFeedback('All snoozes cleared');
    
    setTimeout(() => {
        window.close();
    }, 1000);
}

function handleClose() {
    // Send message to background script that alarm was dismissed
    chrome.runtime.sendMessage({
        action: 'dismissAlarm',
        alarmId: alarmData.id
    });
    
    window.close();
}

function playAlarmSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create alarm sound
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // First beep: 800Hz -> 1000Hz -> 800Hz
        oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator1.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        oscillator1.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        
        // Second beep: 600Hz -> 1200Hz -> 600Hz
        oscillator2.frequency.setValueAtTime(600, audioContext.currentTime + 0.3);
        oscillator2.frequency.setValueAtTime(1200, audioContext.currentTime + 0.4);
        oscillator2.frequency.setValueAtTime(600, audioContext.currentTime + 0.5);
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.35);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.2);
        
        oscillator2.start(audioContext.currentTime + 0.3);
        oscillator2.stop(audioContext.currentTime + 0.5);
        
    } catch (error) {
        console.log('Could not play alarm sound:', error);
    }
}

function showFeedback(message) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #34C759;
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 500;
        z-index: 1000;
        animation: slideDown 0.3s ease-out;
    `;
    feedback.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 2000);
}

