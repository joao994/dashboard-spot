// Preços de exemplo - em um aplicativo real, você iria buscar esses dados da API da AWS
// ou de um backend que consulta os preços atuais
let PRICES = {};
let INTERRUPTION_RATES = {};

// Função para buscar os dados da API do Spot Advisor
async function fetchSpotData() {
    try {
        const response = await fetch('http://localhost:3000/api/spot-prices');
        const data = await response.json();

        // Estruturar os dados para PRICES e INTERRUPTION_RATES
        data.forEach(instance => {
            if (!PRICES[instance.region]) {
                PRICES[instance.region] = {};
                INTERRUPTION_RATES[instance.region] = {};
            }

            PRICES[instance.region][instance.instanceType] = {
                onDemand: "N/A",  // Se precisar dos preços On-Demand, pode adicionar uma fonte aqui
                spot: instance.savingsOverOnDemand // Já está como porcentagem de economia
            };

            INTERRUPTION_RATES[instance.region][instance.instanceType] = {
                rate: `${instance.interruptionRate * 10}%`, // Agora corretamente ajustado para a API
                level: instance.interruptionLevel
            };
        });

        console.log("📌 Dados carregados da API:", PRICES, INTERRUPTION_RATES);

        // Atualiza a interface com os novos dados
        updateInstancesTable();
        updateInterruptionTable();
        updateSummary();
        updateChart();

    } catch (error) {
        console.error("Erro ao buscar os dados do Spot Advisor:", error);
    }
}

// Função para carregar os dados ao iniciar
document.addEventListener('DOMContentLoaded', fetchSpotData);


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
    const hoursPerMonth = parseInt(document.getElementById('hours-per-month').value) || 0;

    if (!selectedInstances || selectedInstances.length === 0) {
        console.warn("⚠️ Nenhuma instância selecionada para o gráfico.");
        return;
    }

    const labels = selectedInstances.map(instance => `${instance.type} (${instance.region})`);
    const onDemandData = selectedInstances.map(instance => 
        instance.prices && instance.prices.onDemand ? instance.prices.onDemand * hoursPerMonth : 0
    );
    const spotData = selectedInstances.map(instance => 
        instance.prices && instance.prices.spot ? instance.prices.spot * hoursPerMonth : 0
    );
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
