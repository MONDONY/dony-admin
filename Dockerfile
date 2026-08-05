FROM node:22-alpine AS builder
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S yadony && adduser -S yadony -G yadony
COPY --from=builder /build/.output ./.output
USER yadony
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
