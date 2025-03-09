# Arquitetura do Dashboard Spot

Este documento descreve a arquitetura da aplicação Dashboard Spot, que é implantada em um cluster Kubernetes.

## Visão Geral

O Dashboard Spot é uma aplicação web que exibe informações sobre instâncias spot da AWS, incluindo preços, economias e níveis de interrupção. A aplicação é composta por um frontend servido pelo Nginx e um backend Node.js, ambos executando no mesmo container.

## Diagrama de Arquitetura

Um diagrama ASCII da arquitetura está disponível no arquivo `architecture-diagram.txt`.

## Componentes Principais

### 1. Ingress

O Ingress gerencia o acesso externo à aplicação, roteando o tráfego HTTP para o serviço apropriado.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dashboard-spot-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  rules:
  - host: dashboard-spot.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: dashboard-spot
            port:
              number: 80
```

### 2. Service

O Service expõe a aplicação internamente no cluster e balanceia a carga entre os pods.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dashboard-spot
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  selector:
    app: dashboard-spot
```

### 3. Deployment

O Deployment gerencia os pods da aplicação, garantindo que o número desejado de réplicas esteja sempre em execução.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashboard-spot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dashboard-spot
  template:
    metadata:
      labels:
        app: dashboard-spot
    spec:
      containers:
      - name: dashboard-spot
        image: joao994/dashboard-spot:latest
        ports:
        - containerPort: 80
```

### 4. HorizontalPodAutoscaler

O HPA escala automaticamente o número de pods com base na utilização de CPU.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dashboard-spot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dashboard-spot
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 5. ConfigMap

O ConfigMap armazena configurações da aplicação que são injetadas como variáveis de ambiente.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-spot-config
data:
  NODE_ENV: "production"
  CACHE_DURATION: "1800000"  # 30 minutos em milissegundos
```

## Fluxo de Dados

1. O usuário acessa a aplicação via URL (dashboard-spot.local)
2. A requisição chega ao Ingress Controller
3. O Ingress Controller roteia a requisição para o Service dashboard-spot
4. O Service encaminha a requisição para um dos Pods disponíveis
5. Dentro do Pod:
   - Requisições para arquivos estáticos são servidas pelo Nginx
   - Requisições para a API (/api/*) são redirecionadas para o Node.js
6. O Node.js processa as requisições da API:
   - Busca dados do AWS S3 (spot-advisor-data.json)
   - Armazena em cache para requisições futuras
   - Retorna os dados processados
7. O HPA monitora o uso de CPU e escala os Pods conforme necessário

## Arquitetura Interna do Container

Cada pod contém um único container que executa:

1. **Nginx (porta 80)**
   - Serve arquivos estáticos do frontend
   - Atua como proxy reverso para o backend Node.js

2. **Node.js (porta 3000)**
   - Processa requisições da API
   - Busca e formata dados de instâncias spot
   - Implementa sistema de cache

3. **Volume de Cache**
   - Armazena dados em cache para reduzir chamadas à API externa
   - Implementado como um emptyDir no Kubernetes

## Escalabilidade e Resiliência

- Múltiplas réplicas garantem alta disponibilidade
- HPA escala automaticamente baseado em uso de CPU
- Health checks (liveness e readiness probes) garantem que apenas pods saudáveis recebam tráfego
- Limites de recursos previnem sobrecarga do cluster 