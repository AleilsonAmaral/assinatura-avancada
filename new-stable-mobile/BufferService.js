// Arquivo: src/services/BufferService.js (No projeto mobile)

import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

/**
 * Converte uma string Base64 limpa (sem prefixo MIME) para um Uint8Array (Buffer).
 * @param {string} base64 - A string Base64 pura.
 * @returns {Uint8Array} O array de bytes.
 */
const base64ToArrayBuffer = (base64) => {
    // Usa a função padrão de JS para decodificar Base64
    const binaryString = atob(base64); 
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

/**
 * Salva a assinatura Base64 no sistema de arquivos local como um arquivo PNG.
 * @param {string} base64Data - A string Base64 da assinatura (com ou sem prefixo MIME).
 * @param {string} signerId - O ID do signatário (para nomear o arquivo).
 * @returns {Promise<string|null>} O URI do arquivo salvo (file://...) ou null em caso de falha.
 */
export const saveSignatureBase64 = async (base64Data, signerId) => {
    
    if (!base64Data || typeof base64Data !== 'string' || base64Data.length < 100) {
        Alert.alert("Erro", "Desenho não capturado. Dados insuficientes.");
        return null;
    }

    // 1. Limpeza da Base64 (Pega apenas os dados puros)
    const base64Clean = base64Data.split(',')[1]; 

    const fileName = `rubrica_${signerId}_${Date.now()}.png`;
    const fileUri = FileSystem.cacheDirectory + fileName; 

    try {
        // 🚨 AÇÃO CRÍTICA: Manter o writeAsStringAsync com Base64 encoding.
        // Se a função writeAsStringAsync está depreciada, mas é a única que aceita Base64.
        
        await FileSystem.writeAsStringAsync(fileUri, base64Clean, { 
            encoding: FileSystem.EncodingType.Base64,
        });
        
        return fileUri; 
        
    } catch (error) {
        console.error("[FileSystem ERROR - Write Failed]:", error);
        Alert.alert("Erro", "Falha crítica no processamento da assinatura. Tente novamente.");
        return null;
    }
};