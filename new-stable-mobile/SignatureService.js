// Arquivo: new-stable-mobile/src/services/SignatureService.js

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const JWT_TRANSACTION_KEY = 'jwtToken'; 

export async function finalizeDocumentSignature(signerId, docId, docTitle, templateId, uploadedDocumentUri, otpCode) {
    
    // 1. OBTEM O TOKEN
    const token = await AsyncStorage.getItem(JWT_TRANSACTION_KEY);
    if (!token) {
        throw new Error("Sessão expirada. Token de transação ausente.");
    }

    // 2. CONSTRUÇÃO DO PAYLOAD (FormData)
    const formData = new FormData();
    formData.append('signerId', signerId);
    formData.append('submittedOTP', otpCode); 
    // ... (append dos outros campos)
    
    if (templateId === 'upload' && uploadedDocumentUri) {
         formData.append('documentFile', {
             uri: uploadedDocumentUri,
             name: docTitle,
             type: 'application/pdf',
         });
    }

    // 3. FETCH E TRATAMENTO DE ERRO
    const response = await fetch(`${API_BASE_URL}/document/sign`, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${token}` },
         body: formData,
    });

    if (!response.ok) {
         const data = await response.json();
         throw new Error(data.message || `Falha HTTP ${response.status}.`);
    }

    // Limpeza (Opcional, pode ser feita no componente também)
    await AsyncStorage.removeItem(JWT_TRANSACTION_KEY); 
    
    return response.json();
}