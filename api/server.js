const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const path = require('path');
const AWS = require('aws-sdk');

// Verificar variável de ambiente para modo de desenvolvimento
const DEV_MODE = process.env.DEV_MODE === 'true';
console.log(`Modo de desenvolvimento: ${DEV_MODE ? 'ATIVADO' : 'DESATIVADO'}`);

const app = express();
// Configurar o Express para analisar JSON
app.use(express.json());
app.use(cors({
    origin: '*',  // Permitir todas as origens (para desenvolvimento)
    methods: ['GET', 'POST'],  // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Accept'],  // Cabeçalhos permitidos
    credentials: true  // Permitir cookies
}));
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

// API endpoint para retornar os dados de preço spot
app.get('/api/spot-prices', async (req, res) => {
    try {
        const formattedData = await getSpotData();
        res.json(formattedData);
    } catch (error) {
        console.error("Erro na requisição:", error);
        res.status(500).json({ error: "Erro ao processar a requisição" });
    }
});

// API endpoint para assumir role na AWS
app.post('/api/assume-role', async (req, res) => {
    // Registra todas as informações da requisição para debug
    console.log('[DEBUG] Nova requisição assume-role recebida:');
    console.log('[DEBUG] Headers:', req.headers);
    console.log('[DEBUG] Body:', req.body);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    try {
        const { accountId, region, accessKey, secretKey } = req.body;
        
        console.log('[ASSUME-ROLE] Solicitação recebida:', { 
            accountId, 
            region, 
            hasAccessKey: !!accessKey,
            hasSecretKey: !!secretKey
        });
        
        if (!accountId || !region) {
            return res.status(400).json({ error: "accountId e region são obrigatórios" });
        }
        
        // Proteger contra redirecionamentos no corpo da resposta
        res.removeHeader('X-Powered-By');
        
        try {
            // Configurar AWS SDK
            if (accessKey && secretKey) {
                console.log('[ASSUME-ROLE] Usando credenciais fornecidas');
                // Se credenciais foram fornecidas, usá-las
                AWS.config.update({
                    region: region,
                    accessKeyId: accessKey,
                    secretAccessKey: secretKey
                });
            } else {
                console.log('[ASSUME-ROLE] Usando credenciais do ambiente');
                // Caso contrário, usar as credenciais do ambiente
                AWS.config.update({ region: region });
            }
            
            // Verificar configuração
            console.log('[ASSUME-ROLE] Configuração AWS:', { 
                region: AWS.config.region,
                hasCredentials: !!AWS.config.credentials
            });
            
            // Criar um cliente STS
            const sts = new AWS.STS();
            
            // Verificar identidade atual
            try {
                const identity = await sts.getCallerIdentity().promise();
                console.log('[ASSUME-ROLE] Identidade atual:', identity);
            } catch (error) {
                console.error('[ASSUME-ROLE] Erro ao verificar identidade:', error);
                return res.status(401).json({ 
                    error: "Erro ao verificar credenciais AWS", 
                    details: error.message
                });
            }
            
            // Assume role
            const roleArn = `arn:aws:iam::${accountId}:role/worker-node-group`;
            console.log('[ASSUME-ROLE] Tentando assumir role:', roleArn);
            
            const assumeRoleResponse = await sts.assumeRole({
                RoleArn: roleArn,
                RoleSessionName: 'SpotDashboardSession',
                DurationSeconds: 3600 // 1 hora
            }).promise();
            
            console.log('[ASSUME-ROLE] Role assumida com sucesso');
            
            // Retornar as credenciais temporárias
            return res.json({
                credentials: {
                    accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
                    secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
                    sessionToken: assumeRoleResponse.Credentials.SessionToken,
                    expiration: assumeRoleResponse.Credentials.Expiration
                },
                assumedRoleUser: assumeRoleResponse.AssumedRoleUser
            });
            
        } catch (error) {
            console.error('[ASSUME-ROLE] Erro ao assumir role:', error);
            return res.status(403).json({ 
                error: `Erro ao assumir role na conta ${accountId}`, 
                details: error.message 
            });
        }
    } catch (error) {
        console.error('[ASSUME-ROLE] Erro geral na requisição:', error);
        return res.status(500).json({ 
            error: "Erro interno no servidor", 
            details: error.message 
        });
    }
});

// API endpoint para buscar o preço spot mais recente
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

// API endpoint de teste simples para verificar se o servidor está funcionando
app.get('/api/test', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
        success: true, 
        message: 'API respondendo corretamente', 
        timestamp: new Date().toISOString() 
    });
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para verificar o modo de desenvolvimento
app.get('/api/config', (req, res) => {
    res.json({
        devMode: DEV_MODE
    });
});

// Rota para obter preço spot específico
app.get('/api/spot-price', async (req, res) => {
    try {
        const { instanceType, region, os } = req.query;
        
        if (!instanceType || !region || !os) {
            return res.status(400).json({ 
                success: false, 
                error: 'Parâmetros necessários: instanceType, region, os' 
            });
        }
        
        // Normalizar o sistema operacional
        const normalizedOs = os.toLowerCase();
        
        // Buscar dados do Spot
        const spotData = await getSpotData();
        
        // Procurar o preço spot específico
        for (const item of spotData) {
            if (item.instanceType === instanceType && 
                item.region === region && 
                item.os.toLowerCase() === normalizedOs) {
                
                return res.json({
                    success: true,
                    price: item.savingsOverOnDemand,
                    savings: item.savingsOverOnDemand,
                    interruption: item.interruptionRate,
                    interruption_level: item.interruptionLevel
                });
            }
        }
        
        // Se não encontrar preço spot para a combinação exata
        return res.json({
            success: false,
            price: "Preço não disponível",
            message: "Preço spot não disponível para esta combinação específica. Tente usar uma estimativa baseada na economia média."
        });
        
    } catch (error) {
        console.error("Erro ao buscar preço spot:", error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar preço spot',
            details: error.message
        });
    }
});

// Rota para qualquer outra requisição que não seja encontrada
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`Cache local: ${CACHE_FILE}`);
});
