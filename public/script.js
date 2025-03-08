// Estado global dos dados
let spotData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let awsInstances = [];
let spotPriceMap = {};
let isAwsConnected = false;

// Elementos DOM - serão inicializados quando o documento estiver pronto
let regionFilter;
let osFilter;
let instanceFilter;
let interruptionFilter;
let tableBody;
let pagination;
let exportBtn;
let connectAwsBtn;
let saveCredentialsBtn;
let credentialsStatus;
let awsAnalysisResults;
let awsAnalysisSummary;
let viewFullAnalysisBtn;
let closeAnalysisBtn;
let connectionStatus;
let sidebar;
let mainContent;
let menuToggle;
let sidebarCloseBtn;

// Inicialização quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar referências DOM
    regionFilter = document.getElementById('region-filter');
    osFilter = document.getElementById('os-filter');
    instanceFilter = document.getElementById('instance-filter');
    interruptionFilter = document.getElementById('interruption-filter');
    tableBody = document.getElementById('table-body');
    pagination = document.getElementById('pagination');
    exportBtn = document.getElementById('export-csv');
    connectAwsBtn = document.getElementById('connect-aws-btn');
    saveCredentialsBtn = document.getElementById('save-credentials-btn');
    credentialsStatus = document.getElementById('credentials-status');
    awsAnalysisResults = document.getElementById('aws-analysis-results');
    awsAnalysisSummary = document.getElementById('aws-analysis-summary');
    viewFullAnalysisBtn = document.getElementById('view-full-analysis');
    closeAnalysisBtn = document.getElementById('close-analysis');
    connectionStatus = document.getElementById('connection-status');
    sidebarCloseBtn = document.getElementById('sidebar-close');
    mainContent = document.querySelector('.main-content');
    menuToggle = document.getElementById('menu-toggle');
    sidebar = document.querySelector('.sidebar');

    // Configurar listeners de eventos
    setupEventListeners();

    // Carregar dados iniciais
    loadData();
});

// Configurar todos os event listeners
function setupEventListeners() {
    // Botão para exportar CSV
    exportBtn.addEventListener('click', exportCsv);

    // Botões relacionados à AWS
    connectAwsBtn.addEventListener('click', connectToAws);
    saveCredentialsBtn.addEventListener('click', saveAwsCredentials);
    viewFullAnalysisBtn.addEventListener('click', () => {
        awsAnalysisResults.classList.remove('hide');
    });
    closeAnalysisBtn.addEventListener('click', () => {
        awsAnalysisResults.classList.add('hide');
    });

    // Controles da Sidebar
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
        mainContent.classList.add('sidebar-open');
    });
    sidebarCloseBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
        mainContent.classList.remove('sidebar-open');
    });
}

// Função para carregar os dados da API
async function loadData() {
    try {
        const response = await fetch('http://localhost:3000/api/spot-prices');
        spotData = await response.json();
        
        // Criar mapeamento de preços spot para referência rápida
        createSpotPriceMap();
        
        // Inicializar os filtros
        initializeFilters();
        
        // Aplicar filtros iniciais
        applyFilters();
        
        // Renderizar gráficos
        renderCharts();
        
        // Carregar credenciais salvas, se existirem
        loadSavedCredentials();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        document.getElementById('table-container').innerHTML = 
            '<div class="loading">Erro ao carregar dados. Verifique se a API está funcionando.</div>';
    }
}

// Criar mapeamento de preços spot para uso posterior
function createSpotPriceMap() {
    spotPriceMap = {};
    
    spotData.forEach(item => {
        const key = `${item.region}:${item.instanceType}:${item.os}`;
        spotPriceMap[key] = {
            savingsPercentage: item.savingsOverOnDemand,
            interruptionLevel: item.interruptionLevel
        };
    });
}

// Inicializar os filtros com valores únicos dos dados
function initializeFilters() {
    // Preencher filtro de regiões
    const regions = [...new Set(spotData.map(item => item.region))];
    regions.sort().forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionFilter.appendChild(option);
    });
    
    // Preencher filtro de sistemas operacionais
    const osList = [...new Set(spotData.map(item => item.os))];
    osList.sort().forEach(os => {
        const option = document.createElement('option');
        option.value = os;
        option.textContent = formatOsName(os);
        osFilter.appendChild(option);
    });
    
    // Adicionar eventos aos filtros
    regionFilter.addEventListener('change', applyFilters);
    osFilter.addEventListener('change', applyFilters);
    instanceFilter.addEventListener('input', applyFilters);
    interruptionFilter.addEventListener('change', applyFilters);
}

// Aplicar filtros aos dados
function applyFilters() {
    const regionValue = regionFilter.value;
    const osValue = osFilter.value;
    const instanceValue = instanceFilter.value.toLowerCase();
    const interruptionValue = interruptionFilter.value;
    
    filteredData = spotData.filter(item => {
        let matches = true;
        
        if (regionValue !== 'all' && item.region !== regionValue) {
            matches = false;
        }
        
        if (osValue !== 'all' && item.os !== osValue) {
            matches = false;
        }
        
        if (instanceValue && !item.instanceType.toLowerCase().includes(instanceValue)) {
            matches = false;
        }
        
        if (interruptionValue !== 'all' && item.interruptionLevel !== interruptionValue) {
            matches = false;
        }
        
        return matches;
    });
    
    // Reset para a primeira página quando filtros mudam
    currentPage = 1;
    
    // Renderizar tabela e paginação
    renderTable();
    renderPagination();
    
    // Atualizar gráficos com dados filtrados
    renderCharts();
}

// Renderizar tabela de dados
function renderTable() {
    tableBody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'Nenhum dado encontrado para os filtros selecionados.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }
    
    pageData.forEach(item => {
        const row = document.createElement('tr');
        
        const instanceCell = document.createElement('td');
        instanceCell.textContent = item.instanceType;
        row.appendChild(instanceCell);
        
        const regionCell = document.createElement('td');
        regionCell.textContent = item.region;
        row.appendChild(regionCell);
        
        const osCell = document.createElement('td');
        osCell.textContent = formatOsName(item.os);
        row.appendChild(osCell);
        
        const savingsCell = document.createElement('td');
        savingsCell.textContent = typeof item.savingsOverOnDemand === 'number' 
            ? `${(item.savingsOverOnDemand).toFixed(0)}%` 
            : 'N/A';
        row.appendChild(savingsCell);
        
        const interruptionCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.textContent = item.interruptionLevel;
        badge.className = `status-badge status-${item.interruptionLevel.replace(' ', '-')}`;
        interruptionCell.appendChild(badge);
        row.appendChild(interruptionCell);
        
        tableBody.appendChild(row);
    });
}

// Renderizar paginação
function renderPagination() {
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    
    if (totalPages <= 1) {
        return;
    }
    
    // Botão anterior
    const prevButton = document.createElement('button');
    prevButton.textContent = '◀';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    });
    pagination.appendChild(prevButton);
    
    // Botões de página
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.toggle('active', i === currentPage);
        pageButton.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
        });
        pagination.appendChild(pageButton);
    }
    
    // Botão próximo
    const nextButton = document.createElement('button');
    nextButton.textContent = '▶';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    });
    pagination.appendChild(nextButton);
}

// Renderizar gráficos
function renderCharts() {
    renderSavingsByRegionChart();
    renderInterruptionDistributionChart();
    renderTopSavingsChart();
    renderOsSavingsChart();
}

// Gráfico de economia média por região
function renderSavingsByRegionChart() {
    const ctx = document.getElementById('savings-by-region-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.savingsByRegionChart) {
        window.savingsByRegionChart.destroy();
    }
    
    // Agrupar dados por região
    const regionData = {};
    filteredData.forEach(item => {
        if (typeof item.savingsOverOnDemand === 'number') {
            if (!regionData[item.region]) {
                regionData[item.region] = {
                    total: 0,
                    count: 0
                };
            }
            regionData[item.region].total += item.savingsOverOnDemand;
            regionData[item.region].count++;
        }
    });
    
    // Calcular médias
    const regions = Object.keys(regionData);
    const averages = regions.map(region => 
        (regionData[region].total / regionData[region].count)
    );
    
    // Ordenar por média de economia (descendente)
    const combined = regions.map((region, i) => ({
        region,
        average: averages[i]
    }));
    combined.sort((a, b) => b.average - a.average);
    
    window.savingsByRegionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: combined.map(item => item.region),
            datasets: [{
                label: 'Economia média (%)',
                data: combined.map(item => item.average.toFixed(1)),
                backgroundColor: 'rgba(255, 153, 0, 0.7)',
                borderColor: 'rgba(255, 153, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Economia média (%)'
                    }
                }
            }
        }
    });
}

// Gráfico de distribuição de níveis de interrupção
function renderInterruptionDistributionChart() {
    const ctx = document.getElementById('interruption-distribution-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.interruptionChart) {
        window.interruptionChart.destroy();
    }
    
    // Contar ocorrências de cada nível
    const countByLevel = {
        'low': 0,
        'medium': 0,
        'high': 0,
        'very high': 0
    };
    
    filteredData.forEach(item => {
        if (item.interruptionLevel in countByLevel) {
            countByLevel[item.interruptionLevel]++;
        }
    });
    
    const colorMap = {
        'low': '#28a745',
        'medium': '#ffc107',
        'high': '#dc3545',
        'very high': '#842029'
    };
    
    window.interruptionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(countByLevel).map(level => 
                level.charAt(0).toUpperCase() + level.slice(1)
            ),
            datasets: [{
                data: Object.values(countByLevel),
                backgroundColor: Object.keys(countByLevel).map(level => colorMap[level])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Gráfico das 10 instâncias com maior economia
function renderTopSavingsChart() {
    const ctx = document.getElementById('top-savings-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.topSavingsChart) {
        window.topSavingsChart.destroy();
    }
    
    // Filtrar instâncias com economia numérica e classificá-las
    const instancesWithSavings = filteredData
        .filter(item => typeof item.savingsOverOnDemand === 'number')
        .sort((a, b) => b.savingsOverOnDemand - a.savingsOverOnDemand)
        .slice(0, 10);
    
    window.topSavingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: instancesWithSavings.map(item => `${item.instanceType} (${item.region})`),
            datasets: [{
                label: 'Economia (%)',
                data: instancesWithSavings.map(item => (item.savingsOverOnDemand).toFixed(1)),
                backgroundColor: 'rgba(0, 123, 255, 0.7)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Economia (%)'
                    }
                }
            }
        }
    });
}

// Gráfico de economia média por sistema operacional
function renderOsSavingsChart() {
    const ctx = document.getElementById('os-savings-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.osSavingsChart) {
        window.osSavingsChart.destroy();
    }
    
    // Agrupar dados por sistema operacional
    const osData = {};
    filteredData.forEach(item => {
        if (typeof item.savingsOverOnDemand === 'number') {
            if (!osData[item.os]) {
                osData[item.os] = {
                    total: 0,
                    count: 0
                };
            }
            osData[item.os].total += item.savingsOverOnDemand;
            osData[item.os].count++;
        }
    });
    
    // Calcular médias
    const osList = Object.keys(osData);
    const averages = osList.map(os => 
        (osData[os].total / osData[os].count)
    );
    
    // Ordenar por média de economia (descendente)
    const combined = osList.map((os, i) => ({
        os: formatOsName(os),
        average: averages[i]
    }));
    combined.sort((a, b) => b.average - a.average);
    
    window.osSavingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: combined.map(item => item.os),
            datasets: [{
                label: 'Economia média (%)',
                data: combined.map(item => item.average.toFixed(1)),
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Economia média (%)'
                    }
                }
            }
        }
    });
}

// Gráfico de comparação de custo para análise AWS
function renderSavingsComparisonChart(currentCost, spotCost) {
    const ctx = document.getElementById('savings-comparison-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.savingsComparisonChart) {
        window.savingsComparisonChart.destroy();
    }
    
    window.savingsComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Custo Mensal On-Demand', 'Custo Mensal Spot'],
            datasets: [{
                label: 'Custo Mensal (USD)',
                data: [currentCost.toFixed(2), spotCost.toFixed(2)],
                backgroundColor: [
                    'rgba(220, 53, 69, 0.7)',
                    'rgba(40, 167, 69, 0.7)'
                ],
                borderColor: [
                    'rgba(220, 53, 69, 1)',
                    'rgba(40, 167, 69, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Custo Mensal (USD)'
                    }
                }
            }
        }
    });
}

// Função para formatar o nome do sistema operacional
function formatOsName(os) {
    const osMap = {
        'linux': 'Linux',
        'mswin': 'Windows',
        'suse': 'SUSE Linux',
        'rhel': 'Red Hat',
        'amazon': 'Amazon Linux'
    };
    
    return osMap[os] || os;
}

// Exportar dados para CSV
function exportCsv() {
    // Preparar cabeçalhos
    const headers = ['Tipo de Instância', 'Região', 'Sistema Operacional', 'Economia (%)', 'Nível de Interrupção'];
    
    // Preparar linhas de dados
    const rows = filteredData.map(item => [
        item.instanceType,
        item.region,
        formatOsName(item.os),
        typeof item.savingsOverOnDemand === 'number' ? (item.savingsOverOnDemand).toFixed(1) : 'N/A',
        item.interruptionLevel
    ]);
    
    // Criar conteúdo CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Criar blob e link para download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'spot_instances_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Conectar à AWS e analisar instâncias
async function connectToAws() {
    const accessKey = document.getElementById('aws-access-key').value;
    const secretKey = document.getElementById('aws-secret-key').value;
    const region = document.getElementById('aws-region').value;
    
    if (!accessKey || !secretKey) {
        alert('Por favor, preencha as credenciais AWS.');
        return;
    }
    
    try {
        // Configurar AWS SDK
        AWS.config.update({
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            region: region
        });
        
        // Criar serviço EC2
        const ec2 = new AWS.EC2();
        
        // Buscar instâncias EC2
        const response = await ec2.describeInstances({
            Filters: [
                {
                    Name: 'instance-state-name',
                    Values: ['running']
                }
            ]
        }).promise();
        
        // Processar instâncias
        awsInstances = [];
        let totalCurrentCost = 0;
        let totalSpotCost = 0;
        
        // Preços on-demand de referência para estimativas (USD/hora)
        const baseOnDemandPrices = {
            't2.micro': 0.0116,
            't2.small': 0.023,
            't2.medium': 0.0464,
            't2.large': 0.0928,
            'm5.large': 0.096,
            'c5.large': 0.085,
            // Adicione mais conforme necessário
        };
        
        response.Reservations.forEach(reservation => {
            reservation.Instances.forEach(instance => {
                // Determinar o sistema operacional (simplificado)
                let os = 'linux'; // padrão
                if (instance.Platform === 'windows') {
                    os = 'mswin';
                }
                
                // Buscar a porcentagem de economia do mapeamento de dados da API
                const key = `${region}:${instance.InstanceType}:${os}`;
                const pricingInfo = spotPriceMap[key] || {
                    savingsPercentage: 0,
                    interruptionLevel: 'N/A'
                };
                
                // Determinar elegibilidade para Spot (simplificado)
                const isEligible = pricingInfo.interruptionLevel !== 'very high' && 
                                  pricingInfo.interruptionLevel !== 'N/A' &&
                                  !instance.Tags.some(tag => 
                                    tag.Key.toLowerCase() === 'critical' && 
                                    tag.Value.toLowerCase() === 'true'
                                  );
                
                // Estimar preço on-demand (baseado em valores de referência)
                let estimatedOnDemandHourlyPrice = 0.10; // valor padrão
                
                if (baseOnDemandPrices[instance.InstanceType]) {
                    estimatedOnDemandHourlyPrice = baseOnDemandPrices[instance.InstanceType];
                } else {
                    // Lógica básica de estimativa por família/tamanho quando não temos o valor exato
                    const family = instance.InstanceType.split('.')[0];
                    const size = instance.InstanceType.split('.')[1];
                    
                    if (family === 'm') estimatedOnDemandHourlyPrice = 0.10;
                    else if (family === 'c') estimatedOnDemandHourlyPrice = 0.085;
                    else if (family === 'r') estimatedOnDemandHourlyPrice = 0.12;
                    else if (family === 't') estimatedOnDemandHourlyPrice = 0.02;
                    
                    // Multiplicador por tamanho
                    if (size === 'small') estimatedOnDemandHourlyPrice *= 1;
                    else if (size === 'medium') estimatedOnDemandHourlyPrice *= 2;
                    else if (size === 'large') estimatedOnDemandHourlyPrice *= 4;
                    else if (size === 'xlarge') estimatedOnDemandHourlyPrice *= 8;
                    else if (size === '2xlarge') estimatedOnDemandHourlyPrice *= 16;
                }
                
                // Ajustar preço para Windows se necessário
                if (os === 'mswin') {
                    estimatedOnDemandHourlyPrice *= 2; // Windows geralmente custa ~2x mais
                }
                
                // Calcular preço spot com base na % de economia
                const savingsPercent = pricingInfo.savingsPercentage || 0;
                const estimatedSpotHourlyPrice = estimatedOnDemandHourlyPrice * (1 - (savingsPercent / 100));
                
                // Calcular custos mensais (assumindo 730 horas por mês)
                const monthlyHours = 730;
                const onDemandMonthlyCost = estimatedOnDemandHourlyPrice * monthlyHours;
                const spotMonthlyCost = estimatedSpotHourlyPrice * monthlyHours;
                
                // Adicionar à lista de instâncias
                awsInstances.push({
                    id: instance.InstanceId,
                    type: instance.InstanceType,
                    region: region,
                    onDemandCost: onDemandMonthlyCost,
                    spotCost: spotMonthlyCost,
                    savings: onDemandMonthlyCost - spotMonthlyCost,
                    savingsPercentage: savingsPercent,
                    isEligible: isEligible
                });
                
                // Adicionar aos totais
                totalCurrentCost += onDemandMonthlyCost;
                if (isEligible) {
                    totalSpotCost += spotMonthlyCost;
                } else {
                    totalSpotCost += onDemandMonthlyCost;
                }
            });
        });
        
        // Calcular economia total
        const totalSavings = totalCurrentCost - totalSpotCost;
        
        // Atualizar a interface
        document.getElementById('current-cost').textContent = `${totalCurrentCost.toFixed(2)}`;
        document.getElementById('spot-cost').textContent = `${totalSpotCost.toFixed(2)}`;
        document.getElementById('analysis-savings-amount').textContent = `${totalSavings.toFixed(2)}`;
        document.getElementById('savings-amount').textContent = `${totalSavings.toFixed(2)}`;
        
        // Renderizar tabela de instâncias
        renderInstancesTable();
        
        // Renderizar gráfico de comparação
        renderSavingsComparisonChart(totalCurrentCost, totalSpotCost);
        
        // Exibir resumo na barra lateral
        awsAnalysisSummary.classList.remove('hide');
        
        // Atualizar status de conexão
        connectionStatus.textContent = 'Conectado';
        connectionStatus.classList.remove('status-disconnected');
        connectionStatus.classList.add('status-connected');
        
        isAwsConnected = true;
        
    } catch (error) {
        console.error('Erro ao conectar com AWS:', error);
        alert(`Erro ao conectar com AWS: ${error.message}`);
    }
}

// Renderizar tabela de instâncias analisadas
function renderInstancesTable() {
    const tableBody = document.getElementById('instances-table-body');
    tableBody.innerHTML = '';
    
    if (awsInstances.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = 'Nenhuma instância encontrada.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }
    
    awsInstances.forEach(instance => {
        const row = document.createElement('tr');
        
        const idCell = document.createElement('td');
        idCell.textContent = instance.id;
        row.appendChild(idCell);
        
        const typeCell = document.createElement('td');
        typeCell.textContent = instance.type;
        row.appendChild(typeCell);
        
        const regionCell = document.createElement('td');
        regionCell.textContent = instance.region;
        row.appendChild(regionCell);
        
        const onDemandCell = document.createElement('td');
        onDemandCell.textContent = `${instance.onDemandCost.toFixed(2)}`;
        row.appendChild(onDemandCell);
        
        const spotCell = document.createElement('td');
        spotCell.textContent = `${instance.isEligible ? instance.spotCost.toFixed(2) : 'N/A'}`;
        row.appendChild(spotCell);
        
        const savingsCell = document.createElement('td');
        if (instance.isEligible) {
            savingsCell.textContent = `${instance.savings.toFixed(2)} (${instance.savingsPercentage.toFixed(0)}%)`;
            savingsCell.style.color = '#28a745';
        } else {
            savingsCell.textContent = 'N/A';
        }
        row.appendChild(savingsCell);
        
        const eligibleCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.textContent = instance.isEligible ? 'Sim' : 'Não';
        badge.className = `status-badge ${instance.isEligible ? 'status-low' : 'status-high'}`;
        eligibleCell.appendChild(badge);
        row.appendChild(eligibleCell);
        
        tableBody.appendChild(row);
    });
}

// Salvar credenciais localmente
function saveAwsCredentials() {
    const accessKey = document.getElementById('aws-access-key').value;
    const secretKey = document.getElementById('aws-secret-key').value;
    const region = document.getElementById('aws-region').value;
    
    if (!accessKey || !secretKey) {
        alert('Por favor, preencha as credenciais AWS.');
        return;
    }
    
    // Salvar no localStorage
    localStorage.setItem('aws_access_key', accessKey);
    localStorage.setItem('aws_secret_key', secretKey);
    localStorage.setItem('aws_region', region);
    
    // Exibir mensagem de sucesso
    credentialsStatus.classList.remove('hide');
    
    // Ocultar a mensagem após 3 segundos
    setTimeout(() => {
        credentialsStatus.classList.add('hide');
    }, 3000);
}

// Carregar credenciais salvas
function loadSavedCredentials() {
    const accessKey = localStorage.getItem('aws_access_key');
    const secretKey = localStorage.getItem('aws_secret_key');
    const region = localStorage.getItem('aws_region');
    
    if (accessKey) {
        document.getElementById('aws-access-key').value = accessKey;
    }
    
    if (secretKey) {
        document.getElementById('aws-secret-key').value = secretKey;
    }
    
    if (region) {
        document.getElementById('aws-region').value = region;
    }
} 