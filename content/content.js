/**
 * ArchersHub Enlistment Automator - Content Script
 * Classification and DOM interaction surface.
 */

let classifierModule = null;
let activeLoop = null;

async function getClassifier() {
  if (classifierModule) return classifierModule;
  try {
    const src = chrome.runtime.getURL('content/classifier.js');
    classifierModule = await import(src);
    return classifierModule;
  } catch (err) {
    console.error('Failed to import classifier module:', err);
    return null;
  }
}

// Runtime message listener for background worker / popup requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    getClassifier()
      .then((mod) => {
        if (!mod || !mod.handleContentMessage) {
          sendResponse({ success: false, error: 'Classifier not initialized' });
          return;
        }
        mod.handleContentMessage(message, sender, sendResponse, {
          document,
          window,
          location: window.location,
          activeLoop,
          setActiveLoop: (l) => {
            activeLoop = l;
          },
          sendMessage: (msg) => {
            try {
              chrome.runtime.sendMessage(msg);
            } catch (_) {}
          },
        });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // Asynchronous message response
  });
}

console.log('ArchersHub Enlistment Automator content script loaded');
