FROM node:24-bookworm-slim
WORKDIR /app/bar-management-system
COPY bar-management-system/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node bar-management-system/ ./
COPY --chown=node:node docker/local.cjs /app/docker/local.cjs
USER node
EXPOSE 3000
CMD ["node", "/app/docker/local.cjs", "serve"]
