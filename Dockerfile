FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production
ENV ORIGIN=https://codesync.onrender.com

# Expose the port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "server"]