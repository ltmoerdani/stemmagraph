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
# tini (repo community alpine): init PID 1 yang meneruskan sinyal
# mkdir + chown sebelum USER node: named volume /app/data mewarisi kepemilikan dir image pada pemakaian pertama
RUN apk add --no-cache tini && mkdir -p /app/data && chown -R node:node /app/data
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json .
EXPOSE 3000
USER node
ENTRYPOINT ["/sbin/tini","--"]
# status HTTP apa pun berarti hidup, gagal jaringan berarti mati
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/').then(() => process.exit(0), () => process.exit(1))"
# exec menjadikan node pengganti sh di bawah tini, SIGTERM sampai ke node
CMD ["sh","-c","npx prisma migrate deploy && exec node server/index.ts"]
