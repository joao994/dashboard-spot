const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
const PORT = 3000;

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

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Cache local: ${CACHE_FILE}`);
});
