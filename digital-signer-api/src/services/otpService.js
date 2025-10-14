const crypto = require('crypto');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail'); // SDK do SendGrid

dotenv.config();

// CONFIGURAÇÕES
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos
const activeTokens = new Map();
const SENDER_EMAIL = process.env.SENDER_EMAIL; 
const JWT_SECRET = process.env.JWT_SECRET; 

// --- 1. INICIALIZAÇÃO SENDGRID ---
// A chave é inicializada globalmente com a variável de ambiente
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ===============================================================
// FUNÇÕES BÁSICAS DE TOKEN
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
// FUNÇÃO DE ENVIO CENTRALIZADA (REAL SENDGRID)
// ===============================================================

async function sendToken(method, recipient, token) {
    try {
        switch (method) {
            case 'Email':
                const subject = `Seu código de acesso: ${token}`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                        <h2 style="color: #3498db;">Confirmação de Assinatura Digital</h2>
                        <p>Seu código de uso único (OTP) é:</p>
                        <p style="font-size: 30px; font-weight: bold; letter-spacing: 3px; color: #2c3e50; background: #ecf0f1; padding: 15px; border-radius: 5px; display: inline-block;">${token}</p>
                        <p>Este código expira em 10 minutos. Não o compartilhe.</p>
                    </div>`;

                const mailOptions = {
                    from: SENDER_EMAIL, // CRÍTICO: E-mail verificado no SendGrid
                    to: recipient,
                    subject: subject,
                    html: html
                };

                await sgMail.send(mailOptions);
                console.log(`[LOG - ENVIO SENDGRID] ✅ E-mail OTP enviado para: ${recipient}`);
                return `Token enviado para o e-mail ${recipient}.`;

            case 'SMS':
            case 'WhatsApp':
                // Voltamos para a simulação de log
                console.log(`[LOG - SIMULAÇÃO] ✉️ TOKEN (Simulado) ${token} foi gerado para ${recipient} via ${method}.`);
                return `Token para ${recipient} (via ${method}) foi gerado no console.`;

            default:
                throw new Error(`Método de envio '${method}' não suportado.`);
        }
    } catch (error) {
        // Loga o erro detalhado do SendGrid ou da rede
        const errorDetails = error.response ? JSON.stringify(error.response.body.errors) : error.message;
        console.error(`[ERRO NO ENVIO - ${method}] para ${recipient}:`, errorDetails);
        throw new Error(`Falha ao enviar o token via ${method}. Verifique a chave SENDGRID_API_KEY.`);
    }
}


module.exports = {
    generateToken,
    validateToken,
    sendToken,
};

    
