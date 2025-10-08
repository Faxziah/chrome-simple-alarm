# Simple Alarm - Chrome Extension

A minimal Chrome extension for creating one-shot reminders with date and time. Built with Manifest V3, no server required.

## Features

- **One-shot reminders**: Create reminders for specific date and time
- **Persistent storage**: Reminders survive browser/computer restarts
- **System notifications**: Native Chrome notifications with custom sound
- **Two-tab interface**: Pending and Completed reminders
- **CRUD operations**: Create, edit, delete reminders
- **Auto-completion**: Events automatically move to Completed when triggered
- **Offline-first**: No internet connection required

## Technical Details

### Architecture
- **Manifest V3** with service worker
- **Chrome Alarms API** for scheduling (minimum 30 seconds delay)
- **Chrome Storage API** for data persistence
- **Chrome Notifications API** for system alerts
- **Offscreen Document API** for custom audio playback

### Permissions
- `alarms` - Schedule reminder notifications
- `notifications` - Show system notifications
- `storage` - Persist reminder data locally
- `offscreen` - Play custom alarm sounds

### Data Model
```javascript
{
  id: string,           // Unique identifier
  title: string,        // Reminder title
  whenMs: number,      // Absolute timestamp (epoch ms)
  createdAtMs: number, // Creation timestamp
  status: 'pending' | 'completed',
  completedAtMs: number | null
}
```

### Key Components

#### Background Service Worker (`background.js`)
- Handles alarm scheduling and firing
- Manages event status transitions (pending → completed)
- Plays custom alarm sounds via offscreen document
- Handles startup reconciliation for missed events

#### Popup UI (`popup.html`, `popup.js`, `popup.css`)
- Two-tab interface (Pending/Completed)
- Form validation (minimum 30 seconds in future)
- Real-time UI updates via storage listeners
- CSP-compliant event delegation

#### Offscreen Document (`offscreen.html`, `offscreen.js`)
- Custom alarm sound generation using Web Audio API
- Works even when Chrome is minimized/closed

### Edge Cases Handled
- **Missed events**: Events that fire while Chrome/computer is off are notified immediately on startup
- **Concurrent events**: Multiple events scheduled for the same time are all processed
- **Edit protection**: Completed events cannot be edited (prevents status corruption)
- **Storage limits**: Events are lightweight, well within 5MB chrome.storage.local limit

### Browser Compatibility
- Chrome 88+ (Manifest V3 support)
- Requires Chrome Alarms API support
- Web Audio API for custom sounds

### Security & Privacy
- **No data collection**: All data stored locally
- **No external requests**: Completely offline
- **CSP compliant**: No inline scripts or styles
- **Minimal permissions**: Only required Chrome APIs

### Development Notes
- Uses `chrome.alarms.create()` with `when` parameter for one-shot scheduling
- Custom sound via offscreen document (service workers can't access AudioContext)
- Real-time UI updates via `chrome.storage.onChanged` listener
- Form validation prevents past-time scheduling
- Auto-generated event titles ("Alarm 1", "Alarm 2", etc.)

### Testing Checklist
- [ ] Create reminder 2+ minutes in future → notification fires
- [ ] Create reminder < 30 seconds → blocked by validation
- [ ] Edit reminder time → old alarm cleared, new alarm scheduled
- [ ] Delete reminder → alarm cleared, no notification
- [ ] Close Chrome before due time, reopen after → immediate notification
- [ ] Multiple events at same time → all fire and move to completed
- [ ] Edit completed event → blocked with error message
- [ ] System DND mode → notification may be silent (expected behavior)

### File Structure
```
manifest.json          # Extension configuration
background.js          # Service worker for alarms/notifications
popup.html             # Main UI
popup.js              # UI logic and event handling
popup.css             # Styling
offscreen.html        # Audio playback document
offscreen.js          # Custom sound generation
icons/                # Extension icons (16, 32, 48, 128px)
```

### Build & Deploy
1. Load unpacked extension in Chrome for testing
2. Package extension for Chrome Web Store
3. Upload to Chrome Web Store with required assets
4. No build process required (vanilla HTML/CSS/JS)

### Dependencies
- None (vanilla JavaScript, no external libraries)
- Chrome Extensions APIs only
- No npm packages or build tools required
