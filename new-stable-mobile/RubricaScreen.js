// Arquivo: new-stable-mobile/RubricaScreen.js

import React, { useState } from 'react';
import { 
    View, 
    Text, 
    Button, 
    Alert, 
    ActivityIndicator, 
    TextInput, 
    StyleSheet,
    KeyboardAvoidingView, // Melhoria de UX para teclado
    Platform 
} from 'react-native';

// 🚨 IMPORTANTE: Crie estes arquivos em seus respectivos diretórios
import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 
//import { uploadSignature, validateOTP } from './services/apiService'; 

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
    // Guarda os dados necessários para exibir o Carimbo de Validação
    const [signatureMetaData, setSignatureMetaData] = useState(null); 

    // 1. Função para INICIAR A ASSINATURA e avançar para o OTP
    const handleStartSignature = async () => {
        setIsLoading(true);
        try {
            // Não há rubrica. O "Base64" é um placeholder para a intenção de assinar.
            const intentionPayload = `Intent_Sign_${documentId}_by_${signerId}`; 
            
            // 🚨 Chama o serviço de upload para iniciar o processo no backend
            const { name, date, validationUrl, hash } = await uploadSignature(
                intentionPayload, 
                signerId
            );

            // 💡 Salva os dados que serão usados no Carimbo e no OTP
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
            // O documentHash é essencial para vincular o OTP à transação correta
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
                            <SignatureCanvasConteiner
                                signerName={signatureMetaData.signerName}
                                signatureDate={signatureMetaData.signatureDate}
                                validationUrl={signatureMetaData.validationUrl}
                            />
                        )}
                    </View>
                );
            default:
                return <Text>Erro no Fluxo de Processamento.</Text>;
        }
    };

    return (
        // Garante que o input não seja obscurecido pelo teclado
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