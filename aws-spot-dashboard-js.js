// Preços de exemplo - em um aplicativo real, você iria buscar esses dados da API da AWS
// ou de um backend que consulta os preços atuais
const PRICES = {
    "us-east-1": {
        "t3.micro": { onDemand: 0.0104, spot: 0.0031 },
        "t3.small": { onDemand: 0.0208, spot: 0.0062 },
        "t3.medium": { onDemand: 0.0416, spot: 0.0125 },
        "m5.large": { onDemand: 0.096, spot: 0.0378 },
        "m5.xlarge": { onDemand: 0.192, spot: 0.0789 },
        "m5.2xlarge": { onDemand: 0.384, spot: 0.1565 },
        "c5.large": { onDemand: 0.085, spot: 0.0316 },
        "c5.xlarge": { onDemand: 0.17, spot: 0.0688 },
        "r5.large": { onDemand: 0.126, spot: 0.0427 },
        "r5.xlarge": { onDemand: 0.252, spot: 0.0854 }
    },
    "us-east-2": {
        "t3.micro": { onDemand: 0.0104, spot: 0.0031 },
        "t3.small": { onDemand: 0.0208, spot: 0.0062 },
        "t3.medium": { onDemand: 0.0416, spot: 0.0125 },
        "m5.large": { onDemand: 0.096, spot: 0.0336 },
        "m5.xlarge": { onDemand: 0.192, spot: 0.0672 },
        "m5.2xlarge": { onDemand: 0.384, spot: 0.1344 },
        "c5.large": { onDemand: 0.085, spot: 0.0298 },
        "c5.xlarge": { onDemand: 0.17, spot: 0.0595 },
        "r5.large": { onDemand: 0.126, spot: 0.0441 },
        "r5.xlarge": { onDemand: 0.252, spot: 0.0882 }
    },
    "sa-east-1": {
        "t3.micro": { onDemand: 0.0132, spot: 0.0040 },
        "t3.small": { onDemand: 0.0264, spot: 0.0079 },
        "t3.medium": { onDemand: 0.0528, spot: 0.0158 },
        "m5.large": { onDemand: 0.122, spot: 0.0427 },
        "m5.xlarge": { onDemand: 0.244, spot: 0.0854 },
        "m5.2xlarge": { onDemand: 0.488, spot: 0.1708 },
        "c5.large": { onDemand: 0.108, spot: 0.0378 },
        "c5.xlarge": { onDemand: 0.216, spot: 0.0756 },
        "r5.large": { onDemand: 0.16, spot: 0.056 },
        "r5.xlarge": { onDemand: 0.32, spot: 0.112 }
    }
};

// Dados de interrupção de exemplo - você precisará coletar esses dados manualmente
// do Spot Instance Advisor e inserir aqui ou implementar um web scraper
const INTERRUPTION_RATES = {
    "us-east-1": {
        "t3.micro": { rate: "<5%", level: "low" },
        "t3.small": { rate: "<5%", level: "low" },
        "t3.medium": { rate: "<5%", level: "low" },
        "m5.large": { rate: "5-10%", level: "medium" },
        "m5.xlarge": { rate: "5-10%", level: "medium" },
        "m5.2xlarge": { rate: "10-15%", level: "high" },
        "c5.large": { rate: "<5%", level: "low" },
        "c5.xlarge": { rate: "<5%", level: "low" },
        "r5.large": { rate: "5-10%", level: "medium" },
        "r5.xlarge": { rate: "5-10%", level: "medium" }
    }
};

// Variáveis para armazenar o estado atual
let selectedInstances = [];
let chart = null;

// Função para formatar moeda
function formatCurrency(value) {
    return `R$ ${value.toFixed(2)}`;
}

// Função para calcular a porcentagem de economia
function calculateSavingsPercentage(onDemand, spot) {
    return ((onDemand - spot) / onDemand * 100).toFixed(1);
}

// Função para determinar a classe de economia com base na porcentagem
function getSavingsClass(percentage) {
    if (percentage >= 70) return "savings-high";
    if (percentage >= 50) return "savings-medium";
    return "savings-low";
}

// Função para adicionar uma instância à tabela
function addInstance(instanceType) {
    const region = document.getElementById('region').value;
    
    // Verificar se a instância já foi adicionada
    if (selectedInstances.some(instance => instance.type === instanceType && instance.region === region)) {
        alert(`Instância ${instanceType} na região ${region} já foi adicionada.`);
        return;
    }
    
    // Verificar se temos dados de preço para esta instância e região
    if (!PRICES[region] || !PRICES[region][instanceType]) {
        alert(`Não temos dados de preço para ${instanceType} na região ${region}.`);
        return;
    }
    
    // Adicionar à lista de instâncias selecionadas
    selectedInstances.push({
        type: instanceType,
        region: region,
        prices: PRICES[region][instanceType]
    });
    
    // Atualizar a tabela e os cálculos
    updateInstancesTable();
    updateInterruptionTable();
    updateSummary();
    updateChart();
}

// Função para remover uma instância da tabela
function removeInstance(index) {
    selectedInstances.splice(index, 1);
    updateInstancesTable();
    updateInterruptionTable();
    updateSummary();
    updateChart();
}

// Função para atualizar a tabela de instâncias
function updateInstancesTable() {
    const tableBody = document.querySelector('#instances-table tbody');
    tableBody.innerHTML = '';
    
    selectedInstances.forEach((instance, index) => {
        const onDemandPrice = instance.prices.onDemand;
        const spotPrice = instance.prices.spot;
        const savingsPercentage = calculateSavingsPercentage(onDemandPrice, spotPrice);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${instance.type} (${instance.region})</td>
            <td>${formatCurrency(onDemandPrice)}</td>
            <td>${formatCurrency(spotPrice)}</td>
            <td class="${getSavingsClass(savingsPercentage)}">${savingsPercentage}%</td>
            <td><button class="btn" onclick="removeInstance(${index})">Remover</button></td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Função para atualizar a tabela de interrupção
function updateInterruptionTable() {
    const tableBody = document.querySelector('#interruption-table tbody');
    tableBody.innerHTML = '';
    
    selectedInstances.forEach(instance => {
        // Verificar se temos dados de interrupção para esta instância e região
        if (!INTERRUPTION_RATES[instance.region] || !INTERRUPTION_RATES[instance.region][instance.type]) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${instance.type} (${instance.region})</td>
                <td colspan="2">Dados não disponíveis</td>
            `;
            tableBody.appendChild(row);
            return;
        }
        
        const interruptionData = INTERRUPTION_RATES[instance.region][instance.type];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${instance.type} (${instance.region})</td>
            <td>${interruptionData.rate}</td>
            <td>
                <span class="interruption-level interruption-${interruptionData.level}"></span>
                ${interruptionData.level === 'low' ? 'Baixo' : interruptionData.level === 'medium' ? 'Médio' : 'Alto'}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Função para atualizar o resumo
function updateSummary() {
    const hoursPerMonth = parseInt(document.getElementById('hours-per-month').value);
    
    let totalOnDemand = 0;
    let totalSpot = 0;
    
    selectedInstances.forEach(instance => {
        totalOnDemand += instance.prices.onDemand * hoursPerMonth;
        totalSpot += instance.prices.spot * hoursPerMonth;
    });
    
    const totalSavings = totalOnDemand - totalSpot;
    const savingsPercentage = totalOnDemand > 0 ? (totalSavings / totalOnDemand * 100).toFixed(1) : 0;
    
    document.getElementById('total-ondemand').textContent = formatCurrency(totalOnDemand);
    document.getElementById('total-spot').textContent = formatCurrency(totalSpot);
    document.getElementById('total-savings').textContent = `${formatCurrency(totalSavings)} (${savingsPercentage}%)`;
}

// Função para atualizar o gráfico
function updateChart() {
    const ctx = document.getElementById('savings-chart').getContext('2d');
    const hoursPerMonth = parseInt(document.getElementById('hours-per-month').value);
    
    const labels = selectedInstances.map(instance => `${instance.type} (${instance.region})`);
    const onDemandData = selectedInstances.map(instance => instance.prices.onDemand * hoursPerMonth);
    const spotData = selectedInstances.map(instance => instance.prices.spot * hoursPerMonth);
    const savingsData = selectedInstances.map((instance, index) => 
        onDemandData[index] - spotData[index]
    );
    
    // Destruir gráfico anterior se existir
    if (chart) {
        chart.destroy();
    }
    
    // Criar novo gráfico
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Custo On-Demand Mensal',
                    data: onDemandData,
                    backgroundColor: '#232f3e',
                    borderColor: '#232f3e',
                    borderWidth: 1
                },
                {
                    label: 'Custo Spot Mensal',
                    data: spotData,
                    backgroundColor: '#ff9900',
                    borderColor: '#ff9900',
                    borderWidth: 1
                },
                {
                    label: 'Economia Mensal',
                    data: savingsData,
                    backgroundColor: '#28a745',
                    borderColor: '#28a745',
                    borderWidth: 1,
                    type: 'bar'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Custo Mensal (R$)'
                    }
                }
            }
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Botão de adicionar instância
    document.getElementById('btn-add-instance').addEventListener('click', function() {
        const instanceType = document.getElementById('instance-type').value;
        addInstance(instanceType);
    });
    
    // Atualizar quando a região mudar
    document.getElementById('region').addEventListener('change', function() {
        // Limpar instâncias ao mudar de região
        selectedInstances = [];
        updateInstancesTable();
        updateInterruptionTable();
        updateSummary();
        updateChart();
    });
    
    // Atualizar quando horas por mês mudar
    document.getElementById('hours-per-month').addEventListener('input', function() {
        updateSummary();
        updateChart();
    });
    
    // Inicializar gráfico vazio
    const ctx = document.getElementById('savings-chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
});

// Expor funções para o escopo global
window.addInstance = addInstance;
window.removeInstance = removeInstance;
