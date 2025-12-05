const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const config = require('../config/default');

/**
 * Save configuration
 */
router.post('/config',
    [
        body('geminiApiKey').optional().isString(),
        body('redisHost').optional().isString(),
        body('redisPort').optional().isInt(),
        body('maxConcurrentJobs').optional().isInt({ min: 1, max: 10 }),
        body('defaultClipDuration').optional().isInt({ min: 1, max: 60 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const configData = req.body;

            // Update .env file
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';

            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }

            // Update or add environment variables
            const updateEnvVar = (key, value) => {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                if (envContent.match(regex)) {
                    envContent = envContent.replace(regex, `${key}=${value}`);
                } else {
                    envContent += `\n${key}=${value}`;
                }
            };

            if (configData.geminiApiKey) {
                updateEnvVar('GEMINI_API_KEY', configData.geminiApiKey);
            }
            if (configData.redisHost) {
                updateEnvVar('REDIS_HOST', configData.redisHost);
            }
            if (configData.redisPort) {
                updateEnvVar('REDIS_PORT', configData.redisPort);
            }
            if (configData.maxConcurrentJobs) {
                updateEnvVar('MAX_CONCURRENT_JOBS', configData.maxConcurrentJobs);
            }
            if (configData.defaultClipDuration) {
                updateEnvVar('DEFAULT_CLIP_DURATION', configData.defaultClipDuration);
            }

            fs.writeFileSync(envPath, envContent.trim() + '\n');

            res.json({ success: true, message: 'Configuration saved. Please restart the server for changes to take effect.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * Get current configuration
 */
router.get('/config', (req, res) => {
    try {
        const currentConfig = {
            geminiApiKey: process.env.GEMINI_API_KEY ? '***' + process.env.GEMINI_API_KEY.slice(-4) : '',
            redisHost: process.env.REDIS_HOST || 'localhost',
            redisPort: parseInt(process.env.REDIS_PORT) || 6379,
            maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 2,
            defaultClipDuration: parseInt(process.env.DEFAULT_CLIP_DURATION) || 15
        };

        res.json(currentConfig);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Upload YouTube credentials
 */
router.post('/youtube-credentials', async (req, res) => {
    try {
        const credentials = req.body;

        // Validate credentials structure
        if (!credentials.installed && !credentials.web) {
            return res.status(400).json({ error: 'Invalid credentials format' });
        }

        // Save credentials to file
        const credentialsDir = path.join(process.cwd(), 'credentials');
        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }

        const credentialsPath = path.join(credentialsDir, 'youtube_credentials.json');
        fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

        // Initialize YouTube uploader with new credentials
        const youtubeUploader = require('../services/youtubeUploader');
        await youtubeUploader.initialize();

        res.json({ success: true, message: 'Credentials uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check system status
 */
router.get('/system-status', async (req, res) => {
    try {
        const status = {
            ytdlp: await checkYtDlp(),
            ffmpeg: await checkFFmpeg(),
            redis: await checkRedis(),
            server: { available: true, version: 'Running' }
        };

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check if yt-dlp is installed
 */
async function checkYtDlp() {
    try {
        const { stdout } = await execPromise('yt-dlp --version');
        return {
            available: true,
            version: stdout.trim()
        };
    } catch (error) {
        return {
            available: false,
            error: 'yt-dlp not found. Please install it.'
        };
    }
}

/**
 * Check if FFmpeg is installed
 */
async function checkFFmpeg() {
    try {
        const { stdout } = await execPromise('ffmpeg -version');
        const versionMatch = stdout.match(/ffmpeg version ([\d.]+)/);
        return {
            available: true,
            version: versionMatch ? versionMatch[1] : 'Unknown'
        };
    } catch (error) {
        return {
            available: false,
            error: 'FFmpeg not found. Please install it.'
        };
    }
}

/**
 * Check if Redis is running
 */
async function checkRedis() {
    try {
        const { stdout } = await execPromise('redis-cli ping');
        return {
            available: stdout.trim() === 'PONG',
            version: 'Connected'
        };
    } catch (error) {
        return {
            available: false,
            error: 'Redis not running. Please start Redis server.'
        };
    }
}

module.exports = router;
