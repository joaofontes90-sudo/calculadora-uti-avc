FROM node:20-bookworm-slim

# Instala o Chromium e fontes para busca de laudos (Puppeteer) em segundo plano
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV BACKUP_DIR=/app/backups
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npm run build && mkdir -p /app/backups

EXPOSE 3000

CMD ["npm", "start"]
