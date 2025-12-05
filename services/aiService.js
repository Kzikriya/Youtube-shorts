const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.initialize();
    }

    initialize() {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('⚠️  Gemini API key not found. AI features will be disabled.');
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
            console.log('✅ Gemini AI initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Gemini AI:', error.message);
        }
    }

    /**
     * Generate title and description for a video clip
     * @param {object} videoMetadata - Original video metadata
     * @param {object} clipInfo - Clip information
     * @returns {Promise<object>} - Generated title and description
     */
    async generateTitleAndDescription(videoMetadata, clipInfo) {
        if (!this.model) {
            // Fallback if AI is not available
            return this.generateFallbackContent(videoMetadata, clipInfo);
        }

        try {
            const prompt = this.buildPrompt(videoMetadata, clipInfo);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseResponse(text);
        } catch (error) {
            console.error('AI generation failed:', error.message);
            return this.generateFallbackContent(videoMetadata, clipInfo);
        }
    }

    /**
     * Generate titles and descriptions for multiple clips
     * @param {object} videoMetadata - Original video metadata
     * @param {Array} clips - Array of clip info
     * @returns {Promise<Array>} - Array of generated content
     */
    async generateBatch(videoMetadata, clips) {
        const results = [];

        for (const clip of clips) {
            const content = await this.generateTitleAndDescription(videoMetadata, clip);
            results.push({
                clipId: clip.id,
                ...content
            });
        }

        return results;
    }

    /**
     * Build prompt for AI generation
     * @param {object} videoMetadata - Video metadata
     * @param {object} clipInfo - Clip information
     * @returns {string} - Formatted prompt
     */
    buildPrompt(videoMetadata, clipInfo) {
        const { title, description, tags } = videoMetadata;
        const { index, startTime, duration } = clipInfo;

        return `You are a YouTube Shorts content expert. Generate an engaging title and description for a short video clip.

Original Video Information:
- Title: ${title}
- Description: ${description || 'N/A'}
- Tags: ${tags ? tags.join(', ') : 'N/A'}

Clip Information:
- Clip Number: ${index + 1}
- Start Time: ${Math.floor(startTime)}s
- Duration: ${Math.floor(duration)}s

Requirements:
1. Title: Create a catchy, attention-grabbing title (max 100 characters) that works well for YouTube Shorts
2. Description: Write an engaging description (2-3 sentences) with relevant hashtags

Format your response EXACTLY as follows:
TITLE: [your title here]
DESCRIPTION: [your description here]

Make it compelling and optimized for YouTube Shorts discovery!`;
    }

    /**
     * Parse AI response
     * @param {string} text - AI response text
     * @returns {object} - Parsed title and description
     */
    parseResponse(text) {
        const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
        const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?:\n\n|$)/is);

        const title = titleMatch ? titleMatch[1].trim() : null;
        const description = descMatch ? descMatch[1].trim() : null;

        // Validate and truncate if needed
        const finalTitle = title ? this.validateTitle(title) : null;
        const finalDescription = description ? this.validateDescription(description) : null;

        return {
            title: finalTitle,
            description: finalDescription
        };
    }

    /**
     * Validate and truncate title
     * @param {string} title - Title to validate
     * @returns {string} - Validated title
     */
    validateTitle(title) {
        // YouTube Shorts title limit is 100 characters
        if (title.length > 100) {
            return title.substring(0, 97) + '...';
        }
        return title;
    }

    /**
     * Validate and enhance description
     * @param {string} description - Description to validate
     * @returns {string} - Validated description
     */
    validateDescription(description) {
        // Ensure description has hashtags
        if (!description.includes('#')) {
            description += '\n\n#Shorts #YouTubeShorts #Viral';
        }
        return description;
    }

    /**
     * Generate fallback content when AI is unavailable
     * @param {object} videoMetadata - Video metadata
     * @param {object} clipInfo - Clip information
     * @returns {object} - Fallback title and description
     */
    generateFallbackContent(videoMetadata, clipInfo) {
        const { title } = videoMetadata;
        const { index } = clipInfo;

        return {
            title: `${title} - Part ${index + 1} #Shorts`,
            description: `Check out this amazing clip from: ${title}\n\n#Shorts #YouTubeShorts #Viral #Trending`
        };
    }

    /**
     * Generate hashtags based on content
     * @param {object} videoMetadata - Video metadata
     * @returns {Array} - Array of hashtags
     */
    generateHashtags(videoMetadata) {
        const { tags } = videoMetadata;
        const baseHashtags = ['Shorts', 'YouTubeShorts', 'Viral'];

        if (tags && tags.length > 0) {
            // Take top 5 tags and convert to hashtags
            const contentHashtags = tags.slice(0, 5).map(tag =>
                tag.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')
            );
            return [...baseHashtags, ...contentHashtags];
        }

        return baseHashtags;
    }
}

module.exports = new AIService();
