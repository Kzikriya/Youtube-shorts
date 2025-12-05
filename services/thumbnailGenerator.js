const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const config = require('../config/default');

class ThumbnailGenerator {
    constructor() {
        this.outputDir = config.paths.output;
    }

    /**
     * Extract thumbnail from video at specific timestamp
     * @param {string} videoPath - Path to video
     * @param {number} timestamp - Timestamp in seconds
     * @returns {Promise<string>} - Path to thumbnail
     */
    async extractThumbnail(videoPath, timestamp = 0) {
        const thumbnailPath = path.join(
            this.outputDir,
            `thumb_${Date.now()}.jpg`
        );

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timestamp],
                    filename: path.basename(thumbnailPath),
                    folder: path.dirname(thumbnailPath),
                    size: '1080x1920'
                })
                .on('end', () => resolve(thumbnailPath))
                .on('error', (err) => reject(err));
        });
    }

    /**
     * Generate thumbnail with text overlay
     * @param {string} videoPath - Path to video
     * @param {string} text - Text to overlay
     * @param {number} timestamp - Timestamp in seconds
     * @returns {Promise<string>} - Path to thumbnail
     */
    async generateWithText(videoPath, text, timestamp = 0) {
        const thumbnailPath = path.join(
            this.outputDir,
            `thumb_${Date.now()}.jpg`
        );

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timestamp],
                    filename: path.basename(thumbnailPath),
                    folder: path.dirname(thumbnailPath),
                    size: '1080x1920'
                })
                .videoFilters([
                    {
                        filter: 'drawtext',
                        options: {
                            text: text.substring(0, 50), // Limit text length
                            fontsize: 60,
                            fontcolor: 'white',
                            x: '(w-text_w)/2',
                            y: 'h-th-50',
                            borderw: 3,
                            bordercolor: 'black'
                        }
                    }
                ])
                .on('end', () => resolve(thumbnailPath))
                .on('error', (err) => reject(err));
        });
    }

    /**
     * Generate multiple thumbnails from video
     * @param {string} videoPath - Path to video
     * @param {number} count - Number of thumbnails
     * @returns {Promise<Array>} - Array of thumbnail paths
     */
    async generateMultiple(videoPath, count = 3) {
        const duration = await this.getVideoDuration(videoPath);
        const interval = duration / (count + 1);
        const thumbnails = [];

        for (let i = 1; i <= count; i++) {
            const timestamp = interval * i;
            const thumbnail = await this.extractThumbnail(videoPath, timestamp);
            thumbnails.push(thumbnail);
        }

        return thumbnails;
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
     * Clean up thumbnail
     * @param {string} thumbnailPath - Path to thumbnail
     */
    cleanup(thumbnailPath) {
        try {
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
        } catch (error) {
            console.error(`Failed to cleanup thumbnail: ${error.message}`);
        }
    }
}

module.exports = new ThumbnailGenerator();
