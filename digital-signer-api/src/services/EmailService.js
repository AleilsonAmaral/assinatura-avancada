// digital-signer-api/src/services/SinchService.js

const axios = require('axios');
// Adiciona a importação de Buffer
const { Buffer } = require('node:buffer'); 
// Endpoint da API de SMS do Sinch. A região 'eu' é globalmente acessível.
const API_URL = 'https://eu.sms.api.sinch.com/xms/v1/'; 

const SinchService = {
    /**
     * Envia um código OTP via SMS usando a API HTTP do Sinch.
     * Requer que as variáveis de ambiente SINCH_KEY_ID, SINCH_KEY_SECRET e SINCH_SMS_SENDER estejam configuradas.
     * @param {string} phoneNumber - O número de telefone de destino (Ex: DDDXXXXXXXXX).
     * @param {string} token - O código OTP de 6 dígitos.
     */
    sendSmsOtp: async (phoneNumber, token) => {
        const sender = process.env.SINCH_SMS_SENDER; // Seu número Sinch (obtido no pré-requisito)
        const keyId = process.env.SINCH_KEY_ID;
        const keySecret = process.env.SINCH_KEY_SECRET;

        // 1. Verificação de Credenciais
        if (!keyId || !keySecret || !sender) {
            throw new Error("Credenciais Sinch incompletas (Key ID, Secret ou Sender faltando no Heroku Config).");
        }

        const message = `Seu código de verificação para o Digital Signer é: ${token}. Não compartilhe este código.`;
        
        try {
            // 2. Monta a URL de envio
            const sendEndpoint = `${API_URL}${keyId}/batches`;
            
            // 3. Autenticação: Sinch usa autenticação Basic (Key ID:Key Secret)
            // Agora usando Buffer.from que está importado
            const authString = Buffer.from(`${keyId}:${keySecret}`).toString('base64'); 

            // 4. Chamada da API usando Axios
            const response = await axios.post(sendEndpoint, {
                // Conteúdo da mensagem
                from: sender,
                to: [phoneNumber], // O Sinch espera um array de destinatários
                body: message
            }, {
                // Headers de Autenticação
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authString}`
                }
            });

            console.log(`[LOG - SINCH] SMS enviado com sucesso. Status: ${response.status}, ID: ${response.data.batch_id}`);
            return response.data;

        } catch (error) {
            // Captura erros específicos da API do Sinch
            const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error('[ERRO - SINCH SERVICE]: Falha ao enviar SMS.', errorDetails);
            // Lança um erro detalhado para ser capturado pela rota
            throw new Error(`Falha no envio de SMS via Sinch. Detalhes: ${errorDetails}`);
        }
    }
};

module.exports = SinchService;