// Popup script for Simple Alarm extension
// Handles UI interactions, CRUD operations, and validation

const EVENTS_KEY = "events";

let currentEditingId = null;
let events = [];

// DOM elements
const pendingTab = document.getElementById('pending-tab');
const completedTab = document.getElementById('completed-tab');
const pendingEventsList = document.getElementById('pending-events');
const completedEventsList = document.getElementById('completed-events');
const eventForm = document.getElementById('event-form');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// Form elements
const titleInput = document.getElementById('event-title');
const dateInput = document.getElementById('event-date');
const timeInput = document.getElementById('event-time');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-button');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadEvents();
  setupEventListeners();
  renderEvents();
  setMinDateTime();
  setupMessageListener();
  // Pre-fill default title on initial open if empty
  if (!titleInput.value) {
    titleInput.value = getNextAlarmTitle();
  }
});

// Event listeners
function setupEventListeners() {
  // Form submission
  eventForm.addEventListener('submit', handleFormSubmit);
  
  // Cancel button
  cancelBtn.addEventListener('click', cancelEdit);
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Delegated clicks for Pending list (Edit/Delete)
  pendingEventsList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const id = actionBtn.getAttribute('data-id');
    if (action === 'edit') {
      onEditEvent(id);
    } else if (action === 'delete') {
      onDeleteEvent(id);
    }
  });

  // Delegated clicks for Completed list (Delete only)
  completedEventsList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    const id = actionBtn.getAttribute('data-id');
    if (action === 'delete') {
      onDeleteEvent(id);
    }
  });
}

// Tab management
function switchTab(tabName) {
  // Update tab buttons
  tabButtons.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Reset form if switching to pending
  if (tabName === 'pending') {
    resetForm();
  }
}

// Data management
async function loadEvents() {
  return new Promise((resolve) => {
    chrome.storage.local.get([EVENTS_KEY], (result) => {
      events = result[EVENTS_KEY] || [];
      resolve();
    });
  });
}

async function saveEvents() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [EVENTS_KEY]: events }, () => resolve());
  });
}

// Form handling
function handleFormSubmit(e) {
  e.preventDefault();
  
  const title = titleInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;
  
  // Validation
  if (!title) {
    alert('Please enter a title');
    return;
  }
  
  if (!date || !time) {
    alert('Please select both date and time');
    return;
  }
  
  const whenMs = new Date(`${date}T${time}`).getTime();
  const now = Date.now();
  
  if (whenMs <= now) {
    alert('Please select a time in the future');
    return;
  }
  
  // Create or update event
  const eventData = {
    title,
    whenMs,
    createdAtMs: now,
    status: 'pending',
    completedAtMs: null
  };
  
  if (currentEditingId) {
    // Update existing event
    const eventIndex = events.findIndex(e => e.id === currentEditingId);
    if (eventIndex >= 0) {
      events[eventIndex] = { ...events[eventIndex], ...eventData };
      // Clear existing alarm and create new one
      chrome.alarms.clear(currentEditingId);
      chrome.alarms.create(currentEditingId, { when: whenMs });
    }
  } else {
    // Create new event
    const newEvent = {
      id: generateId(),
      ...eventData
    };
    events.push(newEvent);
    chrome.alarms.create(newEvent.id, { when: whenMs });
  }
  
  saveEvents().then(() => {
    resetForm();
    renderEvents();
  });
}

function cancelEdit() {
  resetForm();
}

function resetForm() {
  currentEditingId = null;
  titleInput.value = getNextAlarmTitle();
  dateInput.value = '';
  timeInput.value = '';
  saveBtn.textContent = 'Save Reminder';
  cancelBtn.style.display = 'none';
  setMinDateTime();
}

function setMinDateTime() {
  const now = new Date();
  const minDate = now.toISOString().split('T')[0];
  const minTime = now.toTimeString().slice(0, 5);
  
  dateInput.min = minDate;
  timeInput.min = minTime;
  
  // Set default to 1 minute from now
  const defaultTime = new Date(now.getTime() + 60 * 1000);
  if (!dateInput.value) {
    dateInput.value = defaultTime.toISOString().split('T')[0];
  }
  if (!timeInput.value) {
    timeInput.value = defaultTime.toTimeString().slice(0, 5);
  }
}

// Event rendering
function renderEvents() {
  renderPendingEvents();
  renderCompletedEvents();
}

function renderPendingEvents() {
  const pendingEvents = events.filter(e => e.status === 'pending');
  
  if (pendingEvents.length === 0) {
    pendingEventsList.innerHTML = `
      <div class="empty-state">
        <h3>No pending reminders</h3>
        <p>Add a new reminder above</p>
      </div>
    `;
    return;
  }
  
  // Sort by time
  pendingEvents.sort((a, b) => a.whenMs - b.whenMs);
  
  pendingEventsList.innerHTML = pendingEvents.map(event => `
    <div class="event-item">
      <div class="event-info">
        <div class="event-title">${escapeHtml(event.title)}</div>
        <div class="event-time">${formatDateTime(event.whenMs)}</div>
      </div>
      <div class="event-actions">
        <button class="btn-edit" data-action="edit" data-id="${event.id}">Edit</button>
        <button class="btn-delete" data-action="delete" data-id="${event.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderCompletedEvents() {
  const completedEvents = events.filter(e => e.status === 'completed');
  
  if (completedEvents.length === 0) {
    completedEventsList.innerHTML = `
      <div class="empty-state">
        <h3>No completed reminders</h3>
        <p>Completed reminders will appear here</p>
      </div>
    `;
    return;
  }
  
  // Sort by completion time (newest first)
  completedEvents.sort((a, b) => (b.completedAtMs || 0) - (a.completedAtMs || 0));
  
  completedEventsList.innerHTML = completedEvents.map(event => `
    <div class="event-item">
      <div class="event-info">
        <div class="event-title">${escapeHtml(event.title)}</div>
        <div class="event-time">
          Completed: ${formatDateTime(event.completedAtMs || event.whenMs)}
        </div>
      </div>
      <div class="event-actions">
        <button class="btn-delete" data-action="delete" data-id="${event.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

// Event actions
function onEditEvent(id) {
  const event = events.find(e => e.id === id);
  if (!event) return;
  
  currentEditingId = id;
  titleInput.value = event.title;
  
  const eventDate = new Date(event.whenMs);
  dateInput.value = eventDate.toISOString().split('T')[0];
  timeInput.value = eventDate.toTimeString().slice(0, 5);
  
  saveBtn.textContent = 'Update Reminder';
  cancelBtn.style.display = 'inline-block';
  
  // Scroll to form
  document.querySelector('body').scrollIntoView({ behavior: 'smooth' });
}

async function onDeleteEvent(id) {
  const target = events.find(e => e.id === id);
  if (!target) return;
  // Ask confirmation only for pending items; delete completed immediately
  if (target.status === 'pending') {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
  }
  
  // Remove from events array
  events = events.filter(e => e.id !== id);
  
  // Clear alarm
  chrome.alarms.clear(id);
  
  // Save changes
  await saveEvents();
  renderEvents();
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Compute next default title like "Alarm 1", "Alarm 2", ... unique among pending
function getNextAlarmTitle() {
  const base = 'Alarm';
  const pendingTitles = new Set(
    events.filter(e => e.status === 'pending').map(e => (e.title || '').trim())
  );
  let n = 1;
  while (pendingTitles.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

// Message listener for custom alarm sound
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playAlarmSound') {
      playCustomAlarmSound(request.eventTitle);
    }
  });
}

// Play custom alarm sound using Web Audio API
function playCustomAlarmSound(eventTitle) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a more complex alarm sound
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
    
    // Show visual feedback
    showAlarmVisualFeedback(eventTitle);
    
  } catch (error) {
    console.log('Could not play custom alarm sound:', error);
  }
}

// Show visual feedback for alarm
function showAlarmVisualFeedback(eventTitle) {
  // Create a temporary visual indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-weight: bold;
    z-index: 10000;
    animation: pulse 0.5s ease-in-out 3;
  `;
  indicator.textContent = `🔔 ${eventTitle}`;
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 3000);
}
