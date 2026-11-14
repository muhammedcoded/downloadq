FROM node:22-bookworm-slim

# All download dependencies run on the cloud server, not the visitor's PC.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/yt-dlp && /opt/yt-dlp/bin/pip install --no-cache-dir -U 'yt-dlp[default]'
ENV PATH="/opt/yt-dlp/bin:${PATH}"
ENV YTDLP_BIN=/opt/yt-dlp/bin/yt-dlp
ENV NODE_ENV=production
ENV YTDLP_JS_RUNTIME=node
WORKDIR /app
COPY . .
USER node
EXPOSE 3000
CMD ["node","server.mjs"]
