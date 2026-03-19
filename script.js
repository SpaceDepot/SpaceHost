// ============================================
// CONFIGURATION: UPDATE THESE VALUES
// ============================================
const CONFIG = {
    owner: 'SpaceDepot',
    repo: 'rivals-depot',
    branch: 'main',
    mappingsPath: 'usmap',
    materialPath: 'MaterialTag/MaterialTagPresets.ini'
};
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const statusContainer = document.getElementById('status-container');
    const fileInfo = document.getElementById('file-info');
    const errorContainer = document.getElementById('error-container');
    const statusText = document.getElementById('status-text');
    const filenameEl = document.getElementById('filename');
    const filemetaEl = document.getElementById('filemeta');
    const downloadBtn = document.getElementById('download-btn');
    const retryBtn = document.getElementById('retry-btn');

    // Tab Elements
    const tabMappings = document.getElementById('tab-mappings');
    const tabMaterialTag = document.getElementById('tab-materialtag');
    const boxTitle = document.getElementById('box-title');

    let currentDownloadUrl = null;
    let currentTab = 'mappings'; // 'mappings' or 'materialtag'

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    // Helper to extract the build number from filenames
    const getBuildNumber = (filename) => {
        const match = filename.match(/\d+\.\d+\.\d+-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const loadData = async () => {
        // Reset UI
        statusContainer.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        errorContainer.classList.add('hidden');
        statusText.textContent = 'FETCHING LATEST FILE...';

        try {
            let targetFileObj = null;

            if (currentTab === 'mappings') {
                boxTitle.textContent = '- LATEST USMAP -';
                const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.mappingsPath}?ref=${CONFIG.branch}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`API returned ${response.status}`);

                const data = await response.json();
                const contents = Array.isArray(data) ? data : [data];
                const usmapFiles = contents.filter(file => file.name.endsWith('.usmap'));

                if (usmapFiles.length === 0) throw new Error('No .usmap files found.');

                // Smart sort by build number descending
                usmapFiles.sort((a, b) => {
                    const buildA = getBuildNumber(a.name);
                    const buildB = getBuildNumber(b.name);
                    if (buildB !== buildA) return buildB - buildA;
                    return a.name.localeCompare(b.name);
                });
                targetFileObj = usmapFiles[0];

            } else if (currentTab === 'materialtag') {
                boxTitle.textContent = '- MATERIALTAG PRESETS FILE -';
                const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.materialPath}?ref=${CONFIG.branch}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`API returned ${response.status}`);

                targetFileObj = await response.json(); // It's directly the file object
            }

            if (!targetFileObj) throw new Error('Target file resolution failed.');
            currentDownloadUrl = targetFileObj.download_url;

            // Fetch the commit date for this specific file
            let dateStr = "UNKNOWN DATE";
            try {
                const encodedPath = encodeURIComponent(targetFileObj.path);
                const commitResp = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/commits?path=${encodedPath}&sha=${CONFIG.branch}&per_page=1`);
                if (commitResp.ok) {
                    const commitData = await commitResp.json();
                    if (commitData.length > 0) {
                        const dateObj = new Date(commitData[0].commit.committer.date);
                        dateStr = dateObj.toISOString().split('T')[0];
                    }
                }
            } catch (err) {
                console.warn("Could not fetch commit date", err);
            }

            // Update UI
            filenameEl.textContent = targetFileObj.name;
            filemetaEl.textContent = `SIZE: ${formatBytes(targetFileObj.size)} | DATE: ${dateStr}`;

            statusContainer.classList.add('hidden');
            fileInfo.classList.remove('hidden');

        } catch (error) {
            console.error('Error fetching file:', error);
            statusContainer.classList.add('hidden');
            errorContainer.classList.remove('hidden');
            document.getElementById('error-text').textContent = error.message.includes('API rate limit')
                ? 'GITHUB API LIMIT REACHED. RETRY LATER.'
                : 'FAILED TO FETCH FILE. ENSURE CONFIG IS CORRECT.';
        }
    };

    // Tab Switching Logic
    const switchTab = (tabName) => {
        if (currentTab === tabName) return; // Ignore if already active
        currentTab = tabName;

        // Update CSS classes
        if (tabName === 'mappings') {
            tabMappings.classList.add('active');
            tabMaterialTag.classList.remove('active');
        } else {
            tabMaterialTag.classList.add('active');
            tabMappings.classList.remove('active');
        }

        loadData();
    };

    tabMappings.addEventListener('click', () => switchTab('mappings'));
    tabMaterialTag.addEventListener('click', () => switchTab('materialtag'));

    downloadBtn.addEventListener('click', async () => {
        if (!currentDownloadUrl) return;

        // Visual feedback
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '> DOWNLOADING... &lt;';
        downloadBtn.style.pointerEvents = 'none';

        try {
            // Fetch the file as a Blob to force download instead of navigation
            const response = await fetch(currentDownloadUrl);
            if (!response.ok) throw new Error('Download request failed');

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filenameEl.textContent;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Cleanup
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

        } catch (err) {
            console.error('Download error:', err);
            alert('DOWNLOAD ERROR. PLEASE CHECK CONNECTION.');
        } finally {
            // Restore button
            downloadBtn.innerHTML = originalText;
            downloadBtn.style.pointerEvents = 'auto';
        }
    });

    retryBtn.addEventListener('click', loadData);

    // Initial fetch
    loadData();
});
