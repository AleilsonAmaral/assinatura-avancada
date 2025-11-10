// Arquivo: src/services/apiServiceMock.js (CORRIGIDO PARA INTEGRAÇÃO REAL)

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1'; // Reafirmando o Base URL

function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

export const uploadSignature = async (intentionPayload, signerId) => { 
    // MOCK DE DADOS: O frontend espera estes dados
    const mockHash = generateMockHash(intentionPayload);
    const mockValidationUrl = `https://seusistema.com/verifica/${signerId}/${mockHash.substring(0, 10)}`;
    const now = new Date();
    
    // 💡 Em um cenário real, esta chamada (fetch) dispararia o envio do OTP
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simula latência de rede
    
    return {
        name: `Assinante Mockado ${signerId}`,
        date: now.toISOString(),
        validationUrl: mockValidationUrl,
        hash: mockHash,
    };
};

export const validateOTP = async (otpCode, signatureHash) => {
    // CORREÇÃO CRÍTICA: Substituímos o código de teste hardcoded (123456)
    // por uma chamada real à sua API. O erro do OTP será determinado PELO SEU BACKEND.
    
    console.log(`[Frontend] Enviando OTP para API Real...`);

    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    const data = await response.json().catch(() => ({ message: 'Erro de resposta da API.' }));

    if (!response.ok || data.success === false) {
        // Se a validação falhar, o erro virá do seu servidor.
        throw new Error(data.message || `Validação OTP falhou. Verifique o código.`);
    }
    
    return data;
};