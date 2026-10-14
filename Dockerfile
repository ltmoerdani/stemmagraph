# Stemmagraph self-host image, fase i Pilar 1 Permanensi (v178)
# Bangun: docker compose build

# Stage build: dependensi, klien Prisma, dan aset frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# Stage runtime: hanya artefak yang dibutuhkan untuk melayani
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json .
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && node server/index.ts"]
