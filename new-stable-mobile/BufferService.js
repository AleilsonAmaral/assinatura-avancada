// Arquivo: new-stable-mobile/services/apiService.js
// 🚨 MOCKADO: Em produção, substituir por chamadas reais a 'digital-signer-api'

// Função utilitária simples para simular a criação de um hash (DEVE SER FEITO NO BACKEND REAL)
const generateMockHash = (data) => {
    // Simula um SHA-256 seguro (apenas para testar o formato)
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
};

/**
 * Simula o envio da intenção de assinatura para a API.
 * Receberia o Base64/Intenção e retorna metadados de validação.
 */
export const uploadSignature = async (intentionPayload, signerId) => {
    console.log(`[API Mock] Iniciando processo de assinatura para ID: ${signerId}`);
    
    // 💡 Simula o tempo de resposta do servidor
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    if (signerId === 'ERROR_USER') {
         throw new Error("Usuário não autorizado ou bloqueado.");
    }
    
    // Simula o processamento no backend:
    const mockHash = generateMockHash(intentionPayload);
    const mockValidationUrl = `https://seusistema.com/verifica/${signerId}/${mockHash.substring(0, 10)}`;
    const now = new Date();

    return {
        // Metadados para o Carimbo Digital
        name: `Assinante Mockado ${signerId}`,
        date: now.toISOString(),
        validationUrl: mockValidationUrl,
        // Hash (CRÍTICO para segurança)
        hash: mockHash,
    };
};

/**
 * Simula o envio do código OTP para validação final da assinatura.
 */
export const validateOTP = async (otpCode, signatureHash) => {
    console.log(`[API Mock] Validando OTP: ${otpCode} para Hash: ${signatureHash.substring(0, 8)}...`);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Código de sucesso hardcoded para teste
    if (otpCode === '123456') { 
        return { success: true, message: "Assinatura validada e selada." };
    } else {
        throw new Error("Código OTP inválido. Tente o código de teste: 123456.");
    }
};

// Se você tiver uma API real, você usaria o fetch/axios aqui:
/*
export const uploadSignature = async (intentionPayload, signerId) => {
    const response = await fetch('http://localhost:3000/api/signature/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentionPayload, signerId })
    });
    if (!response.ok) throw new Error('API Error: ' + response.statusText);
    return response.json();
};
*/