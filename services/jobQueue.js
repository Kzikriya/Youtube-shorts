const Queue = require('bull');
const config = require('../config/default');
const videoDownloader = require('./videoDownloader');
const videoProcessor = require('./videoProcessor');
const aiService = require('./aiService');
const youtubeUploader = require('./youtubeUploader');

class JobQueue {
    constructor() {
        this.queue = new Queue('video-processing', {
            redis: config.redis
        });

        this.setupProcessors();
        this.setupEventHandlers();
    }

    /**
     * Setup job processors
     */
    setupProcessors() {
        // Process complete pipeline
        this.queue.process('process-video', config.processing.maxConcurrentJobs, async (job) => {
            return await this.processVideo(job);
        });

        // Process individual upload
        this.queue.process('upload-video', 3, async (job) => {
            return await this.uploadVideo(job);
        });
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.queue.on('completed', (job, result) => {
            console.log(`✅ Job ${job.id} completed:`, result);
        });

        this.queue.on('failed', (job, err) => {
            console.error(`❌ Job ${job.id} failed:`, err.message);
        });

        this.queue.on('progress', (job, progress) => {
            console.log(`📊 Job ${job.id} progress:`, progress);
        });
    }

    /**
     * Add video processing job
     * @param {object} data - Job data
     * @returns {Promise<object>} - Job info
     */
    async addProcessingJob(data) {
        const job = await this.queue.add('process-video', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            }
        });

        return {
            jobId: job.id,
            status: 'queued'
        };
    }

    /**
     * Add upload job
     * @param {object} data - Job data
     * @returns {Promise<object>} - Job info
     */
    async addUploadJob(data) {
        const job = await this.queue.add('upload-video', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            },
            delay: data.scheduledTime ? new Date(data.scheduledTime).getTime() - Date.now() : 0
        });

        return {
            jobId: job.id,
            status: 'queued'
        };
    }

    /**
     * Process video pipeline
     * @param {object} job - Bull job
     */
    async processVideo(job) {
        const { url, options, io } = job.data;
        const results = {
            videoInfo: null,
            clips: [],
            aiContent: [],
            errors: []
        };

        try {
            // Step 1: Download video
            job.progress(10);
            this.emitProgress(io, job.id, { stage: 'downloading', percent: 10 });

            const downloadResult = await videoDownloader.downloadVideo(url, {
                quality: options.quality || 'best',
                audioQuality: options.audioQuality || 'best',
                onProgress: (progress) => {
                    const percent = 10 + (progress.percent * 0.2);
                    job.progress(percent);
                    this.emitProgress(io, job.id, { stage: 'downloading', percent });
                }
            });

            results.videoInfo = downloadResult.metadata;

            // Step 2: Process video to Shorts
            job.progress(30);
            this.emitProgress(io, job.id, { stage: 'processing', percent: 30 });

            const clips = await videoProcessor.processToShorts(downloadResult.path, {
                clipDuration: options.clipDuration || config.processing.defaultClipDuration,
                startTime: options.startTime || 0,
                maxClips: options.maxClips || null,
                onProgress: (progress) => {
                    const percent = 30 + (progress.percent * 0.4);
                    job.progress(percent);
                    this.emitProgress(io, job.id, { stage: 'processing', percent, ...progress });
                }
            });

            results.clips = clips;

            // Step 3: Generate AI content
            job.progress(70);
            this.emitProgress(io, job.id, { stage: 'generating-ai', percent: 70 });

            const aiContent = await aiService.generateBatch(downloadResult.metadata, clips);
            results.aiContent = aiContent;

            // Clean up downloaded video
            videoDownloader.cleanup(downloadResult.path);

            job.progress(100);
            this.emitProgress(io, job.id, { stage: 'completed', percent: 100 });

            return results;
        } catch (error) {
            this.emitProgress(io, job.id, { stage: 'error', error: error.message });
            throw error;
        }
    }

    /**
     * Upload video to YouTube
     * @param {object} job - Bull job
     */
    async uploadVideo(job) {
        const { videoPath, metadata, io } = job.data;

        try {
            this.emitProgress(io, job.id, { stage: 'uploading', percent: 0 });

            const result = await youtubeUploader.uploadVideo(videoPath, metadata, (progress) => {
                job.progress(progress.percent);
                this.emitProgress(io, job.id, { stage: 'uploading', percent: progress.percent });
            });

            this.emitProgress(io, job.id, { stage: 'completed', percent: 100 });

            return result;
        } catch (error) {
            this.emitProgress(io, job.id, { stage: 'error', error: error.message });
            throw error;
        }
    }

    /**
     * Emit progress via Socket.IO
     * @param {object} io - Socket.IO instance
     * @param {string} jobId - Job ID
     * @param {object} progress - Progress data
     */
    emitProgress(io, jobId, progress) {
        if (io) {
            io.emit('job-progress', { jobId, ...progress });
        }
    }

    /**
     * Get job status
     * @param {string} jobId - Job ID
     * @returns {Promise<object>} - Job status
     */
    async getJobStatus(jobId) {
        const job = await this.queue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        const state = await job.getState();
        const progress = job.progress();
        const result = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            id: job.id,
            state,
            progress,
            result,
            failedReason,
            data: job.data
        };
    }

    /**
     * Get all jobs
     * @returns {Promise<Array>} - Array of jobs
     */
    async getAllJobs() {
        const jobs = await this.queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);

        return Promise.all(jobs.map(async (job) => {
            const state = await job.getState();
            return {
                id: job.id,
                state,
                progress: job.progress(),
                data: job.data,
                timestamp: job.timestamp
            };
        }));
    }

    /**
     * Cancel job
     * @param {string} jobId - Job ID
     */
    async cancelJob(jobId) {
        const job = await this.queue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        await job.remove();
        return { success: true };
    }

    /**
     * Retry failed job
     * @param {string} jobId - Job ID
     */
    async retryJob(jobId) {
        const job = await this.queue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        await job.retry();
        return { success: true };
    }

    /**
     * Clean old jobs
     * @param {number} grace - Grace period in milliseconds
     */
    async cleanOldJobs(grace = 24 * 60 * 60 * 1000) {
        await this.queue.clean(grace, 'completed');
        await this.queue.clean(grace, 'failed');
    }
}

module.exports = new JobQueue();
