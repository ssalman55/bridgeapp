<<<<<<< HEAD
# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app
=======
# Use Node.js 18 LTS
FROM node:18

# Set working directory
WORKDIR /usr/src/app
>>>>>>> 29b5c5b (Docker File Added)

# Copy everything first
COPY . .

# Debug: Check what's in the backend directory
RUN ls -la "Read Me/backend/"

# Copy backend files explicitly
RUN cp "Read Me/backend/package.json" . && cp "Read Me/backend/package-lock.json" . && cp -r "Read Me/backend/src" . && rm -rf "Read Me"

# Install dependencies
<<<<<<< HEAD
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000
=======
RUN npm install

# Expose port 5000
EXPOSE 5000
>>>>>>> 29b5c5b (Docker File Added)

# Start the app
CMD ["npm", "start"] 