// Configuration
const EDGE_FUNCTION_URL = 'https://wrayzjdnlimxzqcswots.supabase.co/functions/v1/submit-voice-insight';
const MAX_DURATION_SECONDS = 120; // 2 minutes

// State
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;

// DOM Elements
const setupView = document.getElementById('setup-view');
const preRecordingView = document.getElementById('pre-recording-view');
const recordingView = document.getElementById('recording-view');
const loadingView = document.getElementById('loading-view');
const resultView = document.getElementById('result-view');
const setupForm = document.getElementById('setup-form');
const emailInput = document.getElementById('email-input');
const saveEmailBtn = document.getElementById('save-email-btn');
const setupError = document.getElementById('setup-error');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const timer = document.getElementById('timer');
const permissionInstructions = document.getElementById('permission-instructions');
const changeEmailBtn = document.getElementById('change-email-btn');
const changeEmailBtnResult = document.getElementById('change-email-btn-result');
const recordAnotherBtn = document.getElementById('record-another-btn');
const resultSuccess = document.getElementById('result-success');
const resultError = document.getElementById('result-error');
const resultTranscript = document.getElementById('result-transcript');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkEmailSetup();
  setupEventListeners();
  await checkMicrophonePermission();
  await checkActiveRecording();
});

// Check if there's an active recording
async function checkActiveRecording() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RECORDING_STATE'
    });
    
    if (response && response.isRecording) {
      // Resume the recording UI
      isRecording = true;
      recordingStartTime = Date.now() - (response.elapsed * 1000);
      showActiveRecordingView();
      startTimer();
    }
  } catch (error) {
    console.log('No active recording found:', error);
  }
}

// Check microphone permission status
async function checkMicrophonePermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      console.log('Microphone permission status:', result.state);
      
      result.onchange = () => {
        console.log('Microphone permission changed to:', result.state);
      };
    }
  } catch (error) {
    console.log('Could not check microphone permission:', error);
  }
}

// Check if email is already configured
async function checkEmailSetup() {
  try {
    const result = await chrome.storage.local.get(['userEmail']);
    if (result.userEmail) {
      showRecordingView(result.userEmail);
    } else {
      showSetupView();
    }
  } catch (error) {
    console.error('Error checking email setup:', error);
    showSetupView();
  }
}

// Show setup view
function showSetupView() {
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  // Small delay for smooth transition
  setTimeout(() => {
    setupView.style.display = 'block';
    setupView.style.opacity = '0';
    requestAnimationFrame(() => {
      setupView.style.opacity = '1';
    });
  }, 10);
  emailInput.value = '';
  setupError.style.display = 'none';
}

// Show pre-recording view (before recording starts)
function showRecordingView(email) {
  setupView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  // Small delay for smooth transition
  setTimeout(() => {
    preRecordingView.style.display = 'block';
    preRecordingView.style.opacity = '0';
    requestAnimationFrame(() => {
      preRecordingView.style.opacity = '1';
    });
  }, 10);
  // Store email for later use
  chrome.storage.local.set({ userEmail: email });
  resetUI();
}

//Show pre-recording view without email param
function showPreRecordingView() {
  setupView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  setTimeout(() => {
    preRecordingView.style.display = 'block';
    preRecordingView.style.opacity = '0';
    requestAnimationFrame(() => {
      preRecordingView.style.opacity = '1';
    });
  }, 10);
  resetUI();
}

// Show active recording view (during recording)
function showActiveRecordingView() {
  preRecordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  setTimeout(() => {
    recordingView.style.display = 'block';
    recordingView.style.opacity = '0';
    requestAnimationFrame(() => {
      recordingView.style.opacity = '1';
    });
  }, 10);
}

// Show loading view (processing)
function showLoadingView() {
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  resultView.style.display = 'none';
  setTimeout(() => {
    loadingView.style.display = 'block';
    loadingView.style.opacity = '0';
    requestAnimationFrame(() => {
      loadingView.style.opacity = '1';
    });
  }, 10);
}

// Show result view (after recording completes)
function showResultView(success, message, transcriptPreview = null) {
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  
  // Reset result displays
  resultSuccess.style.display = 'none';
  resultError.style.display = 'none';
  resultTranscript.style.display = 'none';
  
  if (success) {
    resultSuccess.style.display = 'flex';
    const resultText = resultSuccess.querySelector('.result-text');
    if (resultText) resultText.textContent = message;
    
    if (transcriptPreview) {
      resultTranscript.style.display = 'block';
      const transcriptText = resultTranscript.querySelector('.transcript-text');
      if (transcriptText) transcriptText.textContent = transcriptPreview;
    }
  } else {
    resultError.style.display = 'flex';
    const resultText = resultError.querySelector('.result-text');
    if (resultText) resultText.textContent = message;
  }
  
  setTimeout(() => {
    resultView.style.display = 'block';
    resultView.style.opacity = '0';
    requestAnimationFrame(() => {
      resultView.style.opacity = '1';
    });
  }, 10);
}

// Setup event listeners
function setupEventListeners() {
  setupForm.addEventListener('submit', handleEmailSubmit);
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  changeEmailBtn.addEventListener('click', handleChangeEmail);
  changeEmailBtnResult.addEventListener('click', handleChangeEmail);
  recordAnotherBtn.addEventListener('click', showPreRecordingView);
}

// Handle email submission
async function handleEmailSubmit(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim().toLowerCase();
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showSetupError('Please enter a valid email address');
    return;
  }
  
  try {
    saveEmailBtn.disabled = true;
    saveEmailBtn.textContent = 'Saving...';
    
    // Save email to storage
    await chrome.storage.local.set({ userEmail: email });
    
    // Show recording view
    showRecordingView(email);
  } catch (error) {
    console.error('Error saving email:', error);
    showSetupError('Failed to save email. Please try again.');
  } finally {
    saveEmailBtn.disabled = false;
    saveEmailBtn.textContent = 'Save & Continue';
  }
}

// Handle change email
async function handleChangeEmail() {
  await chrome.storage.local.remove(['userEmail']);
  showSetupView();
}

// Show setup error
function showSetupError(message) {
  setupError.textContent = message;
  setupError.style.display = 'block';
  setTimeout(() => {
    setupError.style.display = 'none';
  }, 5000);
}

// Start recording
async function startRecording() {
  try {
    // Start recording via background/offscreen
    const response = await chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      maxDuration: MAX_DURATION_SECONDS
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to start recording');
    }
    
    isRecording = true;
    recordingStartTime = Date.now();
    
    // Switch to active recording view
    showActiveRecordingView();
    
    // Start timer (counts down from 02:00)
    startTimer();
    
    // Auto-stop at 2 minutes
    setTimeout(() => {
      if (isRecording) {
        stopRecording();
      }
    }, MAX_DURATION_SECONDS * 1000);
    
  } catch (error) {
    // Log detailed error information
    console.error('Error starting recording:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      error: error
    });
    
    // Handle specific error types
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      let errorMsg = 'Microphone permission is required. ';
      if (error.message && error.message.includes('dismissed')) {
        errorMsg += 'The permission prompt was dismissed or blocked. ';
      } else if (error.message && error.message.includes('denied')) {
        errorMsg += 'Permission was previously denied. ';
      }
      errorMsg += 'To fix: Click the lock icon (🔒) in Chrome\'s address bar, find "Microphone" and set it to "Allow", then try again.';
      showPermissionInstructions();
      // Also show in result view after permission instructions
      showResultView(false, errorMsg);
    } else if (error.name === 'NotFoundError') {
      showResultView(false, 'No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      showResultView(false, 'Microphone is being used by another application. Please close other apps using the microphone and try again.');
    } else if (error.name === 'OverconstrainedError') {
      showResultView(false, 'Microphone constraints could not be satisfied. Please try a different microphone.');
    } else {
      showResultView(false, `Failed to start recording: ${error.message || error.name || 'Unknown error'}. Please try again.`);
    }
  }
}

// Stop recording
async function stopRecording() {
  if (!isRecording) {
    return;
  }
  
  isRecording = false;
  stopTimer();
  
  try {
    // Stop recording via background/offscreen
    const response = await chrome.runtime.sendMessage({
      type: 'STOP_RECORDING'
    });
    
    if (response && response.success) {
      // Process the recording
      await handleRecordingComplete(response.audio_base64, response.duration_seconds);
    } else {
      throw new Error(response?.error || 'Failed to stop recording');
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    showResultView(false, 'Failed to process recording. Please try again.');
  }
}

// Handle recording complete
async function handleRecordingComplete(base64Audio, duration) {
  try {
    // Show loading view
    showLoadingView();
    
    // Get user email
    const result = await chrome.storage.local.get(['userEmail']);
    const userEmail = result.userEmail;
    
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const sourceUrl = tab?.url || null;
    const userAgent = navigator.userAgent;
    
    // Submit to edge function
    await submitRecording({
      audio_base64: base64Audio,
      user_email: userEmail,
      source_url: sourceUrl,
      user_agent: userAgent,
      duration_seconds: duration
    });
    
  } catch (error) {
    console.error('Error processing recording:', error);
    showResultView(false, 'Failed to process recording. Please try again.');
  }
}

// Submit recording to edge function
async function submitRecording(data) {
  try {
    stopBtn.disabled = true;
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Edge Function response:', result);
    
    // Verify transcription completed successfully
    if (!result.success) {
      console.error('Transcription failed - result.success is not true:', result);
      throw new Error(result.error || 'Transcription failed');
    }
    
    // Build success message with personality
    const mainMessage = 'I\'ve transcribed your recording and your feedback is being processed.';
    const transcriptPreview = result.transcript_preview || null;
    
    console.log('Showing success result with transcript:', transcriptPreview);
    
    // Show result view with success
    showResultView(true, mainMessage, transcriptPreview);
    
  } catch (error) {
    console.error('Error submitting recording:', error);
    
    let errorMsg = 'Failed to submit recording. ';
    if (error.message.includes('Transcription failed')) {
      errorMsg = 'The audio could not be transcribed. Please try speaking more clearly.';
    } else if (error.message.includes('No speech detected')) {
      errorMsg = 'No speech was detected in the recording. Please try again.';
    } else if (error.message.includes('exceeds maximum duration')) {
      errorMsg = 'Recording was too long. Maximum duration is 2 minutes.';
    } else if (error.message.includes('Network')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else {
      errorMsg = error.message || 'Something went wrong. Please try again.';
    }
    
    showResultView(false, errorMsg);
  } finally {
    stopBtn.disabled = false;
  }
}

// Start timer (counts down from 02:00)
function startTimer() {
  // Initialize timer display
  timer.textContent = '02:00';
  timer.style.color = '#1f2937';
  timer.classList.add('recording');
  
  timerInterval = setInterval(() => {
    if (!isRecording) {
      stopTimer();
      return;
    }
    
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const remaining = MAX_DURATION_SECONDS - elapsed;
    
    if (remaining <= 0) {
      stopRecording();
      return;
    }
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Warning at 10 seconds remaining
    if (remaining <= 10) {
      timer.style.color = '#ef4444';
    } else {
      timer.style.color = '#1f2937';
    }
  }, 100);
}

// Stop timer
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Reset UI to initial state (pre-recording view)
function resetUI() {
  isRecording = false;
  recordingStartTime = null;
  stopTimer();
  
  // Reset timer
  timer.textContent = '02:00';
  timer.style.color = '#1f2937';
  timer.classList.remove('recording');
  
  // Reset buttons
  recordBtn.disabled = false;
  stopBtn.disabled = false;
  
  if (permissionInstructions) {
    permissionInstructions.style.display = 'none';
  }
}

// Show permission instructions
function showPermissionInstructions() {
  if (permissionInstructions) {
    permissionInstructions.style.display = 'block';
  }
}

