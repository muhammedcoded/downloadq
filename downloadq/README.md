# DownloadQ

A web-based media downloader for **public videos you own or have permission to save**. Paste a link, preview video metadata, choose MP4 or MP3, and download through a server-hosted media processor. Built with Node.js, `yt-dlp`, and FFmpeg.

**A product of Remscorp Tech.**

## What's supported

- Public YouTube videos and Shorts
- Public TikTok videos and official short share links
- Instagram Reels/posts, Facebook videos, X video posts, and LinkedIn posts **when the platform allows the extractor to access the content**
- Direct public HTTPS links to media files
- Preview thumbnails, video titles, uploaders, and duration when available
- MP4 video download and MP3 audio extraction, with server-side processing
- Responsive purple-and-white website with dark mode

Not all videos on these services are available. The app will report extraction errors for private posts, login-gated videos, age-restricted media, blocked datacenter IPs, unavailable formats, and platform changes. No login bypass or DRM circumvention is implemented. Do not represent any platform as universally supported.

## Quick local setup (VS Code)

This version is a **server application**, not a static HTML website. It uses the backend for actual online video downloads.

Install Node.js 22+, Python 3, yt-dlp, and FFmpeg. For YouTube, yt-dlp also needs a supported JavaScript runtime; this project uses Node 22 through `--js-runtimes node`.

On Windows PowerShell:

```powershell
py -m pip install -U "yt-dlp[default]"
winget install Gyan.FFmpeg
node server.mjs
```

On some Windows machines `py -m yt_dlp` is unavailable until Python is on PATH. Set `YTDLP_BIN` to an installed yt-dlp executable if needed. Restart the terminal after installing FFmpeg. Open `http://localhost:3000`.

## Deploy online using Railway (recommended)

You do **not** need to install yt-dlp, FFmpeg, or Python on visitors' computers.

1. Create a GitHub repository and upload the **contents** of this project folder, including `Dockerfile`, `server.mjs`, `social.mjs`, and `public/`.
2. Open [Railway](https://railway.com/), choose **New Project → Deploy from GitHub Repo**, and select your repository.
3. Railway builds this Dockerfile, installing Node.js, Python, yt-dlp, and FFmpeg in the cloud.
4. In your Railway service, add a public domain through Networking. The application listens to `process.env.PORT` automatically.
5. Visit your new domain, paste a supported public video link, and test a video that you own or are authorized to save.
6. When ready, add your custom domain in Railway and configure your DNS records.

No Supabase database is needed for basic downloads. You can add a database later for accounts and paid plans.

**Production considerations:** Media extractors may fail from cloud host IPs. Long downloads consume server RAM, CPU, bandwidth, and ephemeral disk space. Railway may charge for bandwidth and compute. Add per-user quotas, abuse prevention, monitoring, a queue, additional rate limits, caching rules and Terms/Privacy pages before public launch. The starter's limit is two concurrent media jobs per instance. Server files are deleted after each download, and a 200 MB output ceiling is enforced, but monitor temporary storage and unexpected process termination. Do not claim universal platform availability.

## API

- `GET /api/health` returns application status.
- `POST /api/social/inspect` with `{"url":"https://...","confirmRights":true}` returns metadata and format options.
- `GET /api/social/download?url=...&format=mp4&confirm=yes` processes an authorized video and returns a file.
- `POST /api/inspect` inspects direct media URLs.
- `GET /api/download?url=...` streams a direct media file.

Only publicly accessible URLs are supported. The application does not request users' social-media passwords, browser cookies, or access tokens.

## Tests

```bash
npm test
```

Automated tests use simulated media extractor responses and verify URL validation and API behavior. **They do not establish that every TikTok/YouTube/etc. link will work from your deployed server.** Verify real video previews and downloads from Railway after deployment.

## Copyright and acceptable use

Only download videos you own, are licensed to download, or otherwise have permission to save. Respect platform terms, privacy, copyright, and takedown requests.

## License

MIT, see LICENSE.
