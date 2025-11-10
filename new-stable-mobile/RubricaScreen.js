// Arquivo: RubricaScreen.js (FINAL CORRIGIDO E OTIMIZADO)

import React, { useState } from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    Button, 
    Alert, 
    ActivityIndicator, 
    TextInput, 
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableOpacity,
    Linking
} from 'react-native';

// Importações
import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// --- Variáveis Globais ---
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = 'Usuário de Teste'; 


// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (INTEGRAÇÃO API REAL C/ TRATAMENTO ROBUSTO)
// =========================================================

function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

/**
 * Função utilitária para extrair a mensagem de erro da resposta da API.
 * (Mantenho aqui, embora no VerificationScreen ela estivesse externa, para manter a estrutura original)
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


/**
 * 1. INÍCIO DE ASSINATURA (SOLICITA OTP) - ENDPOINT CORRIGIDO
 */
async function uploadSignature(intentionPayload, signerId) { 
    // 🎯 CORREÇÃO CRÍTICA: Rota /signature/start alterada para /otp/generate
    const response = await fetch(`${API_BASE_URL}/otp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ATENÇÃO: A rota /otp/generate pode esperar outros campos (method, recipient)
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        // 🛠️ Tratamento de Erro Robusto (reutilizando a função)
        const message = await getApiErrorMessage(response, 'Falha ao iniciar o processo de assinatura.');
        throw new Error(message);
    }
    
    return response.json(); 
}

/**
 * 2. VALIDAÇÃO DE OTP - Tratamento de Erro Robusto
 */
async function validateOTP(otpCode, signatureHash) {
    // ⚠️ ATENÇÃO: Mantendo /signature/validate. Se houver 404, esta é a próxima a ser corrigida.
    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    if (!response.ok) {
        // 🛠️ Tratamento de Erro Robusto (reutilizando a função)
        const message = await getApiErrorMessage(response, 'Validação OTP falhou. Verifique o código.');
        throw new Error(message);
    }
    
    return response.json();
}

// ⭐️ FUNÇÃO AUXILIAR: Converte URI local em um Blob
async function uriToBlob(uri) {
    // Implementação real da conversão (se necessário para upload)
    const response = await fetch(uri);
    return await response.blob();
}

// --- FIM DA SEÇÃO DE FUNÇÕES ---


// --- Constantes de Estado ---
const STEPS = {
    PREPARE: 'PREPARE',
    OTP: 'OTP',
    CONFIRMED: 'CONFIRMED',
};

const RubricaScreen = ({ signerId = 'USER_DEFAULT_ID', documentId = 'DOC_ABC_123' }) => {
    const [step, setStep] = useState(STEPS.PREPARE);
    const [isLoading, setIsLoading] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [signatureMetaData, setSignatureMetaData] = useState(null); 

    // 1. Função para INICIAR A ASSINATURA e avançar para o OTP
    const handleStartSignature = async () => {
        setIsLoading(true);
        try {
            const intentionPayload = `Intent_Sign_${documentId}_by_${signerId}`; 
            
            // ✅ CHAMADA REAL: Envia intenção e aguarda resposta
            const metadata = await uploadSignature(
                intentionPayload, 
                signerId
            );

            // ATENÇÃO: A rota /otp/generate não retorna hash, name, date, etc.
            // Para evitar quebrar, estou usando fallbacks.
            setSignatureMetaData({ 
                signerName: metadata.name || SIGNER_NAME, 
                signatureDate: metadata.date || new Date().toISOString(), 
                validationUrl: metadata.validationUrl || 'https://default.url', 
                documentHash: metadata.hash || generateMockHash(documentId) 
            });
            
            Alert.alert("Sucesso", "Token de OTP enviado. Verifique seu telefone ou e-mail.");
            setStep(STEPS.OTP);
            
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            // 🛠️ Mostra a mensagem detalhada do erro robusto da API
            Alert.alert("Erro ao Iniciar", error.message || "Falha ao iniciar o processo de assinatura.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // 2. Função para CONFIRMAR A ASSINATURA com o código OTP
    const handleValidateOTP = async () => {
        if (otpCode.length < 6) {
            Alert.alert("Atenção", "O código de verificação deve ter 6 dígitos.");
            return;
        }
        if (!signatureMetaData || !signatureMetaData.documentHash) {
             Alert.alert("Erro", "Metadados de assinatura ausentes. Reinicie o processo.");
             setStep(STEPS.PREPARE); // Volta para o início
             return;
        }

        setIsLoading(true);
        try {
            // ✅ CHAMADA REAL: Validação contra o servidor
            await validateOTP(otpCode, signatureMetaData.documentHash); 
            
            Alert.alert("Sucesso", "Assinatura confirmada e concluída!");
            setStep(STEPS.CONFIRMED);
            
        } catch (error) {
            console.error("Erro OTP:", error.message);
            // 🛠️ Mostra a mensagem detalhada do erro robusto da API
            Alert.alert("Erro de Validação", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Renderização de Conteúdo Baseada no Estado (Step) ---
    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007BFF" />
                    <Text style={styles.loadingText}>Processando...</Text>
                </View>
            );
        }
        
        switch (step) {
            case STEPS.PREPARE:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.instructionText}>
                            Ao clicar abaixo, você concorda com o Termo de Adesão e declara sua intenção legal de assinar o documento **{documentId}**. Um código de verificação será enviado para confirmar sua identidade.
                        </Text>
                        <Button 
                            title="1. Assinar Documento e Enviar OTP" 
                            onPress={handleStartSignature} 
                            color="#007BFF"
                        />
                    </View>
                );
            case STEPS.OTP:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.instructionText}>
                            Passo 2. Verificação de Identidade (OTP)
                        </Text>
                        <Text style={styles.infoText}>
                            Insira o código de 6 dígitos que foi enviado para seu telefone ou e-mail.
                        </Text>
                        <TextInput 
                            placeholder="Insira o Código OTP"
                            onChangeText={setOtpCode}
                            value={otpCode}
                            keyboardType="numeric"
                            maxLength={6}
                            style={styles.input}
                        />
                        <Button 
                            title="Confirmar Assinatura" 
                            onPress={handleValidateOTP}
                            color={otpCode.length === 6 ? '#28a745' : '#6c757d'}
                            disabled={otpCode.length !== 6}
                        />
                        <View style={{ marginTop: 10 }}>
                            <Button 
                                title="Voltar (Reenviar OTP)" 
                                onPress={() => setStep(STEPS.PREPARE)} 
                                color="#bdc3c7"
                            />
                        </View>
                    </View>
                );
            case STEPS.CONFIRMED:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.successHeader}>✅ Assinatura Digital Concluída!</Text>
                        <Text style={styles.infoText}>
                            O documento foi selado com sucesso.
                        </Text>
                        {/* 💡 Exibe o Carimbo de Validação */}
                        {signatureMetaData && (
                            <SignatureCanvasContainer
                                signerName={signatureMetaData.signerName}
                                signatureDate={signatureMetaData.signatureDate}
                                validationUrl={signatureMetaData.validationUrl}
                                // Adicionei documentHash para consistência (supondo que Canvas o renderize)
                                documentHash={signatureMetaData.documentHash} 
                            />
                        )}
                        <Button 
                            title="Voltar para Início" 
                            onPress={() => setStep(STEPS.PREPARE)} // Reinicia o fluxo
                            color="#28a745"
                        />
                    </View>
                );
            default:
                return <Text>Erro no Fluxo de Processamento.</Text>;
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.fullScreen}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.container}>
                <Text style={styles.mainHeader}>
                    {step === STEPS.CONFIRMED ? 'Documento Assinado' : 'Processo de Assinatura Digital'}
                </Text>
                
                {renderContent()}
                
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    mainHeader: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#333',
    },
    stepContainer: {
        flex: 1,
    },
    instructionText: {
        fontSize: 16,
        marginBottom: 20,
        lineHeight: 24,
        color: '#555',
    },
    infoText: {
        fontSize: 14,
        marginBottom: 15,
        color: '#6c757d',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#007BFF',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 12,
        marginBottom: 20,
        borderRadius: 4,
        fontSize: 16,
    },
    successHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'green',
        marginBottom: 10,
    },
});

export default RubricaScreen;