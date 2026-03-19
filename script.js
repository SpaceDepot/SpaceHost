// ============================================
// CONFIGURATION: UPDATE THESE VALUES
// ============================================
const CONFIG = {
    owner: 'SpaceDepot',
    repo: 'rivals-depot',
    branch: 'main',
    path: 'usmap'
};
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const statusContainer = document.getElementById('status-container');
    const fileInfo = document.getElementById('file-info');
    const errorContainer = document.getElementById('error-container');
    const statusText = document.getElementById('status-text');
    const filenameEl = document.getElementById('filename');
    const filemetaEl = document.getElementById('filemeta');
    const downloadBtn = document.getElementById('download-btn');
    const retryBtn = document.getElementById('retry-btn');

    let currentDownloadUrl = null;

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

    const fetchLatestUSMAP = async () => {
        // Reset UI
        statusContainer.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        errorContainer.classList.add('hidden');
        statusText.textContent = 'Fetching latest files from GitHub...';

        try {
            // Fetch repository contents
            const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.path}?ref=${CONFIG.branch}`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle if path is a file instead of a directory
            const contents = Array.isArray(data) ? data : [data];

            // Filter for .usmap files
            const usmapFiles = contents.filter(file => file.name.endsWith('.usmap'));

            if (usmapFiles.length === 0) {
                throw new Error('No .usmap files found in the specified repository path.');
            }

            // Smartly sort by build number extracted from the filename (descending)
            usmapFiles.sort((a, b) => {
                const buildA = getBuildNumber(a.name);
                const buildB = getBuildNumber(b.name);

                if (buildB !== buildA) {
                    return buildB - buildA; // Highest build numbers first
                }

                // If same build number, sort alphabetically to have a predictable order
                return a.name.localeCompare(b.name);
            });

            const latestFile = usmapFiles[0];
            currentDownloadUrl = latestFile.download_url;

            // Fetch the commit date for this specific file
            let dateStr = "UNKNOWN DATE";
            try {
                const encodedPath = encodeURIComponent(latestFile.path);
                const commitResp = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/commits?path=${encodedPath}&sha=${CONFIG.branch}&per_page=1`);
                if (commitResp.ok) {
                    const commitData = await commitResp.json();
                    if (commitData.length > 0) {
                        const dateObj = new Date(commitData[0].commit.committer.date);
                        dateStr = dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                    }
                }
            } catch (err) {
                console.warn("Could not fetch commit date", err);
            }

            // Update UI
            filenameEl.textContent = latestFile.name;
            filemetaEl.textContent = `SIZE: ${formatBytes(latestFile.size)} | DATE: ${dateStr}`;
            
            statusContainer.classList.add('hidden');
            fileInfo.classList.remove('hidden');

        } catch (error) {
            console.error('Error fetching file:', error);
            statusContainer.classList.add('hidden');
            errorContainer.classList.remove('hidden');
            document.getElementById('error-text').textContent = error.message.includes('API rate limit')
                ? 'GitHub API limit reached. Please try again later.'
                : 'Failed to fetch files. Ensure your config is correct and the repo is public.';
        }
    };

    downloadBtn.addEventListener('click', () => {
        if (currentDownloadUrl) {
            // Trigger download by opening link
            const a = document.createElement('a');
            a.href = currentDownloadUrl;
            a.download = filenameEl.textContent;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    retryBtn.addEventListener('click', fetchLatestUSMAP);

    // Initial fetch
    fetchLatestUSMAP();
});
