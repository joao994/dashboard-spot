#!/bin/sh
set -e

echo "Iniciando Dashboard Spot AWS..."

# Verificar arquivos estáticos
echo "Verificando arquivos estáticos..."
ls -la /usr/share/nginx/html

# Verificar se o styles.css e script.js existem
if [ -f /usr/share/nginx/html/styles.css ]; then
    echo "styles.css encontrado!"
else
    echo "ERRO: styles.css não encontrado!"
fi

if [ -f /usr/share/nginx/html/script.js ]; then
    echo "script.js encontrado!"
else
    echo "ERRO: script.js não encontrado!"
fi

# Iniciar o servidor Node.js em segundo plano
echo "Iniciando servidor Node.js..."
cd /app && node api/server.js &

# Aguardar o Node.js iniciar
sleep 3

# Iniciar o Nginx em primeiro plano
echo "Iniciando Nginx..."
nginx -g 'daemon off;' 