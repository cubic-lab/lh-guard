FROM ghcr.io/cubic-lab/bun-chromium:v1.0.0-bun-1.2.13

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium  

WORKDIR /app

COPY . /app