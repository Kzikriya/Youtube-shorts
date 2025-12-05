# 🚀 YouTube Shorts Automation

Transform full-length YouTube videos into viral Shorts with AI-powered titles and descriptions, all automatically uploaded to your channel.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🎬 Automated Video Processing**: Download and split videos into optimized Shorts (1080x1920)
- **🤖 AI-Powered Content**: Generate catchy titles and descriptions with Gemini AI
- **📤 Auto Upload**: Automatically upload to YouTube with proper metadata
- **📅 Smart Scheduling**: Schedule uploads with flexible patterns (intervals, daily, custom)
- **⚡ Real-time Progress**: Live updates via WebSocket
- **🎨 Modern UI**: Beautiful, responsive interface with glassmorphism design
- **⚙️ Flexible Configuration**: Customize clip duration, quality, start time, and more

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **Redis** (for job queue)
- **yt-dlp** (for downloading videos)
- **FFmpeg** (for video processing)

### Installing System Dependencies

#### Windows
```powershell
# Install yt-dlp
winget install yt-dlp

# Install FFmpeg
winget install FFmpeg

# Install Redis (via Chocolatey)
choco install redis-64
```

#### macOS
```bash
# Install yt-dlp
brew install yt-dlp

# Install FFmpeg
brew install ffmpeg

# Install Redis
brew install redis
brew services start redis
```

#### Linux (Ubuntu/Debian)
```bash
# Install yt-dlp
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Install FFmpeg
sudo apt update
sudo apt install ffmpeg

# Install Redis
sudo apt install redis-server
sudo systemctl start redis
```

## 🔧 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Set Up YouTube API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **YouTube Data API v3**
4. Create **OAuth 2.0 credentials**:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000`
5. Download the credentials JSON file
6. Save it as `credentials/youtube_credentials.json`

### 4. Get Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file

### 5. Start Redis

Make sure Redis is running:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📖 Usage Guide

### First Time Setup

1. **Open the application** in your browser
2. **Click "Connect YouTube"** to authenticate
3. **Complete the OAuth flow** in the popup window
4. **Return to the app** - you should see "Connected as [Your Channel Name]"

### Creating Shorts

1. **Enter a YouTube URL** of the video you want to convert
2. **Configure settings**:
   - **Clip Duration**: Length of each Short (1-60 seconds)
   - **Start Time**: Where to start clipping from the video
   - **Video Quality**: Best, 1080p, 720p, or 480p
   - **Audio Quality**: Best, Good, or Medium
   - **Max Clips**: Optional limit on number of clips
3. **Click "Process Video"**
4. **Watch the progress** in real-time
5. **Review generated Shorts** with AI-generated titles and descriptions

### Uploading Shorts

#### Upload Immediately
- Click **"Upload"** on individual clips
- Or click **"Upload All"** to queue all clips

#### Schedule Uploads
- Click **"Schedule"** on individual clips
- Or click **"Schedule All"** for bulk scheduling

**Scheduling Options**:
- **Regular Intervals**: Post every X hours
- **Daily at Same Time**: Post once per day at specified time
- **Custom Times**: Specify exact times for each clip

## 🎯 API Endpoints

### Jobs

- `POST /api/jobs/process` - Start video processing
- `POST /api/jobs/upload` - Upload a video
- `GET /api/jobs/:jobId` - Get job status
- `GET /api/jobs` - Get all jobs
- `DELETE /api/jobs/:jobId` - Cancel a job

### Authentication

- `POST /api/auth/init` - Initialize YouTube API
- `GET /api/auth/auth-url` - Get OAuth URL
- `POST /api/auth/auth-callback` - Handle OAuth callback
- `GET /api/auth/status` - Check auth status
- `GET /api/auth/channel` - Get channel info

### Scheduler

- `POST /api/scheduler/schedule` - Schedule single upload
- `POST /api/scheduler/schedule-bulk` - Schedule multiple uploads
- `GET /api/scheduler` - Get all schedules
- `GET /api/scheduler/upcoming` - Get upcoming schedules
- `DELETE /api/scheduler/:scheduleId` - Cancel schedule
- `PUT /api/scheduler/:scheduleId` - Reschedule upload

## 🛠️ Configuration

### Video Quality Presets

- **best**: Best available quality
- **1080p**: Full HD
- **720p**: HD (recommended for faster processing)
- **480p**: SD

### Audio Quality Presets

- **best**: Highest quality (0)
- **good**: Good quality (5)
- **medium**: Medium quality (7)

### Processing Settings

Edit `config/default.js` to customize:

```javascript
processing: {
  maxConcurrentJobs: 2,  // Number of parallel jobs
  maxClipDuration: 60,   // Maximum clip duration
  defaultClipDuration: 15 // Default clip duration
}
```

## 🐛 Troubleshooting

### "yt-dlp not found"
- Ensure yt-dlp is installed and in your PATH
- Test: `yt-dlp --version`

### "FFmpeg not found"
- Ensure FFmpeg is installed and in your PATH
- Test: `ffmpeg -version`

### "Redis connection failed"
- Ensure Redis is running
- Test: `redis-cli ping`

### "YouTube authentication failed"
- Check your credentials file exists at `credentials/youtube_credentials.json`
- Ensure redirect URI matches in Google Cloud Console

### "Gemini API error"
- Verify your API key in `.env`
- Check you have quota remaining

## 📊 Performance Tips

1. **Use 720p quality** for faster processing
2. **Limit concurrent jobs** to avoid overwhelming your system
3. **Use scheduling** to spread uploads over time
4. **Clean old jobs** periodically to save disk space

## 🔒 Security Notes

- Never commit `.env` or `credentials/` to version control
- Keep your API keys secure
- Use private uploads initially, then make public after review
- Regularly rotate your API keys

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💡 Tips for Best Results

1. **Choose engaging moments** - Set start time to skip intros
2. **Optimize clip duration** - 15-30 seconds works best for Shorts
3. **Review AI content** - Edit titles/descriptions before uploading
4. **Schedule strategically** - Post during peak hours for your audience
5. **Use good source videos** - Higher quality input = better Shorts

## 🎉 Credits

Built with:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video downloading
- [FFmpeg](https://ffmpeg.org/) - Video processing
- [Google Gemini](https://ai.google.dev/) - AI content generation
- [YouTube Data API](https://developers.google.com/youtube/v3) - Video uploading
- [Bull](https://github.com/OptimalBits/bull) - Job queue
- [Socket.IO](https://socket.io/) - Real-time updates

---

Made with ❤️ for content creators
