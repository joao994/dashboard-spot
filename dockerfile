# Stage 1: Build da aplicação Node.js
FROM node:18-slim AS node-builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências primeiro
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o resto dos arquivos do projeto
COPY . .

# Criar diretório para o cache
RUN mkdir -p /app/api/cache

# Stage 2: Configuração do Nginx
FROM nginx:stable-alpine

# Instalar dependências necessárias
RUN apk add --no-cache nodejs npm curl bash

# Remover conteúdo padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar a configuração do Nginx
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar os arquivos estáticos do frontend
COPY ./public/* /usr/share/nginx/html/

# Verificar se os arquivos essenciais foram copiados
RUN ls -la /usr/share/nginx/html/ && \
    if [ ! -f /usr/share/nginx/html/styles.css ]; then echo "ERRO: styles.css não encontrado!"; exit 1; fi && \
    if [ ! -f /usr/share/nginx/html/script.js ]; then echo "ERRO: script.js não encontrado!"; exit 1; fi

# Definir permissões
RUN chmod -R 755 /usr/share/nginx/html

# Criar diretório para a aplicação Node.js
WORKDIR /app

# Copiar a aplicação Node.js do stage anterior
COPY --from=node-builder /app /app

# Criar diretório para o cache e definir permissões
RUN mkdir -p /app/api/cache && \
    chmod -R 777 /app/api/cache

# Copiar o script de inicialização
COPY start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Expor porta 80
EXPOSE 80

# IMPORTANTE: O frontend deve acessar a API usando caminhos relativos (/api/...)
# em vez de URLs absolutas (http://localhost:3000/api/...)

# Iniciar Nginx e Node.js
CMD ["/start-nginx.sh"]