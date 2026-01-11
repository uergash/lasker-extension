// Configuration
const VOICE_EDGE_FUNCTION_URL = 'https://wrayzjdnlimxzqcswots.supabase.co/functions/v1/submit-voice-insight';
const SUPABASE_URL = 'https://wrayzjdnlimxzqcswots.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyYXl6amRubGlteHpxY3N3b3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTQwMDksImV4cCI6MjA3MzM3MDAwOX0.lZjyhOdtRd6M1j04tlKm7QXaBc2EgQK77z4y2FR5a2E'; // You'll need to provide this
const EMAIL_SUBMISSIONS_URL = `${SUPABASE_URL}/rest/v1/email_submissions`;
const MAX_DURATION_SECONDS = 120; // 2 minutes

// State
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;
let pendingEmailData = null;

// DOM Elements
const welcomeView = document.getElementById('welcome-view');
const setupView = document.getElementById('setup-view');
const emailPreviewView = document.getElementById('email-preview-view');
const preRecordingView = document.getElementById('pre-recording-view');
const recordingView = document.getElementById('recording-view');
const loadingView = document.getElementById('loading-view');
const resultView = document.getElementById('result-view');
const getStartedBtn = document.getElementById('get-started-btn');
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
const submitEmailBtn = document.getElementById('submit-email-btn');
const cancelEmailBtn = document.getElementById('cancel-email-btn');
const emailFrom = document.getElementById('email-from');
const emailSubject = document.getElementById('email-subject');
const emailSnippet = document.getElementById('email-snippet');
const emailSuccessAction = document.getElementById('email-success-action');
const recordInsightLink = document.getElementById('record-insight-link');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  
  const hasPendingEmail = await checkForPendingEmail();
  
  // Only check email setup if there's no pending email to preview
  if (!hasPendingEmail) {
    // Check if we need to show welcome screen for permission
    const needsPermissionSetup = await checkIfNeedsPermissionSetup();
    
    if (needsPermissionSetup) {
      showWelcomeView();
    } else {
      await checkEmailSetup();
    }
  }
  
  await checkMicrophonePermission();
  await checkActiveRecording();
});

// Check if there's a pending email from Gmail
async function checkForPendingEmail() {
  
  try {
    const result = await chrome.storage.local.get(['pendingEmail', 'userEmail']);
    
    
    if (result.pendingEmail && result.userEmail) {
      // Show email preview view
      pendingEmailData = result.pendingEmail;
      
      
      showEmailPreviewView(result.pendingEmail);
      
      // Clear pending email from storage
      await chrome.storage.local.remove(['pendingEmail']);
      return true;
    }
    
    
    return false;
  } catch (error) {
    console.error('Error checking for pending email:', error);
    return false;
  }
}

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

// Check if we need to show the welcome screen for permission setup
async function checkIfNeedsPermissionSetup() {
  try {
    // Check if user has completed setup before
    const result = await chrome.storage.local.get(['permissionSetupComplete']);
    
    if (result.permissionSetupComplete) {
      return false; // Already completed setup
    }
    
    // Check current permission status
    if (navigator.permissions && navigator.permissions.query) {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      
      // If already granted, mark setup as complete and skip welcome screen
      if (permissionStatus.state === 'granted') {
        await chrome.storage.local.set({ permissionSetupComplete: true });
        return false;
      }
    }
    
    // Need to show welcome screen
    return true;
  } catch (error) {
    console.log('Could not check permission setup status:', error);
    // If we can't check, assume we need to show welcome screen
    return true;
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

// Request microphone permission
async function requestMicrophonePermission() {
  try {
    // Request microphone access - this will show Chrome's permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Immediately stop the stream - we just needed to trigger the permission prompt
    stream.getTracks().forEach(track => track.stop());
    
    // Mark permission setup as complete
    await chrome.storage.local.set({ permissionSetupComplete: true });
    
    return { success: true };
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return { success: false, error: error };
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

// Show welcome view
function showWelcomeView() {
  setupView.style.display = 'none';
  emailPreviewView.style.display = 'none';
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  // Small delay for smooth transition
  setTimeout(() => {
    welcomeView.style.display = 'block';
    welcomeView.style.opacity = '0';
    requestAnimationFrame(() => {
      welcomeView.style.opacity = '1';
    });
  }, 10);
}

// Show setup view
function showSetupView() {
  welcomeView.style.display = 'none';
  emailPreviewView.style.display = 'none';
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

// Show email preview view
function showEmailPreviewView(emailData) {
  welcomeView.style.display = 'none';
  setupView.style.display = 'none';
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  resultView.style.display = 'none';
  
  // Populate email preview
  emailFrom.textContent = `From: ${emailData.from.name || emailData.from.email}`;
  emailSubject.textContent = emailData.subject || '(No subject)';
  
  // Create snippet (first 200 chars)
  const snippet = emailData.body.length > 200 
    ? emailData.body.substring(0, 200) + '...' 
    : emailData.body;
  emailSnippet.textContent = snippet;
  
  // Small delay for smooth transition
  setTimeout(() => {
    emailPreviewView.style.display = 'block';
    emailPreviewView.style.opacity = '0';
    requestAnimationFrame(() => {
      emailPreviewView.style.opacity = '1';
    });
  }, 10);
}

// Show pre-recording view (before recording starts)
function showRecordingView(email) {
  welcomeView.style.display = 'none';
  setupView.style.display = 'none';
  emailPreviewView.style.display = 'none';
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
  welcomeView.style.display = 'none';
  setupView.style.display = 'none';
  emailPreviewView.style.display = 'none';
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
  welcomeView.style.display = 'none';
  emailPreviewView.style.display = 'none';
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
function showLoadingView(message = null) {
  welcomeView.style.display = 'none';
  emailPreviewView.style.display = 'none';
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  resultView.style.display = 'none';
  
  // Update loading message if provided
  if (message) {
    const loadingText = loadingView.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = message;
  }
  
  setTimeout(() => {
    loadingView.style.display = 'block';
    loadingView.style.opacity = '0';
    requestAnimationFrame(() => {
      loadingView.style.opacity = '1';
    });
  }, 10);
}

// Show result view (after recording completes or email submission)
function showResultView(success, message, transcriptPreview = null, type = 'recording') {
  welcomeView.style.display = 'none';
  emailPreviewView.style.display = 'none';
  preRecordingView.style.display = 'none';
  recordingView.style.display = 'none';
  loadingView.style.display = 'none';
  
  // Reset result displays
  resultSuccess.style.display = 'none';
  resultError.style.display = 'none';
  resultTranscript.style.display = 'none';
  emailSuccessAction.style.display = 'none';
  
  // Update title and button visibility based on type
  const resultTitle = resultSuccess.querySelector('.result-title');
  const recordAnotherBtn = document.getElementById('record-another-btn');
  const btnText = recordAnotherBtn.querySelector('.btn-text');
  const micIcon = recordAnotherBtn.querySelector('.mic-icon-svg');
  
  if (type === 'email') {
    // Email flow customization
    if (resultTitle) resultTitle.textContent = 'Extracted';
    // Hide the button for email flow
    recordAnotherBtn.style.display = 'none';
    // Show email success action (only on success)
    if (success) {
      emailSuccessAction.style.display = 'flex';
    }
  } else {
    // Recording flow customization
    if (resultTitle) resultTitle.textContent = 'Recorded';
    if (btnText) btnText.textContent = 'Record Another';
    if (micIcon) micIcon.style.display = 'block';
    // Show the button for recording flow
    recordAnotherBtn.style.display = 'flex';
    // Hide email success action
    emailSuccessAction.style.display = 'none';
  }
  
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
  getStartedBtn.addEventListener('click', handleGetStarted);
  setupForm.addEventListener('submit', handleEmailSubmit);
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  changeEmailBtn.addEventListener('click', handleChangeEmail);
  changeEmailBtnResult.addEventListener('click', handleChangeEmail);
  recordAnotherBtn.addEventListener('click', showPreRecordingView);
  submitEmailBtn.addEventListener('click', handleSubmitEmail);
  cancelEmailBtn.addEventListener('click', handleCancelEmail);
  recordInsightLink.addEventListener('click', handleRecordInsight);
}

// Handle Get Started button click (request microphone permission)
async function handleGetStarted() {
  try {
    getStartedBtn.disabled = true;
    getStartedBtn.textContent = 'Requesting permission...';
    
    const result = await requestMicrophonePermission();
    
    if (result.success) {
      // Permission granted, proceed to email setup
      await checkEmailSetup();
    } else {
      // Permission denied, show instructions
      if (result.error.name === 'NotAllowedError' || result.error.name === 'PermissionDeniedError') {
        alert('Microphone access is required to use Lasker. Please click the icon in your browser\'s address bar and allow microphone access, then try again.');
        showWelcomeView();
      } else {
        alert('Could not access microphone. Please check your system settings and try again.');
        showWelcomeView();
      }
    }
  } catch (error) {
    console.error('Error requesting permission:', error);
    alert('An error occurred. Please try again.');
    showWelcomeView();
  } finally {
    getStartedBtn.disabled = false;
    getStartedBtn.textContent = 'Get Started';
  }
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

// Handle email submission
async function handleSubmitEmail() {
  if (!pendingEmailData) {
    showResultView(false, 'No email data found. Please try again.');
    return;
  }
  
  try {
    // Show loading view with email-specific message
    showLoadingView('Submitting email insights...');
    
    // Submit directly to Supabase
    await submitEmail(pendingEmailData);
    
  } catch (error) {
    console.error('Error submitting email:', error);
    showResultView(false, 'Failed to submit email. Please try again.');
  }
}

// Handle cancel email
function handleCancelEmail() {
  pendingEmailData = null;
  showPreRecordingView();
}

// Handle record insight link click
function handleRecordInsight(e) {
  e.preventDefault();
  showPreRecordingView();
}

// Submit email to Supabase REST API
async function submitEmail(emailData) {
  try {
    submitEmailBtn.disabled = true;
    
    // Get user email
    const storage = await chrome.storage.local.get(['userEmail']);
    const userEmail = storage.userEmail;
    
    // Prepare submission data matching email_submissions schema
    const submissionData = {
      from_email: emailData.from?.email || '',
      from_name: emailData.from?.name || '',
      subject: emailData.subject || '',
      body: emailData.body || '',
      email_date: emailData.date || new Date().toISOString(),
      thread_id: emailData.threadId || null,
      source: 'gmail',
      source_url: emailData.sourceUrl || null,
      metadata: {
        labels: emailData.labels || [],
        user_email: userEmail
      },
      processing_status: 'pending',
      created_at: new Date().toISOString()
    };
    
    console.log('Submitting email to Supabase:', submissionData);
    
    const response = await fetch(EMAIL_SUBMISSIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(submissionData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Supabase error:', errorData);
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }
    
    const submissionResult = await response.json();
    console.log('Email submission response:', submissionResult);
    
    // Build success message
    const mainMessage = 'Email extracted successfully! Your insights are being processed.';
    
    // Show result view with success (email type)
    showResultView(true, mainMessage, null, 'email');
    
    // Clear pending email data
    pendingEmailData = null;
    
  } catch (error) {
    console.error('Error submitting email:', error);
    
    let errorMsg = 'Failed to submit email. ';
    if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else {
      errorMsg = error.message || 'Something went wrong. Please try again.';
    }
    
    showResultView(false, errorMsg, null, 'email');
  } finally {
    submitEmailBtn.disabled = false;
  }
}

// Submit recording to edge function
async function submitRecording(data) {
  try {
    stopBtn.disabled = true;
    
    const response = await fetch(VOICE_EDGE_FUNCTION_URL, {
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

