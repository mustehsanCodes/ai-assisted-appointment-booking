FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @appointment/api build
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4000
CMD ["node","apps/api/dist/server.js"]
