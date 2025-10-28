// digital-signer-api/src/services/MailgunService.js

const FormData = require('form-data');
const Mailgun = require('mailgun.js');

// 1. Inicializa o cliente Mailgun (Sintaxe corrigida)
const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    // 🚨 MUDANÇA CRÍTICA AQUI: USANDO 'host' em vez de 'url' para mapeamento de região/domínio
    host: 'api.mailgun.net',
    // Removemos 'url' para simplificar, confiando no 'host'
    // Tente adicionar 'public_api_key' se o host falhar
});

const MailgunService = {
    sendEmail: async (to, subject, html) => {
        const domain = process.env.MAILGUN_DOMAIN; // Domínio Sandbox ou Próprio

        if (!domain) {
            // Em caso de erro de configuração, garante que a API trave com uma mensagem clara
            throw new Error("Mailgun Domain faltando. Configure MAILGUN_DOMAIN.");
        }

        const messageData = {
            // 💡 MUDANÇA AQUI: Trocando 'postmaster' por 'noreply'
            from: `Assinatura Digital <noreply@${domain}>`,
            to: to,
            subject: subject,
            html: html,
        };

        try {
            // 3. Criação da mensagem
            const response = await mg.messages.create(domain, messageData);
            console.log(`[LOG - MAILGUN] E-mail enviado com sucesso. ID: ${response.id}`);
            return response;
        } catch (error) {

            // 🚨 MUDANÇA CRÍTICA AQUI (Bloco de catch fornecido por você)
            let errorDetail = 'Erro desconhecido do Mailgun.';
            if (error.response && error.response.data) {
                // Tenta logar a mensagem de erro específica da API (ex: "Forbidden", "Domain is not enabled")
                errorDetail = `Status: ${error.status || 'N/A'} | API Message: ${JSON.stringify(error.response.data)}`;
            } else {
                // Captura erro de rede ou falha de biblioteca
                errorDetail = error.message;
            }

            console.error('[ERRO FATAL MAILGUN SERVICE]: Falha no envio. Detalhes:', errorDetail);

            throw new Error(`Falha no envio de e-mail via Mailgun. Verifique o log do backend.`);
        }
    } // <--- FECHA O MÉTODO sendEmail
}; // <--- FECHA O OBJETO MailgunService

module.exports = MailgunService; // <--- EXPORTAÇÃO CORRETA

//module.exports = MailgunService;