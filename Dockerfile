FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts* ./
COPY src/ src/
RUN npx tsup src/server.ts --format esm --dts

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p data
EXPOSE 3000
CMD ["node", "dist/server.js"]
