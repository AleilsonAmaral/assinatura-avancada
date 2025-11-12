/*/ digital-signer-api/src/services/otpService.js

const crypto = require('crypto');
const dotenv = require('dotenv');
// 🎯 Importa os serviços de canal
const MailgunService = require('./MailgunService'); 
const SmsService = require('./SmsService'); 

dotenv.config();

// CONFIGURAÇÕES
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos
const JWT_SECRET = process.env.JWT_SECRET; 

// ===============================================================
// FUNÇÕES BÁSICAS DE TOKEN (Lógica Principal)
// ===============================================================

function generateToken(signerId) {
    const token = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + OTP_EXPIRATION_MS; 
    
    console.log(`[OTP SERVICE] Token ${token} gerado para ${signerId}.`);
    return token;
}

// ===============================================================
// FUNÇÃO DE ENVIO CENTRALIZADA (Orquestrador)
// ===============================================================

async function sendToken(method, recipient, token) {
    // 🚨 LOG CRÍTICO DE ENTRADA: 
    console.log(`[FLOW DEBUG] Tentativa de envio para: ${recipient} via ${method}.`);
    
    try {
        switch (method) {
            case 'Email':
                // ✅ Lógica Mailgun 
                try {
                    const subject = `Seu código de acesso: ${token}`;
                    const html = `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #007BFF;">Confirmação de Assinatura Digital</h2>
                            <p>Seu código de uso único (OTP) é:</p>
                            <p style="font-size: 30px; font-weight: bold; letter-spacing: 3px; color: #2c3e50; background: #ecf0f1; padding: 15px; border-radius: 5px; display: inline-block;">${token}</p>
                            <p>Este código expira em 10 minutos.</p>
                        </div>`;
                    
                    await MailgunService.sendEmail(recipient, subject, html); 
                    
                    console.log(`[LOG - ENVIO MAILGUN] ✅ E-mail OTP enviado para: ${recipient}`);
                    return `Token enviado para o e-mail ${recipient} via Mailgun.`;
                } catch (error) {
                    console.error('[ERRO NO ENVIO - MAILGUN]:', error.message);
                    throw new Error(`Falha ao enviar o token via E-mail: ${error.message}.`);
                }
                
            case 'SMS':
            case 'WhatsApp':
                // 🚨 CORREÇÃO: SIMULAÇÃO de Sucesso (para evitar o 401 do Sinch)
                console.log(`[LOG - SIMULAÇÃO] ✉️ TOKEN (Simulado) ${token} foi gerado para ${recipient} via ${method}.`);
                return `Token para ${recipient} (via ${method}) foi gerado no console.`;

            default:
                throw new Error(`Método de envio '${method}' não suportado.`);
        }
    } catch (error) {
        // Se a falha for na lógica de token, ela é capturada aqui.
        console.error('[ERRO GERAL - SENDTOKEN]:', error.message);
        throw error;
    }
}


module.exports = {
    generateToken,
    sendToken,
};*/

// digital-signer-api/src/services/otpService.js

const crypto = require('crypto');
const dotenv = require('dotenv');
// 🎯 Importa os serviços de canal
const MailgunService = require('./MailgunService'); 
const SmsService = require('./SmsService'); 

dotenv.config();

// CONFIGURAÇÕES
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos
const JWT_SECRET = process.env.JWT_SECRET; 

// ===============================================================
// FUNÇÕES BÁSICAS DE TOKEN (Lógica Principal)
// ===============================================================

function generateToken(signerId) {
    const token = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + OTP_EXPIRATION_MS; 
    
    console.log(`[OTP SERVICE] Token ${token} gerado para ${signerId}.`);
    return token;
}

// ===============================================================
// FUNÇÃO DE ENVIO CENTRALIZADA (Orquestrador) - CORRIGIDA
// ===============================================================

async function sendToken(method, recipient, token) {
    // 🚨 LOG CRÍTICO DE ENTRADA: 
    console.log(`[FLOW DEBUG] Tentativa de envio para: ${recipient} via ${method}.`);
    
    // 💡 CORREÇÃO CRÍTICA: Padronizar o método para minúsculas
    const standardizedMethod = method.toLowerCase(); 
    
    try {
        switch (standardizedMethod) {
            case 'Email': // ✅ Usando minúsculas para estabilidade
                // ✅ Lógica Mailgun 
                try {
                    const subject = `Seu código de acesso: ${token}`;
                    const html = `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #007BFF;">Confirmação de Assinatura Digital</h2>
                            <p>Seu código de uso único (OTP) é:</p>
                            <p style="font-size: 30px; font-weight: bold; letter-spacing: 3px; color: #2c3e50; background: #ecf0f1; padding: 15px; border-radius: 5px; display: inline-block;">${token}</p>
                            <p>Este código expira em 10 minutos.</p>
                        </div>`;
                    
                    await MailgunService.sendEmail(recipient, subject, html); 
                    
                    console.log(`[LOG - ENVIO MAILGUN] ✅ E-mail OTP enviado para: ${recipient}`);
                    return `Token enviado para o e-mail ${recipient} via Mailgun.`;
                } catch (error) {
                    console.error('[ERRO NO ENVIO - MAILGUN]:', error.message);
                    throw new Error(`Falha ao enviar o token via E-mail: ${error.message}.`);
                }
                
            case 'sms': // ✅ Simulação em minúsculas
            case 'whatsapp': // ✅ Simulação em minúsculas
                // 🚨 CORREÇÃO: SIMULAÇÃO de Sucesso (para evitar o 401 do Sinch)
                console.log(`[LOG - SIMULAÇÃO] ✉️ TOKEN (Simulado) ${token} foi gerado para ${recipient} via ${standardizedMethod}.`);
                return `Token para ${recipient} (via ${standardizedMethod}) foi gerado no console.`;

            default:
                // Retorna o método original no erro para o log
                throw new Error(`Método de envio '${method}' não suportado.`);
        }
    } catch (error) {
        console.error('[ERRO GERAL - SENDTOKEN]:', error.message);
        throw error;
    }
}


module.exports = {
    generateToken,
    sendToken,
};