// Arquivo: src/services/apiServiceMock.js (MOCK SERVICE)

const generateMockHash = (data) => {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
};

export const uploadSignature = async (intentionPayload, signerId) => { 
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    if (signerId === 'ERROR_USER') throw new Error("Usuário não autorizado ou bloqueado.");
    
    const mockHash = generateMockHash(intentionPayload);
    const mockValidationUrl = `https://seusistema.com/verifica/${signerId}/${mockHash.substring(0, 10)}`;
    const now = new Date();

    return {
        name: `Assinante Mockado ${signerId}`,
        date: now.toISOString(),
        validationUrl: mockValidationUrl,
        hash: mockHash,
    };
};

export const validateOTP = async (otpCode, signatureHash) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const TEST_OTP_CODE = '123456';
    if (otpCode === TEST_OTP_CODE) { 
        return { success: true, message: "Assinatura validada e selada." };
    } else {
        throw new Error(`Código OTP inválido. Tente o código de teste: ${TEST_OTP_CODE}.`);
    }
};