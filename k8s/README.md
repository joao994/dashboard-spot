# Deploy no Kubernetes - Dashboard Spot

Este diretório contém o arquivo necessário para fazer o deploy da aplicação Dashboard Spot no Kubernetes.

## Estrutura do arquivo

O arquivo `dashboard-spot.yaml` contém todos os recursos necessários:
- Deployment: Gerencia os pods da aplicação
- Service: Expõe a aplicação internamente
- ConfigMap: Configurações da aplicação
- HPA: Configuração do Horizontal Pod Autoscaling
- Ingress: Gerencia o acesso externo à aplicação

## Pré-requisitos

1. Cluster Kubernetes configurado
2. kubectl instalado e configurado
3. Ingress Controller NGINX instalado no cluster
4. Imagem Docker da aplicação construída e disponível

## Preparação

1. Construa a imagem Docker:
```bash
docker build -t dashboard-spot:latest .
```

2. Se estiver usando um registro de containers remoto:
```bash
docker tag dashboard-spot:latest seu-registro/dashboard-spot:latest
docker push seu-registro/dashboard-spot:latest
```
Neste caso, atualize o campo `image` no arquivo `dashboard-spot.yaml`.

3. Configure o domínio:
Edite o arquivo `dashboard-spot.yaml` e altere o host no Ingress:
```yaml
spec:
  rules:
  - host: seu-dominio.com  # Altere para seu domínio
```

## Deploy

1. Criar o namespace:
```bash
kubectl create namespace dashboard-spot
```

2. Aplicar todos os recursos:
```bash
kubectl apply -f dashboard-spot.yaml -n dashboard-spot
```

## Verificar o status

1. Verificar todos os recursos:
```bash
kubectl -n dashboard-spot get all
```

2. Verificar o Ingress:
```bash
kubectl -n dashboard-spot get ingress
```

3. Verificar os logs:
```bash
kubectl -n dashboard-spot logs -l app=dashboard-spot
```

## Acessar a aplicação

1. Adicione o domínio ao seu arquivo hosts (para teste local):
```bash
echo "127.0.0.1 dashboard-spot.local" | sudo tee -a /etc/hosts
```

2. Acesse a aplicação:
```
http://dashboard-spot.local
```

## Escalar a aplicação

O HPA (Horizontal Pod Autoscaler) irá automaticamente escalar os pods baseado no uso de CPU:
- Mínimo: 2 réplicas
- Máximo: 5 réplicas
- Alvo de utilização de CPU: 70%

Para verificar o status do HPA:
```bash
kubectl -n dashboard-spot get hpa
```

## Limpeza

Para remover todos os recursos:
```bash
kubectl delete -f dashboard-spot.yaml -n dashboard-spot
kubectl delete namespace dashboard-spot
```

## Troubleshooting

1. Verificar eventos do Ingress:
```bash
kubectl -n dashboard-spot describe ingress dashboard-spot-ingress
```

2. Verificar logs do Ingress Controller:
```bash
kubectl -n ingress-nginx logs -l app.kubernetes.io/name=ingress-nginx
```

3. Verificar status dos pods:
```bash
kubectl -n dashboard-spot describe pod -l app=dashboard-spot
``` 