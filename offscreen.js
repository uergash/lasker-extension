// Offscreen document for handling recording in background
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let stream = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages targeted to us
  if (message.target !== 'OFFSCREEN') {
    return false;
  }
  
  if (message.type === 'START_RECORDING') {
    startRecording(message.maxDuration)
      .then((result) => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.type === 'STOP_RECORDING') {
    stopRecording()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.type === 'GET_RECORDING_STATE') {
    const elapsed = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    const state = { 
      isRecording: mediaRecorder !== null && mediaRecorder.state === 'recording',
      elapsed: elapsed
    };
    sendResponse(state);
    return true;
  }
  
  return false;
});

async function startRecording(maxDuration) {
  try {
    // Request microphone permission
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Determine supported mime type
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else {
        mimeType = '';
      }
    }
    
    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    recordingStartTime = Date.now();
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    
    mediaRecorder.start(1000);
    
    // Auto-stop at max duration
    if (maxDuration) {
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopRecording();
        }
      }, maxDuration * 1000);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
}

async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      resolve({ success: false, error: 'Not recording' });
      return;
    }
    
    mediaRecorder.onstop = async () => {
      try {
        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Create blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - recordingStartTime) / 1000);
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result.split(',')[1];
          resolve({
            success: true,
            audio_base64: base64Audio,
            duration_seconds: duration
          });
          
          // Reset state
          mediaRecorder = null;
          audioChunks = [];
          recordingStartTime = null;
          stream = null;
        };
        reader.onerror = (error) => {
          console.error('Failed to convert audio to base64:', error);
          reject(error);
        };
        reader.readAsDataURL(audioBlob);
      } catch (error) {
        console.error('Failed to process recording:', error);
        reject(error);
      }
    };
    
    mediaRecorder.stop();
  });
}
