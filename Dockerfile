<<<<<<< HEAD
# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app
=======
# Use Node.js 18 LTS
FROM node:18

# Set working directory to backend
WORKDIR /usr/src/app
>>>>>>> 29b5c5b (Docker File Added)

# Copy the entire backend directory (using wildcard to handle space in directory name)
COPY Read\ Me/backend/ ./

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