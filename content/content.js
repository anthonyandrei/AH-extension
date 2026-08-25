/**
 * ArchersHub Enlistment Automator - Content Script
 * Classification and DOM interaction surface.
 */

import { handleContentMessage } from './classifier.js';

let activeLoop = null;

function getContentContext() {
  return {
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
  };
}

// Runtime message listener for background worker / popup requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleContentMessage(message, sender, sendResponse, getContentContext());
    return true;
  });
}

// Check if a Vigil is currently watching and initiate auto-steering on page load/reload
async function checkAndAutoSteer() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return;
  try {
    const data = await chrome.storage.local.get(['vigil']);
    if (data?.vigil?.state === 'watching') {
      handleContentMessage({ type: 'STEER_TAB' }, {}, () => {}, getContentContext());
    }
  } catch (_) {}
}

checkAndAutoSteer();

console.log('ArchersHub Enlistment Automator content script loaded');

