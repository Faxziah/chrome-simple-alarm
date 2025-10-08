// Offscreen audio playback for Simple Alarm

async function playBeep() {
  try {
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(900, audioContext.currentTime);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.6);
  } catch (e) {
    // no-op
  }
}

async function playAlarmPattern() {
  await playBeep();
  setTimeout(playBeep, 700);
  setTimeout(playBeep, 700);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'offscreen-play-sound') {
    playAlarmPattern();
  }
});

