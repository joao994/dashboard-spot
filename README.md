# Dashboard de Instâncias Spot AWS

Um dashboard interativo para análise de custos e economia potencial com instâncias spot da AWS. Esta ferramenta permite visualizar e analisar preços de instâncias spot em comparação com instâncias on-demand, ajudando na tomada de decisão para otimização de custos na AWS.

## 🚀 Funcionalidades

### 📊 Visualização de Dados
- Gráficos interativos mostrando:
  - Economia média por região
  - Distribuição de níveis de interrupção
  - Top 10 instâncias com maior economia e menor nível de interrupção (balanceamento ideal)
  - Economia média por sistema operacional
- Tabela detalhada com informações de preços e economia
- Sistema de paginação para melhor navegação dos dados

### 🔍 Filtros Avançados
- Filtro por região
- Filtro por sistema operacional
- Filtro por tipo de instância
- Filtro por nível de interrupção

### 💰 Análise de Economia
- Conexão com sua conta AWS para análise personalizada
- Cálculo de economia potencial baseado em suas instâncias atuais
- Identificação de instâncias elegíveis para conversão para spot
- Estimativas de custos mensais (On-Demand vs Spot)

### 🔐 Segurança
- Credenciais AWS armazenadas apenas localmente
- Opção de salvar credenciais no navegador de forma segura
- Análise realizada localmente sem envio de dados para servidores externos

### 📤 Exportação de Dados
- Exportação dos dados filtrados para CSV
- Relatórios detalhados de economia potencial

## 🛠️ Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- Chart.js para visualizações gráficas
- AWS SDK para JavaScript
- PapaParse para manipulação de CSV

## 📋 Pré-requisitos

- Navegador web moderno com suporte a JavaScript
- Credenciais AWS com permissões para `ec2:DescribeInstances`
- Servidor local ou hospedagem para servir a aplicação

## 🚦 Como Usar

1. Clone o repositório:
   ```bash
   git clone [URL_DO_REPOSITORIO]
   ```

2. Configure um servidor web local (pode usar Python, Node.js, etc.)
   ```bash
   # Exemplo com Python
   python -m http.server 8000
   ```

3. Acesse a aplicação no navegador:
   ```
   http://localhost:8000
   ```

4. Para análise personalizada:
   - Clique no menu lateral
   - Insira suas credenciais AWS
   - Clique em "Analisar Instâncias"

## 🔧 Configuração da AWS

Para usar a funcionalidade de análise personalizada, você precisará:

1. Uma conta AWS
2. Access Key ID e Secret Access Key
3. Permissões para listar instâncias EC2
4. Região AWS configurada

## 📈 Métricas de Economia

O dashboard calcula a economia potencial considerando:
- Preços atuais das instâncias on-demand
- Preços históricos das instâncias spot
- Níveis de interrupção por região/tipo
- Elegibilidade das cargas de trabalho

## 🔒 Segurança e Privacidade

- Nenhum dado é enviado para servidores externos
- Credenciais AWS são armazenadas apenas no localStorage do navegador
- Análises são realizadas diretamente via AWS SDK no navegador

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature
   ```bash
   git checkout -b feature/NovaFeature
   ```
3. Commit suas mudanças
   ```bash
   git commit -m 'Adicionando nova feature'
   ```
4. Push para a branch
   ```bash
   git push origin feature/NovaFeature
   ```
5. Abra um Pull Request

## 📝 Notas Importantes

- Os preços e economias são estimativas baseadas em dados históricos
- Nem todas as instâncias são elegíveis para conversão para spot
- Recomenda-se análise adicional antes de converter instâncias críticas

## 🌐 API de Preços

O dashboard utiliza uma API local para obter os preços spot. Certifique-se de que a API está rodando em:
```
http://localhost:3000/api/spot-prices
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ✨ Agradecimentos

- AWS pela documentação e SDKs
- Comunidade open source pelas bibliotecas utilizadas
- Contribuidores do projeto
