const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jobQueue = require('../services/jobQueue');

/**
 * Create new video processing job
 */
router.post('/process',
    [
        body('url').isURL().withMessage('Valid YouTube URL required'),
        body('options.clipDuration').optional().isInt({ min: 1, max: 60 }),
        body('options.startTime').optional().isInt({ min: 0 }),
        body('options.quality').optional().isIn(['best', '1080p', '720p', '480p']),
        body('options.audioQuality').optional().isIn(['best', 'good', 'medium'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { url, options = {} } = req.body;
            const io = req.app.get('io');

            const result = await jobQueue.addProcessingJob({
                url,
                options,
                io
            });

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * Create upload job
 */
router.post('/upload',
    [
        body('videoPath').notEmpty(),
        body('metadata.title').notEmpty().isLength({ max: 100 }),
        body('metadata.description').optional(),
        body('metadata.tags').optional().isArray(),
        body('metadata.privacyStatus').optional().isIn(['public', 'private', 'unlisted'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { videoPath, metadata, scheduledTime } = req.body;
            const io = req.app.get('io');

            const result = await jobQueue.addUploadJob({
                videoPath,
                metadata,
                scheduledTime,
                io
            });

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * Get job status
 */
router.get('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const status = await jobQueue.getJobStatus(jobId);
        res.json(status);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * Get all jobs
 */
router.get('/', async (req, res) => {
    try {
        const jobs = await jobQueue.getAllJobs();
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Cancel job
 */
router.delete('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const result = await jobQueue.cancelJob(jobId);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * Retry failed job
 */
router.post('/:jobId/retry', async (req, res) => {
    try {
        const { jobId } = req.params;
        const result = await jobQueue.retryJob(jobId);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

module.exports = router;
