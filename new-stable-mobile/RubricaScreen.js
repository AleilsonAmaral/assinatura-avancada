// Arquivo: RubricaScreen.js (FINAL COMPLETO E CORRIGIDO COM ASYNCSTORAGE)

import React, { useState } from 'react';
import { 
    StyleSheet, Text, View, Button, Alert, ActivityIndicator, 
    TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';

// Importações (Mantendo AsyncStorage, conforme solicitado)
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 

// --- Variáveis Globais (MOCK para Usuário/Documento) ---
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = 'Usuário de Teste'; 
const LOGGED_IN_USER_ID = 'USER_DEFAULT_ID_FROM_LOGIN'; 

// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (API)
// =========================================================

function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

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
 * 1. SOLICITAÇÃO DE OTP e GERAÇÃO de JWT (Passo de Envio do Código)
 * Rota pública que gera o JWT de Transação.
 */
async function requestOTP(intentionPayload, signerId) { 
    const response = await fetch(`${API_BASE_URL}/otp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Falha ao solicitar o OTP.');
        throw new Error(message);
    }
    
    return response.json(); 
}

/**
 * 2. VALIDAÇÃO DE OTP E FINALIZAÇÃO DA ASSINATURA (Passo de Confirmação)
 * 🔑 Requer o JWT de transação para autorizar a requisição.
 */
async function finalizeSignature(otpCode, signatureHash, jwtToken) {
    // 🛑 CRÍTICO: O JWT é enviado no header para autorizar a transação
    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}` // 🔑 AUTORIZAÇÃO DE SEGURANÇA
        },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Validação OTP falhou. Verifique o código.');
        throw new Error(message);
    }
    
    return response.json();
}

// =========================================================
// 🎯 SEÇÃO 2: TELA PRINCIPAL (RubricaScreen)
// =========================================================

// --- Constantes de Estado do Novo Fluxo ---
const STEPS = {
    PREPARE: 'PREPARE',         // Passo 1: Termos e Intenção
    REQUEST_OTP: 'REQUEST_OTP', // Passo 2: Enviar OTP e Inserir Código
    CONFIRMED: 'CONFIRMED',     // Passo 3: Carimbo Digital
};

const RubricaScreen = ({ signerId = LOGGED_IN_USER_ID, documentId = 'DOC_ABC_123' }) => {
    const [step, setStep] = useState(STEPS.PREPARE);
    const [isLoading, setIsLoading] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [signatureMetaData, setSignatureMetaData] = useState(null); 
    const [otpSent, setOtpSent] = useState(false); // 🚩 Novo: Controla se o código foi enviado

    // 1. Função que SOLICITA o OTP e Salva o JWT (Primeiro botão do Passo 2)
    const handleRequestOTP = async () => {
        setIsLoading(true);
        try {
            const intentionPayload = `Intent_Sign_${documentId}_by_${signerId}`; 
            
            // ✅ CHAMADA REAL: Solicita o OTP e recebe o JWT
            const responseData = await requestOTP(intentionPayload, signerId);

            // 🔑 ALTERAÇÃO: Salva o JWT de Transação no AsyncStorage
            if (responseData.token) {
                await AsyncStorage.setItem('jwtToken', responseData.token);
            } else {
                 throw new Error("API não retornou o token de transação (JWT).");
            }

            // Mock de metadados
            setSignatureMetaData({ 
                signerName: responseData.name || SIGNER_NAME, 
                signatureDate: new Date().toISOString(), 
                validationUrl: responseData.validationUrl || 'https://default.url', 
                documentHash: responseData.hash || generateMockHash(documentId) 
            });
            
            Alert.alert("Sucesso", "Token de OTP enviado. Por favor, insira o código abaixo.");
            setOtpSent(true); 
            
        } catch (error) {
            console.error("Erro ao solicitar OTP:", error);
            Alert.alert("Erro ao Enviar OTP", error.message || "Falha ao iniciar o processo de assinatura.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // 2. Função para CONFIRMAR OTP E FINALIZAR ASSINATURA (Segundo botão do Passo 2)
    const handleFinalizeSignature = async () => {
        // Validações
        if (otpCode.length < 6 || !signatureMetaData || !signatureMetaData.documentHash) {
             Alert.alert("Erro", "Campos ausentes ou metadados inválidos.");
             return;
        }

        setIsLoading(true);
        try {
            // 🔑 1. OBTÉM O JWT de Transação (Salvo no Passo de Envio)
            const token = await AsyncStorage.getItem('jwtToken');
            if (!token) {
                // 🛑 Falha de Autorização: Se o token for nulo, a API rejeitará
                throw new Error("Sessão expirada. Token de transação ausente. Reinicie.");
            }
            
            // ✅ CHAMADA FINAL: Validação e Finalização usando o JWT e o OTP
            await finalizeSignature(otpCode, signatureMetaData.documentHash, token); 
            
            // 🧹 LIMPEZA: Remove o JWT da transação (Segurança/Limpeza)
            await AsyncStorage.removeItem('jwtToken'); 
            
            Alert.alert("Sucesso", "Assinatura confirmada e concluída!");
            setStep(STEPS.CONFIRMED);
            
        } catch (error) {
            console.error("Erro Finalizar Assinatura:", error.message);
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
                            Passo 1. Termos e Intenção de Assinatura
                        </Text>
                        <Text style={styles.infoText}>
                            Leia atentamente o Termo de Adesão e o documento **{documentId}**. Ao prosseguir, você concorda com o Termo e será enviado um código de verificação (OTP).
                        </Text>
                        <Button 
                            title="Prosseguir para Verificação" 
                            onPress={() => setStep(STEPS.REQUEST_OTP)} 
                            color="#007BFF"
                        />
                    </View>
                );
            case STEPS.REQUEST_OTP:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.instructionText}>
                            Passo 2. Envio e Verificação de OTP
                        </Text>
                        
                        {/* 🔄 Botão 1: SOLICITAR OTP (Ação de Envio) */}
                        <Button 
                            title={otpSent ? "Reenviar Código OTP" : "1. Assinar Documento e Enviar OTP"} 
                            onPress={handleRequestOTP} 
                            color={otpSent ? '#FF9800' : '#007BFF'} 
                            disabled={isLoading}
                        />

                        {otpSent && ( // Componentes aparecem somente após o envio bem-sucedido
                            <>
                                <Text style={[styles.infoText, { marginTop: 20 }]}>
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
                                {/* 🔄 Botão 2: CONFIRMAR OTP E FINALIZAR (Ação de Verificação/Finalização) */}
                                <Button 
                                    title="2. Confirmar e Finalizar Assinatura" 
                                    onPress={handleFinalizeSignature}
                                    color={otpCode.length === 6 ? '#28a745' : '#6c757d'}
                                    disabled={otpCode.length !== 6 || isLoading}
                                />
                            </>
                        )}
                        <View style={{ marginTop: 20 }}>
                             <Button 
                                 title="Voltar ao Início" 
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
                        {signatureMetaData && (
                            <SignatureCanvasContainer
                                signerName={signatureMetaData.signerName}
                                signatureDate={signatureMetaData.signatureDate}
                                validationUrl={signatureMetaData.validationUrl}
                                documentHash={signatureMetaData.documentHash} 
                            />
                        )}
                        <Button 
                            title="Voltar para Início" 
                            onPress={() => setStep(STEPS.PREPARE)}
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
                <ScrollView contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled">
                    {renderContent()}
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
};

// ... (Styles Mantidos)
const styles = StyleSheet.create({
    fullScreen: { flex: 1 },
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    mainHeader: { fontSize: 22, fontWeight: 'bold', marginBottom: 30, color: '#333' },
    stepContainer: { flex: 1 },
    instructionText: { fontSize: 16, marginBottom: 20, lineHeight: 24, color: '#555' },
    infoText: { fontSize: 14, marginBottom: 15, color: '#6c757d' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#007BFF' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 20, borderRadius: 4, fontSize: 16 },
    successHeader: { fontSize: 18, fontWeight: 'bold', color: 'green', marginBottom: 10 },
});

export default RubricaScreen;