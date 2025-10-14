const crypto = require('crypto');

// A chave secreta é carregada do .env
const SECRET_SIGNER_SALT = process.env.SIGNER_SECRET || 'chave_de_fallback_insegura_use_o_.env'; 

function generateDocumentHash(content) {
    // Prova de Integridade (SHA-256)
    return crypto.createHash('sha256').update(content).digest('hex');
}

function signData(dataToSign) {
    // Prova de Autoria (Assinatura Criptográfica)
    return crypto.createHmac('sha256', SECRET_SIGNER_SALT).update(dataToSign).digest('hex');
}

function verifySignature(originalHash, originalSignature, timestamp, signerId) {
    // Verifica a assinatura
    const dataToVerify = `${originalHash}|${timestamp}|${signerId}`;
    const expectedSignature = crypto.createHmac('sha256', SECRET_SIGNER_SALT) 
                                    .update(dataToVerify)
                                    .digest('hex');
    return originalSignature === expectedSignature;
}

module.exports = {
    generateDocumentHash,
    signData,
    verifySignature
};