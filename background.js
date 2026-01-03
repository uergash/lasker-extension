// Background service worker
let offscreenDocumentCreated = false;

async function createOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }
  
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording audio from microphone in background',
    });
    offscreenDocumentCreated = true;
    
    // Wait for offscreen document to fully load
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    throw error;
  }
}

async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) {
    return;
  }
  
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    console.error('Failed to close offscreen document:', error);
  }
}

// Forward message to offscreen document
async function sendToOffscreen(message) {
  // Add a target identifier so offscreen knows this is for it
  const messageWithTarget = {
    ...message,
    target: 'OFFSCREEN'
  };
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageWithTarget, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // If no response (undefined), it means no one handled it
      if (response === undefined) {
        reject(new Error('No response from offscreen document'));
        return;
      }
      
      resolve(response);
    });
  });
}

async function handleStartRecording(message) {
  try {
    await createOffscreenDocument();
    const response = await sendToOffscreen({
      type: 'START_RECORDING',
      maxDuration: message.maxDuration
    });
    return response;
  } catch (error) {
    console.error('Failed to start recording:', error);
    return { success: false, error: error.message };
  }
}

async function handleStopRecording() {
  try {
    const response = await sendToOffscreen({
      type: 'STOP_RECORDING'
    });
    
    // Close offscreen document after stopping
    await closeOffscreenDocument();
    
    return response;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    await closeOffscreenDocument();
    return { success: false, error: error.message };
  }
}

async function handleGetRecordingState() {
  if (!offscreenDocumentCreated) {
    return { isRecording: false, elapsed: 0 };
  }
  
  try {
    const response = await sendToOffscreen({
      type: 'GET_RECORDING_STATE'
    });
    return response;
  } catch (error) {
    console.error('Failed to get recording state:', error);
    return { isRecording: false, elapsed: 0 };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages targeted to offscreen (those are responses we're waiting for)
  if (message.target === 'OFFSCREEN') {
    return false;
  }
  
  // Only handle messages from popup
  if (message.type === 'START_RECORDING' && sender.url?.includes('popup.html')) {
    handleStartRecording(message)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'STOP_RECORDING' && sender.url?.includes('popup.html')) {
    handleStopRecording()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_RECORDING_STATE' && sender.url?.includes('popup.html')) {
    handleGetRecordingState()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ isRecording: false, elapsed: 0 }));
    return true;
  }
});
