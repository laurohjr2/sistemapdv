# Dockerfile para o Backend
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código fonte
COPY . .

# Copiar arquivo de ambiente para Docker
COPY .env.docker .env

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Criar diretório de logs
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]

