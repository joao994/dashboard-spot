const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = 3000;

async function fetchSpotData() {
    return new Promise((resolve, reject) => {
        https.get('https://spot-bid-advisor.s3.amazonaws.com/spot-advisor-data.json', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.spot_advisor); 
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
                        interruptionLevel: data.r === 1 ? 'low' : data.r === 2 ? 'medium' : data.r === 3 ? 'high' : 'very high'
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
    const data = await getSpotData();
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/api/spot-prices`);
});
