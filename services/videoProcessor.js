const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');

class VideoProcessor {
    constructor() {
        this.outputDir = config.paths.output;
        this.tempDir = config.paths.temp;
    }

    /**
     * Split video into clips
     * @param {string} videoPath - Path to source video
     * @param {object} options - Processing options
     * @returns {Promise<Array>} - Array of clip info
     */
    async splitIntoClips(videoPath, options = {}) {
        const {
            clipDuration = config.processing.defaultClipDuration,
            startTime = 0,
            maxClips = null,
            onProgress = null
        } = options;

        try {
            // Get video duration
            const duration = await this.getVideoDuration(videoPath);

            // Calculate number of clips
            const availableDuration = duration - startTime;
            const numClips = maxClips || Math.floor(availableDuration / clipDuration);

            if (numClips <= 0) {
                throw new Error('Not enough video duration for clips');
            }

            const clips = [];

            for (let i = 0; i < numClips; i++) {
                const clipStartTime = startTime + (i * clipDuration);
                const clipEndTime = Math.min(clipStartTime + clipDuration, duration);
                const actualDuration = clipEndTime - clipStartTime;

                if (actualDuration < 1) break; // Skip clips shorter than 1 second

                const clipId = uuidv4();
                const clipPath = path.join(this.tempDir, `clip_${clipId}.mp4`);

                await this.extractClip(videoPath, clipPath, clipStartTime, actualDuration);

                clips.push({
                    id: clipId,
                    path: clipPath,
                    startTime: clipStartTime,
                    duration: actualDuration,
                    index: i
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: numClips,
                        percent: ((i + 1) / numClips) * 100
                    });
                }
            }

            return clips;
        } catch (error) {
            throw new Error(`Failed to split video: ${error.message}`);
        }
    }

    /**
     * Extract a single clip from video
     * @param {string} inputPath - Source video path
     * @param {string} outputPath - Output clip path
     * @param {number} startTime - Start time in seconds
     * @param {number} duration - Clip duration in seconds
     */
    extractClip(inputPath, outputPath, startTime, duration) {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .setStartTime(startTime)
                .setDuration(duration)
                .output(outputPath)
                .videoCodec('copy')
                .audioCodec('copy')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    /**
     * Resize video to vertical format (1080x1920) for Shorts
     * @param {string} inputPath - Source video path
     * @param {string} outputPath - Output video path
     * @param {function} onProgress - Progress callback
     */
    resizeToShorts(inputPath, outputPath, onProgress = null) {
        return new Promise((resolve, reject) => {
            const { width, height } = config.shorts;

            ffmpeg(inputPath)
                .size(`${width}x${height}`)
                .aspect('9:16')
                .autopad('black')
                .videoCodec(config.ffmpeg.videoCodec)
                .audioCodec(config.ffmpeg.audioCodec)
                .audioBitrate(config.ffmpeg.audioBitrate)
                .outputOptions([
                    `-preset ${config.ffmpeg.preset}`,
                    `-crf ${config.ffmpeg.crf}`,
                    '-movflags +faststart'
                ])
                .on('progress', (progress) => {
                    if (onProgress && progress.percent) {
                        onProgress({ percent: progress.percent });
                    }
                })
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(outputPath);
        });
    }

    /**
     * Process clip: split and resize to Shorts format
     * @param {string} videoPath - Source video path
     * @param {object} options - Processing options
     * @returns {Promise<Array>} - Array of processed clips
     */
    async processToShorts(videoPath, options = {}) {
        const {
            clipDuration = config.processing.defaultClipDuration,
            startTime = 0,
            maxClips = null,
            onProgress = null
        } = options;

        try {
            // Step 1: Split into clips
            const clips = await this.splitIntoClips(videoPath, {
                clipDuration,
                startTime,
                maxClips,
                onProgress: (progress) => {
                    if (onProgress) {
                        onProgress({
                            stage: 'splitting',
                            ...progress
                        });
                    }
                }
            });

            // Step 2: Resize each clip to Shorts format
            const processedClips = [];

            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i];
                const outputPath = path.join(this.outputDir, `short_${clip.id}.mp4`);

                await this.resizeToShorts(clip.path, outputPath, (progress) => {
                    if (onProgress) {
                        onProgress({
                            stage: 'resizing',
                            clipIndex: i,
                            totalClips: clips.length,
                            ...progress
                        });
                    }
                });

                // Clean up temp clip
                fs.unlinkSync(clip.path);

                processedClips.push({
                    ...clip,
                    path: outputPath,
                    size: fs.statSync(outputPath).size
                });
            }

            return processedClips;
        } catch (error) {
            throw new Error(`Failed to process video to Shorts: ${error.message}`);
        }
    }

    /**
     * Get video duration
     * @param {string} videoPath - Path to video
     * @returns {Promise<number>} - Duration in seconds
     */
    getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata.format.duration);
            });
        });
    }

    /**
     * Extract thumbnail from video
     * @param {string} videoPath - Path to video
     * @param {string} outputPath - Output thumbnail path
     * @param {number} timestamp - Timestamp to extract (seconds)
     */
    extractThumbnail(videoPath, outputPath, timestamp = 0) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timestamp],
                    filename: path.basename(outputPath),
                    folder: path.dirname(outputPath),
                    size: '1080x1920'
                })
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }

    /**
     * Clean up processed files
     * @param {Array} clips - Array of clip objects
     */
    cleanup(clips) {
        clips.forEach(clip => {
            try {
                if (fs.existsSync(clip.path)) {
                    fs.unlinkSync(clip.path);
                    console.log(`Cleaned up: ${clip.path}`);
                }
            } catch (error) {
                console.error(`Failed to cleanup ${clip.path}:`, error.message);
            }
        });
    }
}

module.exports = new VideoProcessor();
