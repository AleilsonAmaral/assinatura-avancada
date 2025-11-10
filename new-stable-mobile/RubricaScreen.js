// Arquivo: RubricaScreen.js (FINAL COM INTEGRAÇÃO DE API REAL)

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
    SafeAreaView, // Mantido para o layout
    ScrollView,
    TouchableOpacity,
    Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// --- Variáveis Globais (Mínimas para produção) ---
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = 'Usuário de Teste'; 


// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (INTEGRAÇÃO API REAL)
// =========================================================

// Função auxiliar para simular o hash (Backend fará este cálculo)
function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

// 1. INÍCIO DE ASSINATURA (SOLICITA OTP) - AGORA USA FETCH REAL
async function uploadSignature(intentionPayload, signerId) { 
    const response = await fetch(`${API_BASE_URL}/signature/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro de resposta da API.' }));
        throw new Error(errorData.message || `Falha HTTP: ${response.status}. Falha ao enviar OTP.`);
    }
    
    // A API real deve retornar os metadados
    return response.json(); 
}

// 2. VALIDAÇÃO DE OTP - AGORA USA FETCH REAL (SEM LÓGICA DE TESTE INTERNA)
async function validateOTP(otpCode, signatureHash) {
    const response = await fetch(`${API_BASE_URL}/signature/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    const data = await response.json().catch(() => ({ message: 'Erro de resposta da API.' }));

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Validação OTP falhou. Verifique o código.`);
    }
    
    return data;
}

// ⭐️ FUNÇÃO AUXILIAR: Converte URI local em um Blob (Se necessário para o upload, caso use este componente)
async function uriToBlob(uri) {
    const response = await fetch(uri);
    return await response.blob();
}


// =========================================================
// 🎨 SEÇÃO 2: COMPONENTE DigitalStamp (Carimbo de Validação) - NECESSÁRIO NO FLUXO
// (O componente completo SignatureCanvasContainer deve ser importado se estiver em outro arquivo)
// Este é um mock simples para garantir que a renderização funcione.
const SignatureCanvasContainer = ({ signerName, signatureDate, validationUrl }) => {
    const handlePressValidation = () => {
        if (validationUrl) {
            Linking.openURL(validationUrl).catch(err => Alert.alert("Erro", "Falha ao abrir URL."));
        }
    };
    const formatDate = (isoDate) => {
        try { return new Date(isoDate).toLocaleDateString('pt-BR'); } catch (e) { return 'Data Inválida'; }
    };
    
    return (
        <View style={stampStyles.container}>
            <Text style={stampStyles.header}>Documento assinado digitalmente</Text>
            <Text style={stampStyles.name}>{signerName.toUpperCase()}</Text>
            <Text style={stampStyles.dataLabel}>Data: {formatDate(signatureDate)}</Text>
            <TouchableOpacity onPress={handlePressValidation} style={stampStyles.linkContainer}>
                <Text style={stampStyles.linkUrl}>Verifique aqui</Text>
            </TouchableOpacity>
        </View>
    );
};
const stampStyles = StyleSheet.create({
    container: { borderWidth: 2, borderColor: '#dc3545', padding: 15, marginVertical: 15, },
    header: { fontSize: 13, fontWeight: 'bold', marginBottom: 5, color: '#343a40', textAlign: 'center', },
    name: { fontSize: 16, fontWeight: '900', color: '#000', marginTop: 4, },
    dataLabel: { fontSize: 12, marginTop: 4, color: '#6c757d', },
    linkContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#ccc', },
    linkUrl: { fontSize: 12, color: '#007bff', textDecorationLine: 'underline', fontWeight: 'bold', },
});

// =========================================================
// 🎯 SEÇÃO 3: TELA PRINCIPAL (RubricaScreen.js)
// =========================================================

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
            
            // ✅ CHAMADA REAL
            const { name, date, validationUrl, hash } = await uploadSignature(
                intentionPayload, 
                signerId
            );

            setSignatureMetaData({ 
                signerName: name, 
                signatureDate: date, 
                validationUrl, 
                documentHash: hash 
            });
            
            Alert.alert("Sucesso", "Token de OTP enviado. Verifique seu telefone ou e-mail.");
            setStep(STEPS.OTP);
            
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            Alert.alert("Erro", "Falha ao iniciar o processo de assinatura. Tente novamente.");
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
        setIsLoading(true);
        try {
            // ✅ CHAMADA REAL: Validação contra o servidor
            await validateOTP(otpCode, signatureMetaData.documentHash); 
            
            setStep(STEPS.CONFIRMED);
            
        } catch (error) {
            console.error("Erro OTP:", error.message);
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
                            Ao clicar abaixo, você concorda com o Termo de Adesão e declara sua intenção legal de assinar o documento. Um código de verificação será enviado para confirmar sua identidade.
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
                            disabled={otpCode.length !== 6} // Desabilita se incompleto
                        />
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