FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN npm install --global pnpm@10.4.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
COPY --chmod=644 nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
