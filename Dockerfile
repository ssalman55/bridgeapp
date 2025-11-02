# Use Node.js 18 LTS
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy everything first
COPY . .

# Debug: Check what's in the backend directory
RUN ls -la "Read Me/NewReadBE/" || echo "Backend directory check"

# Copy backend files explicitly from NewReadBE
RUN cp "Read Me/NewReadBE/package.json" . && \
    cp "Read Me/NewReadBE/package-lock.json" . && \
    cp -r "Read Me/NewReadBE/src" . && \
    rm -rf "Read Me"

# Install dependencies
RUN npm install

# Expose port 5000 (or use PORT env var)
EXPOSE 5000

# Start the app
CMD ["npm", "start"]
