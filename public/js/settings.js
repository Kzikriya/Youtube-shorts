// Settings page functionality

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';

    const colors = {
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        info: 'var(--info)'
    };

    notification.style.borderLeft = `4px solid ${colors[type]}`;
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem;">${type.toUpperCase()}</div>
        <div>${message}</div>
    `;

    document.getElementById('notificationContainer').appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// API Configuration Form
document.getElementById('apiConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const config = {
        geminiApiKey: document.getElementById('geminiApiKey').value,
        redisHost: document.getElementById('redisHost').value,
        redisPort: parseInt(document.getElementById('redisPort').value),
        maxConcurrentJobs: parseInt(document.getElementById('maxConcurrentJobs').value),
        defaultClipDuration: parseInt(document.getElementById('defaultClipDuration').value)
    };

    try {
        const response = await fetch('/api/settings/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (response.ok) {
            showNotification('Configuration saved successfully!', 'success');
            // Save to localStorage as backup
            localStorage.setItem('appConfig', JSON.stringify(config));
        } else {
            throw new Error('Failed to save configuration');
        }
    } catch (error) {
        showNotification('Error saving configuration: ' + error.message, 'error');
    }
});

// Load saved configuration
async function loadConfiguration() {
    try {
        // Try to load from server first
        const response = await fetch('/api/settings/config');
        if (response.ok) {
            const config = await response.json();
            applyConfiguration(config);
        } else {
            // Fallback to localStorage
            const savedConfig = localStorage.getItem('appConfig');
            if (savedConfig) {
                applyConfiguration(JSON.parse(savedConfig));
            }
        }
    } catch (error) {
        console.error('Failed to load configuration:', error);
    }
}

function applyConfiguration(config) {
    if (config.geminiApiKey) {
        document.getElementById('geminiApiKey').value = config.geminiApiKey;
    }
    if (config.redisHost) {
        document.getElementById('redisHost').value = config.redisHost;
    }
    if (config.redisPort) {
        document.getElementById('redisPort').value = config.redisPort;
    }
    if (config.maxConcurrentJobs) {
        document.getElementById('maxConcurrentJobs').value = config.maxConcurrentJobs;
    }
    if (config.defaultClipDuration) {
        document.getElementById('defaultClipDuration').value = config.defaultClipDuration;
    }
}

// Upload YouTube Credentials
document.getElementById('uploadCredentialsBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('credentialsFile');
    const file = fileInput.files[0];

    if (!file) {
        showNotification('Please select a credentials file first', 'warning');
        return;
    }

    try {
        const fileContent = await file.text();
        const credentials = JSON.parse(fileContent);

        // Validate credentials structure
        if (!credentials.installed && !credentials.web) {
            throw new Error('Invalid credentials file format');
        }

        const response = await fetch('/api/settings/youtube-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        if (response.ok) {
            showNotification('Credentials uploaded successfully!', 'success');
            document.getElementById('connectYoutubeBtn').disabled = false;
        } else {
            throw new Error('Failed to upload credentials');
        }
    } catch (error) {
        showNotification('Error uploading credentials: ' + error.message, 'error');
    }
});

// Connect to YouTube
document.getElementById('connectYoutubeBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/auth/auth-url');
        const data = await response.json();

        // Open OAuth window
        const authWindow = window.open(data.url, 'YouTube Authentication', 'width=600,height=700');

        // Poll for authentication completion
        const pollInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch('/api/auth/status');
                const statusData = await statusResponse.json();

                if (statusData.authenticated) {
                    clearInterval(pollInterval);
                    if (authWindow && !authWindow.closed) {
                        authWindow.close();
                    }
                    showNotification('Successfully connected to YouTube!', 'success');
                    checkYouTubeAuth();
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (error) {
        showNotification('Error connecting to YouTube: ' + error.message, 'error');
    }
});

// Check YouTube Authentication Status
async function checkYouTubeAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        const statusText = document.getElementById('ytAuthStatusText');
        const badge = document.getElementById('ytAuthBadge');
        const channelInfo = document.getElementById('channelInfo');

        if (data.authenticated) {
            statusText.textContent = 'Connected';
            badge.textContent = 'Connected';
            badge.className = 'badge badge-success';

            // Get channel info
            const channelResponse = await fetch('/api/auth/channel');
            const channelData = await channelResponse.json();

            document.getElementById('channelDetails').innerHTML = `
                <p><strong>Channel:</strong> ${channelData.title}</p>
                <p><strong>Subscribers:</strong> ${parseInt(channelData.subscriberCount).toLocaleString()}</p>
                <p><strong>Videos:</strong> ${parseInt(channelData.videoCount).toLocaleString()}</p>
            `;
            channelInfo.classList.remove('hidden');
        } else {
            statusText.textContent = 'Not connected';
            badge.textContent = 'Not Connected';
            badge.className = 'badge badge-warning';
            channelInfo.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to check YouTube auth:', error);
        document.getElementById('ytAuthStatusText').textContent = 'Error checking status';
    }
}

// Check System Status
document.getElementById('checkSystemBtn').addEventListener('click', async () => {
    const button = document.getElementById('checkSystemBtn');
    button.disabled = true;
    button.textContent = '⏳ Checking...';

    try {
        const response = await fetch('/api/settings/system-status');
        const status = await response.json();

        // Update status displays
        updateStatus('ytdlpStatus', status.ytdlp);
        updateStatus('ffmpegStatus', status.ffmpeg);
        updateStatus('redisStatus', status.redis);
        updateStatus('serverStatus', status.server);

        showNotification('System status checked', 'info');
    } catch (error) {
        showNotification('Error checking system status: ' + error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '🔄 Check System Status';
    }
});

function updateStatus(elementId, status) {
    const element = document.getElementById(elementId);

    if (status.available) {
        element.innerHTML = `<span style="color: var(--success);">✅ Available</span>`;
        if (status.version) {
            element.innerHTML += `<br><small>${status.version}</small>`;
        }
    } else {
        element.innerHTML = `<span style="color: var(--error);">❌ Not Available</span>`;
        if (status.error) {
            element.innerHTML += `<br><small>${status.error}</small>`;
        }
    }
}

// Initialize
loadConfiguration();
checkYouTubeAuth();

// Auto-check system status on load
setTimeout(() => {
    document.getElementById('checkSystemBtn').click();
}, 1000);
