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

// Alarm popup handling
function showAlarmPopup(event) {
  const whenDate = new Date(event.whenMs);
  const timeString = whenDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Create URL with alarm data
  const popupUrl = chrome.runtime.getURL('alarm-popup.html') + 
    `?id=${encodeURIComponent(event.id)}` +
    `&title=${encodeURIComponent(event.title || 'Alarm')}` +
    `&description=${encodeURIComponent('Simple Alarm')}` +
    `&time=${encodeURIComponent(timeString)}`;
  
  // Open popup window
  chrome.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 600,
    height: 300,
    focused: true,
    state: 'normal'
  });
}

// Offscreen document helper
async function ensureOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play alarm sound when alarm fires'
  });
}

// Event listeners
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const event = await getEventById(alarm.name);
  if (!event || event.status !== 'pending') return;
  
  // 1. Mark event as completed immediately when alarm fires
  await updateEventStatus(alarm.name, 'completed', Date.now());
  
  // 2. Show alarm popup
  showAlarmPopup(event);

  // 3. Sweep any other pending events that are overdue and move them to completed
  await sweepOverduePending(event.id);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Event is already marked as completed when alarm fired
  // Just clear the notification
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
      // Event is overdue - mark as completed and show alarm popup immediately
      await updateEventStatus(event.id, 'completed', now);
      showAlarmPopup(event);
    } else {
      // Event is in the future - schedule alarm
      scheduleAlarm(event.id, event.whenMs);
    }
  }
}

// Sweep helper: complete and notify all pending events already in the past
async function sweepOverduePending(excludeId) {
  const now = Date.now();
  const all = await getEvents();
  for (const e of all) {
    if (e.id === excludeId) continue;
    if (e.status !== 'pending') continue;
    if (e.whenMs > now) continue;
    await updateEventStatus(e.id, 'completed', now);
    showAlarmPopup(e);
  }
}

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(handleStartup);
chrome.runtime.onStartup.addListener(handleStartup);

// Handle messages from popup and alarm popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getEvents') {
    getEvents().then(sendResponse);
    return true; // Keep message channel open
  }
  
  if (request.action === 'snoozeAlarm') {
    handleSnoozeAlarm(request.alarmId, request.snoozeTime, request.snoozeMinutes);
    sendResponse({success: true});
  }
  
  if (request.action === 'clearAllSnoozes') {
    handleClearAllSnoozes(request.alarmId);
    sendResponse({success: true});
  }
  
  if (request.action === 'dismissAlarm') {
    handleDismissAlarm(request.alarmId);
    sendResponse({success: true});
  }
  
  return true;
});

// Handle snooze alarm
async function handleSnoozeAlarm(alarmId, snoozeTime, snoozeMinutes) {
  // Create new alarm for snooze
  chrome.alarms.create(`${alarmId}_snooze_${Date.now()}`, { when: snoozeTime });
  
  // Update event status to pending with new time
  await updateEventStatus(alarmId, 'pending');
  const events = await getEvents();
  const eventIndex = events.findIndex(e => e.id === alarmId);
  if (eventIndex >= 0) {
    events[eventIndex].whenMs = snoozeTime;
    await setEvents(events);
  }
}

// Handle clear all snoozes
async function handleClearAllSnoozes(alarmId) {
  // Clear all alarms for this event
  const alarms = await chrome.alarms.getAll();
  alarms.forEach(alarm => {
    if (alarm.name.startsWith(alarmId)) {
      chrome.alarms.clear(alarm.name);
    }
  });
}

// Handle dismiss alarm
async function handleDismissAlarm(alarmId) {
  // Clear all alarms for this event
  const alarms = await chrome.alarms.getAll();
  alarms.forEach(alarm => {
    if (alarm.name.startsWith(alarmId)) {
      chrome.alarms.clear(alarm.name);
    }
  });
}
