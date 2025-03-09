#!/bin/sh
set -e

echo "Iniciando aplicação Dashboard Spot com Nginx..."

# Verificar se o diretório de cache existe
mkdir -p /app/api/cache
chmod -R 777 /app/api/cache

# Verificar arquivos e diretórios
echo "Verificando estrutura de arquivos..."
ls -la /app
ls -la /app/api
ls -la /usr/share/nginx/html

# Iniciar o servidor Node.js em segundo plano
echo "Iniciando servidor Node.js na porta 3000..."
cd /app && node api/server.js &
NODE_PID=$!

# Aguardar um momento para o Node.js iniciar
echo "Aguardando inicialização do Node.js..."
sleep 5

# Verificar se o Node.js está rodando
echo "Verificando se o Node.js está rodando (PID: $NODE_PID)..."
ps aux | grep node

# Testar conexão com o Node.js
echo "Testando conexão com o Node.js..."
curl -v http://127.0.0.1:3000/api/spot-prices || echo "Aviso: Não foi possível conectar ao Node.js, mas continuando..."

# Iniciar o Nginx em primeiro plano
echo "Iniciando Nginx na porta 80..."
nginx -g 'daemon off;' 