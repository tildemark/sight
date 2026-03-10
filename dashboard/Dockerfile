# Sight Dashboard - Next.js Application
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for environment (demo or prod)
ARG BUILD_ENV=demo

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Copy the appropriate config file based on BUILD_ENV
RUN cp public/config-${BUILD_ENV}.json public/config.json

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Production runtime
ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
