const schedule = require('node-schedule');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');

class Scheduler {
    constructor() {
        this.schedulesPath = path.join(config.paths.credentials, 'schedules.json');
        this.schedules = new Map();
        this.jobs = new Map();
        this.loadSchedules();
    }

    /**
     * Load schedules from file
     */
    loadSchedules() {
        try {
            if (fs.existsSync(this.schedulesPath)) {
                const data = JSON.parse(fs.readFileSync(this.schedulesPath, 'utf8'));
                this.schedules = new Map(Object.entries(data));

                // Reschedule active schedules
                this.schedules.forEach((scheduleData, id) => {
                    if (scheduleData.status === 'scheduled' && new Date(scheduleData.scheduledTime) > new Date()) {
                        this.rescheduleJob(id, scheduleData);
                    }
                });

                console.log(`✅ Loaded ${this.schedules.size} schedules`);
            }
        } catch (error) {
            console.error('Failed to load schedules:', error.message);
        }
    }

    /**
     * Save schedules to file
     */
    saveSchedules() {
        try {
            const data = Object.fromEntries(this.schedules);
            fs.writeFileSync(this.schedulesPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save schedules:', error.message);
        }
    }

    /**
     * Schedule a single upload
     * @param {object} uploadData - Upload data
     * @param {string} scheduledTime - ISO timestamp
     * @param {string} timezone - Timezone
     * @returns {object} - Schedule info
     */
    scheduleUpload(uploadData, scheduledTime, timezone = 'UTC') {
        const scheduleId = uuidv4();
        const scheduledDate = moment.tz(scheduledTime, timezone).toDate();

        if (scheduledDate <= new Date()) {
            throw new Error('Scheduled time must be in the future');
        }

        const scheduleData = {
            id: scheduleId,
            uploadData,
            scheduledTime: scheduledDate.toISOString(),
            timezone,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        this.schedules.set(scheduleId, scheduleData);
        this.saveSchedules();

        // Schedule the job
        const job = schedule.scheduleJob(scheduledDate, async () => {
            await this.executeUpload(scheduleId);
        });

        this.jobs.set(scheduleId, job);

        return {
            scheduleId,
            scheduledTime: scheduledDate.toISOString(),
            status: 'scheduled'
        };
    }

    /**
     * Schedule bulk uploads with distribution pattern
     * @param {Array} uploads - Array of upload data
     * @param {object} pattern - Distribution pattern
     * @returns {Array} - Array of schedule info
     */
    scheduleBulk(uploads, pattern) {
        const { type, startTime, timezone = 'UTC', interval = null, times = null } = pattern;
        const results = [];
        const startDate = moment.tz(startTime, timezone);

        uploads.forEach((upload, index) => {
            let scheduledTime;

            switch (type) {
                case 'interval':
                    // Schedule at regular intervals (e.g., every 2 hours)
                    scheduledTime = startDate.clone().add(index * interval, 'hours');
                    break;

                case 'daily':
                    // Schedule daily at specific time
                    scheduledTime = startDate.clone().add(index, 'days');
                    break;

                case 'custom':
                    // Schedule at specific times
                    if (times && times[index]) {
                        scheduledTime = moment.tz(times[index], timezone);
                    } else {
                        throw new Error('Not enough custom times provided');
                    }
                    break;

                default:
                    throw new Error('Invalid pattern type');
            }

            const result = this.scheduleUpload(upload, scheduledTime.toISOString(), timezone);
            results.push(result);
        });

        return results;
    }

    /**
     * Reschedule an existing job
     * @param {string} scheduleId - Schedule ID
     * @param {object} scheduleData - Schedule data
     */
    rescheduleJob(scheduleId, scheduleData) {
        const scheduledDate = new Date(scheduleData.scheduledTime);

        const job = schedule.scheduleJob(scheduledDate, async () => {
            await this.executeUpload(scheduleId);
        });

        this.jobs.set(scheduleId, job);
    }

    /**
     * Execute scheduled upload
     * @param {string} scheduleId - Schedule ID
     */
    async executeUpload(scheduleId) {
        const scheduleData = this.schedules.get(scheduleId);

        if (!scheduleData) {
            console.error(`Schedule ${scheduleId} not found`);
            return;
        }

        try {
            scheduleData.status = 'executing';
            this.saveSchedules();

            // Import here to avoid circular dependency
            const jobQueue = require('./jobQueue');

            const result = await jobQueue.addUploadJob(scheduleData.uploadData);

            scheduleData.status = 'completed';
            scheduleData.result = result;
            scheduleData.completedAt = new Date().toISOString();

            this.saveSchedules();
            this.jobs.delete(scheduleId);

            console.log(`✅ Scheduled upload ${scheduleId} completed`);
        } catch (error) {
            scheduleData.status = 'failed';
            scheduleData.error = error.message;
            scheduleData.failedAt = new Date().toISOString();

            this.saveSchedules();
            this.jobs.delete(scheduleId);

            console.error(`❌ Scheduled upload ${scheduleId} failed:`, error.message);
        }
    }

    /**
     * Cancel scheduled upload
     * @param {string} scheduleId - Schedule ID
     */
    cancelSchedule(scheduleId) {
        const job = this.jobs.get(scheduleId);

        if (job) {
            job.cancel();
            this.jobs.delete(scheduleId);
        }

        const scheduleData = this.schedules.get(scheduleId);
        if (scheduleData) {
            scheduleData.status = 'cancelled';
            scheduleData.cancelledAt = new Date().toISOString();
            this.saveSchedules();
        }

        return { success: true };
    }

    /**
     * Reschedule upload
     * @param {string} scheduleId - Schedule ID
     * @param {string} newTime - New scheduled time
     * @param {string} timezone - Timezone
     */
    reschedule(scheduleId, newTime, timezone = 'UTC') {
        const scheduleData = this.schedules.get(scheduleId);

        if (!scheduleData) {
            throw new Error('Schedule not found');
        }

        // Cancel existing job
        const job = this.jobs.get(scheduleId);
        if (job) {
            job.cancel();
        }

        // Update schedule
        const scheduledDate = moment.tz(newTime, timezone).toDate();
        scheduleData.scheduledTime = scheduledDate.toISOString();
        scheduleData.timezone = timezone;
        scheduleData.status = 'scheduled';

        this.saveSchedules();

        // Create new job
        this.rescheduleJob(scheduleId, scheduleData);

        return {
            scheduleId,
            scheduledTime: scheduledDate.toISOString(),
            status: 'scheduled'
        };
    }

    /**
     * Get all schedules
     * @returns {Array} - Array of schedules
     */
    getAllSchedules() {
        return Array.from(this.schedules.values());
    }

    /**
     * Get schedule by ID
     * @param {string} scheduleId - Schedule ID
     * @returns {object} - Schedule data
     */
    getSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);

        if (!schedule) {
            throw new Error('Schedule not found');
        }

        return schedule;
    }

    /**
     * Get upcoming schedules
     * @param {number} limit - Number of schedules to return
     * @returns {Array} - Array of upcoming schedules
     */
    getUpcoming(limit = 10) {
        const now = new Date();

        return Array.from(this.schedules.values())
            .filter(s => s.status === 'scheduled' && new Date(s.scheduledTime) > now)
            .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
            .slice(0, limit);
    }

    /**
     * Clean old schedules
     * @param {number} daysOld - Number of days
     */
    cleanOldSchedules(daysOld = 30) {
        const cutoffDate = moment().subtract(daysOld, 'days').toDate();
        let cleaned = 0;

        this.schedules.forEach((schedule, id) => {
            if (schedule.status !== 'scheduled' && new Date(schedule.createdAt) < cutoffDate) {
                this.schedules.delete(id);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            this.saveSchedules();
            console.log(`🧹 Cleaned ${cleaned} old schedules`);
        }

        return cleaned;
    }
}

module.exports = new Scheduler();
