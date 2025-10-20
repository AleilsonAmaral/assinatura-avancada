const crypto = require('crypto');
const dotenv = require('dotenv');
// 🎯 CORREÇÃO: Importa o MailgunService para usar no 'Email'
const MailgunService = require('./MailgunService'); 

dotenv.config();

// CONFIGURAÇÕES
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos
const activeTokens = new Map();
const JWT_SECRET = process.env.JWT_SECRET; 

// ===============================================================
// FUNÇÕES BÁSICAS DE TOKEN (Lógica Principal)
// ===============================================================

function generateToken(signerId) {
    const token = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + OTP_EXPIRATION_MS; 
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

// ===============================================================
// FUNÇÃO DE ENVIO CENTRALIZADA (AGORA REALIZA ENVIO POR MAILGUN)
// ===============================================================

async function sendToken(method, recipient, token) {
    try {
        switch (method) {
            case 'Email':
                // ✅ NOVA LÓGICA: Usa o MailgunService
                try {
                    const subject = `Seu código de acesso: ${token}`;
                    const html = `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #007BFF;">Confirmação de Assinatura Digital</h2>
                            <p>Seu código de uso único (OTP) é:</p>
                            <p style="font-size: 30px; font-weight: bold; letter-spacing: 3px; color: #2c3e50; background: #ecf0f1; padding: 15px; border-radius: 5px; display: inline-block;">${token}</p>
                            <p>Este código expira em 10 minutos.</p>
                        </div>`;
                    
                    // 🎯 Chama o serviço de envio do Mailgun
                    await MailgunService.sendEmail(recipient, subject, html); 
                    
                    console.log(`[LOG - ENVIO MAILGUN] ✅ E-mail OTP enviado para: ${recipient}`);
                    return `Token enviado para o e-mail ${recipient} via Mailgun.`;
                } catch (error) {
                    console.error('[ERRO NO ENVIO - MAILGUN]:', error.message);
                    throw new Error(`Falha ao enviar o token via E-mail: ${error.message}.`);
                }
                
            case 'SMS':
            case 'WhatsApp':
                // Mantemos a simulação (Solução Auditável) para evitar a falha de entrega final de e-mail.
                console.log(`[LOG - SIMULAÇÃO] ✉️ TOKEN (Simulado) ${token} foi gerado para ${recipient} via ${method}.`);
                return `Token para ${recipient} (via ${method}) foi gerado no console.`;
                
            default:
                throw new Error(`Método de envio '${method}' não suportado.`);
        }
    } catch (error) {
        console.error('[ERRO GERAL - SENDTOKEN]:', error.message);
        throw error;
    }
}


module.exports = {
    generateToken,
    validateToken,
    sendToken,
};