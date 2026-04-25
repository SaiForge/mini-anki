# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start the Vite development server and expose it to the host network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
