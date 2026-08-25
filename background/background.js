chrome.runtime.onInstalled.addListener(() => {
    console.log('ArchersHub Enlistment Automator installed');
    chrome.alarms.clearAll();
});
