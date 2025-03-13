const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
const PORT = 3000;

// Configurar o Express para servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Cache configuration
const CACHE_FILE = path.join(__dirname, 'spot-advisor-cache.json');
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em milissegundos

// Função para ler dados do cache local
function readFromCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            const now = Date.now();
            
            // Verificar se o cache ainda é válido
            if (now - cacheData.timestamp < CACHE_DURATION) {
                console.log("Retornando dados do cache local...");
                return cacheData.data;
            }
        }
        return null;
    } catch (error) {
        console.error("Erro ao ler cache:", error);
        return null;
    }
}

// Função para salvar dados no cache local
function saveToCache(data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log("Dados salvos no cache local!");
    } catch (error) {
        console.error("Erro ao salvar cache:", error);
    }
}

async function fetchSpotData() {
    // Tentar ler do cache primeiro
    const cachedData = readFromCache();
    if (cachedData) {
        return cachedData;
    }

    console.log("Cache expirado ou não existe, buscando dados novos...");
    return new Promise((resolve, reject) => {
        https.get('https://spot-bid-advisor.s3.amazonaws.com/spot-advisor-data.json', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    const spotData = jsonData.spot_advisor;
                    // Salvar no cache local
                    saveToCache(spotData);
                    resolve(spotData);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function getSpotData() {
    try {
        console.log("Buscando dados do Spot Advisor...");
        const spotData = await fetchSpotData();
        
        // Transformar os dados no formato correto
        const formattedData = [];
        
        for (const region of Object.keys(spotData)) {
            for (const os of Object.keys(spotData[region])) {
                for (const instanceType of Object.keys(spotData[region][os])) {
                    const data = spotData[region][os][instanceType];
                    formattedData.push({
                        instanceType,
                        region,
                        os,
                        savingsOverOnDemand: data.s || "N/A",  // `s` significa economia
                        interruptionRate: data.r || "N/A", // `r` significa frequência de interrupção
                        interruptionLevel: data.r === 0 ? 'very low' : 
                                         data.r === 1 ? 'low' : 
                                         data.r === 2 ? 'medium' : 
                                         data.r === 3 ? 'high' : 'very high'
                    });
                }
            }
        }

        console.log("Dados formatados com sucesso!");
        return formattedData;
    } catch (error) {
        console.error("Erro ao buscar os dados:", error);
        return [];
    }
}

// Função para buscar e salvar os dados de preço spot diretamente da fonte da AWS
async function fetchAndSaveSpotJson() {
    return new Promise((resolve, reject) => {
        console.log("Baixando dados de preço spot da AWS...");
        const spotJsonUrl = 'https://website.spot.ec2.aws.a2z.com/spot.json';
        
        https.get(spotJsonUrl, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Falha ao baixar spot.json: ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    // Converter string para objeto JSON
                    const jsonData = JSON.parse(data);
                    
                    // Formatar o JSON com indentação para melhor legibilidade
                    const formattedJson = JSON.stringify(jsonData, null, 2);
                    
                    const outputPath = path.join(__dirname, 'spot.json');
                    fs.writeFile(outputPath, formattedJson, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        console.log(`Arquivo spot.json formatado e salvo com sucesso em ${outputPath}`);
                        resolve(outputPath);
                    });
                } catch (error) {
                    reject(new Error(`Erro ao processar o JSON: ${error.message}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Função para ler os dados do arquivo spot.json
function readSpotJson() {
    try {
        const spotJsonPath = path.join(__dirname, 'spot.json');
        if (fs.existsSync(spotJsonPath)) {
            const spotData = JSON.parse(fs.readFileSync(spotJsonPath, 'utf8'));
            return spotData;
        }
        return null;
    } catch (error) {
        console.error("Erro ao ler spot.json:", error);
        return null;
    }
}

// Variável global para armazenar os dados spot em memória
let spotDataCache = null;

// Função para carregar os dados spot em memória
function loadSpotDataCache() {
    try {
        console.log("Carregando dados spot em cache...");
        spotDataCache = readSpotJson();
        if (spotDataCache) {
            console.log("Dados spot carregados com sucesso em cache!");
        } else {
            console.log("Dados spot não encontrados. Tentando buscar da fonte...");
            fetchAndSaveSpotJson().then(() => {
                spotDataCache = readSpotJson();
                console.log("Dados spot atualizados e carregados em cache!");
            }).catch(err => {
                console.error("Erro ao buscar dados spot:", err);
            });
        }
    } catch (error) {
        console.error("Erro ao carregar dados spot em cache:", error);
    }
}

// Carregar os dados em cache ao iniciar o servidor
loadSpotDataCache();

// Agendar atualização periódica dos dados (a cada 6 horas)
setInterval(() => {
    console.log("Atualizando dados spot em cache...");
    fetchAndSaveSpotJson().then(() => {
        spotDataCache = readSpotJson();
        console.log("Dados spot atualizados em cache!");
    }).catch(err => {
        console.error("Erro ao atualizar dados spot:", err);
    });
}, 6 * 60 * 60 * 1000); // 6 horas em milissegundos

// Função para encontrar o preço spot de uma instância específica
function findSpotPrice(spotData, region, instanceType, osValue) {
    if (!spotData?.config?.regions) {
        return { price: null, details: null };
    }
    
    // Encontrar a região
    const regionData = spotData.config.regions.find(r => r.region === region);
    if (!regionData) {
        return { price: null, details: null };
    }
    
    // Procurar nos tipos de instância
    for (const instanceTypeGroup of regionData.instanceTypes) {
        if (!instanceTypeGroup.sizes) continue;
        
        // Procurar pelo tamanho específico da instância
        const sizeData = instanceTypeGroup.sizes.find(s => s.size === instanceType);
        if (!sizeData) continue;
        
        if (!sizeData.valueColumns) {
            continue;
        }
        
        // Procurar pelo sistema operacional específico
        const osData = sizeData.valueColumns.find(vc => vc.name === osValue);
        if (!osData?.prices?.USD) {
            continue;
        }
        
        if (osData.prices.USD === 'N/A*') {
            continue;
        }
        
        const price = osData.prices.USD;
        
        return {
            price,
            details: {
                instanceType,
                instanceTypeGroup: instanceTypeGroup.type,
                region,
                os: osValue,
                price
            }
        };
    }
    
    // Se chegou aqui, não encontrou o preço
    return { price: null, details: null };
}

app.get('/api/spot-prices', async (req, res) => {
    try {
        const data = await getSpotData();
        res.json(data);
    } catch (error) {
        console.error("Erro ao processar requisição:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Endpoint para limpar o cache manualmente
app.post('/api/clear-cache', (req, res) => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            console.log("Cache limpo com sucesso!");
            res.json({ message: "Cache limpo com sucesso" });
        } else {
            res.json({ message: "Cache não existe" });
        }
    } catch (error) {
        console.error("Erro ao limpar cache:", error);
        res.status(500).json({ error: "Erro ao limpar cache" });
    }
});

// Endpoint para atualizar os preços spot
app.get('/api/update-spot-prices', async (req, res) => {
    try {
        const filePath = await fetchAndSaveSpotJson();
        res.json({ 
            success: true, 
            message: "Dados de preço spot baixados com sucesso", 
            filePath: filePath 
        });
    } catch (error) {
        console.error("Erro ao baixar dados de preço spot:", error);
        res.status(500).json({ 
            success: false, 
            error: "Erro ao baixar dados de preço spot", 
            details: error.message 
        });
    }
});

// Endpoint para obter preço spot de uma instância específica
app.get('/api/spot-price', (req, res) => {
    try {
        const { instanceType, region, os } = req.query;
        
        if (!instanceType || !region) {
            return res.status(400).json({ 
                success: false, 
                error: "Parâmetros incompletos", 
                message: "É necessário fornecer instanceType e region" 
            });
        }
        
        // Verificar se os dados estão em cache
        if (!spotDataCache) {
            spotDataCache = readSpotJson();
            if (!spotDataCache) {
                return res.status(404).json({ 
                    success: false, 
                    error: "Dados não encontrados", 
                    message: "Arquivo spot.json não encontrado ou inválido" 
                });
            }
        }
        
        const [instanceFamily, instanceSize] = instanceType.split('.');
        
        // Mapeamento de sistemas operacionais para os valores aceitos no spot.json
        const osMapping = {
            'linux': 'linux',
            'rhel': 'linux',
            'suse': 'linux',
            'windows': 'mswin',
            'mswin': 'mswin',
            'win': 'mswin'
        };
        
        // Determinar qual valor de SO usar
        const osValue = osMapping[os?.toLowerCase()] || 'linux';
        
        // Buscar preço usando a função dedicada com os dados em cache
        const result = findSpotPrice(spotDataCache, region, instanceType, osValue);
        
        res.json({
            success: true,
            instanceType,
            region,
            os: os || 'linux',
            price: result.price || "Preço não disponível",
            details: result.details
        });
    } catch (error) {
        console.error("Erro ao obter preço spot:", error);
        res.status(500).json({ 
            success: false, 
            error: "Erro ao obter preço spot", 
            details: error.message 
        });
    }
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para qualquer outra requisição que não seja encontrada
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`Cache local: ${CACHE_FILE}`);
});
