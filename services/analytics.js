const fs = require('fs');
const path = require('path');
const config = require('../config/default');

class Analytics {
    constructor() {
        this.analyticsPath = path.join(config.paths.credentials, 'analytics.json');
        this.data = this.loadData();
    }

    /**
     * Load analytics data
     */
    loadData() {
        try {
            if (fs.existsSync(this.analyticsPath)) {
                return JSON.parse(fs.readFileSync(this.analyticsPath, 'utf8'));
            }
        } catch (error) {
            console.error('Failed to load analytics:', error.message);
        }

        return {
            totalVideosProcessed: 0,
            totalClipsCreated: 0,
            totalUploads: 0,
            successfulUploads: 0,
            failedUploads: 0,
            totalProcessingTime: 0,
            storageUsed: 0,
            history: []
        };
    }

    /**
     * Save analytics data
     */
    saveData() {
        try {
            fs.writeFileSync(this.analyticsPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Failed to save analytics:', error.message);
        }
    }

    /**
     * Record video processing
     * @param {object} videoInfo - Video information
     * @param {number} clipsCount - Number of clips created
     * @param {number} processingTime - Processing time in seconds
     */
    recordProcessing(videoInfo, clipsCount, processingTime) {
        this.data.totalVideosProcessed++;
        this.data.totalClipsCreated += clipsCount;
        this.data.totalProcessingTime += processingTime;

        this.data.history.push({
            type: 'processing',
            timestamp: new Date().toISOString(),
            videoTitle: videoInfo.title,
            clipsCount,
            processingTime
        });

        this.saveData();
    }

    /**
     * Record upload
     * @param {boolean} success - Whether upload was successful
     */
    recordUpload(success) {
        this.data.totalUploads++;

        if (success) {
            this.data.successfulUploads++;
        } else {
            this.data.failedUploads++;
        }

        this.data.history.push({
            type: 'upload',
            timestamp: new Date().toISOString(),
            success
        });

        this.saveData();
    }

    /**
     * Update storage usage
     */
    updateStorageUsage() {
        try {
            const outputDir = config.paths.output;
            let totalSize = 0;

            if (fs.existsSync(outputDir)) {
                const files = fs.readdirSync(outputDir);
                files.forEach(file => {
                    const filePath = path.join(outputDir, file);
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                });
            }

            this.data.storageUsed = totalSize;
            this.saveData();
        } catch (error) {
            console.error('Failed to update storage usage:', error.message);
        }
    }

    /**
     * Get analytics summary
     * @returns {object} - Analytics summary
     */
    getSummary() {
        this.updateStorageUsage();

        return {
            totalVideosProcessed: this.data.totalVideosProcessed,
            totalClipsCreated: this.data.totalClipsCreated,
            totalUploads: this.data.totalUploads,
            successRate: this.data.totalUploads > 0
                ? (this.data.successfulUploads / this.data.totalUploads * 100).toFixed(2) + '%'
                : '0%',
            averageProcessingTime: this.data.totalVideosProcessed > 0
                ? (this.data.totalProcessingTime / this.data.totalVideosProcessed).toFixed(2) + 's'
                : '0s',
            storageUsed: this.formatBytes(this.data.storageUsed)
        };
    }

    /**
     * Get recent history
     * @param {number} limit - Number of items to return
     * @returns {Array} - Recent history
     */
    getRecentHistory(limit = 10) {
        return this.data.history
            .slice(-limit)
            .reverse();
    }

    /**
     * Format bytes to human readable
     * @param {number} bytes - Bytes
     * @returns {string} - Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new Analytics();
