FROM node:20-alpine

# Install Python, build tools, and FFmpeg on Alpine (Required for Shazam & media processing)
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

COPY package*.json ./

# Environment setting to skip python check for youtube downloader
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

RUN npm install

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
