// Arquivo: RubricaScreen.js (FINAL COMPLETO E CORRIGIDO COM AUTORIZAÇÃO)

import React, { useState } from 'react';
import { 
    StyleSheet, Text, View, Button, Alert, ActivityIndicator, 
    TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage'; 
import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 

// --- Variáveis Globais ---
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = 'Usuário de Teste'; 
const LOGGED_IN_USER_ID = 'USER_DEFAULT_ID_FROM_LOGIN'; 
const JWT_LOGIN_KEY = 'jwtToken'; // Chave salva no LoginScreen

// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (API)
// =========================================================

function generateMockHash(data) { /* ... lógica mantida ... */
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

async function getApiErrorMessage(response, defaultMessage) { /* ... lógica mantida ... */
    let finalMessage = defaultMessage || `Falha HTTP: ${response.status}.`;
    
    try {
        const isJson = response.headers.get('content-type')?.includes('application/json');
        const errorData = isJson ? await response.json() : await response.text();
        finalMessage = isJson ? (errorData.message || finalMessage) : finalMessage;
    } catch (e) {
         finalMessage = `Falha HTTP ${response.status}. Resposta da API ilegível.`;
    }
    return finalMessage;
}


/**
 * 1. SOLICITAÇÃO DE OTP e GERAÇÃO de JWT (CORRIGIDA PARA AUTORIZAÇÃO)
 * @param {string} loggedInToken - O JWT do Login (Necessário para o authMiddleware)
 */
async function requestOTP(intentionPayload, signerId, loggedInToken) { 
    // 🔑 O token de LOGIN é enviado para autorizar a requisição de criação de transação
    const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loggedInToken}` // 🔑 AUTORIZAÇÃO DE LOGIN
        },
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Falha ao solicitar o OTP.');
        throw new Error(message);
    }
    
    const responseData = await response.json();
    
    // 🔑 SALVA O JWT de transação (retornado pela API)
    if (responseData.token) {
        await AsyncStorage.setItem(JWT_LOGIN_KEY, responseData.token); // Reutilizando a chave para o JWT de Transação
    } else {
        console.warn('Backend não retornou o JWT após geração de OTP.');
    }
    
    return responseData; 
}

/**
 * 2. VALIDAÇÃO DE OTP E FINALIZAÇÃO DA ASSINATURA 
 */
async function finalizeSignature(otpCode, signatureHash, jwtToken) {
    // ... (Lógica mantida, usando jwtToken para a rota protegida)
    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}` // 🔑 JWT DE TRANSAÇÃO
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

const STEPS = {
    PREPARE: 'PREPARE', 
    OTP: 'OTP',         // Passo 2: Campo de Código e Finalização
    CONFIRMED: 'CONFIRMED', 
};

// ... (Componente Message mantido)

const RubricaScreen = ({ signerId = LOGGED_IN_USER_ID, documentId = 'DOC_ABC_123' }) => {
    // ... (Estados mantidos)
    const [step, setStep] = useState(STEPS.PREPARE);
    const [isLoading, setIsLoading] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [signatureMetaData, setSignatureMetaData] = useState(null); 
    const [otpSent, setOtpSent] = useState(false); 

    // ... (Função handleStartSignature Corrigida Abaixo)
    const handleStartSignature = async () => {
        if (!documentId) {
             Alert.alert("Erro", "ID do Documento ausente.");
             return;
        }

        setIsLoading(true);
        try {
            // 🔑 PASSO CRÍTICO: LER O JWT DE LOGIN/SESSÃO DO STORAGE
            const loggedInToken = await AsyncStorage.getItem(JWT_LOGIN_KEY);
            
            if (!loggedInToken) {
                // Navegar de volta se a sessão expirou
                Alert.alert("Sessão Expirada", "Faça login novamente para iniciar a assinatura.");
                throw new Error("Token de Login ausente. Acesso Negado.");
            }
            
            const userEmail = await AsyncStorage.getItem('userEmail') || signerId; 
            
            // 🛠️ CHAMADA AGORA AUTORIZADA com o JWT de Login
            const intentionPayload = `Intent_Sign_${documentId}_by_${signerId}`;
            const responseData = await requestOTP(intentionPayload, signerId, loggedInToken); 
            
            // ... (Mock e Metadados mantidos)
            const mockHash = generateMockHash(documentId + signerId); 
            setSignatureMetaData({ 
                signerName: SIGNER_NAME, signatureDate: new Date().toISOString(), 
                validationUrl: 'https://seuapp.com/validar', documentHash: mockHash 
            });
            
            Alert.alert("Sucesso", responseData.message || "Token de OTP enviado. Por favor, insira o código abaixo.");
            setOtpSent(true); 
            setStep(STEPS.OTP); 
            
        } catch (error) {
            console.error("Erro ao solicitar OTP:", error);
            Alert.alert("Erro ao Enviar OTP", error.message || "Falha ao iniciar o processo de assinatura.");
        } finally {
            setIsLoading(false);
        }
    };


    // 2. CONFIRMAÇÃO DO OTP E UPLOAD FINAL DO DOCUMENTO (Usa JWT e OTP)
    const handleFinalizeSignature = async () => {
        
        if (step !== STEPS.OTP) return;

        // Validações mantidas
        if (otpCode.length < 6 || !signatureMetaData || !signatureMetaData.documentHash) {
             Alert.alert("Erro", "Campos ausentes ou inválidos.");
             return;
        }

        setIsLoading(true);
        try {
            // 🔑 1. OBTÉM O JWT de Transação (Salvo no Passo 1)
            const token = await AsyncStorage.getItem(JWT_LOGIN_KEY); 
            
            if (!token) {
                 throw new Error("Sessão expirada. Token de transação ausente. Reinicie o Passo 1.");
            }
            
            // ✅ CHAMADA FINAL: Validação e Finalização usando o JWT e o OTP
            await finalizeSignature(otpCode, signatureMetaData.documentHash, token); 
            
            // 🧹 LIMPEZA: Remove o JWT da transação
            await AsyncStorage.removeItem(JWT_LOGIN_KEY); 
            
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
            // ... (Lógica de Loading)
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
                                 onPress={() => {
                                     setOtpSent(false); // Reinicia o estado para PREPARE
                                     setStep(STEPS.PREPARE); 
                                 }} 
                                 color="#bdc3c7"
                             />
                        </View>
                    </View>
                );
            case STEPS.CONFIRMED:
                // ... (Lógica de Renderização CONFIRMED mantida)
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