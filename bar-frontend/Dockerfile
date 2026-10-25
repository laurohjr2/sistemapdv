# Multi-stage build para otimizar tamanho da imagem

# Estágio 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Estágio 2: Produção
FROM nginx:alpine

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Expor porta
EXPOSE 80

# Comando de inicialização
CMD ["nginx", "-g", "daemon off;"]

