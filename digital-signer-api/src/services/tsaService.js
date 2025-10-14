const crypto = require('crypto');

function getTrustedTimestamp() {
    // Simulação: Obtém o tempo atual em formato ISO
    const trustedTime = new Date().toISOString(); 
    
    // Simulação do TSA (Autoridade de Carimbo do Tempo)
    const tsaSignature = crypto.createHmac('sha256', 'TSA_SECRET_KEY_MOCK').update(trustedTime).digest('hex');
    
    return {
        timestamp: trustedTime, 
        tsaSignature: tsaSignature,
        trustedSource: "MOCK_TSA_PROVIDER"
    };
}

module.exports = {
    getTrustedTimestamp
};