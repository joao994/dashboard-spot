// Estado global dos dados
let spotData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let awsInstances = [];
let spotPriceMap = {};
let isAwsConnected = false;
let currentSortColumn = null;
let currentSortDirection = null;

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
let themeToggle;
let updateSpotPriceBtn;

// Cache local para preços spot para evitar chamadas duplicadas à API
const spotPriceCache = {};

// Função para gerenciar o tema (claro/escuro)
function initThemeManager() {
    // Verifica se o usuário já tem uma preferência salva
    const savedTheme = localStorage.getItem('theme');
    
    // Se o tema estiver salvo, usa essa preferência
    if (savedTheme) {
        document.documentElement.classList.toggle('light-theme', savedTheme === 'light');
    } 
    // Caso contrário, define o tema claro como padrão
    else {
        document.documentElement.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    }
    
    // Adiciona evento de clique ao botão de tema
    themeToggle.addEventListener('click', () => {
        // Toggle da classe light-theme no elemento root
        document.documentElement.classList.toggle('light-theme');
        
        // Salva a preferência em localStorage
        const currentTheme = document.documentElement.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
    });
}

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
    credentialsStatus = document.getElementById('credentials-status');
    awsAnalysisResults = document.getElementById('aws-analysis-results');
    awsAnalysisSummary = document.getElementById('aws-analysis-summary');
    viewFullAnalysisBtn = document.getElementById('view-full-analysis');
    closeAnalysisBtn = document.getElementById('close-analysis');
    connectionStatus = document.getElementById('connection-status');
    sidebar = document.querySelector('.sidebar');
    mainContent = document.querySelector('.main-content');
    menuToggle = document.getElementById('menu-toggle');
    sidebarCloseBtn = document.getElementById('sidebar-close');
    themeToggle = document.getElementById('theme-toggle');
    updateSpotPriceBtn = document.getElementById('update-spot-price-btn');

    // Inicializar gerenciador de tema
    initThemeManager();

    // Configurar listeners de eventos
    setupEventListeners();
    
    // Configurar toggle de modo de desenvolvimento
    const devModeToggle = document.getElementById('dev-mode-toggle');
    if (devModeToggle) {
        devModeToggle.addEventListener('change', function() {
            const devCredFields = document.querySelectorAll('.dev-credentials');
            devCredFields.forEach(field => {
                if (this.checked) {
                    field.classList.remove('hide');
                } else {
                    field.classList.add('hide');
                }
            });
        });
    }
    
    // Carregar dados iniciais
    loadData();
    
    // Verificar se há uma sessão AWS ativa salva
    restoreAwsSession();
    
    // Verificar modo de desenvolvimento do servidor
    checkDevMode();
});

// Função para restaurar uma sessão AWS quando a página carrega
function restoreAwsSession() {
    try {
        const isConnected = localStorage.getItem('awsConnected') === 'true';
        if (isConnected) {
            const accountId = localStorage.getItem('awsAccountId');
            const region = localStorage.getItem('awsRegion');
            
            if (accountId && region) {
                console.log('[AWS Session] Sessão anterior detectada para conta:', accountId);
                
                // Preencher formulário com valores salvos
                document.getElementById('aws-account').value = accountId;
                document.getElementById('aws-region').value = region;
                
                // Atualizar interface para mostrar que há uma conexão anterior
                connectionStatus.textContent = `Sessão anterior: ${accountId}`;
                connectionStatus.classList.remove('status-disconnected');
                connectionStatus.classList.add('status-previous-session');
                
                // Mostrar resumo se estiver disponível
                document.getElementById('aws-analysis-summary').classList.remove('hide');
            }
        }
    } catch (error) {
        console.warn('[AWS Session] Erro ao restaurar sessão:', error);
        // Limpar qualquer estado que possa estar corrompido
        localStorage.removeItem('awsConnected');
        localStorage.removeItem('awsAccountId');
        localStorage.removeItem('awsRegion');
    }
}

// Função para verificar o modo de desenvolvimento do servidor
async function checkDevMode() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            
            // Obter referências aos elementos
            const devModeToggle = document.getElementById('dev-mode-toggle');
            const devModeToggleContainer = document.querySelector('.dev-mode-toggle');
            const devCredFields = document.querySelectorAll('.dev-credentials');
            
            if (config.devMode) {
                console.log('[Config] Modo de desenvolvimento ativado pelo servidor');
                // Mostrar o toggle e ativá-lo automaticamente
                if (devModeToggleContainer) devModeToggleContainer.style.display = 'block';
                if (devModeToggle) {
                    devModeToggle.checked = true;
                    // Disparar o evento change para mostrar os campos
                    const event = new Event('change');
                    devModeToggle.dispatchEvent(event);
                }
            } else {
                console.log('[Config] Modo de desenvolvimento desativado pelo servidor');
                // Esconder completamente o toggle e os campos de credenciais
                if (devModeToggleContainer) devModeToggleContainer.style.display = 'none';
                // Esconder todos os campos de credenciais
                devCredFields.forEach(field => {
                    field.classList.add('hide');
                });
                // Garantir que o toggle esteja desativado
                if (devModeToggle) devModeToggle.checked = false;
            }
        }
    } catch (error) {
        console.warn('[Config] Erro ao verificar configuração:', error);
        // Em caso de erro, esconder para garantir segurança
        const devModeToggleContainer = document.querySelector('.dev-mode-toggle');
        if (devModeToggleContainer) devModeToggleContainer.style.display = 'none';
    }
}

// Configurar todos os event listeners
function setupEventListeners() {
    // Adicionar event listeners para filtros
    regionFilter.addEventListener('change', applyFilters);
    osFilter.addEventListener('change', applyFilters);
    instanceFilter.addEventListener('input', applyFilters);
    architectureFilter.addEventListener('change', applyFilters);
    interruptionFilter.addEventListener('change', applyFilters);
    sizeFilter.addEventListener('change', applyFilters);

    // Event listener para exportar para CSV
    exportBtn.addEventListener('click', exportCsv);
    
    // Botões relacionados à AWS - não precisamos mais deste listener direto, pois está usando onsubmit do formulário
    // connectAwsBtn.addEventListener('click', connectToAws);
    
    // Ver análise completa
    viewFullAnalysisBtn.addEventListener('click', () => {
        awsAnalysisResults.classList.remove('hide');
    });
    
    // Fechar análise - melhorado para garantir que funcione
    closeAnalysisBtn.addEventListener('click', () => {
        awsAnalysisResults.classList.add('hide');
        
        // Verificar se o botão Nova Análise existe e adicioná-lo ao DOM se necessário
        let newAnalysisBtn = document.getElementById('new-analysis-btn');
        if (!newAnalysisBtn) {
            newAnalysisBtn = document.createElement('button');
            newAnalysisBtn.id = 'new-analysis-btn';
            newAnalysisBtn.className = 'aws-btn secondary-btn';
            newAnalysisBtn.textContent = 'Nova Análise';
            
            // Adicionar ao resumo na sidebar
            const analysisSection = document.getElementById('aws-analysis-summary');
            if (analysisSection) {
                analysisSection.appendChild(newAnalysisBtn);
            }
        }
        
        // Garantir que a função de click esteja atribuída
        if (newAnalysisBtn) {
            // Remover event listeners antigos para evitar duplicação
            newAnalysisBtn.replaceWith(newAnalysisBtn.cloneNode(true));
            newAnalysisBtn = document.getElementById('new-analysis-btn');
            
            // Adicionar novo event listener
            newAnalysisBtn.addEventListener('click', function() {
                openSidebar();
                document.getElementById('aws-account').focus();
            });
            
            // Mostrar o botão
            newAnalysisBtn.classList.remove('hide');
        }
    });
    
    // Event listeners para menu lateral
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        if (sidebar.classList.contains('active')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    
    // Event listener para clicar fora do menu e fechá-lo
    document.addEventListener('click', function(e) {
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            e.target !== menuToggle) {
            closeSidebar();
        }
    });
    
    // Impedir que cliques dentro do sidebar propaguem para o document
    sidebar.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    updateSpotPriceBtn.addEventListener('click', updateSpotPrices);

    // Limpar cache quando a região mudar
    regionFilter.addEventListener('change', () => {
        clearSpotPriceCache();
        applyFilters();
    });

    // Event listeners para ordenação
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            sortData(column);
        });
    });
    
    // Melhor não confiar apenas no onsubmit do HTML, adicionar também por JavaScript
    const awsCredentialsForm = document.getElementById('aws-credentials-form');
    if (awsCredentialsForm) {
        awsCredentialsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            connectToAws();
            return false;
        });
    }
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
        const response = await fetch('/api/spot-prices');
        spotData = await response.json();
        
        // Criar mapeamento de preços spot para referência rápida
        createSpotPriceMap();
        
        // Inicializar os filtros
        initializeFilters();
        
        // Aplicar filtros iniciais
        applyFilters();
        
        // Renderizar gráficos
        renderCharts();
        
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

// Função para definir a ordem de prioridade dos níveis de interrupção
function getInterruptionPriority(level) {
    const priorities = {
        'very low': 1,
        'low': 2,
        'medium': 3,
        'high': 4,
        'very high': 5
    };
    return priorities[level] || 999; // Valor alto para níveis desconhecidos
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
    
    // Ordenar por nível de interrupção (very low primeiro, very high por último)
    filteredData.sort((a, b) => {
        return getInterruptionPriority(a.interruptionLevel) - getInterruptionPriority(b.interruptionLevel);
    });
    
    // Reset para a primeira página quando filtros mudam
    currentPage = 1;
    
    // Renderizar tabela e paginação
    renderTable();
    renderPagination();
    
    // Atualizar gráficos com dados filtrados
    renderCharts();
}

// Função para ordenar os dados
function sortData(column) {
    const direction = column === currentSortColumn && currentSortDirection === 'asc' ? 'desc' : 'asc';
    
    filteredData.sort((a, b) => {
        let valueA, valueB;
        
        switch(column) {
            case 'instanceType':
                valueA = a.instanceType;
                valueB = b.instanceType;
                break;
            case 'region':
                valueA = a.region;
                valueB = b.region;
                break;
            case 'os':
                valueA = a.os;
                valueB = b.os;
                break;
            case 'savings':
                valueA = parseFloat(a.savingsPercentage);
                valueB = parseFloat(b.savingsPercentage);
                break;
            case 'spotPrice':
                valueA = parseFloat(a.spotPrice);
                valueB = parseFloat(b.spotPrice);
                break;
            case 'interruption':
                valueA = getInterruptionPriority(a.interruptionLevel);
                valueB = getInterruptionPriority(b.interruptionLevel);
                break;
            default:
                return 0;
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    currentSortColumn = column;
    currentSortDirection = direction;

    // Atualizar ícones de ordenação
    document.querySelectorAll('.sortable').forEach(th => {
        th.removeAttribute('data-sort-direction');
        const icon = th.querySelector('.sort-icon');
        icon.textContent = '▾';
        
        if (th.dataset.sort === column) {
            th.setAttribute('data-sort-direction', direction);
            icon.textContent = direction === 'asc' ? '▴' : '▾';
        }
    });

    renderTable();
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
        cell.colSpan = 6;
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
        
        const spotPriceCell = document.createElement('td');
        if (item.isLoading) {
            spotPriceCell.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Carregando...</div>';
        } else if (item.spotPrice) {
            const priceSpan = document.createElement('span');
            priceSpan.textContent = `$${item.spotPrice.toFixed(4)}`;
            priceSpan.className = 'spot-price-value';
            spotPriceCell.appendChild(priceSpan);
        } else {
            spotPriceCell.textContent = 'N/A';
        }
        row.appendChild(spotPriceCell);
        
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
    
    // Ordenar os dados por nível de interrupção
    const dataToCsv = [...filteredData].sort((a, b) => {
        return getInterruptionPriority(a.interruptionLevel) - getInterruptionPriority(b.interruptionLevel);
    });
    
    // Preparar linhas de dados
    const data = dataToCsv.map(item => [
        item.instanceType,
        item.region,
        formatOsName(item.os),
        typeof item.savingsOverOnDemand === 'number' ? item.savingsOverOnDemand.toFixed(0) + '%' : 'N/A',
        item.interruptionLevel
    ]);
    
    // Combinar cabeçalhos e dados
    const csvContent = [headers, ...data]
        .map(e => e.join(','))
        .join('\n');
    
    // Criar um blob para download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Criar link para download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'spot-data.csv');
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
            let priceData;
            
            // Verificar se PriceList[0] é uma string ou um objeto
            if (typeof productsResponse.PriceList[0] === 'string') {
                // Parse apenas se for uma string JSON
                try {
                    priceData = JSON.parse(productsResponse.PriceList[0]);
                } catch (parseError) {
                    console.error('Erro ao fazer parse do JSON:', parseError);
                    return estimateOnDemandPrice(instanceType);
                }
            } else if (typeof productsResponse.PriceList[0] === 'object') {
                // Se já for um objeto, use diretamente
                priceData = productsResponse.PriceList[0];
            } else {
                console.warn('Formato inesperado de dados de preço:', typeof productsResponse.PriceList[0]);
                return estimateOnDemandPrice(instanceType);
            }
            
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
        't2.micro': 0.99,
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
async function getSpotPrice(instanceType, region, os, savingsPercentage) {
    try {
        // Verificar se já temos o preço em cache
        const cacheKey = `${instanceType}|${region}|${os}`;
        if (spotPriceCache[cacheKey]) {
            return spotPriceCache[cacheKey];
        }
        
        // Normalizar o sistema operacional
        let normalizedOs = '';
        if (os) {
            // Converter para minúsculas para facilitar a comparação
            const osLower = os.toLowerCase();
            if (osLower.includes('windows') || osLower.includes('win')) {
                normalizedOs = 'mswin';
            } else {
                normalizedOs = 'linux'; // Linux, RHEL, SUSE, etc. são tratados como 'linux' no spot.json
            }
        } else {
            normalizedOs = 'linux'; // Padrão para Linux
        }
        
        // Tentar obter o preço do novo endpoint que usa spot.json
        const response = await fetch(`/api/spot-price?instanceType=${instanceType}&region=${region}&os=${normalizedOs}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.price && data.price !== "Preço não disponível") {
                console.log(`Preço spot para ${instanceType} (${normalizedOs}) obtido do spot.json: $${data.price}`);
                const price = parseFloat(data.price);
                // Armazenar em cache
                spotPriceCache[cacheKey] = price;
                return price;
            }
        }
        
        console.log(`Preço não encontrado no spot.json para ${instanceType}, usando método de cálculo alternativo...`);
        
        // Fallback para o método anterior se não encontrar no spot.json
        // ou se houver qualquer erro na busca
        if (typeof savingsPercentage === 'number') {
            // Obter preço on-demand para esse tipo
            const onDemandPrice = await getOnDemandPrice(instanceType, region, os);
            // Calcular o preço spot aplicando o desconto
            const spotPrice = onDemandPrice * (1 - (savingsPercentage / 100));
            console.log(`Preço spot calculado para ${instanceType}: on-demand=$${onDemandPrice}, desconto=${savingsPercentage}%, spot=$${spotPrice}`);
            // Armazenar em cache
            spotPriceCache[cacheKey] = spotPrice;
            return spotPrice;
        }
        
        return 0;
    } catch (error) {
        console.error('Erro ao obter preço spot:', error);
        
        // Fallback para o método anterior em caso de erro
        if (typeof savingsPercentage === 'number') {
            try {
                const onDemandPrice = await getOnDemandPrice(instanceType, region, os);
                const spotPrice = onDemandPrice * (1 - (savingsPercentage / 100));
                return spotPrice;
            } catch (innerError) {
                console.error('Erro no fallback para obter preço spot:', innerError);
                return 0;
            }
        }
        
        return 0;
    }
}

async function connectToAws() {
    const accountId = document.getElementById('aws-account').value;
    const region = document.getElementById('aws-region').value;
    const isDevMode = document.getElementById('dev-mode-toggle').checked;
    const localAccessKey = document.getElementById('aws-local-access-key').value;
    const localSecretKey = document.getElementById('aws-local-secret-key').value;
    
    if (!accountId) {
        alert('Por favor, informe o número da conta AWS.');
        return;
    }

    // Prevenir comportamento padrão que possa causar recarga da página
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    // Mostrar status de carregamento
    connectionStatus.textContent = 'Conectando...';
    connectionStatus.className = 'connection-status status-connecting';
    
    console.log('[AWS Connect] Iniciando conexão AWS para a conta:', accountId, 'região:', region);

    try {
        // Exibir a tela de análise antes de processar as instâncias
        // Isso garante que o usuário veja a tela de loading enquanto os dados são processados
        document.getElementById('aws-analysis-results').classList.remove('hide');
        
        // Fechar a sidebar (menu lateral) para melhor visualização da análise
        closeSidebar();
        
        // Mostrar indicador de carregamento na tela de análise
        const instancesTableBody = document.getElementById('instances-table-body');
        instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Conectando à AWS e obtendo credenciais...</td></tr>';
        
        // Verificar se o SDK AWS está disponível
        if (typeof AWS === 'undefined') {
            console.error('[AWS Connect] SDK AWS não está carregado');
            connectionStatus.textContent = 'Erro: SDK AWS não disponível';
            alert('SDK AWS não está carregado. Verifique se o script foi incluído corretamente na página.');
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Usar o servidor como proxy para assume-role (evita problemas de CORS)
        console.log('[AWS Connect] Solicitando assume-role via servidor...');
        connectionStatus.textContent = `Solicitando acesso à conta ${accountId}...`;
        
        try {
            const data = {
                accountId,
                region,
                accessKey: isDevMode ? localAccessKey : null,
                secretKey: isDevMode ? localSecretKey : null
            };
            
            console.log('[AWS Connect] Dados da requisição:', {
                accountId: data.accountId,
                region: data.region,
                hasAccessKey: !!data.accessKey,
                hasSecretKey: !!data.secretKey
            });
            
            // Atualizar a mensagem de loading
            instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Solicitando acesso à conta AWS...</td></tr>';
            
            // Usar o endereço absoluto para evitar problemas de CORS
            const serverUrl = window.location.origin + '/api/assume-role';
            console.log('[AWS Connect] URL do servidor:', serverUrl);
            
            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                mode: 'cors', // Modo CORS explícito
                credentials: 'same-origin' // Enviar cookies se estiver no mesmo domínio
            });
            
            console.log('[AWS Connect] Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    contentType: response.headers.get('content-type'),
                    contentLength: response.headers.get('content-length')
                }
            });
            
            // Verificar o tipo de conteúdo da resposta
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                // Se a resposta não for JSON, tentar obter o texto para debug
                const errorText = await response.text();
                console.error('[AWS Connect] Resposta não-JSON recebida:', {
                    status: response.status,
                    contentType,
                    responseText: errorText.substring(0, 500) // Mostra apenas os primeiros 500 caracteres
                });
                
                connectionStatus.textContent = 'Erro no formato de resposta';
                alert(`Erro na resposta do servidor (${response.status}): Formato inválido`);
                document.getElementById('aws-analysis-results').classList.add('hide');
                return;
            }
            
            // Se o tipo for JSON, fazer o parse normal
            if (!response.ok) {
                const errorData = await response.json();
                console.error('[AWS Connect] Erro na resposta do servidor:', errorData);
                connectionStatus.textContent = 'Erro ao assumir role';
                alert(`Erro ao assumir role: ${errorData.error || 'Erro desconhecido'}\n${errorData.details || ''}`);
                document.getElementById('aws-analysis-results').classList.add('hide');
                return;
            }
            
            const assumeRoleResponse = await response.json();
            console.log('[AWS Connect] Role assumida com sucesso via servidor');
            
            if (!assumeRoleResponse || !assumeRoleResponse.credentials) {
                console.error('[AWS Connect] Resposta inválida do servidor:', assumeRoleResponse);
                connectionStatus.textContent = 'Resposta inválida';
                alert(`Resposta inválida do servidor: Credenciais não encontradas`);
                document.getElementById('aws-analysis-results').classList.add('hide');
                return;
            }
            
            // Atualizar a mensagem de loading
            instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Configurando credenciais temporárias...</td></tr>';
            
            // Configurar AWS SDK com as credenciais temporárias
            console.log('[AWS Connect] Configurando credenciais temporárias');
            AWS.config.update({
                region: region,
                credentials: new AWS.Credentials({
                    accessKeyId: assumeRoleResponse.credentials.accessKeyId,
                    secretAccessKey: assumeRoleResponse.credentials.secretAccessKey,
                    sessionToken: assumeRoleResponse.credentials.sessionToken
                })
            });
        } catch (fetchError) {
            console.error('[AWS Connect] Erro na requisição ao servidor:', fetchError);
            connectionStatus.textContent = 'Erro na comunicação';
            alert(`Erro ao comunicar com o servidor: ${fetchError.message || 'Erro desconhecido'}`);
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Verificar se as novas credenciais estão funcionando
        console.log('[AWS Connect] Verificando novas credenciais...');
        connectionStatus.textContent = 'Verificando credenciais...';
        
        try {
            // Atualizar a mensagem de loading
            instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Verificando credenciais AWS...</td></tr>';
            
            const sts = new AWS.STS();
            let identity;
            
            try {
                identity = await sts.getCallerIdentity().promise();
                console.log('[AWS Connect] Identidade após assume-role:', identity);
                connectionStatus.textContent = `Conectado como: ${identity.Arn}`;
            } catch (error) {
                console.error('[AWS Connect] Erro ao verificar credenciais:', error);
                connectionStatus.textContent = 'Erro ao verificar credenciais';
                alert(`Erro ao verificar credenciais: ${error.message || 'Erro desconhecido'}`);
                document.getElementById('aws-analysis-results').classList.add('hide');
                return;
            }
        } catch (awsError) {
            console.error('[AWS Connect] Erro com o SDK da AWS:', awsError);
            connectionStatus.textContent = 'Erro com o SDK AWS';
            alert(`Erro com o SDK da AWS: ${awsError.message || 'Erro desconhecido'}`);
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Verificar se ainda temos o SDK AWS disponível antes de criar serviços
        if (typeof AWS === 'undefined' || typeof AWS.EC2 !== 'function') {
            console.error('[AWS Connect] SDK AWS não está mais disponível ou EC2 não é uma função');
            connectionStatus.textContent = 'Erro: SDK AWS indisponível';
            alert('SDK AWS não está mais disponível. Recarregue a página e tente novamente.');
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Criar serviço EC2 com as novas credenciais
        console.log('[AWS Connect] Criando cliente EC2...');
        const ec2 = new AWS.EC2();
        
        // Buscar instâncias EC2
        console.log('[AWS Connect] Buscando instâncias EC2...');
        connectionStatus.textContent = 'Buscando instâncias EC2...';
        
        // Atualizar a mensagem de loading
        instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Buscando instâncias EC2...</td></tr>';
        
        let ec2Response;
        try {
            ec2Response = await ec2.describeInstances({
                Filters: [
                    {
                        Name: 'instance-state-name',
                        Values: ['running']
                    }
                ]
            }).promise();
            
            console.log('[AWS Connect] Resposta EC2 recebida');
        } catch (error) {
            console.error('[AWS Connect] Erro ao buscar instâncias EC2:', error);
            connectionStatus.textContent = 'Erro ao buscar instâncias';
            alert(`Erro ao buscar instâncias EC2: ${error.message || 'Erro desconhecido'}`);
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Verificar resposta
        if (!ec2Response || !ec2Response.Reservations) {
            console.error('[AWS Connect] Resposta EC2 inválida:', ec2Response);
            connectionStatus.textContent = 'Erro na resposta EC2';
            alert('Erro: A resposta do EC2 não contém os dados esperados.');
            document.getElementById('aws-analysis-results').classList.add('hide');
            return;
        }
        
        // Processar instâncias
        console.log('[AWS Connect] Processando instâncias...');
        awsInstances = [];
        let totalCurrentCost = 0;
        let totalSpotCost = 0;
        
        // Mostrar indicador de carregamento
        instancesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Obtendo preços e analisando instâncias...</td></tr>';
        
        // Extrair todas as instâncias
        const instances = [];
        if (ec2Response.Reservations && ec2Response.Reservations.length > 0) {
            ec2Response.Reservations.forEach(reservation => {
                if (reservation.Instances && reservation.Instances.length > 0) {
                    reservation.Instances.forEach(instance => {
                        instances.push(instance);
                    });
                }
            });
        }
        
        console.log(`[AWS Connect] Encontradas ${instances.length} instâncias EC2 em execução`);
        
        if (instances.length === 0) {
            connectionStatus.textContent = `Conectado à conta ${accountId} (0 instâncias)`;
            connectionStatus.classList.remove('status-disconnected');
            connectionStatus.classList.add('status-connected');
            
            instancesTableBody.innerHTML = '<tr><td colspan="7" class="no-instances">Nenhuma instância em execução encontrada nesta conta/região</td></tr>';
            
            isAwsConnected = true;
            document.getElementById('aws-analysis-summary').classList.remove('hide');
            // Não fechar a tela de análise mesmo sem instâncias
            // document.getElementById('aws-analysis-results').classList.add('hide');
            
            alert('Nenhuma instância EC2 em execução foi encontrada na conta especificada.');
            return;
        }
        
        // Salvar credenciais e estado de conexão no localStorage para persistir entre refreshes
        try {
            localStorage.setItem('awsConnected', 'true');
            localStorage.setItem('awsAccountId', accountId);
            localStorage.setItem('awsRegion', region);
            console.log('[AWS Connect] Estado de conexão salvo no localStorage');
        } catch (storageError) {
            console.warn('[AWS Connect] Não foi possível salvar estado no localStorage:', storageError);
        }
        
        // Processar instâncias em lotes para não sobrecarregar a API
        const batchSize = 5;
        for (let i = 0; i < instances.length; i += batchSize) {
            const batch = instances.slice(i, i + batchSize);
            await Promise.all(batch.map(async (instance) => {
                // Processamento de instância
                const instanceType = instance.InstanceType;
                const instanceId = instance.InstanceId;
                let os = 'linux';
                
                // Determinar SO com base na AMI ou nome
                if (instance.Platform === 'windows') {
                    os = 'windows';
                }
                
                // Determinar elegibilidade para spot (instâncias com EBS e sem serviços críticos)
                const isEligible = true; // Lógica simplificada - na prática, verificar workload
                
                // Calcular custo on-demand
                const onDemandPrice = await getOnDemandPrice(instanceType, region, os);
                const monthlyOnDemand = onDemandPrice * 24 * 30; // ~730h/mês
                
                // Calcular custo spot e economia, se elegível
                let monthlySpot = monthlyOnDemand;
                let savingsPercentage = 0;
                
                if (isEligible) {
                    const spotPrice = await getSpotPrice(
                        instanceType, 
                        region, 
                        os,
                        80 // Estimativa de economia média
                    );
                    monthlySpot = spotPrice * 24 * 30;
                    
                    // Calcular porcentagem de economia
                    if (monthlyOnDemand > 0) {
                        savingsPercentage = ((monthlyOnDemand - monthlySpot) / monthlyOnDemand) * 100;
                    }
                }
                
                // Calcular economia
                const savings = isEligible ? monthlyOnDemand - monthlySpot : 0;
                
                // Adicionar ao custo total
                totalCurrentCost += monthlyOnDemand;
                totalSpotCost += isEligible ? monthlySpot : monthlyOnDemand;
                
                // Adicionar à lista de instâncias
                awsInstances.push({
                    id: instanceId,
                    type: instanceType,
                    region: region,
                    os: os,
                    onDemandCost: monthlyOnDemand,
                    spotCost: isEligible ? monthlySpot : monthlyOnDemand,
                    savings: savings,
                    savingsPercentage: savingsPercentage,
                    eligible: isEligible
                });
            }));
            
            // Atualizar a interface após cada lote para mostrar progresso
            if (i + batchSize < instances.length) {
                instancesTableBody.innerHTML = `<tr><td colspan="7" class="loading">Processando... (${i + batchSize}/${instances.length} instâncias)</td></tr>`;
            }
        }
        
        // Calcular economia total
        const totalSavings = totalCurrentCost - totalSpotCost;
        const savingsPercentage = (totalSavings / totalCurrentCost * 100) || 0;
        
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
        document.getElementById('aws-analysis-summary').classList.remove('hide');
        
        // Garantir que o botão "Fechar Análise" esteja visível
        const closeAnalysisBtn = document.getElementById('close-analysis');
        if (closeAnalysisBtn) {
            closeAnalysisBtn.classList.remove('hide');
        }
        
        // Adicionar botão "Nova Análise" se ele não existir
        let newAnalysisBtn = document.getElementById('new-analysis-btn');
        if (!newAnalysisBtn) {
            newAnalysisBtn = document.createElement('button');
            newAnalysisBtn.id = 'new-analysis-btn';
            newAnalysisBtn.className = 'aws-btn secondary-btn';
            newAnalysisBtn.textContent = 'Nova Análise';
            newAnalysisBtn.addEventListener('click', function() {
                // Mostrar o sidebar para permitir nova análise
                openSidebar();
                // Focar no campo de conta AWS
                document.getElementById('aws-account').focus();
            });
            
            // Inserir antes do botão "Fechar Análise"
            if (closeAnalysisBtn) {
                closeAnalysisBtn.parentNode.insertBefore(newAnalysisBtn, closeAnalysisBtn);
            }
        } else {
            newAnalysisBtn.classList.remove('hide');
        }
        
        // Atualizar status de conexão
        connectionStatus.textContent = `Conectado à conta ${accountId}`;
        connectionStatus.classList.remove('status-disconnected');
        connectionStatus.classList.add('status-connected');
        
        isAwsConnected = true;
        
    } catch (error) {
        console.error('[AWS Connect] Erro ao conectar com AWS:', error);
        connectionStatus.textContent = 'Erro na conexão';
        connectionStatus.className = 'connection-status status-disconnected';
        alert(`Erro ao conectar com AWS: ${error.message || 'Erro desconhecido'}`);
        
        // Fechar tela de análise em caso de erro para não mostrar dados parciais
        document.getElementById('aws-analysis-results').classList.add('hide');
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
            // Usar a porcentagem de economia já calculada
            const savingsPercentage = instance.savingsPercentage || 0;
            savingsCell.textContent = `$${instance.savings.toFixed(2)} (${savingsPercentage.toFixed(0)}%)`;
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

// Função para atualizar os preços spot
async function updateSpotPrices() {
    try {
        // Desabilitar botão e mostrar mensagem de carregamento
        updateSpotPriceBtn.disabled = true;
        updateSpotPriceBtn.textContent = 'Atualizando...';
        
        // Obter região selecionada no filtro
        const selectedRegion = regionFilter.value;
        const regionToUpdate = selectedRegion === 'all' ? null : selectedRegion;
        
        // Criar e mostrar um indicador de progresso
        const progressContainer = document.createElement('div');
        progressContainer.id = 'update-progress-container';
        progressContainer.style.position = 'fixed';
        progressContainer.style.top = '10px';
        progressContainer.style.right = '10px';
        progressContainer.style.padding = '10px';
        progressContainer.style.backgroundColor = 'var(--card-bg)';
        progressContainer.style.border = '1px solid var(--border-color)';
        progressContainer.style.borderRadius = '5px';
        progressContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        progressContainer.style.zIndex = '1000';
        
        const progressText = document.createElement('div');
        progressText.id = 'update-progress-text';
        progressText.textContent = 'Iniciando atualização...';
        progressContainer.appendChild(progressText);
        
        document.body.appendChild(progressContainer);
        
        // Primeiro, disparamos a requisição para baixar os dados mais recentes
        console.log(`Solicitando download dos dados de preço spot mais recentes${regionToUpdate ? ' para região ' + regionToUpdate : ''}...`);
        progressText.textContent = 'Baixando dados mais recentes...';
        
        try {
            const downloadResponse = await fetch('/api/update-spot-prices', { 
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!downloadResponse.ok) {
                throw new Error(`Falha ao solicitar download: ${downloadResponse.status}`);
            }
            
            const downloadResult = await downloadResponse.json();
            console.log("Download concluído:", downloadResult);
            progressText.textContent = 'Download concluído, processando dados...';
        } catch (downloadError) {
            console.error("Erro ao baixar spot.json:", downloadError);
            progressText.textContent = 'Erro ao baixar dados, usando cache existente...';
            // Continuar com os preços existentes, se houver um erro no download
        }
        
        // Filtrar spotData para processar apenas itens da região selecionada
        const itemsToUpdate = regionToUpdate 
            ? spotData.filter(item => item.region === regionToUpdate)
            : spotData;
        
        console.log(`Atualizando preços para ${itemsToUpdate.length} instâncias ${regionToUpdate ? 'da região ' + regionToUpdate : 'de todas as regiões'}`);
        
        // Processar os dados por páginas para melhor desempenho
        const batchSize = 50; // Processar 50 instâncias por vez
        let updatedSpotData = [...spotData]; // Criar uma cópia dos dados para atualizar
        
        for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
            const batch = itemsToUpdate.slice(i, i + batchSize);
            progressText.textContent = `Processando ${Math.min(i + batchSize, itemsToUpdate.length)} de ${itemsToUpdate.length} instâncias...`;
            
            const batchResults = await Promise.all(batch.map(async (item) => {
                try {
                    const spotPrice = await getSpotPrice(
                        item.instanceType, 
                        item.region, 
                        item.os, 
                        item.savingsOverOnDemand
                    );
                    return { ...item, spotPrice };
                } catch (error) {
                    console.error(`Erro ao obter preço para ${item.instanceType}:`, error);
                    return item; // Manter o item original em caso de erro
                }
            }));
            
            // Atualizar os dados com o lote processado
            for (let j = 0; j < batchResults.length; j++) {
                const updatedItem = batchResults[j];
                // Encontrar o índice no spotData original
                const originalIndex = updatedSpotData.findIndex(item => 
                    item.instanceType === updatedItem.instanceType && 
                    item.region === updatedItem.region && 
                    item.os === updatedItem.os
                );
                
                if (originalIndex !== -1) {
                    updatedSpotData[originalIndex] = updatedItem;
                }
            }
            
            console.log(`Processados ${Math.min(i + batchSize, itemsToUpdate.length)} de ${itemsToUpdate.length} itens`);
            
            // Não atualizamos a UI aqui para evitar o efeito de piscar
        }
        
        // Atualizar spotData com os dados atualizados
        spotData = updatedSpotData;
        
        // Atualizar o cache de preços spot
        createSpotPriceMap();
        
        // Reaplicar filtros após atualizar todos os dados (apenas uma vez)
        progressText.textContent = 'Atualizando interface...';
        applyFilters();
        
        // Remover o indicador de progresso após um breve atraso
        setTimeout(() => {
            if (document.getElementById('update-progress-container')) {
                document.body.removeChild(document.getElementById('update-progress-container'));
            }
        }, 2000);
        
        console.log(regionToUpdate 
            ? `Preços spot da região ${getRegionFullName(regionToUpdate)} atualizados com sucesso!` 
            : 'Preços spot de todas as regiões atualizados com sucesso!');
            
    } catch (error) {
        console.error('Erro ao atualizar preços spot:', error);
        alert(`Erro ao atualizar preços spot: ${error.message}`);
        
        // Remover o indicador de progresso em caso de erro
        if (document.getElementById('update-progress-container')) {
            document.body.removeChild(document.getElementById('update-progress-container'));
        }
    } finally {
        updateSpotPriceBtn.disabled = false;
        updateSpotPriceBtn.textContent = 'Atualizar Preço Spot da Região Selecionada';
    }
}

// Limpar cache de preços spot para garantir dados atualizados
function clearSpotPriceCache() {
    Object.keys(spotPriceCache).forEach(key => delete spotPriceCache[key]);
    console.log("Cache de preços spot limpo");
} 