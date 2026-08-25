function selectSubjectSection(subject, section) {
    try {
        // Find the row containing this subject
        const rows = document.querySelectorAll('tbody tr, table tr');
        let targetRow = null;
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const rowText = row.innerText.toUpperCase();
            
            if (rowText.includes(subject)) {
                targetRow = row;
                break;
            }
        }
        
        if (!targetRow) {
            console.warn(`Subject '${subject}' not found in the table`);
            return { success: false, subject, section, reason: 'Subject not found' };
        }
        
        // Find and check the checkbox in this row
        const checkbox = targetRow.querySelector('input[type="checkbox"]');
        if (!checkbox) {
            console.warn(`No checkbox found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'No checkbox found' };
        }
        
        if (!checkbox.checked) {
            checkbox.click();
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Find and select the section dropdown
        const dropdown = targetRow.querySelector('select');
        if (!dropdown) {
            console.warn(`No dropdown found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'No dropdown found' };
        }
        
        // Try to find the option with matching label or value
        let option = Array.from(dropdown.querySelectorAll('option')).find(opt => 
            opt.textContent.trim().toUpperCase().includes(section) || 
            opt.value.toUpperCase().includes(section)
        );
        
        if (!option) {
            console.warn(`Section '${section}' not found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'Section not found' };
        }
        
        dropdown.value = option.value;
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Successfully selected ${subject} - ${section}`);
        return { success: true, subject, section };
        
    } catch (error) {
        console.error(`Error selecting ${subject} - ${section}:`, error);
        return { success: false, subject, section, reason: error.message };
    }
}

function isFullPageLoaderVisible() {
    if (document.body && document.body.classList.contains('loader-active')) {
        return true;
    }

    const myLoader = document.querySelector('#MyLoader');
    if (!myLoader) {
        return false;
    }

    if (isElementVisible(myLoader)) {
        return true;
    }

    const fullPageLoader = myLoader.querySelector('.full-page-loader');
    return isElementVisible(fullPageLoader);
}

function isElementVisible(element) {
    if (!element) {
        return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

console.log('ArchersHub Enlistment Automator content script loaded');
