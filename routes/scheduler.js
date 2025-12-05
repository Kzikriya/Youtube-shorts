const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const scheduler = require('../services/scheduler');

/**
 * Schedule single upload
 */
router.post('/schedule',
    [
        body('uploadData').notEmpty(),
        body('scheduledTime').isISO8601(),
        body('timezone').optional().isString()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { uploadData, scheduledTime, timezone } = req.body;
            const result = scheduler.scheduleUpload(uploadData, scheduledTime, timezone);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * Schedule bulk uploads
 */
router.post('/schedule-bulk',
    [
        body('uploads').isArray().notEmpty(),
        body('pattern.type').isIn(['interval', 'daily', 'custom']),
        body('pattern.startTime').isISO8601(),
        body('pattern.timezone').optional().isString()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { uploads, pattern } = req.body;
            const results = scheduler.scheduleBulk(uploads, pattern);
            res.json(results);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * Get all schedules
 */
router.get('/', (req, res) => {
    try {
        const schedules = scheduler.getAllSchedules();
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get upcoming schedules
 */
router.get('/upcoming', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const schedules = scheduler.getUpcoming(limit);
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get schedule by ID
 */
router.get('/:scheduleId', (req, res) => {
    try {
        const { scheduleId } = req.params;
        const schedule = scheduler.getSchedule(scheduleId);
        res.json(schedule);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * Cancel schedule
 */
router.delete('/:scheduleId', (req, res) => {
    try {
        const { scheduleId } = req.params;
        const result = scheduler.cancelSchedule(scheduleId);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * Reschedule upload
 */
router.put('/:scheduleId',
    [
        body('newTime').isISO8601(),
        body('timezone').optional().isString()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { scheduleId } = req.params;
            const { newTime, timezone } = req.body;
            const result = scheduler.reschedule(scheduleId, newTime, timezone);
            res.json(result);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
);

module.exports = router;
