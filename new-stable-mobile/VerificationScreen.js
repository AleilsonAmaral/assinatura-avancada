// Arquivo: VerificationScreen.js (FINAL CORRIGIDO)

import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, Text, View, TextInput, Button, ScrollView, Alert,
    ActivityIndicator, TouchableOpacity, Linking, Platform, KeyboardAvoidingView 
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as DocumentPicker from 'expo-document-picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Buffer } from 'buffer';
import * as SignatureService from './SignatureService.js'; 

import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 
// Importe a Picker do React Native se for usar um dropdown.
// Importe a Picker de '@react-native-picker/picker' se estiver usando Expo/RN mais recente.

// --- Variáveis Globais ---
if (typeof global.Buffer === 'undefined') { global.Buffer = Buffer; }
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1'; 
const SIGNER_NAME = 'Usuário de Teste'; 
const JWT_TRANSACTION_KEY = 'jwtToken'; 
const JWT_LOGIN_KEY = 'jwtToken'; 

// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (API) - Mocks/Assumidas
// NOTA: Estas funções devem ser implementadas no SignatureService.js
// =========================================================

function generateMockHash(data) { return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(data).substring(0, 10)}`; }
async function requestOTP(signerId, docId, recipient, method, loggedInToken) { 
    // MOCK para evitar erro de referência. O SignatureScreen.js lida com a chamada real.
    console.log(`[Mock OTP] Solicitando para ${recipient}...`);
    // Simula o salvamento do JWT de transação que viria do backend:
    await AsyncStorage.setItem(JWT_TRANSACTION_KEY, 'MOCK_JWT_TRANSACAO_CURTA');
    return { message: 'Token enviado mockado!', token: 'MOCK_JWT_TRANSACAO_CURTA' }; 
}
const finalizeDocumentSignature = async (signerId, docId, docTitle, templateId, uploadedDocumentUri, otpCode, token) => { 
    // Chamada real seria feita aqui, usando o SignatureService.js
    console.log('[Mock Finalize] Assinando com OTP:', otpCode);
    return { 
        message: 'Assinatura concluída.', 
        signedBy: SIGNER_NAME, 
        finalHash: generateMockHash(docId + otpCode) 
    }; 
};


// =========================================================
// 🎯 SEÇÃO 3: TELA PRINCIPAL (VerificationScreen.js)
// =========================================================

const STEPS = {
    PREPARE: 'PREPARE', // Seleção de Documento
    OTP: 'OTP', 
    CONFIRMED: 'CONFIRMED',
};

const Message = ({ message, type }) => {
    if (!message) return null;
    const color = type === 'success' ? '#28a745' : (type === 'error' ? '#dc3545' : '#007BFF');
    return (
        <View style={{ marginTop: 10, padding: 10, backgroundColor: color + '20', borderColor: color, borderWidth: 1, borderRadius: 5 }}>
            <Text style={{ color: color, fontWeight: 'bold' }}>{message}</Text>
        </View>
    );
};


function VerificationScreen({ route, navigation }) {
    
    // 🔑 RECEBENDO PARÂMETROS DA ROTA
    const signerId = route.params?.signerId; 
    const otpRecipient = route.params?.otpRecipient; 
    const otpMethod = route.params?.otpMethod; 
    const isDataPresent = signerId && otpRecipient && otpMethod;
    
    // --- Estados de Controle de Componente ---
    const [otpCode, setOtpCode] = useState(''); 
    const [templateId, setTemplateId] = useState(''); 
    const [docTitle, setDocTitle] = useState(''); 
    const [docId, setDocId] = useState('');
    const [uploadedDocumentUri, setUploadedDocumentUri] = useState(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '', data: null }); 
    
    // 🔑 CORREÇÃO CRÍTICA: Forçamos o início em PREPARE para garantir que a seleção de documentos seja exibida.
    const [flowStep, setFlowStep] = useState(STEPS.PREPARE);
    const [signatureMetaData, setSignatureMetaData] = useState(null); 
    const [otpSent, setOtpSent] = useState(false); 

    // --- Efeitos e Lógica de Estado ---
    useEffect(() => {
        setUploadedDocumentUri(null); 
        if (templateId === 'template-servico') {
            setDocTitle('Contrato de Serviço Padrão (V1.0)'); 
            setDocId('TPL-SERV-' + Date.now().toString().slice(-10));
        } else if (templateId === 'upload') {
            setDocTitle('Clique em Buscar PDF...');
            setDocId('USER-UP-' + Date.now().toString().slice(-10));
        } else if (!templateId) {
            setDocTitle('');
            setDocId('');
        }
    }, [templateId]);
    
    // ⭐️ FUNÇÃO PARA ABRIR O SELETOR DE ARQUIVOS
    const pickDocument = async () => { 
        try {
             const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, });
             if (result.canceled === false) {
                 const { uri: selectedUri, name: selectedName } = result.assets[0];
                 setUploadedDocumentUri(selectedUri);
                 setDocTitle(selectedName); 
                 setStatus({ message: `✅ Arquivo ${selectedName} carregado.`, type: 'success' });
             } else {
                 setStatus({ message: "Seleção de arquivo cancelada.", type: 'info' });
             }
        } catch (error) {
             Alert.alert("Erro Nativo", "Falha ao abrir seletor de arquivos.");
        }
    };


    // 1. INICIAR A ASSINATURA e avançar para o OTP (Gera JWT)
    const handleStartSignature = async () => {
        
        // 🚨 VALIDAÇÃO DE DOCUMENTO
       if (!templateId) {
             setStatus({ message: "❌ Selecione o tipo de documento.", type: 'error' });
             return;
        }
        if (templateId === 'upload' && !uploadedDocumentUri) {
             setStatus({ message: "❌ Por favor, carregue o arquivo PDF próprio.", type: 'error' });
             return;
        }

        // 🔑 VERIFICAÇÃO FINAL: Garante que os dados de CPF/Método vieram da rota anterior
        if (!isDataPresent) {
             Alert.alert("Erro de Fluxo", "Dados do signatário (CPF/Destinatário) ausentes. Retornando ao Passo 1.");
             navigation.navigate('Signature'); 
             return;
        }

        setIsLoading(true);
        try {
            const loggedInToken = await AsyncStorage.getItem(JWT_LOGIN_KEY);
            
            if (!loggedInToken) {
                Alert.alert("Sessão Expirada", "Faça login novamente para iniciar a assinatura.");
                navigation.navigate('Login');
                return;
            }
            
            // CHAMA MOCK API AUTORIZADA (apenas para simulação de envio de OTP)
            const responseData = await requestOTP(signerId, docId, otpRecipient, otpMethod, loggedInToken); 
            
            // MOCA METADADOS DE ASSINATURA (temporário)
            const mockHash = generateMockHash(docId + signerId); 
            setSignatureMetaData({ 
                signerName: SIGNER_NAME, signatureDate: new Date().toISOString(), 
                validationUrl: 'https://seuapp.com/validar', documentHash: mockHash 
            });
            
            Alert.alert("Sucesso", responseData.message || "Token de OTP enviado. Verifique seu e-mail.");
            setStatus({ message: responseData.message || `Token de OTP enviado.`, type: 'success' });
            
            setOtpSent(true); 
            setFlowStep(STEPS.OTP); // Avança para a tela do Passo 2 (Input OTP)
            
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            setStatus({ message: `❌ ${error.message || 'Falha desconhecida.'}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    // 2. CONFIRMAÇÃO DO OTP E UPLOAD FINAL DO DOCUMENTO
    const handleAssinarDocumentoFinal = async () => {
        
        if (flowStep !== STEPS.OTP) return;

        // VALIDAÇÕES
        if (!otpCode || otpCode.length !== 6 || !docTitle) {
             setStatus({ message: "❌ O código OTP e o Título do Documento são obrigatórios.", type: 'error' });
             return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            // Usa o JWT de transação que foi salvo no passo 1 (requestOTP)
            const token = await AsyncStorage.getItem(JWT_TRANSACTION_KEY); 
            
            if (!token) { throw new Error("Sessão expirada. Token de transação ausente. Reinicie o Passo 1."); }
            
            // ✅ CHAMADA FINAL: Passa todos os dados coletados/armazenados para a função de serviço
            const result = await finalizeDocumentSignature(
                signerId, docId, docTitle, templateId, uploadedDocumentUri, otpCode, token
            );
            
            // SUCESSO
            setSignatureMetaData(prev => ({ ...prev, 
                 signerName: result.signedBy || SIGNER_NAME,
                 signatureDate: result.signedAt || new Date().toISOString(),
                 validationUrl: result.validationUrl || prev.validationUrl,
                 documentHash: result.finalHash || prev.documentHash
            }));

            Alert.alert("Sucesso", result.message || "Assinatura concluída.");
            setStatus({ message: "✅ Assinatura concluída. Documento selado.", type: 'success' });
            setFlowStep(STEPS.CONFIRMED); 

        } catch (error) {
             setStatus({ message: `❌ ${error.message || "Erro de Conexão. Tente novamente."}`, type: 'error' });
        } finally {
             setIsLoading(false);
        }
    };


    // --- Renderização ---
    const renderContent = () => {
        if (isLoading) { return ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007BFF" /><Text style={styles.loadingText}>Processando...</Text></View> ); }
        
        if (flowStep === STEPS.CONFIRMED && signatureMetaData) { 
             return (
                 <View style={styles.card}>
                     <Text style={styles.successHeader}>✅ Assinatura Digital Concluída!</Text>
                     <Text style={styles.infoText}>O documento foi selado com sucesso e está disponível para download.</Text>
                     <SignatureCanvasContainer
                         signerName={signatureMetaData.signerName}
                         signatureDate={signatureMetaData.signatureDate}
                         validationUrl={signatureMetaData.validationUrl}
                         documentHash={signatureMetaData.documentHash}
                     />
                     {navigation && <Button title="Ver Evidência (Navegar)" onPress={() => navigation.navigate('Evidence', { documentId: docId })} color="#007BFF" />}
                 </View>
             );
        }
        
        // ESTADO PADRÃO: SELEÇÃO DE DOCUMENTOS (AGORA O PADRÃO)
        if (flowStep === STEPS.PREPARE) {
             return (
                 <View style={styles.card}>
                     <Text style={styles.header}>Passo 1: Confirmação de Intenção</Text>
                     
                     <Text style={styles.label}>Selecione o Documento:</Text>
                     <View style={styles.buttonGroup}>
                         {/* BOTÕES DE SELEÇÃO DE FLUXO */}
                         <Button title="CONTRATO PADRÃO" onPress={() => setTemplateId('template-servico')} color={templateId === 'template-servico' ? '#007BFF' : '#bdc3c7'} />
                         <Button title="CARREGAR PDF PRÓPRIO" onPress={() => setTemplateId('upload')} color={templateId === 'upload' ? '#007BFF' : '#dc3545'} />
                     </View>
                     
                     {/* INPUT/BOTÃO DE UPLOAD CONDICIONAL */}
                     {templateId === 'upload' && (
                         <View style={{ marginTop: 15, width: '100%' }}>
                             <Button 
                                 title={uploadedDocumentUri ? `✅ PDF: ${docTitle}` : "BUSCAR ARQUIVO PDF"} 
                                 onPress={pickDocument} 
                                 color={uploadedDocumentUri ? '#28a745' : '#FF9800'} 
                                 disabled={isLoading} 
                             />
                             {/* TÍTULO DO DOCUMENTO */}
                             <Text style={styles.label}>Título do Documento:</Text>
                             <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={!isLoading} />
                         </View>
                     )}

                     {/* INPUT DE TÍTULO PARA TEMPLATE PADRÃO */}
                     {templateId === 'template-servico' && (
                         <View style={{ marginTop: 15, width: '100%' }}>
                             <Text style={styles.label}>Título do Contrato Padrão:</Text>
                             <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={!isLoading} />
                         </View>
                     )}
                     
                     <View style={{ marginTop: 30 }}>
                         <Message message={status.message} type={status.type} />
                         {/* Botão Principal: Inicia Transação e ENCAMINHA para o Passo 2 (OTP) */}
                         <Button 
                             title="1. INICIAR ASSINATURA E ENVIAR OTP" 
                             onPress={handleStartSignature} 
                             color={templateId ? '#007BFF' : '#6c757d'} 
                             disabled={!templateId || isLoading || (templateId === 'upload' && !uploadedDocumentUri)} 
                         />
                     </View>
                 </View>
             );
        }

        // ESTADO DE VERIFICAÇÃO OTP (Após o envio bem-sucedido)
        if (flowStep === STEPS.OTP) {
             return (
                 <View style={styles.card}>
                     <Text style={styles.header}>Passo 2: Verificação OTP e Finalização</Text>
                     
                      <Text style={styles.infoText}>
                          {otpSent ? `Código enviado com sucesso para ${otpRecipient || 'o destinatário'}. Insira o código abaixo:` : 'Aguardando envio do OTP...'}
                      </Text>

                     <Text style={styles.label}>Código OTP Recebido:</Text>
                     <TextInput
                         style={styles.input} value={otpCode} onChangeText={setOtpCode}
                         keyboardType="numeric" maxLength={6} editable={!isLoading}
                     />
                     
                     {/* 💡 AQUI: Renderizamos apenas o título para referência, mas ele não é editável */}
                     <Text style={styles.label}>Título do Documento (Confirmação):</Text>
                     <Text style={styles.input}>{docTitle}</Text>


                     <Message message={status.message} type={status.type} />

                     {/* Botão Finalizar */}
                     <View style={{ marginTop: 20 }}>
                         <Button 
                             title="2. FINALIZAR ASSINATURA" 
                             onPress={handleAssinarDocumentoFinal} 
                             color={otpCode.length === 6 && docTitle ? "#28a745" : "#6c757d"} 
                             disabled={otpCode.length !== 6 || !docTitle || isLoading}
                         />
                     </View>
                     <View style={{ marginTop: 10 }}>
                          <Button title="Voltar (Reenviar OTP)" onPress={() => setFlowStep(STEPS.PREPARE)} color="#bdc3c7" disabled={isLoading} />
                     </View>
                 </View>
             );
        }
        
        return <Text>Erro no Fluxo de Processamento.</Text>;
    };

    return (
        <SafeAreaView style={styles.safeContainer}> 
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                {renderContent()}
            </ScrollView>
        </SafeAreaView>
    );
}

// ... (Styles mantidos)
const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f8f9fa', },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, },
    card: { width: '90%', maxWidth: 700, backgroundColor: '#fff', padding: 30, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 8, },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#007BFF', textAlign: 'center', },
    successHeader: { fontSize: 22, fontWeight: 'bold', color: 'green', marginBottom: 10, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 5, color: '#343a40', },
    input: { height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, width: '100%', backgroundColor: '#fff', },
    buttonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 200, },
    loadingText: { marginTop: 10, color: '#007BFF', },
    infoText: { fontSize: 16, marginBottom: 15, color: '#6c757d', textAlign: 'center' }
});

export default VerificationScreen;