#!/bin/bash
set -e

echo "Iniciando aplicação Dashboard Spot..."
echo "Verificando arquivos estáticos..."
ls -la /app/public

echo "Iniciando servidor Node.js..."
node api/server.js 