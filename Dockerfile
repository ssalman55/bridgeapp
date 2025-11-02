# Use Node.js 18 LTS
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy everything first
COPY . .

# Debug: Check what's in the backend directory
RUN ls -la "Read Me/backend/" || echo "Backend directory check"

# Copy backend files explicitly
RUN cp "Read Me/backend/package.json" . && \
    cp "Read Me/backend/package-lock.json" . && \
    cp -r "Read Me/backend/src" . && \
    rm -rf "Read Me"

# Install dependencies
RUN npm install

# Expose port 5000 (or use PORT env var)
EXPOSE 5000

# Start the app
CMD ["npm", "start"]
