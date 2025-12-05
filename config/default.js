module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379
  },
  
  paths: {
    temp: process.env.TEMP_DIR || './temp',
    output: process.env.OUTPUT_DIR || './output',
    credentials: './credentials'
  },
  
  processing: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 2,
    maxClipDuration: parseInt(process.env.MAX_CLIP_DURATION) || 60,
    defaultClipDuration: parseInt(process.env.DEFAULT_CLIP_DURATION) || 15
  },
  
  video: {
    qualityPresets: {
      best: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
      '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]',
      '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]'
    },
    audioQualityPresets: {
      best: '0',
      good: '5',
      medium: '7'
    }
  },
  
  shorts: {
    width: 1080,
    height: 1920,
    maxDuration: 60,
    minDuration: 1
  },
  
  ffmpeg: {
    videoCodec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    preset: 'fast',
    crf: 23
  }
};
