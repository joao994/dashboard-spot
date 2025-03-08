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
let architectureFilter;
let interruptionFilter;
let sizeFilter;
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
    architectureFilter = document.getElementById('architecture-filter');
    interruptionFilter = document.getElementById('interruption-filter');
    sizeFilter = document.getElementById('size-filter');
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
    // Inicializar referências aos filtros
    regionFilter = document.getElementById('region-filter');
    osFilter = document.getElementById('os-filter');
    instanceFilter = document.getElementById('instance-filter');
    architectureFilter = document.getElementById('architecture-filter');
    interruptionFilter = document.getElementById('interruption-filter');
    sizeFilter = document.getElementById('size-filter');
    tableBody = document.getElementById('table-body');
    
    // Adicionar event listeners para filtros
    regionFilter.addEventListener('change', applyFilters);
    osFilter.addEventListener('change', applyFilters);
    instanceFilter.addEventListener('input', applyFilters);
    architectureFilter.addEventListener('change', applyFilters);
    interruptionFilter.addEventListener('change', applyFilters);
    sizeFilter.addEventListener('change', applyFilters);

    // Event listener para exportar para CSV
    document.getElementById('export-csv').addEventListener('click', exportCsv);
    
    // Botões relacionados à AWS
    document.getElementById('connect-aws-btn').addEventListener('click', connectToAws);
    document.getElementById('save-credentials-btn').addEventListener('click', saveAwsCredentials);
    document.getElementById('view-full-analysis').addEventListener('click', () => {
        document.getElementById('aws-analysis-results').classList.remove('hide');
    });
    document.getElementById('close-analysis').addEventListener('click', () => {
        document.getElementById('aws-analysis-results').classList.add('hide');
    });
    
    // Event listeners para menu lateral
    document.getElementById('menu-toggle').addEventListener('click', function(e) {
        e.stopPropagation();
        if (document.querySelector('.sidebar').classList.contains('active')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    
    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    
    // Event listener para clicar fora do menu e fechá-lo
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            e.target !== menuToggle) {
            closeSidebar();
        }
    });
    
    // Impedir que cliques dentro do sidebar propaguem para o document
    document.querySelector('.sidebar').addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// Função para abrir a sidebar
function openSidebar() {
    sidebar.classList.add('active');
    mainContent.classList.add('sidebar-open');
}

// Função para fechar a sidebar
function closeSidebar() {
    sidebar.classList.remove('active');
    mainContent.classList.remove('sidebar-open');
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
            savingsOverOnDemand: item.savingsOverOnDemand,
            interruptionRate: item.interruptionRate,
            interruptionLevel: item.interruptionLevel
        };
    });
}

// Função para determinar a arquitetura de uma instância baseada no nome
function getInstanceArchitecture(instanceType) {
    // Instâncias com "g" antes do ponto são ARM (Graviton)
    // Ex: t4g.micro, m7g.large
    const armPattern = /[a-z][0-9]+g\./i;
    
    if (armPattern.test(instanceType)) {
        return 'arm';
    } else {
        return 'x86';
    }
}

// Função para obter o tamanho de uma instância a partir do tipo
function getInstanceSize(instanceType) {
    // Extrair a parte do tamanho (micro, small, medium, large, xlarge, 2xlarge, etc.)
    const parts = instanceType.split('.');
    if (parts.length > 1) {
        return parts[1].toLowerCase();
    }
    return '';
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
    architectureFilter.addEventListener('change', applyFilters);
    interruptionFilter.addEventListener('change', applyFilters);
    sizeFilter.addEventListener('change', applyFilters);
}

// Aplicar filtros aos dados
function applyFilters() {
    const regionValue = regionFilter.value;
    const osValue = osFilter.value;
    const instanceValue = instanceFilter.value.toLowerCase();
    const architectureValue = architectureFilter.value;
    const interruptionValue = interruptionFilter.value;
    const sizeValue = sizeFilter.value;
    
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
        
        if (architectureValue !== 'all') {
            const architecture = getInstanceArchitecture(item.instanceType);
            if (architecture !== architectureValue) {
                matches = false;
            }
        }
        
        if (sizeValue !== 'all') {
            const size = getInstanceSize(item.instanceType);
            if (size !== sizeValue) {
                matches = false;
            }
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
        if (getInstanceArchitecture(item.instanceType) === 'arm') {
            instanceCell.classList.add('arm-instance');
        }
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
    renderArchitectureComparisonChart();
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
        'very low': 0,
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
        'very low': '#c3e6cb',
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

// Gráfico das 10 instâncias com maior economia e menor nível de interrupção
function renderTopSavingsChart() {
    const ctx = document.getElementById('top-savings-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.topSavingsChart) {
        window.topSavingsChart.destroy();
    }
    
    // Pontuação para níveis de interrupção (menor é melhor)
    const interruptionScores = {
        'very low': 0,
        'low': 1,
        'medium': 2,
        'high': 3,
        'very high': 4
    };
    
    // Filtrar instâncias com economia numérica
    const instancesWithValidData = filteredData
        .filter(item => 
            typeof item.savingsOverOnDemand === 'number' && 
            item.interruptionLevel in interruptionScores
        );
    
    // Criar pontuação combinada (economia ajustada pelo nível de interrupção)
    const scoredInstances = instancesWithValidData.map(item => {
        // Normalizar a economia entre 0-100
        const economyScore = item.savingsOverOnDemand;
        
        // Inverter a pontuação de interrupção para que valores baixos (menos interrupções) resultem em pontuações mais altas
        // 5 - score para inverter (4 -> 1, 3 -> 2, 2 -> 3, 1 -> 4)
        const stabilityScore = 5 - interruptionScores[item.interruptionLevel];
        
        // Pontuação combinada: Economia (70% do peso) + Estabilidade (30% do peso)
        // Esta fórmula prioriza economia mas dá bônus significativo para instâncias mais estáveis
        const combinedScore = (economyScore * 0.7) + (stabilityScore * 25 * 0.3);
        
        // Determinar arquitetura
        const architecture = getInstanceArchitecture(item.instanceType);
        
        // Funções para truncar e formatar nomes longos
        const truncateInstanceType = (instanceType) => {
            // Aumentando o limite de caracteres para 25
            return instanceType.length > 25 ? 
                   instanceType.substring(0, 23) + '...' : 
                   instanceType;
        };
        
        // Cria um label mais curto para exibição no gráfico
        const shortLabel = `${truncateInstanceType(item.instanceType)} (${item.region})`;
        
        return {
            ...item,
            combinedScore,
            // Exibe o tipo de instância (possivelmente truncado) e região
            formattedLabel: shortLabel,
            // Guarda o nome original para o tooltip
            originalInstanceType: item.instanceType,
            // Guarda a arquitetura
            architecture: architecture
        };
    });
    
    // Ordenar por pontuação combinada e pegar as 10 melhores
    const topInstances = scoredInstances
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, 10);
    
    window.topSavingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topInstances.map(item => item.formattedLabel),
            datasets: [{
                label: 'Economia (%)',
                data: topInstances.map(item => (item.savingsOverOnDemand).toFixed(1)),
                backgroundColor: topInstances.map(item => {
                    // Cores baseadas no nível de interrupção e arquitetura
                    const baseColor = item.architecture === 'arm' ? 
                        { 
                            'very low': 'rgba(0, 80, 160, 0.7)',      // Azul mais escuro para ARM com interrupção muito baixa
                            'low': 'rgba(0, 102, 204, 0.7)',      // Azul para ARM com interrupção baixa
                            'medium': 'rgba(51, 153, 255, 0.7)',  // Azul mais claro para ARM com interrupção média
                            'high': 'rgba(102, 178, 255, 0.7)',   // Azul ainda mais claro para ARM com interrupção alta
                            'very high': 'rgba(153, 204, 255, 0.7)' // Azul bem claro para ARM com interrupção muito alta
                        } : 
                        {
                            'very low': 'rgba(20, 140, 50, 0.7)',   // Verde escuro
                            'low': 'rgba(40, 167, 69, 0.7)',     // Verde
                            'medium': 'rgba(255, 193, 7, 0.7)',  // Amarelo
                            'high': 'rgba(220, 53, 69, 0.7)',    // Vermelho
                            'very high': 'rgba(132, 32, 41, 0.7)' // Vermelho escuro
                        };
                    
                    return baseColor[item.interruptionLevel];
                }),
                borderColor: topInstances.map(item => {
                    // Bordas baseadas no nível de interrupção e arquitetura
                    const baseBorder = item.architecture === 'arm' ?
                        {
                            'very low': 'rgb(0, 80, 160)',
                            'low': 'rgb(0, 102, 204)',
                            'medium': 'rgb(51, 153, 255)',
                            'high': 'rgb(102, 178, 255)',
                            'very high': 'rgb(153, 204, 255)'
                        } :
                        {
                            'very low': 'rgb(20, 140, 50)',
                            'low': 'rgb(40, 167, 69)',
                            'medium': 'rgb(255, 193, 7)',
                            'high': 'rgb(220, 53, 69)',
                            'very high': 'rgb(132, 32, 41)'
                        };
                        
                    return baseBorder[item.interruptionLevel];
                }),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 20,    // Aumentando o padding à esquerda
                    right: 80,   // Mantendo espaço à direita para os indicadores
                    top: 0,
                    bottom: 0
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Instâncias com Maior Economia e Menor Nível de Interrupção',
                    font: {
                        size: 14
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 10,
                    callbacks: {
                        // Personalizar o tooltip para mostrar informações detalhadas, incluindo o nome completo
                        title: function(context) {
                            const item = topInstances[context[0].dataIndex];
                            // Usar o nome original completo no tooltip
                            return `${item.originalInstanceType} (${item.region})`;
                        },
                        label: function(context) {
                            const item = topInstances[context.dataIndex];
                            return [
                                `Arquitetura: ${item.architecture === 'arm' ? 'ARM (Graviton)' : 'x86/x64'}`,
                                `Economia: ${item.savingsOverOnDemand.toFixed(1)}%`,
                                `Nível de Interrupção: ${item.interruptionLevel}`
                            ];
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Economia (%)'
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 8,
                        font: {
                            size: 9  // Reduzindo o tamanho da fonte para 9px
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'interruptionLevelLabels',
            afterDraw: function(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                
                meta.data.forEach((bar, index) => {
                    const item = topInstances[index];
                    const position = bar.tooltipPosition();
                    
                    // Calcular o final da barra
                    const barEnd = chart.scales.x.getPixelForValue(parseFloat(item.savingsOverOnDemand.toFixed(1)));
                    
                    // Definir estilo do texto
                    ctx.font = '12px Arial';
                    ctx.textBaseline = 'middle';
                    ctx.textAlign = 'left';
                    
                    // Cor baseada no nível de interrupção e arquitetura
                    if (item.architecture === 'arm') {
                        switch(item.interruptionLevel) {
                            case 'very low': ctx.fillStyle = 'rgb(0, 80, 160)'; break;
                            case 'low': ctx.fillStyle = 'rgb(0, 102, 204)'; break;
                            case 'medium': ctx.fillStyle = 'rgb(51, 153, 255)'; break;
                            case 'high': ctx.fillStyle = 'rgb(102, 178, 255)'; break;
                            case 'very high': ctx.fillStyle = 'rgb(153, 204, 255)'; break;
                            default: ctx.fillStyle = 'rgb(0, 102, 204)';
                        }
                    } else {
                        switch(item.interruptionLevel) {
                            case 'very low': ctx.fillStyle = 'rgb(20, 140, 50)'; break;
                            case 'low': ctx.fillStyle = 'rgb(40, 167, 69)'; break;
                            case 'medium': ctx.fillStyle = 'rgb(255, 193, 7)'; break;
                            case 'high': ctx.fillStyle = 'rgb(220, 53, 69)'; break;
                            case 'very high': ctx.fillStyle = 'rgb(132, 32, 41)'; break;
                            default: ctx.fillStyle = 'rgb(0, 123, 255)';
                        }
                    }
                    
                    // Desenhar texto com o nível de interrupção
                    ctx.fillText(
                        `${item.interruptionLevel}`, 
                        barEnd + 10,  // 10px após o final da barra
                        position.y    // Mesma altura da barra
                    );
                    
                    // Indicador de ARM
                    if (item.architecture === 'arm') {
                        ctx.font = '10px Arial';
                        ctx.fillStyle = '#0066cc';
                        ctx.textAlign = 'left';
                        // Desenhar indicador de ARM à direita do nível de interrupção
                        ctx.fillText(
                            'ARM', 
                            barEnd + 10 + ctx.measureText(item.interruptionLevel).width + 8,
                            position.y
                        );
                    }
                });
            }
        }]
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
    
    // Calcular economia e porcentagem
    const savings = currentCost - spotCost;
    const savingsPercentage = (savings / currentCost * 100).toFixed(0);
    
    window.savingsComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Custo Mensal On-Demand', 'Custo Mensal Spot', 'Economia'],
            datasets: [{
                label: 'Custo Mensal (USD)',
                data: [currentCost.toFixed(2), spotCost.toFixed(2), savings.toFixed(2)],
                backgroundColor: [
                    'rgba(220, 53, 69, 0.7)',  // Vermelho para On-Demand
                    'rgba(40, 167, 69, 0.7)',  // Verde para Spot
                    'rgba(0, 123, 255, 0.7)'   // Azul para Economia
                ],
                borderColor: [
                    'rgba(220, 53, 69, 1)',
                    'rgba(40, 167, 69, 1)',
                    'rgba(0, 123, 255, 1)'
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
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y;
                                
                                // Adicionar porcentagem para a barra de economia
                                if (context.dataIndex === 2) {
                                    label += ` (${savingsPercentage}% de economia)`;
                                }
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: function(value, context) {
                        return '$' + value;
                    },
                    font: {
                        weight: 'bold'
                    },
                    color: function(context) {
                        return context.dataset.borderColor[context.dataIndex];
                    }
                }
            }
        },
        plugins: [{
            afterDraw: function(chart) {
                var ctx = chart.ctx;
                ctx.save();
                
                // Desenhar porcentagem de economia
                if (savings > 0) {
                    var meta = chart.getDatasetMeta(0);
                    var economyBar = meta.data[2];
                    
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = '12px Arial';
                    ctx.fillStyle = 'rgba(0, 123, 255, 1)';
                    ctx.fillText(
                        `${savingsPercentage}% de economia`, 
                        economyBar.x, 
                        economyBar.y - 10
                    );
                }
                
                ctx.restore();
            }
        }]
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

// Função para obter preço on-demand da AWS Pricing API
async function getOnDemandPrice(instanceType, region, os) {
    try {
        // Criar um cliente para o serviço de Pricing
        const pricing = new AWS.Pricing({ region: 'us-east-1' }); // A API de pricing só está disponível em us-east-1

        // Mapear o sistema operacional para o formato esperado pela API
        const osMap = {
            'linux': 'Linux',
            'mswin': 'Windows',
            'rhel': 'RHEL',
            'suse': 'SUSE',
            'amazon': 'Amazon Linux'
        };
        
        const platformDescription = osMap[os] || 'Linux';
        
        // Obter os produtos que correspondem aos filtros
        const params = {
            ServiceCode: 'AmazonEC2',
            Filters: [
                { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
                { Type: 'TERM_MATCH', Field: 'location', Value: getRegionFullName(region) },
                { Type: 'TERM_MATCH', Field: 'operatingSystem', Value: platformDescription },
                { Type: 'TERM_MATCH', Field: 'tenancy', Value: 'Shared' },
                { Type: 'TERM_MATCH', Field: 'preInstalledSw', Value: 'NA' },
                { Type: 'TERM_MATCH', Field: 'capacitystatus', Value: 'Used' }
            ],
            MaxResults: 100
        };
        
        const productsResponse = await pricing.getProducts(params).promise();
        
        if (productsResponse.PriceList && productsResponse.PriceList.length > 0) {
            // Parse o JSON da lista de preços
            const priceData = JSON.parse(productsResponse.PriceList[0]);
            
            // Navegar pela estrutura de preços para encontrar o preço por hora
            const terms = priceData.terms;
            if (terms && terms.OnDemand) {
                const onDemandTerms = Object.values(terms.OnDemand)[0];
                if (onDemandTerms && onDemandTerms.priceDimensions) {
                    const priceDimension = Object.values(onDemandTerms.priceDimensions)[0];
                    if (priceDimension && priceDimension.pricePerUnit && priceDimension.pricePerUnit.USD) {
                        return parseFloat(priceDimension.pricePerUnit.USD);
                    }
                }
            }
        }
        
        console.warn(`Não foi possível encontrar preço on-demand para ${instanceType} em ${region} (${os})`);
        // Caso não encontre, usar o valor fixo ou uma estimativa
        return estimateOnDemandPrice(instanceType);
    } catch (error) {
        console.error('Erro ao buscar preço on-demand:', error);
        return estimateOnDemandPrice(instanceType);
    }
}

// Função para estimar preço on-demand (fallback)
function estimateOnDemandPrice(instanceType) {
    // Preços on-demand de referência para estimativas (USD/hora)
    const baseOnDemandPrices = {
        't2.micro': 0.0116,
        't2.small': 0.023,
        't2.medium': 0.0464,
        't2.large': 0.0928,
        'm5.large': 0.096,
        'c5.large': 0.085,
        'r5.large': 0.126,
        'm6g.medium': 0.0385,
        't4g.small': 0.0168,
        'c6g.large': 0.068,
        'r6g.large': 0.1008
    };
    
    if (baseOnDemandPrices[instanceType]) {
        return baseOnDemandPrices[instanceType];
    }
    
    // Se não tiver o preço exato, estimar com base no tipo e tamanho
    const family = instanceType.split('.')[0];
    const size = instanceType.split('.')[1];
    
    // Estimativas muito aproximadas por família
    const familyBasePrice = {
        't2': 0.0116, 't3': 0.0104, 't4g': 0.0084,
        'm5': 0.096, 'm6g': 0.077, 'm6i': 0.096,
        'c5': 0.085, 'c6g': 0.068, 'c6i': 0.085,
        'r5': 0.126, 'r6g': 0.1008, 'r6i': 0.126
    };
    
    // Multiplicadores para tamanhos
    const sizeMultiplier = {
        'nano': 0.25, 'micro': 0.5, 'small': 1, 'medium': 2,
        'large': 4, 'xlarge': 8, '2xlarge': 16, '4xlarge': 32,
        '8xlarge': 64, '12xlarge': 96, '16xlarge': 128, '24xlarge': 192
    };
    
    if (familyBasePrice[family] && sizeMultiplier[size]) {
        return familyBasePrice[family] * (sizeMultiplier[size] / 4); // Base em large (4)
    }
    
    // Valor padrão se tudo falhar
    console.warn(`Usando preço padrão para ${instanceType}`);
    return 0.10;
}

// Função para obter o nome completo da região
function getRegionFullName(regionCode) {
    const regionNames = {
        'us-east-1': 'US East (N. Virginia)',
        'us-east-2': 'US East (Ohio)',
        'us-west-1': 'US West (N. California)',
        'us-west-2': 'US West (Oregon)',
        'af-south-1': 'Africa (Cape Town)',
        'ap-east-1': 'Asia Pacific (Hong Kong)',
        'ap-south-1': 'Asia Pacific (Mumbai)',
        'ap-northeast-1': 'Asia Pacific (Tokyo)',
        'ap-northeast-2': 'Asia Pacific (Seoul)',
        'ap-northeast-3': 'Asia Pacific (Osaka)',
        'ap-southeast-1': 'Asia Pacific (Singapore)',
        'ap-southeast-2': 'Asia Pacific (Sydney)',
        'ca-central-1': 'Canada (Central)',
        'eu-central-1': 'Europe (Frankfurt)',
        'eu-west-1': 'Europe (Ireland)',
        'eu-west-2': 'Europe (London)',
        'eu-west-3': 'Europe (Paris)',
        'eu-north-1': 'Europe (Stockholm)',
        'eu-south-1': 'Europe (Milan)',
        'me-south-1': 'Middle East (Bahrain)',
        'sa-east-1': 'South America (Sao Paulo)'
    };
    
    return regionNames[regionCode] || regionCode;
}

// Função para obter o preço spot estimado
function getSpotPrice(instanceType, region, os, savingsPercentage) {
    // A AWS Pricing API não fornece preços spot diretamente, então usamos a porcentagem de economia
    if (typeof savingsPercentage === 'number') {
        // Obter preço on-demand para esse tipo
        return new Promise(async (resolve) => {
            try {
                const onDemandPrice = await getOnDemandPrice(instanceType, region, os);
                // Calcular o preço spot aplicando o desconto
                const spotPrice = onDemandPrice * (1 - (savingsPercentage / 100));
                console.log(`Preço spot para ${instanceType}: on-demand=$${onDemandPrice}, desconto=${savingsPercentage}%, spot=$${spotPrice}`);
                resolve(spotPrice);
            } catch (error) {
                console.error('Erro ao calcular preço spot:', error);
                resolve(0);
            }
        });
    }
    return Promise.resolve(0);
}

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
        
        // Processamento em lotes das instâncias para melhor desempenho
        const instances = [];
        response.Reservations.forEach(reservation => {
            reservation.Instances.forEach(instance => {
                instances.push(instance);
            });
        });
        
        // Mostrar indicador de carregamento
        const instancesTableBody = document.getElementById('instances-table-body');
        instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Obtendo preços e analisando instâncias...</td></tr>';
        
        // Processar instâncias em lotes para não sobrecarregar a API
        const batchSize = 5;
        for (let i = 0; i < instances.length; i += batchSize) {
            const batch = instances.slice(i, i + batchSize);
            await Promise.all(batch.map(async (instance) => {
                // Determinar o sistema operacional
                let os = 'linux'; // padrão
                if (instance.Platform === 'windows') {
                    os = 'mswin';
                }
                
                // Buscar a porcentagem de economia do mapeamento de dados da API
                const key = `${region}:${instance.InstanceType}:${os}`;
                const pricingInfo = spotPriceMap[key] || {
                    savingsOverOnDemand: "N/A",
                    interruptionRate: "N/A",
                    interruptionLevel: 'N/A'
                };
                
                // Verificar se é elegível para spot (não "very high" e tem dados)
                const isEligible = pricingInfo.interruptionLevel !== 'very high' &&
                    pricingInfo.interruptionLevel !== 'N/A' &&
                    typeof pricingInfo.savingsOverOnDemand === 'number';
                
                // Obter preço on-demand (API)
                const onDemandPrice = await getOnDemandPrice(instance.InstanceType, region, os);
                
                // Calcular custo mensal on-demand (730 horas por mês)
                const monthlyOnDemand = onDemandPrice * 730;
                
                // Adicionar ao total
                totalCurrentCost += monthlyOnDemand;
                
                // Calcular custo spot e economia, se elegível
                let monthlySpot = monthlyOnDemand;
                if (isEligible) {
                    const spotPrice = await getSpotPrice(
                        instance.InstanceType, 
                        region, 
                        os, 
                        pricingInfo.savingsOverOnDemand
                    );
                    monthlySpot = spotPrice * 730;
                    totalSpotCost += monthlySpot;
                } else {
                    totalSpotCost += monthlyOnDemand; // Se não for elegível, manter o preço on-demand
                }
                
                // Adicionar à lista de instâncias
                awsInstances.push({
                    id: instance.InstanceId,
                    type: instance.InstanceType,
                    region: region,
                    onDemandCost: monthlyOnDemand,
                    spotCost: isEligible ? monthlySpot : 'N/A',
                    savings: isEligible ? (monthlyOnDemand - monthlySpot) : 'N/A',
                    savingsPercentage: isEligible ? pricingInfo.savingsOverOnDemand : 'N/A',
                    eligible: isEligible,
                    interruptionLevel: pricingInfo.interruptionLevel
                });
            }));
            
            // Atualizar a interface após cada lote para mostrar progresso
            if (i + batchSize < instances.length) {
                instancesTableBody.innerHTML = `<tr><td colspan="7" class="loading">Processando... (${i + batchSize}/${instances.length} instâncias)</td></tr>`;
            }
        }
        
        // Calcular economia total
        const totalSavings = totalCurrentCost - totalSpotCost;
        const savingsPercentage = (totalSavings / totalCurrentCost * 100);
        
        // Atualizar a interface com símbolo $
        document.getElementById('current-cost').textContent = `$${totalCurrentCost.toFixed(2)}`;
        document.getElementById('spot-cost').textContent = `$${totalSpotCost.toFixed(2)}`;
        document.getElementById('analysis-savings-amount').textContent = `$${totalSavings.toFixed(2)} (${savingsPercentage.toFixed(0)}%)`;
        document.getElementById('savings-amount').textContent = `$${totalSavings.toFixed(2)}`;
        
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
        onDemandCell.textContent = `$${instance.onDemandCost.toFixed(2)}`;
        row.appendChild(onDemandCell);
        
        const spotCell = document.createElement('td');
        spotCell.textContent = instance.eligible ? `$${instance.spotCost.toFixed(2)}` : 'N/A';
        row.appendChild(spotCell);
        
        const savingsCell = document.createElement('td');
        if (instance.eligible) {
            savingsCell.textContent = `$${instance.savings.toFixed(2)} (${instance.savingsPercentage.toFixed(0)}%)`;
            savingsCell.style.color = '#28a745';
        } else {
            savingsCell.textContent = 'N/A';
        }
        row.appendChild(savingsCell);
        
        const eligibleCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.textContent = instance.eligible ? 'Sim' : 'Não';
        badge.className = `status-badge ${instance.eligible ? 'status-low' : 'status-high'}`;
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

// Gráfico de comparação de arquiteturas (ARM vs x86)
function renderArchitectureComparisonChart() {
    const ctx = document.getElementById('architecture-comparison-chart').getContext('2d');
    
    // Limpar gráfico existente
    if (window.architectureComparisonChart) {
        window.architectureComparisonChart.destroy();
    }
    
    // Separar dados por arquitetura
    const armInstances = filteredData.filter(item => 
        typeof item.savingsOverOnDemand === 'number' && 
        getInstanceArchitecture(item.instanceType) === 'arm'
    );
    
    const x86Instances = filteredData.filter(item => 
        typeof item.savingsOverOnDemand === 'number' && 
        getInstanceArchitecture(item.instanceType) === 'x86'
    );
    
    // Calcular economia média e contagem por nível de interrupção para ARM
    const armData = {
        'very low': { total: 0, count: 0 },
        'low': { total: 0, count: 0 },
        'medium': { total: 0, count: 0 },
        'high': { total: 0, count: 0 },
        'very high': { total: 0, count: 0 }
    };
    
    armInstances.forEach(item => {
        if (item.interruptionLevel in armData) {
            armData[item.interruptionLevel].total += item.savingsOverOnDemand;
            armData[item.interruptionLevel].count++;
        }
    });
    
    // Calcular economia média e contagem por nível de interrupção para x86
    const x86Data = {
        'very low': { total: 0, count: 0 },
        'low': { total: 0, count: 0 },
        'medium': { total: 0, count: 0 },
        'high': { total: 0, count: 0 },
        'very high': { total: 0, count: 0 }
    };
    
    x86Instances.forEach(item => {
        if (item.interruptionLevel in x86Data) {
            x86Data[item.interruptionLevel].total += item.savingsOverOnDemand;
            x86Data[item.interruptionLevel].count++;
        }
    });
    
    // Calcular médias para cada categoria
    const interruptionLevels = ['very low', 'low', 'medium', 'high', 'very high'];
    
    const armAverages = interruptionLevels.map(level => 
        armData[level].count > 0 ? 
        (armData[level].total / armData[level].count).toFixed(1) : 
        0
    );
    
    const x86Averages = interruptionLevels.map(level => 
        x86Data[level].count > 0 ? 
        (x86Data[level].total / x86Data[level].count).toFixed(1) : 
        0
    );
    
    // Calcular economia média geral
    const armTotalSavings = armInstances.reduce((sum, item) => sum + item.savingsOverOnDemand, 0);
    const x86TotalSavings = x86Instances.reduce((sum, item) => sum + item.savingsOverOnDemand, 0);
    
    const armAverageSavings = armInstances.length > 0 ? 
        (armTotalSavings / armInstances.length).toFixed(1) : 0;
    const x86AverageSavings = x86Instances.length > 0 ? 
        (x86TotalSavings / x86Instances.length).toFixed(1) : 0;
    
    // Preparar dados para o gráfico
    const labels = ['Média Geral', 'Interrupção Baixa', 'Interrupção Média', 'Interrupção Alta', 'Interrupção Muito Alta'];
    
    const armValues = [armAverageSavings, ...armAverages];
    const x86Values = [x86AverageSavings, ...x86Averages];
    
    window.architectureComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ARM (Graviton)',
                    data: armValues,
                    backgroundColor: 'rgba(0, 102, 204, 0.7)',
                    borderColor: 'rgb(0, 102, 204)',
                    borderWidth: 1
                },
                {
                    label: 'x86/x64',
                    data: x86Values,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgb(40, 167, 69)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Economia Média (%) por Arquitetura e Nível de Interrupção',
                    font: {
                        size: 14
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            const count = context.dataIndex === 0 ? 
                                (context.dataset.label === 'ARM (Graviton)' ? armInstances.length : x86Instances.length) :
                                (context.dataset.label === 'ARM (Graviton)' ? 
                                    armData[interruptionLevels[context.dataIndex-1]].count : 
                                    x86Data[interruptionLevels[context.dataIndex-1]].count);
                            
                            return `${label}: ${value}% (${count} instâncias)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Economia Média (%)'
                    }
                }
            }
        }
    });
} 