// Initialize Socket.IO
const socket = io();

// State
let currentJobId = null;
let processedClips = [];
let videoMetadata = null;

// DOM Elements
const videoForm = document.getElementById('videoForm');
const processBtn = document.getElementById('processBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const currentStage = document.getElementById('currentStage');
const stagePercent = document.getElementById('stagePercent');
const progressDetails = document.getElementById('progressDetails');
const clipsSection = document.getElementById('clipsSection');
const clipsGrid = document.getElementById('clipsGrid');
const uploadAllBtn = document.getElementById('uploadAllBtn');
const scheduleAllBtn = document.getElementById('scheduleAllBtn');
const scheduleModal = document.getElementById('scheduleModal');
const confirmScheduleBtn = document.getElementById('confirmScheduleBtn');
const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
const authBtn = document.getElementById('authBtn');
const authStatusText = document.getElementById('authStatusText');

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.authenticated) {
            authStatusText.textContent = '✅ Connected to YouTube';
            authBtn.style.display = 'none';

            // Get channel info
            const channelResponse = await fetch('/api/auth/channel');
            const channelData = await channelResponse.json();
            authStatusText.textContent = `✅ Connected as ${channelData.title}`;
        } else {
            authStatusText.textContent = '⚠️ Not connected to YouTube';
            authBtn.style.display = 'block';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        authStatusText.textContent = '❌ Authentication error';
    }
}

// Initialize YouTube auth
authBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/auth/auth-url');
        const data = await response.json();
        window.open(data.url, '_blank');
        showNotification('Please complete authentication in the new window', 'info');
    } catch (error) {
        showNotification('Failed to start authentication', 'error');
    }
});

// Form submission
videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = document.getElementById('videoUrl').value;
    const clipDuration = parseInt(document.getElementById('clipDuration').value);
    const startTime = parseInt(document.getElementById('startTime').value);
    const quality = document.getElementById('videoQuality').value;
    const audioQuality = document.getElementById('audioQuality').value;
    const maxClips = document.getElementById('maxClips').value;

    const options = {
        clipDuration,
        startTime,
        quality,
        audioQuality
    };

    if (maxClips) {
        options.maxClips = parseInt(maxClips);
    }

    try {
        processBtn.disabled = true;
        processBtn.textContent = '⏳ Processing...';
        progressSection.classList.remove('hidden');
        clipsSection.classList.add('hidden');

        const response = await fetch('/api/jobs/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, options })
        });

        const data = await response.json();
        currentJobId = data.jobId;

        showNotification('Processing started! This may take a few minutes.', 'success');
    } catch (error) {
        showNotification('Failed to start processing: ' + error.message, 'error');
        processBtn.disabled = false;
        processBtn.textContent = '🚀 Process Video';
    }
});

// Socket.IO event handlers
socket.on('job-progress', (data) => {
    if (data.jobId !== currentJobId) return;

    const { stage, percent, error } = data;

    if (error) {
        showNotification('Error: ' + error, 'error');
        resetForm();
        return;
    }

    // Update progress bar
    progressFill.style.width = percent + '%';
    stagePercent.textContent = Math.round(percent) + '%';

    // Update stage
    const stageNames = {
        'downloading': '📥 Downloading Video',
        'processing': '⚙️ Processing Clips',
        'generating-ai': '🤖 Generating AI Content',
        'completed': '✅ Completed',
        'uploading': '📤 Uploading'
    };

    const stageBadge = currentStage.querySelector('.badge');
    stageBadge.textContent = stageNames[stage] || stage;
    stageBadge.className = 'badge ' + (stage === 'completed' ? 'badge-success' : 'badge-info');

    // Update details
    if (data.clipIndex !== undefined) {
        progressDetails.textContent = `Processing clip ${data.clipIndex + 1} of ${data.totalClips}`;
    }

    // Check if completed
    if (stage === 'completed' && percent === 100) {
        setTimeout(() => {
            checkJobStatus(currentJobId);
        }, 1000);
    }
});

// Check job status
async function checkJobStatus(jobId) {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data = await response.json();

        if (data.state === 'completed' && data.result) {
            processedClips = data.result.clips;
            videoMetadata = data.result.videoInfo;
            const aiContent = data.result.aiContent;

            // Merge AI content with clips
            processedClips.forEach((clip, index) => {
                const ai = aiContent.find(a => a.clipId === clip.id);
                if (ai) {
                    clip.title = ai.title;
                    clip.description = ai.description;
                }
            });

            displayClips();
            showNotification(`Successfully created ${processedClips.length} shorts!`, 'success');
            resetForm();
        }
    } catch (error) {
        showNotification('Failed to get job status', 'error');
    }
}

// Display clips
function displayClips() {
    clipsGrid.innerHTML = '';
    clipsSection.classList.remove('hidden');

    processedClips.forEach((clip, index) => {
        const clipCard = document.createElement('div');
        clipCard.className = 'clip-card';
        clipCard.innerHTML = `
            <div class="clip-thumbnail flex-center" style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                <span style="font-size: 3rem;">🎬</span>
            </div>
            <div class="clip-info">
                <div class="clip-title">${clip.title || `Clip ${index + 1}`}</div>
                <div class="clip-description">${clip.description || 'No description'}</div>
                <div class="mt-1 flex gap-1">
                    <button class="btn btn-primary" onclick="uploadClip(${index})" style="flex: 1; padding: 0.5rem;">
                        Upload
                    </button>
                    <button class="btn btn-secondary" onclick="scheduleClip(${index})" style="flex: 1; padding: 0.5rem;">
                        Schedule
                    </button>
                </div>
            </div>
        `;
        clipsGrid.appendChild(clipCard);
    });
}

// Upload single clip
async function uploadClip(index) {
    const clip = processedClips[index];

    try {
        showNotification(`Uploading clip ${index + 1}...`, 'info');

        const response = await fetch('/api/jobs/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: clip.path,
                metadata: {
                    title: clip.title,
                    description: clip.description,
                    privacyStatus: 'private'
                }
            })
        });

        const data = await response.json();
        showNotification(`Clip ${index + 1} queued for upload!`, 'success');
    } catch (error) {
        showNotification(`Failed to upload clip ${index + 1}`, 'error');
    }
}

// Schedule single clip
function scheduleClip(index) {
    // Store current clip index for scheduling
    window.currentScheduleClip = index;
    scheduleModal.classList.remove('hidden');
}

// Upload all clips
uploadAllBtn.addEventListener('click', async () => {
    for (let i = 0; i < processedClips.length; i++) {
        await uploadClip(i);
        // Add delay between uploads
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
});

// Schedule all clips
scheduleAllBtn.addEventListener('click', () => {
    window.currentScheduleClip = null; // Indicates bulk scheduling
    scheduleModal.classList.remove('hidden');
});

// Confirm schedule
confirmScheduleBtn.addEventListener('click', async () => {
    const pattern = document.getElementById('schedulePattern').value;
    const startTime = document.getElementById('scheduleStartTime').value;
    const timezone = document.getElementById('scheduleTimezone').value;
    const interval = parseInt(document.getElementById('scheduleInterval').value);

    if (!startTime) {
        showNotification('Please select a start time', 'warning');
        return;
    }

    try {
        if (window.currentScheduleClip !== null) {
            // Schedule single clip
            const clip = processedClips[window.currentScheduleClip];

            const response = await fetch('/api/scheduler/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploadData: {
                        videoPath: clip.path,
                        metadata: {
                            title: clip.title,
                            description: clip.description,
                            privacyStatus: 'private'
                        }
                    },
                    scheduledTime: startTime,
                    timezone
                })
            });

            showNotification('Clip scheduled successfully!', 'success');
        } else {
            // Schedule all clips
            const uploads = processedClips.map(clip => ({
                videoPath: clip.path,
                metadata: {
                    title: clip.title,
                    description: clip.description,
                    privacyStatus: 'private'
                }
            }));

            const response = await fetch('/api/scheduler/schedule-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploads,
                    pattern: {
                        type: pattern,
                        startTime,
                        timezone,
                        interval: pattern === 'interval' ? interval : undefined
                    }
                })
            });

            showNotification(`${processedClips.length} clips scheduled successfully!`, 'success');
        }

        scheduleModal.classList.add('hidden');
    } catch (error) {
        showNotification('Failed to schedule: ' + error.message, 'error');
    }
});

// Cancel schedule
cancelScheduleBtn.addEventListener('click', () => {
    scheduleModal.classList.add('hidden');
    scheduleModal.style.display = 'none';
});

// Reset form
function resetForm() {
    processBtn.disabled = false;
    processBtn.textContent = '🚀 Process Video';
    progressSection.classList.add('hidden');
    progressFill.style.width = '0%';
}

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

// Initialize
checkAuth();

// Set default datetime to 1 hour from now
const now = new Date();
now.setHours(now.getHours() + 1);
document.getElementById('scheduleStartTime').value = now.toISOString().slice(0, 16);
