// Gmail Content Script - Email Detection and Button Injection
// Detects when user is viewing an email and injects "Extract Insights" button

(function() {
  'use strict';
  
  const BUTTON_ID = 'lasker-extract-btn';
  const BUTTON_CLASS = 'lasker-gmail-button';
  let currentEmailData = null;
  let buttonInjected = false;
  let lastProcessedUrl = '';
  
  // Detect email provider
  function detectProvider() {
    const hostname = window.location.hostname;
    if (hostname.includes('mail.google.com')) return 'gmail';
    if (hostname.includes('outlook')) return 'outlook';
    return 'unknown';
  }
  
  // Check if we're viewing an email (not list view)
  function isEmailView() {
    const provider = detectProvider();
    
    if (provider === 'gmail') {
      // Gmail: Check if we're in a conversation view
      const emailView = document.querySelector('div[role="main"]');
      const emailBody = document.querySelector('.a3s.aiL') || document.querySelector('.ii.gt');
      return emailView && emailBody;
    }
    
    return false;
  }
  
  // Extract email data from Gmail
  function extractEmailData() {
    try {
      const provider = detectProvider();
      
      if (provider === 'gmail') {
        return extractGmailData();
      }
      
      return null;
    } catch (error) {
      console.error('[Lasker] Error extracting email data:', error);
      return null;
    }
  }
  
  // Extract data from Gmail
  function extractGmailData() {
    // Get the email subject
    const subjectElement = document.querySelector('h2.hP');
    const subject = subjectElement ? subjectElement.textContent.trim() : '';
    
    // Get sender information
    const senderElement = document.querySelector('span.gD[email]');
    const senderEmailAttr = senderElement ? senderElement.getAttribute('email') : '';
    const senderNameElement = document.querySelector('span.go');
    const senderName = senderNameElement ? senderNameElement.textContent.trim() : '';
    
    // Get email date
    const dateElement = document.querySelector('span.g3[title]');
    const dateString = dateElement ? dateElement.getAttribute('title') : '';
    
    // Get email body - target the last message in thread
    const emailBodies = document.querySelectorAll('.a3s.aiL, .ii.gt');
    let body = '';
    if (emailBodies.length > 0) {
      const lastEmail = emailBodies[emailBodies.length - 1];
      body = lastEmail.textContent.trim();
      
      // Remove quoted replies (lines starting with >)
      body = body.split('\n')
        .filter(line => !line.trim().startsWith('>'))
        .join('\n')
        .trim();
      
      // Remove email signatures (common patterns)
      body = removeEmailSignature(body);
    }
    
    // Get thread ID from URL
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const threadId = urlParams.get('th') || '';
    
    // Get labels
    const labelElements = document.querySelectorAll('div[data-tooltip*="Label"]');
    const labels = Array.from(labelElements).map(el => el.getAttribute('data-tooltip').replace('Label: ', ''));
    
    return {
      from: {
        name: senderName || senderEmailAttr,
        email: senderEmailAttr
      },
      subject: subject,
      date: dateString || new Date().toISOString(),
      body: body,
      threadId: threadId,
      labels: labels,
      sourceUrl: window.location.href
    };
  }
  
  // Remove common email signature patterns
  function removeEmailSignature(text) {
    // Common signature delimiters
    const signaturePatterns = [
      /\n--\s*\n[\s\S]*$/,  // Standard -- delimiter
      /\n_{3,}\s*\n[\s\S]*$/,  // Underscores
      /\nBest regards[\s\S]*$/i,
      /\nBest[\s\S]*$/i,
      /\nThanks[\s\S]*$/i,
      /\nRegards[\s\S]*$/i,
      /\nSincerely[\s\S]*$/i,
      /\nSent from my[\s\S]*$/i
    ];
    
    let cleanedText = text;
    for (const pattern of signaturePatterns) {
      cleanedText = cleanedText.replace(pattern, '');
    }
    
    return cleanedText.trim();
  }
  
  // Create the extract button
  function createExtractButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = BUTTON_CLASS;
    button.innerHTML = `
      <svg class="lasker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <span class="lasker-btn-text">Extract to Lasker</span>
    `;
    
    button.addEventListener('click', handleExtractClick);
    
    return button;
  }
  
  // Handle extract button click
  async function handleExtractClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    
    // Extract email data
    currentEmailData = extractEmailData();
    
    if (!currentEmailData || !currentEmailData.body) {
      showNotification('Could not extract email content. Please try again.', 'error');
      return;
    }
    
    // Update button state
    button.disabled = true;
    button.innerHTML = `
      <svg class="lasker-icon lasker-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      <span class="lasker-btn-text">Extracting...</span>
    `;
    
    // Send message to extension
    try {
      chrome.runtime.sendMessage({
        type: 'EXTRACT_EMAIL',
        emailData: currentEmailData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Lasker] Error:', chrome.runtime.lastError);
          showNotification('Failed to connect to Lasker extension', 'error');
          resetButton();
          return;
        }
        
        if (response && response.success) {
          showNotification('Email extracted successfully! Opening Lasker...', 'success');
          // Button will be reset when user returns to Gmail
        } else {
          showNotification(response?.error || 'Failed to extract email', 'error');
          resetButton();
        }
      });
    } catch (error) {
      console.error('[Lasker] Error sending message:', error);
      showNotification('Failed to extract email', 'error');
      resetButton();
    }
  }
  
  // Reset button to initial state
  function resetButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    
    button.disabled = false;
    button.innerHTML = `
      <svg class="lasker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <span class="lasker-btn-text">Extract to Lasker</span>
    `;
  }
  
  // Show notification banner
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.getElementById('lasker-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'lasker-notification';
    notification.className = `lasker-notification lasker-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('lasker-notification-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
  
  // Inject button into Gmail toolbar
  function injectButton() {
    if (buttonInjected) return;
    
    // Find Gmail's toolbar (next to reply/forward buttons)
    const toolbar = document.querySelector('div[role="toolbar"]');
    
    if (!toolbar) {
      // Toolbar not ready yet
      return;
    }
    
    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) {
      buttonInjected = true;
      return;
    }
    
    // Create and inject button
    const button = createExtractButton();
    
    // Insert at the beginning of toolbar
    toolbar.insertBefore(button, toolbar.firstChild);
    
    buttonInjected = true;
    console.log('[Lasker] Extract button injected successfully');
  }
  
  // Remove button when not in email view
  function removeButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.remove();
      buttonInjected = false;
    }
  }
  
  // Check and update UI based on current view
  function checkAndUpdateUI() {
    const currentUrl = window.location.href;
    
    // Only process if URL changed or first load
    if (currentUrl === lastProcessedUrl) return;
    
    lastProcessedUrl = currentUrl;
    
    if (isEmailView()) {
      // Wait a bit for Gmail to fully render
      setTimeout(() => {
        injectButton();
      }, 500);
    } else {
      removeButton();
    }
  }
  
  // Listen for URL changes (Gmail is a SPA)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      buttonInjected = false; // Reset injection flag
      checkAndUpdateUI();
    }
  });
  
  // Start observing URL changes
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndUpdateUI);
  } else {
    checkAndUpdateUI();
  }
  
  // Periodic check (as Gmail DOM updates frequently)
  setInterval(checkAndUpdateUI, 2000);
  
  console.log('[Lasker] Gmail content script loaded');
})();

