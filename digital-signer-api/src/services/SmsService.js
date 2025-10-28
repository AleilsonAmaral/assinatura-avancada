// digital-signer-api/src/services/SinchSmsService.js

const axios = require('axios');
const Buffer = require('buffer').Buffer; // ✅ Importação estável do Buffer

// 💡 CONFIGURAÇÕES DE RETRY
const MAX_RETRIES = 3; 
const RETRY_DELAY_MS = 1500; 

// 🚨 VARIÁVEIS DE AMBIENTE REAIS DO SINCH SMS (Do seu .env)
const KEY_ID = process.env.SINCH_KEY_ID; 
const API_SECRET = process.env.SINCH_API_SECRET; 
const SENDER_NUMBER = process.env.SINCH_SENDER_NUMBER; 
const SERVICE_PLAN_ID = process.env.SINCH_SERVICE_PLAN_ID; 
const API_URL_BASE = process.env.SINCH_SMS_API_URL_BASE; 

// Montamos a URL completa para a API de Lotes/Batches
const API_URL = `${API_URL_BASE}/${SERVICE_PLAN_ID}/batches`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const SinchSmsService = {
    sendOTP: async (recipient, token) => {
        if (!KEY_ID || !API_SECRET || !SENDER_NUMBER || !SERVICE_PLAN_ID) {
            throw new Error("Credenciais do Sinch (Key ID/Secret ou Number) incompletas.");
        }
        
        // 🚨 AUTENTICAÇÃO: Usando Key ID e Key Secret para o Basic Auth
        const authString = Buffer.from(`${KEY_ID}:${API_SECRET}`).toString('base64'); // ✅ CORREÇÃO

        const message = `Seu codigo OTP para assinatura: ${token}. Expira em 10 minutos.`;
        
        const messagePayload = {
            from: SENDER_NUMBER, 
            to: [recipient], 
            body: message
        };

        let lastError = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[DB DEBUG] Tentativa #${attempt} - Payload Sinch sendo enviado.`);
                
                const response = await axios.post(API_URL, messagePayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        // ✅ CORREÇÃO CRÍTICA: Retorna a sintaxe correta do Basic Auth
                        'Authorization': `Basic ${authString}`
                    }
                });

                if (response.status >= 200 && response.status < 300) {
                    console.log(`[LOG - SINCH] ✅ Token SMS enviado com sucesso na tentativa #${attempt}.`);
                    return response.data;
                }
                
                throw new Error(`Status de API inesperado: ${response.status}`);

            } catch (error) {
                lastError = error;
                const status = error.response ? error.response.status : 0;
                
                // Erros Irrecuperáveis (400, 401, 403, 404): Não repete
                if (status === 401 || status === 400 || status === 403 || status === 404) {
                    console.error(`[ERRO IRRECUPERÁVEL SINCH] Status ${status}. Detalhes da API:`, error.response?.data);
                    break; 
                }

                // Erro recuperável (Timeouts, 500 Interno)
                if (attempt < MAX_RETRIES) {
                    console.warn(`[RETRY] Tentativa ${attempt} falhou.`);
                    await delay(RETRY_DELAY_MS);
                }
            }
        }

        const errorDetails = lastError.response 
            ? JSON.stringify(lastError.response.data) 
            : lastError.message;
            
        console.error('[ERRO FATAL SINCH]: Falha após todas as tentativas. Detalhes:', errorDetails);
        
        throw new Error(`Falha no envio de SMS após ${MAX_RETRIES} tentativas.`);
    }
};

module.exports = SinchSmsService;