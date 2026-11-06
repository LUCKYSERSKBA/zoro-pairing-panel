FROM node:20-alpine

# Install Python, Pip, build tools, and FFmpeg on Alpine
RUN apk add --no-cache python3 py3-pip make g++ ffmpeg

WORKDIR /app

COPY package*.json ./

# Environment setting to skip python check for youtube downloader
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

# Install Node.js dependencies (shazamio must be removed from package.json)
RUN npm install

# Install Python's shazamio library for audio recognition
RUN pip install --no-cache-dir shazamio --break-system-packages

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
