// src/services/otpService.js

const crypto = require('crypto');
const nodemailer = require('nodemailer');
// Não precisamos mais da biblioteca da Twilio
// const twilio = require('twilio'); 
require('dotenv').config();

const activeTokens = new Map();

// --- CONFIGURAÇÃO DOS SERVIÇOS DE ENVIO ---

// 1. Cliente Nodemailer para E-mail
const emailTransporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_API_KEY, 
    },

    tls: {
    // Esta linha pode ser necessária para conexões mais antigas, mas tente sem ela primeiro
    // ciphers: 'SSLv3' 
}
});

// --- FUNÇÕES DE GERAÇÃO E VALIDAÇÃO DE TOKEN ---

function generateToken(signerId) {
    const token = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 10 * 60 * 1000; // Validade de 10 minutos
    activeTokens.set(signerId, { token, expires });
    console.log(`[OTP SERVICE] Token ${token} gerado para ${signerId}.`);
    return token;
}

function validateToken(signerId, submittedToken) {
    const stored = activeTokens.get(signerId);
    if (!stored) return { valid: false, message: 'Token não encontrado ou já utilizado.' };
    if (Date.now() > stored.expires) {
        activeTokens.delete(signerId);
        return { valid: false, message: 'Token expirado.' };
    }
    if (stored.token !== submittedToken) return { valid: false, message: 'Código OTP incorreto.' };
    activeTokens.delete(signerId);
    return { valid: true, message: 'Token validado com sucesso.' };
}

// --- FUNÇÕES DE ENVIO POR CANAL ---

async function sendEmailOTP(recipientEmail, token) {
    const mailOptions = {
        from: `"API Assinatura Digital" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `Seu código de acesso: ${token}`,
        html: `<div>Seu código de assinatura é: <strong>${token}</strong></div>`,
    };
    await emailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] OTP ${token} enviado para ${recipientEmail}`);
}

// NOVA FUNÇÃO DE ENVIO DE SMS COM A API DA ZENVIA
async function sendSmsOTP(recipientPhone, token) {
    const zenviaToken = process.env.ZENVIA_API_TOKEN;
    if (!zenviaToken) throw new Error('Token da Zenvia (ZENVIA_API_TOKEN) não encontrado no .env.');

    const apiUrl = 'https://api.zenvia.com/v2/channels/sms/messages';

    // A API da Zenvia espera o número apenas com o código do país, sem o '+'
    // Ex: +5511999998888 -> 5511999998888
    const formattedPhone = recipientPhone.replace('+', '');

    const requestBody = {
        from: "Assinatura", // Um nome curto de remetente (pode ter restrições)
        to: formattedPhone,
        contents: [
            {
                type: 'text',
                text: `Seu código de assinatura digital é: ${token}`
            }
        ]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'X-API-TOKEN': zenviaToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        // Lança um erro com os detalhes da falha para ser capturado no log
        throw new Error(`[ZENVIA API ERROR] ${JSON.stringify(errorData)}`);
    }

    console.log(`[SMS ZENVIA] OTP ${token} enviado para ${recipientPhone}`);
}

// --- FUNÇÃO PRINCIPAL "DISPATCHER" ---

async function sendToken(method, recipient, token) {
    try {
        switch (method) {
            case 'Email':
                await sendEmailOTP(recipient, token);
                return `Token enviado para o e-mail ${recipient}`;

            case 'SMS':
                await sendSmsOTP(recipient, token);
                return `Token enviado por SMS para ${recipient}`;

            case 'WhatsApp':
                // Mantemos o WhatsApp como simulação, pois não foi configurado na Zenvia
                console.log(`[SIMULAÇÃO WHATSAPP] Para o número ${recipient}, o token é ${token}`);
                return `Token para ${recipient} (via WhatsApp) foi gerado no console.`;

            default:
                throw new Error(`Método de envio '${method}' não suportado.`);
        }
    } catch (error) {
        console.error(`[ERRO NO ENVIO - ${method}] para ${recipient}:`, error.message);
        throw new Error(`Falha ao enviar o token via ${method}. Verifique os logs do servidor.`);
    }
}
// Em src/services/otpService.js

async function sendSmsOTP(recipientPhone, token) {
    const zenviaToken = process.env.ZENVIA_API_TOKEN;

    // ADICIONE ESTA LINHA PARA TESTE:
    console.log('[DEBUG] Tentando usar o Zenvia API Token:', zenviaToken);

    if (!zenviaToken) throw new Error('Token da Zenvia (ZENVIA_API_TOKEN) não encontrado no .env.');

    const apiUrl = 'https://api.zenvia.com/v2/channels/sms/messages';
    // ... (o resto da função continua igual)
}
// --- EXPORTA AS FUNÇÕES ---
module.exports = {
    generateToken,
    validateToken,
    sendToken,
};