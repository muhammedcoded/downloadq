# DownloadQ 3.0

**Online media downloader for supported public links.** Built with Node.js, yt-dlp, FFmpeg, and a Dockerfile for Railway. A product of Remscorp Tech.

## What this version changes

- Removes the compulsory permission checkbox from the website **and backend**. Users do not need DownloadQ accounts.
- Adds server-confirmed video metadata previews, MP4 and MP3 buttons, and browser-visible errors for failed downloads.
- Uses a supported Node.js runtime (`--js-runtimes node`) for yt-dlp. The Dockerfile installs `yt-dlp[default]`, including the matching EJS scripts.
- Shows download status rather than silently starting an HTML/JSON error download.
- Retains input validation, server-side concurrency limits, temporary-file cleanup, and direct-media URL protection.

**Availability warning:** A successful deployment does **not** guarantee downloads from every social-media platform. YouTube and other sites may require authentication or block data-center addresses. DownloadQ does not bypass login requirements, DRM, or site protections. Use it for media you have the right to save.

## Repository layout

```text
DownloadQ repo (GitHub)
└── downloadq/                  # Railway root directory /downloadq
    ├── Dockerfile
    ├── package.json
    ├── server.mjs
    ├── social.mjs
    ├── youtube.mjs
    ├── public/
    │   ├── index.html
    │   ├── app.js
    │   └── styles.css
    └── tests/
```

## Run locally

Requirements: Node.js 22+, Python 3.11+, FFmpeg, and yt-dlp. Install yt-dlp with `python -m pip install -U "yt-dlp[default]"` and set `YTDLP_BIN` to your yt-dlp executable if needed.

```bash
cd downloadq
node server.mjs
```

Open http://localhost:3000. Run `npm test` for the automated tests.

## Update the existing GitHub repository

Your existing repository is `muhammedcoded/downloadq` and Railway currently uses `/downloadq` as the Root Directory.

**Via VS Code and Git:**

1. Download and extract the update ZIP.
2. Clone the existing repo (once): `git clone https://github.com/muhammedcoded/downloadq.git`.
3. Replace the **contents of the repository's `downloadq/` directory** with the contents of the new ZIP's `downloadq/` directory. Do not make a second nested `downloadq/downloadq/` directory.
4. In the repository root, run:

```bash
git add -A
git commit -m "Improve downloader workflow and errors"
git push origin main
```

**Via GitHub website:** Open the repository, enter its `downloadq/` folder, and use **Add file → Upload files** to replace changed files. Preserve each file's directory path. For many files, Git is more dependable.

## Railway settings

- **Source repo:** `muhammedcoded/downloadq`
- **Root Directory:** `/downloadq`
- **Builder:** Dockerfile
- **Dockerfile Path:** `/downloadq/Dockerfile` if Railway asks for an absolute repository path
- **Start command:** provided by Dockerfile, no custom command necessary
- **Public Networking:** keep your current domain; the server reads Railway's `PORT` environment variable
- **YTDLP_BIN:** `/opt/yt-dlp/bin/yt-dlp` (already defined in Dockerfile)
- **YTDLP_JS_RUNTIME:** `node` (already defined in Dockerfile)

Railway usually starts a new deployment automatically after a commit to the connected branch. Check the Build Logs and Deploy Logs. If autodeploy is disabled, use the service Deployments option to deploy the latest commit.

## Verifying the new site

1. Visit `/api/health` on your Railway URL. It should return `{"ok":true,"product":"DownloadQ"}`.
2. Refresh the home page with Ctrl+Shift+R. The permission checkbox should be **gone**.
3. Paste a public video link you are authorized to download and click **Check link**.
4. If the provider allows access, its preview and MP4/MP3 buttons appear. If access is blocked, the website explains the failure.
5. Click MP4 and check that a file actually appears in your browser's Downloads folder. A title or thumbnail alone is **not** proof of a successful download.

## Tests and what they prove

`npm test` includes 22 automated tests, including HTTP tests with a **mock extractor** for metadata and MP4 response. These confirm code integration, not successful access to a real YouTube/TikTok video from a Railway IP.

We have **not** performed a real live-platform download or built the Docker image in this authoring environment. Browser automation against localhost was also blocked, so verify those parts after deployment.

## Operations

Downloads may take time and consume Railway CPU, memory, bandwidth, and disk. Cap concurrency and file size, monitor usage, and investigate errors in Railway Deploy Logs. Keep extractor dependencies current by rebuilding the Docker image. Do not expose cookies, passwords, or credentials in frontend files or GitHub.

## License

MIT. See `LICENSE`.
