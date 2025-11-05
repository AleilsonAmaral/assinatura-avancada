// Arquivo: src/services/BufferService.js

import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

/**
 * Salva a assinatura Base64 no sistema de arquivos local como um arquivo PNG.
 * * @param {string} base64Data - A string Base64 da assinatura (PURA, sem prefixo 'data:').
 * @param {string} signerId - O ID do signatário (para nomear o arquivo).
 * @returns {Promise<string|null>} O URI do arquivo salvo (file://...) ou null em caso de falha.
 */
export const saveSignatureBase64 = async (base64Data, signerId = 'temp') => {
    
    // **1. VALIDAÇÃO DE ENTRADA (Ajustada)**
    // A Base64 pura deve ter pelo menos 100 caracteres para ser considerada um desenho.
    if (!base64Data || typeof base64Data !== 'string' || base64Data.length < 100) {
        console.warn("BufferService: Dados insuficientes para salvar a assinatura.");
        Alert.alert("Erro", "Desenho não capturado. Dados insuficientes.");
        return null;
    }

    // O NOVO CANVAS JÁ GERA A BASE64 PURA, ENTÃO ELIMINAMOS A LIMPEZA
    // Linha removida: const base64Clean = base64Data.split(',')[1]; 
    const base64Pura = base64Data;
    
    const fileName = `rubrica_${signerId}_${Date.now()}.png`;
    // Usamos cacheDirectory para arquivos temporários/não permanentes.
    const fileUri = FileSystem.cacheDirectory + fileName; 

    try {
        // 2. AÇÃO CRÍTICA: Escrita do arquivo
        // Usamos a string Base64 pura com o encoding Base64 do FileSystem.
        await FileSystem.writeAsStringAsync(fileUri, base64Pura, { 
            encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log(`[BufferService] Assinatura salva em: ${fileUri}`);
        return fileUri; // Retorna o URI de sucesso
        
    } catch (error) {
        console.error("[FileSystem ERROR - Write Failed]:", error);
        // O erro 'Base64 of undefined' deve sumir. Se persistir, o problema é nativo.
        Alert.alert("Erro", "Falha crítica no processamento da assinatura. Tente novamente.");
        return null;
    }
};

// Exportamos a função, não um objeto completo (como é o seu arquivo)
// Se precisar exportar o objeto como antes:
// export default { saveSignatureBase64 };