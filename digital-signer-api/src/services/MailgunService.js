// digital-signer-api/src/services/MailgunService.js

const FormData = require('form-data');
const Mailgun = require('mailgun.js');

// 1. Inicializa o cliente Mailgun (Sintaxe corrigida)
const mailgun = new Mailgun(FormData);

// 2. Define o cliente com o endpoint V3 da API
const mg = mailgun.client({
    username: 'api', // Padrão de username do Mailgun
    key: process.env.MAILGUN_API_KEY, // Usa a chave configurada no Heroku
    // 🎯 CORREÇÃO DA URL: Forçamos o endpoint da API V3 padrão
    url: 'https://api.mailgun.net/v3'
});

const MailgunService = {
    sendEmail: async (to, subject, html) => {
        const domain = process.env.MAILGUN_DOMAIN; // Domínio Sandbox ou Próprio

        if (!domain) {
            // Em caso de erro de configuração, garante que a API trave com uma mensagem clara
            throw new Error("Mailgun Domain faltando. Configure MAILGUN_DOMAIN.");
        }

        const messageData = {
            // 🎯 Remetente: Usa o subdomínio 'postmaster' para envio, o que é o padrão
            from: `Assinatura Digital <postmaster@${domain}>`,
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
            // Captura erros de credencial ou conexão
            console.error('[ERRO - MAILGUN SERVICE]: Falha no envio.', error.message);
            // 🎯 Lança um erro limpo (erro de sintaxe 's' removido)
            throw new Error(`Falha no envio de e-mail via Mailgun.`);
        }
    }
};

module.exports = MailgunService;