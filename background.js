// Background service worker for Simple Alarm extension
// Handles alarms, notifications, and data persistence

const EVENTS_KEY = "events";
const MIN_LEAD_TIME_MS = 60 * 1000; // 1 minute

// Utility functions for storage
async function getEvents() {
  return new Promise((resolve) => {
    chrome.storage.local.get([EVENTS_KEY], (result) => {
      resolve(result[EVENTS_KEY] || []);
    });
  });
}

async function setEvents(events) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [EVENTS_KEY]: events }, () => resolve());
  });
}

async function getEventById(id) {
  const events = await getEvents();
  return events.find(event => event.id === id) || null;
}

async function updateEventStatus(id, status, completedAtMs = null) {
  const events = await getEvents();
  const eventIndex = events.findIndex(event => event.id === id);
  if (eventIndex >= 0) {
    events[eventIndex].status = status;
    if (completedAtMs !== null) {
      events[eventIndex].completedAtMs = completedAtMs;
    }
    await setEvents(events);
  }
}

// Alarm management
function scheduleAlarm(eventId, whenMs) {
  chrome.alarms.create(eventId, { when: whenMs });
}

function clearAlarm(eventId) {
  chrome.alarms.clear(eventId);
}

// Notification handling
function showNotification(event) {
  const title = event.title || "Reminder";
  const whenDate = new Date(event.whenMs);
  const message = whenDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  chrome.notifications.create(event.id, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: title,
    message: message,
    requireInteraction: true,
    priority: 2
  });
}

// Event listeners
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const event = await getEventById(alarm.name);
  if (!event || event.status !== 'pending') return;
  
  showNotification(event);
  // Don't delete event here - wait for user to click notification
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Mark event as completed
  await updateEventStatus(notificationId, 'completed', Date.now());
  
  // Clear the notification
  chrome.notifications.clear(notificationId);
  
  // Optionally open popup
  chrome.action.openPopup();
});

chrome.notifications.onClosed.addListener((notificationId) => {
  // Clean up if needed
});

// Startup handling
async function handleStartup() {
  const events = await getEvents();
  const now = Date.now();
  
  for (const event of events) {
    if (event.status === 'completed') {
      // Skip completed events
      continue;
    }
    
    if (event.whenMs <= now) {
      // Event is overdue - show notification immediately
      showNotification(event);
    } else {
      // Event is in the future - schedule alarm
      scheduleAlarm(event.id, event.whenMs);
    }
  }
}

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(handleStartup);
chrome.runtime.onStartup.addListener(handleStartup);

// Handle messages from popup (if needed)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getEvents') {
    getEvents().then(sendResponse);
    return true; // Keep message channel open
  }
});
