# Dashboard Spot - Instruções Docker

Este documento contém instruções para executar a aplicação Dashboard Spot usando Docker com Nginx como proxy reverso.

## Arquitetura da Solução

Esta solução utiliza:
- **Nginx**: Servidor web que atua como proxy reverso, servindo arquivos estáticos e redirecionando requisições da API
- **Node.js**: Servidor de aplicação que processa as requisições da API
- **Docker**: Container que encapsula toda a aplicação

## Requisitos

- Docker instalado em sua máquina
- Git (para clonar o repositório)

## Como executar

### 1. Construir a imagem Docker

```bash
docker build -t dashboard-spot .
```

### 2. Executar o container

```bash
docker run -p 80:80 dashboard-spot
```

Para executar em segundo plano (modo detached):

```bash
docker run -d -p 80:80 --name dashboard-spot-container dashboard-spot
```

### 3. Acessar a aplicação

Abra seu navegador e acesse:
```
http://localhost
```

## Informações adicionais

- A aplicação é acessível pela porta 80 (HTTP padrão)
- O Nginx serve os arquivos estáticos e atua como proxy para a API
- O Node.js roda internamente na porta 3000
- Os dados são armazenados em cache por 30 minutos
- Para limpar o cache manualmente, acesse: `http://localhost/api/clear-cache` (POST)

## Solução de problemas comuns

### API não está respondendo

Se o frontend carrega, mas a API não responde, verifique:

1. Se o container está rodando corretamente:
```bash
docker ps
```

2. Verifique os logs do container:
```bash
docker logs [container-id]
```

3. Teste a API diretamente:
```bash
curl http://localhost/api/spot-prices
```

4. Verifique se o Node.js está rodando dentro do container:
```bash
docker exec [container-id] ps aux | grep node
```

5. Teste a conexão interna:
```bash
docker exec [container-id] curl http://127.0.0.1:3000/api/spot-prices
```

### Problemas de permissão no cache

Se houver problemas com permissões de arquivo no cache:

```bash
docker exec [container-id] chmod -R 777 /app/api/cache
```

### Reiniciar o container

Para reiniciar o container após alterações:

```bash
docker stop [container-id]
docker rm [container-id]
docker run -d -p 80:80 --name dashboard-spot-container dashboard-spot
```

## Vantagens desta abordagem

1. **Segurança**: O Node.js não está diretamente exposto à internet
2. **Performance**: O Nginx é otimizado para servir arquivos estáticos
3. **Escalabilidade**: Facilita a adição de mais instâncias do backend
4. **Flexibilidade**: Permite configurações avançadas como SSL, compressão, etc. 