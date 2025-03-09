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

# Verificar arquivos de CSS e JS específicos
echo "Verificando arquivos CSS e JS..."
if [ -f /usr/share/nginx/html/styles.css ]; then
    echo "OK: styles.css encontrado!"
else
    echo "ERRO: styles.css não encontrado!"
    # Tentar copiar de outro local como fallback
    cp -f /app/public/styles.css /usr/share/nginx/html/ || echo "Falha ao copiar styles.css"
fi

if [ -f /usr/share/nginx/html/script.js ]; then
    echo "OK: script.js encontrado!"
else
    echo "ERRO: script.js não encontrado!"
    # Tentar copiar de outro local como fallback
    cp -f /app/public/script.js /usr/share/nginx/html/ || echo "Falha ao copiar script.js"
fi

# Aplicar permissões adequadas
echo "Aplicando permissões para arquivos estáticos..."
chmod -R 755 /usr/share/nginx/html/

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