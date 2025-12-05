const express = require('express');
const router = express.Router();
const youtubeUploader = require('../services/youtubeUploader');

/**
 * Initialize YouTube API
 */
router.post('/init', async (req, res) => {
    try {
        const result = await youtubeUploader.initialize();
        res.json({ success: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get authorization URL
 */
router.get('/auth-url', (req, res) => {
    try {
        const url = youtubeUploader.getAuthUrl();
        res.json({ url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Set credentials from auth code
 */
router.post('/auth-callback', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }

        await youtubeUploader.setCredentials(code);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check authentication status
 */
router.get('/status', (req, res) => {
    const isAuthenticated = youtubeUploader.isAuthenticated();
    res.json({ authenticated: isAuthenticated });
});

/**
 * Get channel info
 */
router.get('/channel', async (req, res) => {
    try {
        const channelInfo = await youtubeUploader.getChannelInfo();
        res.json(channelInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
