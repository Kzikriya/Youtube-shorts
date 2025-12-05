const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config/default');

class YouTubeUploader {
    constructor() {
        this.youtube = null;
        this.oauth2Client = null;
        this.credentialsPath = process.env.YOUTUBE_CREDENTIALS_PATH || path.join(config.paths.credentials, 'youtube_credentials.json');
        this.tokenPath = process.env.YOUTUBE_TOKEN_PATH || path.join(config.paths.credentials, 'youtube_token.json');
    }

    /**
     * Initialize OAuth2 client
     */
    async initialize() {
        try {
            if (!fs.existsSync(this.credentialsPath)) {
                throw new Error('YouTube credentials file not found. Please set up OAuth credentials.');
            }

            const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
            const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

            this.oauth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            // Load token if exists
            if (fs.existsSync(this.tokenPath)) {
                const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                this.oauth2Client.setCredentials(token);
            }

            this.youtube = google.youtube({
                version: 'v3',
                auth: this.oauth2Client
            });

            console.log('✅ YouTube API initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize YouTube API:', error.message);
            return false;
        }
    }

    /**
     * Get authorization URL
     * @returns {string} - Authorization URL
     */
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes
        });
    }

    /**
     * Set credentials from authorization code
     * @param {string} code - Authorization code
     */
    async setCredentials(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // Save token
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));

            console.log('✅ YouTube authentication successful');
            return true;
        } catch (error) {
            throw new Error(`Failed to authenticate: ${error.message}`);
        }
    }

    /**
     * Check if authenticated
     * @returns {boolean} - Whether user is authenticated
     */
    isAuthenticated() {
        return this.oauth2Client && this.oauth2Client.credentials && this.oauth2Client.credentials.access_token;
    }

    /**
     * Upload video to YouTube
     * @param {string} videoPath - Path to video file
     * @param {object} metadata - Video metadata
     * @param {function} onProgress - Progress callback
     * @returns {Promise<object>} - Upload result
     */
    async uploadVideo(videoPath, metadata, onProgress = null) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please authenticate first.');
        }

        try {
            const { title, description, tags = [], privacyStatus = 'private', scheduledTime = null } = metadata;

            const requestBody = {
                snippet: {
                    title: title || 'Untitled Short',
                    description: description || '',
                    tags: ['Shorts', ...tags],
                    categoryId: '22' // People & Blogs category
                },
                status: {
                    privacyStatus: scheduledTime ? 'private' : privacyStatus,
                    selfDeclaredMadeForKids: false
                }
            };

            // Add scheduled publish time if provided
            if (scheduledTime) {
                requestBody.status.publishAt = scheduledTime;
            }

            const fileSize = fs.statSync(videoPath).size;
            const media = {
                body: fs.createReadStream(videoPath)
            };

            const response = await this.youtube.videos.insert({
                part: 'snippet,status',
                requestBody,
                media
            }, {
                onUploadProgress: (evt) => {
                    if (onProgress) {
                        const progress = (evt.bytesRead / fileSize) * 100;
                        onProgress({ percent: progress, uploaded: evt.bytesRead, total: fileSize });
                    }
                }
            });

            return {
                id: response.data.id,
                url: `https://www.youtube.com/watch?v=${response.data.id}`,
                title: response.data.snippet.title,
                status: response.data.status.privacyStatus
            };
        } catch (error) {
            throw new Error(`Failed to upload video: ${error.message}`);
        }
    }

    /**
     * Upload thumbnail for a video
     * @param {string} videoId - YouTube video ID
     * @param {string} thumbnailPath - Path to thumbnail image
     */
    async uploadThumbnail(videoId, thumbnailPath) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please authenticate first.');
        }

        try {
            await this.youtube.thumbnails.set({
                videoId,
                media: {
                    body: fs.createReadStream(thumbnailPath)
                }
            });

            console.log(`✅ Thumbnail uploaded for video ${videoId}`);
            return true;
        } catch (error) {
            console.error(`Failed to upload thumbnail: ${error.message}`);
            return false;
        }
    }

    /**
     * Batch upload multiple videos
     * @param {Array} videos - Array of video objects with path and metadata
     * @param {function} onProgress - Progress callback
     * @returns {Promise<Array>} - Array of upload results
     */
    async batchUpload(videos, onProgress = null) {
        const results = [];

        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];

            try {
                const result = await this.uploadVideo(
                    video.path,
                    video.metadata,
                    (uploadProgress) => {
                        if (onProgress) {
                            onProgress({
                                videoIndex: i,
                                totalVideos: videos.length,
                                videoProgress: uploadProgress.percent,
                                overallProgress: ((i + uploadProgress.percent / 100) / videos.length) * 100
                            });
                        }
                    }
                );

                results.push({
                    success: true,
                    videoId: video.id,
                    ...result
                });
            } catch (error) {
                results.push({
                    success: false,
                    videoId: video.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get channel information
     * @returns {Promise<object>} - Channel info
     */
    async getChannelInfo() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await this.youtube.channels.list({
                part: 'snippet,statistics',
                mine: true
            });

            if (response.data.items.length === 0) {
                throw new Error('No channel found');
            }

            const channel = response.data.items[0];
            return {
                id: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                thumbnail: channel.snippet.thumbnails.default.url,
                subscriberCount: channel.statistics.subscriberCount,
                videoCount: channel.statistics.videoCount
            };
        } catch (error) {
            throw new Error(`Failed to get channel info: ${error.message}`);
        }
    }
}

module.exports = new YouTubeUploader();
