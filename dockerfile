# Dockerfile
FROM node:16-alpine

# Criar diretório da aplicação
WORKDIR /app

# Instalar dependências do sistema
# O git é necessário para algumas dependências npm
RUN apk add --no-cache git

# Copiar package.json e package-lock.json
COPY package*.json ./

COPY /api/server*.js ./

# Instalar dependências
RUN npm install

# Copiar o código da aplicação
COPY . .

# Expor a porta que a aplicação utiliza
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]