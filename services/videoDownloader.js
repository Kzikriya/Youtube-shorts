const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');

const ytDlpWrap = new YTDlpWrap();

class VideoDownloader {
    constructor() {
        this.tempDir = config.paths.temp;
    }

    /**
     * Download a YouTube video
     * @param {string} url - YouTube video URL
     * @param {object} options - Download options
     * @returns {Promise<object>} - Downloaded video info
     */
    async downloadVideo(url, options = {}) {
        const {
            quality = 'best',
            audioQuality = 'best',
            onProgress = null
        } = options;

        const videoId = uuidv4();
        const outputPath = path.join(this.tempDir, `${videoId}.mp4`);

        try {
            // Get video info first
            const info = await this.getVideoInfo(url);

            // Download video
            const format = config.video.qualityPresets[quality] || config.video.qualityPresets.best;

            const ytDlpArgs = [
                '-f', format,
                '--audio-quality', config.video.audioQualityPresets[audioQuality] || '0',
                '--no-playlist',
                '-o', outputPath,
                url
            ];

            await ytDlpWrap.execPromise(ytDlpArgs);

            return {
                videoId,
                path: outputPath,
                metadata: info,
                size: fs.statSync(outputPath).size
            };
        } catch (error) {
            // Clean up on error
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            throw new Error(`Failed to download video: ${error.message}`);
        }
    }

    /**
     * Get video metadata without downloading
     * @param {string} url - YouTube video URL
     * @returns {Promise<object>} - Video metadata
     */
    async getVideoInfo(url) {
        try {
            const infoJson = await ytDlpWrap.execPromise([
                '--dump-json',
                '--no-playlist',
                '--no-warnings',
                url
            ]);

            const info = JSON.parse(infoJson);

            return {
                id: info.id,
                title: info.title,
                description: info.description,
                duration: info.duration,
                thumbnail: info.thumbnail,
                uploader: info.uploader,
                uploadDate: info.upload_date,
                viewCount: info.view_count,
                likeCount: info.like_count,
                tags: info.tags || []
            };
        } catch (error) {
            throw new Error(`Failed to get video info: ${error.message}`);
        }
    }

    /**
     * Validate YouTube URL
     * @param {string} url - URL to validate
     * @returns {boolean} - Whether URL is valid
     */
    isValidYouTubeUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    /**
     * Clean up downloaded video
     * @param {string} videoPath - Path to video file
     */
    cleanup(videoPath) {
        try {
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                console.log(`Cleaned up: ${videoPath}`);
            }
        } catch (error) {
            console.error(`Failed to cleanup ${videoPath}:`, error.message);
        }
    }
}

module.exports = new VideoDownloader();
