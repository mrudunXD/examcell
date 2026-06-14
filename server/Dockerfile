FROM node:20-slim

# Install Python 3, pip, and virtual env tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment and install Google OR-Tools
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir ortools

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 5000

ENV PORT=5000
CMD ["node", "src/index.js"]
