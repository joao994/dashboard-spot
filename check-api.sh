#!/bin/bash
set -e

echo "Verificando se a API está funcionando..."

# Verificar se o container está rodando
CONTAINER_ID=$(docker ps -q -f ancestor=dashboard-spot)

if [ -z "$CONTAINER_ID" ]; then
    echo "Container não está rodando. Iniciando..."
    docker run -d -p 80:80 --name dashboard-spot-container dashboard-spot
    sleep 10
    CONTAINER_ID=$(docker ps -q -f name=dashboard-spot-container)
fi

echo "Container ID: $CONTAINER_ID"

# Verificar logs do container
echo "Logs do container:"
docker logs $CONTAINER_ID --tail 50

# Verificar se o Node.js está rodando
echo "Processos Node.js no container:"
docker exec $CONTAINER_ID ps aux | grep node

# Testar a API diretamente
echo "Testando API diretamente no container:"
docker exec $CONTAINER_ID curl -v http://127.0.0.1:3000/api/spot-prices

# Testar a API através do Nginx
echo "Testando API através do Nginx:"
docker exec $CONTAINER_ID curl -v http://127.0.0.1/api/spot-prices

# Testar a API externamente
echo "Testando API externamente:"
curl -v http://localhost/api/spot-prices

echo "Verificação concluída!" 