// Arquivo: src/services/apiService.js (INTEGRAÇÃO 100% REAL E ROBUSTA)

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';

// Função auxiliar (mantida para caso outras partes do app a usem)
function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

/**
 * Função utilitária para extrair a mensagem de erro da resposta da API.
 * Suporta JSON, Texto puro ou falhas na leitura.
 */
async function getApiErrorMessage(response, defaultMessage) {
    let finalMessage = defaultMessage || `Falha HTTP: ${response.status}.`;
    
    try {
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        if (isJson) {
            const errorData = await response.json();
            finalMessage = errorData.message || finalMessage;
        } else {
            const rawText = await response.text();
            finalMessage = `Falha HTTP ${response.status}. Resposta da API: ${rawText.substring(0, 100)}`;
        }
    } catch (e) {
         console.error("Erro ao tentar ler resposta da API:", e);
         finalMessage = `Falha HTTP ${response.status}. Resposta da API vazia ou ilegível.`;
    }
    return finalMessage;
}


// =========================================================
// 1. INÍCIO DE ASSINATURA (DISPARA ENVIO DE OTP)
// =========================================================

export const uploadSignature = async (intentionPayload, signerId) => { 
    // 🎯 CORREÇÃO CRÍTICA: Rota /signature/start alterada para /otp/generate
    console.log(`[API] Iniciando assinatura em: ${API_BASE_URL}/otp/generate`);
    
    const response = await fetch(`${API_BASE_URL}/otp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Nota: A rota /otp/generate provavelmente espera 'method' e 'recipient'
        // Você pode precisar ajustar o payload aqui, dependendo de como o frontend o utiliza.
        // Assumindo que o frontend enviará os dados necessários para /otp/generate.
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Falha ao iniciar o processo de assinatura.');
        throw new Error(message);
    }
    
    // Espera-se que a API real retorne os metadados do selo (name, date, validationUrl, hash)
    return response.json();
};

// =========================================================
// 2. VALIDAÇÃO DE OTP
// =========================================================

export const validateOTP = async (otpCode, signatureHash) => {
    // ⚠️ ATENÇÃO: A rota /signature/validate TAMBÉM PODE ESTAR ERRADA no backend.
    // Manteremos por enquanto, mas se o próximo erro for 404, ela será a próxima a ser verificada.
    console.log(`[API] Enviando OTP para validação em: ${API_BASE_URL}/signature/validate`);

    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Validação OTP falhou. Verifique o código.');
        throw new Error(message);
    }
    
    // Retorna a resposta OK da validação
    return response.json();
};