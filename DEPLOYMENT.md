# Railway Deployment Guide

This guide will walk you through deploying the YouTube Shorts Automation application to Railway.

## Prerequisites

Before deploying, ensure you have:

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Google Gemini API Key**: Get it from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. **YouTube API Credentials**: 
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials (Desktop app)
   - Download the credentials JSON file

## Deployment Steps

### 1. Push Your Code to GitHub

If you haven't already, push your code to a GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Create a New Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will automatically detect it's a Node.js app

### 3. Add Redis Service

Your app needs Redis for the job queue:

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add Redis"**
3. Railway will automatically create a Redis instance
4. The `REDIS_URL` environment variable will be automatically set

### 4. Configure Environment Variables

In your Railway project dashboard:

1. Click on your service (the Node.js app)
2. Go to the **"Variables"** tab
3. Add the following environment variables:

#### Required Variables:

```env
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_HOST=${{Redis.RAILWAY_PRIVATE_DOMAIN}}
REDIS_PORT=${{Redis.RAILWAY_TCP_PROXY_PORT}}
```

#### Optional Variables (with defaults):

```env
MAX_CONCURRENT_JOBS=2
MAX_CLIP_DURATION=60
DEFAULT_CLIP_DURATION=15
TEMP_DIR=/tmp/youtube-shorts/temp
OUTPUT_DIR=/tmp/youtube-shorts/output
```

> **Note**: Railway provides `${{Redis.RAILWAY_PRIVATE_DOMAIN}}` and `${{Redis.RAILWAY_TCP_PROXY_PORT}}` as references to your Redis service. These will automatically resolve to the correct values.

### 5. YouTube API Credentials Setup

Since Railway doesn't support uploading files directly, you have two options:

#### Option A: Use Environment Variables (Recommended)

1. Open your downloaded YouTube credentials JSON file
2. Copy the entire JSON content
3. In Railway Variables, add:
   ```
   YOUTUBE_CREDENTIALS_JSON=<paste the entire JSON here>
   ```

4. Update your `routes/auth.js` to read from environment variable:

```javascript
// Add this at the top of routes/auth.js
const credentials = process.env.YOUTUBE_CREDENTIALS_JSON 
  ? JSON.parse(process.env.YOUTUBE_CREDENTIALS_JSON)
  : require(config.paths.credentials + '/youtube_credentials.json');
```

#### Option B: Use Railway Volumes (For persistent storage)

1. In Railway dashboard, go to your service
2. Click **"Settings"** → **"Volumes"**
3. Add a new volume mounted at `/app/credentials`
4. After deployment, use Railway CLI to upload credentials:
   ```bash
   railway run bash
   # Then upload your credentials file
   ```

### 6. Deploy

Railway will automatically deploy your app when you push to GitHub. You can also trigger manual deployments:

1. Go to **"Deployments"** tab
2. Click **"Deploy"** to trigger a new deployment

### 7. Get Your App URL

1. In Railway dashboard, go to **"Settings"**
2. Click **"Generate Domain"** under **"Networking"**
3. Railway will provide a public URL like `https://your-app.up.railway.app`

## Verify Deployment

Once deployed, verify everything is working:

1. **Health Check**: Visit `https://your-app.up.railway.app/api/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Check Logs**: In Railway dashboard, go to **"Deployments"** → **"View Logs"**
   - Look for: `🚀 Server running on http://localhost:3000`
   - Verify FFmpeg and yt-dlp are available

3. **Test the App**: Open `https://your-app.up.railway.app` in your browser

## Important Notes

### Storage Limitations

⚠️ **Railway uses ephemeral storage** - files in `temp/` and `output/` directories will be deleted when the container restarts.

**For production use**, consider:
- Adding Railway Volumes for persistent storage
- Using cloud storage (AWS S3, Google Cloud Storage, Cloudinary)
- Implementing automatic cleanup of processed files

### Redis Connection

The app automatically connects to Railway's Redis using the environment variables. If you see connection errors:

1. Verify Redis service is running
2. Check `REDIS_HOST` and `REDIS_PORT` variables are set correctly
3. Ensure both services are in the same Railway project

### YouTube OAuth Flow

The first time you use YouTube upload features:

1. The app will generate an authorization URL
2. You'll need to visit this URL and authorize the app
3. The token will be saved (if using volumes) or you'll need to re-authorize after restarts

## Troubleshooting

### Build Failures

If the build fails:
- Check Railway build logs for errors
- Ensure `nixpacks.toml` is in the root directory
- Verify `package.json` has correct dependencies

### FFmpeg/yt-dlp Not Found

If you see errors about missing FFmpeg or yt-dlp:
- Verify `nixpacks.toml` is correctly configured
- Check build logs to ensure packages were installed
- Railway should show: "Installing nixPkgs: ffmpeg, yt-dlp"

### Redis Connection Errors

If the app can't connect to Redis:
- Ensure Redis service is running in Railway
- Verify environment variables reference the Redis service correctly
- Check both services are in the same project

### Out of Memory Errors

Video processing is memory-intensive. If you encounter OOM errors:
- Upgrade to a higher Railway plan with more RAM
- Reduce `MAX_CONCURRENT_JOBS` to 1
- Implement file size limits

## Updating Your App

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push
```

Railway will automatically detect the push and redeploy.

## Railway CLI (Optional)

Install Railway CLI for easier management:

```bash
npm install -g @railway/cli
railway login
railway link
```

Useful commands:
- `railway logs` - View live logs
- `railway run bash` - Access container shell
- `railway status` - Check deployment status
- `railway open` - Open app in browser

## Cost Estimation

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month (500 hours of usage)
- **Pro Plan**: $20/month + usage-based pricing

Your app will use:
- Node.js service: ~$5-10/month
- Redis service: ~$5/month
- Bandwidth: Depends on usage

## Support

If you encounter issues:
- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Check application logs in Railway dashboard

---

**Happy Deploying! 🚀**
