// Arquivo: RubricaScreen.js (FINAL COMPLETO E FUNCIONAL)

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
    Platform 
} from 'react-native';

// Importações removidas ou ajustadas para o fluxo simplificado
import SignatureCanvasContainer from './SignatureCanvasContainer.js'; // Componente Selo (se estiver em arquivo separado)
// REMOVIDO: import { Buffer } from 'buffer'; // Não é mais necessário aqui
// REMOVIDO: import * as DocumentPicker from 'expo-document-picker'; // Não é usado nesta tela

// --- MOCKS INSERIDOS DIRETAMENTE PARA RESOLVER ReferenceError ---
const TEST_OTP_CODE = '123456'; 

// 1. Função Mock Auxiliar
const generateMockHash = (data) => {
    // Usamos Math.random e uma fatia da data para simular o hash
    return `sha256-${Math.random().toString(36).substring(2, 12)}...`; 
};

// 2. MOCK uploadSignature (Simula a API)
const uploadSignature = async (intentionPayload, signerId) => { 
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    const mockHash = generateMockHash(intentionPayload);
    const now = new Date();
    return {
        name: `Assinante Mockado ${signerId}`,
        date: now.toISOString(),
        validationUrl: 'https://seusistema.com/verifica/...',
        hash: mockHash,
    };
};

// 3. MOCK validateOTP (Simula a API)
const validateOTP = async (otpCode, signatureHash) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    if (otpCode === TEST_OTP_CODE) { 
        return { success: true, message: "Assinatura validada e selada." };
    } else {
        throw new Error(`Código OTP inválido. Tente o código de teste: ${TEST_OTP_CODE}.`);
    }
};
// --- FIM DOS MOCKS ---


// --- Constantes de Estado ---
const STEPS = {
    PREPARE: 'PREPARE', // Iniciar a assinatura (envio da intenção)
    OTP: 'OTP',         // Validação com código
    CONFIRMED: 'CONFIRMED', // Assinatura finalizada
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
            
            // ✅ uploadSignature agora será encontrada no escopo superior
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
            
            Alert.alert("Sucesso", "Token de OTP enviado por SMS ou e-mail. Verifique a caixa de entrada.");
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
            // ✅ validateOTP agora será encontrada no escopo superior
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
                            Insira o código de 6 dígitos que foi enviado para seu telefone ou e-mail. (Código de teste: 123456)
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
                        {/* Exibe o Carimbo de Validação */}
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