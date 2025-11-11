// Arquivo: VerificationScreen.js (FINAL COMPLETO E ESTÁVEL)

import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, Text, View, TextInput, Button, ScrollView, Alert,
    ActivityIndicator, TouchableOpacity, Linking, Platform 
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as DocumentPicker from 'expo-document-picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Buffer } from 'buffer';

import SignatureCanvasContainer from './SignatureCanvasContainer.js'; 

// --- Variáveis Globais ---
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1'; 
const SIGNER_NAME = 'Usuário de Teste'; 
const JWT_TRANSACTION_KEY = 'jwtToken'; // Chave de segurança no AsyncStorage

// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (API)
// =========================================================

function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

async function uriToBlob(uri) {
    try {
        const response = await fetch(uri);
        return await response.blob();
    } catch (error) {
        throw new Error("Falha ao preparar o arquivo para upload.");
    }
}

// 1. SOLICITA OTP E GERA JWT DE TRANSAÇÃO (ROTA PÚBLICA)
async function requestOTP(signerId, docId, userEmail) { 
    // ... (Lógica de API mantida)
    const response = await fetch(`${API_BASE_URL}/auth/request-otp`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerId, method: 'email', recipient: userEmail, documentId: docId }),
    });

    if (!response.ok) {
        let finalMessage = `Falha HTTP: ${response.status}. Falha ao enviar OTP.`;
        try {
            const isJson = response.headers.get('content-type')?.includes('application/json');
            const errorData = isJson ? await response.json() : await response.text();
            finalMessage = isJson ? (errorData.message || finalMessage) : finalMessage;
        } catch (e) {
             finalMessage = `Falha HTTP ${response.status}. Resposta da API ilegível.`;
        }
        throw new Error(finalMessage);
    }
    
    const responseData = await response.json();
    
    if (responseData.token) {
        await AsyncStorage.setItem(JWT_TRANSACTION_KEY, responseData.token);
    } else {
        console.warn('Backend não retornou o JWT após geração de OTP.');
    }
    
    return responseData; 
}


// =========================================================
// 🎯 SEÇÃO 3: TELA PRINCIPAL (VerificationScreen.js)
// =========================================================

const STEPS = {
    PREPARE: 'PREPARE',
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


// 🚩 CORREÇÃO: Removido o 'export default' para usar a exportação no final (Linha ~97)
function VerificationScreen({ route, navigation }) {
    
    // PARAMS
    const signerId = route.params?.signerId || 'USER_DEFAULT_ID';
    
    // --- Estados de Controle de Componente ---
    const [otpCode, setOtpCode] = useState(''); 
    const [templateId, setTemplateId] = useState(''); 
    const [docTitle, setDocTitle] = useState(''); 
    const [docId, setDocId] = useState('');
    const [uploadedDocumentUri, setUploadedDocumentUri] = useState(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '', data: null }); 
    const [flowStep, setFlowStep] = useState(STEPS.PREPARE);
    const [signatureMetaData, setSignatureMetaData] = useState(null); 
    const [otpSent, setOtpSent] = useState(false); // CRÍTICO: Controla se o OTP já foi solicitado

    // --- Efeitos e Lógica de Estado (Mantidos) ---
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
    
    // ⭐️ FUNÇÃO PARA ABRIR O SELETOR DE ARQUIVOS (Mantida)
    const pickDocument = async () => {
         try {
              const result = await DocumentPicker.getDocumentAsync({
                  type: 'application/pdf', copyToCacheDirectory: true,
              });
     
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
        if (!templateId) {
             setStatus({ message: "❌ Selecione o tipo de documento.", type: 'error' });
             return;
        }

        setIsLoading(true);
        try {
            const userEmail = await AsyncStorage.getItem('userEmail') || signerId; 
            
            // CHAMA API E SALVA JWT NO ASYNCSTORAGE
            const responseData = await requestOTP(signerId, docId, userEmail); 
            
            // MOCA METADADOS
            const mockHash = generateMockHash(docId + signerId); 
            setSignatureMetaData({ 
                signerName: SIGNER_NAME, signatureDate: new Date().toISOString(), 
                validationUrl: 'https://seuapp.com/validar', documentHash: mockHash 
            });
            
            Alert.alert("Sucesso", responseData.message || "Token de OTP enviado. Verifique seu telefone ou e-mail.");
            setStatus({ message: responseData.message || `Token de OTP enviado.`, type: 'success' });
            
            setOtpSent(true); 
            setFlowStep(STEPS.OTP); // Avança para a tela do Passo 2 (Input OTP)
            
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            Alert.alert("Erro", error.message || "Falha ao iniciar o processo de assinatura. Tente novamente.");
            setStatus({ message: `❌ ${error.message || 'Falha desconhecida.'}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    // 2. CONFIRMAÇÃO DO OTP E UPLOAD FINAL DO DOCUMENTO (Usa JWT e OTP)
    const assinarDocumentoFinal = async () => {
        
        if (flowStep !== STEPS.OTP) return;

        // VALIDAÇÕES
        if (!otpCode || otpCode.length !== 6 || !docTitle) {
             setStatus({ message: "❌ O código OTP e o Título do Documento são obrigatórios.", type: 'error' });
             return;
        }
        if (!signatureMetaData || !signatureMetaData.documentHash) {
             setStatus({ message: "❌ Hash de documento ausente. Reinicie a assinatura.", type: 'error' });
             return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            
            // 🔑 1. OBTÉM O JWT (CRÍTICO: Fonte da falha de autorização 401)
            const token = await AsyncStorage.getItem(JWT_TRANSACTION_KEY); 
            
            if (!token) {
                 throw new Error("Sessão expirada. Token de transação ausente. Reinicie o Passo 1.");
            }
            
            // 2. Prepara o FormData
            const finalDocIdToSend = String(docId || '').trim(); 
            
            const formData = new FormData();
            formData.append('signerId', signerId);
            formData.append('submittedOTP', otpCode); 
            formData.append('documentId', finalDocIdToSend); 
            formData.append('templateId', templateId); 
            formData.append('signerName', (await AsyncStorage.getItem('userEmail')) || SIGNER_NAME);
            formData.append('contractTitle', docTitle); 
            
            // 🚨 ANEXO DE ARQUIVOS (Onde o Multer/400 pode falhar)
            if (templateId === 'upload' && uploadedDocumentUri) {
                 formData.append('documentFile', {
                     uri: uploadedDocumentUri,
                     name: docTitle,
                     type: 'application/pdf',
                 });
            }
            // Envia um campo vazio para a Rubrica (signatureImage) para evitar erro 400 do Multer
            formData.append('signatureImage', ''); 

            // Requisição Final - PROTEÇÃO JWT (Onde o authMiddleware é ativado)
            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                 method: 'POST',
                 // ✅ CORREÇÃO: Envia o JWT no HEADER
                 headers: { 'Authorization': `Bearer ${token}` }, 
                 body: formData, // NENHUM Content-Type manual!
            });

            // 3. TRATAMENTO DE ERRO ROBUSTO
            if (!response.ok) {
                 let data = {};
                 try { data = await response.json(); } catch {}
                 
                 // 🎯 Retorna o erro real do backend (401 OTP, 403 Autorização, etc.)
                 throw new Error(data.error || data.message || `Falha HTTP ${response.status}. Verifique token/payload.`);
            }

            // SUCESSO
            await AsyncStorage.removeItem(JWT_TRANSACTION_KEY); // Limpa o token
            const data = await response.json(); 
            
            setSignatureMetaData(prev => ({ ...prev, 
                 signerName: data.signedBy || SIGNER_NAME,
                 signatureDate: data.signedAt || new Date().toISOString(),
                 validationUrl: data.validationUrl || prev.validationUrl,
                 documentHash: data.finalHash || prev.documentHash
            }));
            setStatus({ message: "✅ Assinatura concluída. Documento selado.", type: 'success' });
            setFlowStep(STEPS.CONFIRMED); 

        } catch (error) {
             console.error("Erro na requisição de assinatura:", error);
             setStatus({ message: `❌ ${error.message || "Erro de Conexão. Tente novamente."}`, type: 'error' });
        } finally {
             setIsLoading(false);
        }
    };


    // --- Renderização ---
    const renderStepContent = () => {
        if (isLoading) {
             return (
                 <View style={styles.loadingContainer}>
                     <ActivityIndicator size="large" color="#007BFF" />
                     <Text style={styles.loadingText}>Processando...</Text>
                 </View>
             );
        }
        
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
        
        return (
            <View style={styles.card}>
                <Text style={styles.header}>
                    {flowStep === STEPS.PREPARE ? 'Passo 1: Confirmação de Intenção' : 'Passo 2: Verificação OTP e Finalização'}
                </Text>
                
                {/* 1. SELETOR DE DOCUMENTOS / BOTÃO DE ENVIO OTP */}
                {flowStep === STEPS.PREPARE && (
                    <>
                        <Text style={styles.label}>Selecione o Documento:</Text>
                        <View style={styles.buttonGroup}>
                            <Button title="Contrato Padrão" onPress={() => setTemplateId('template-servico')} color={templateId === 'template-servico' ? '#007BFF' : '#bdc3c7'} />
                            <Button title="Upload PDF Próprio" onPress={() => setTemplateId('upload')} color={templateId === 'upload' ? '#007BFF' : '#bdc3c7'} />
                        </View>
                        {templateId === 'upload' && (
                            <View style={{ marginTop: 15, width: '100%' }}>
                                <Button title={uploadedDocumentUri ? `✅ PDF: ${docTitle}` : "BUSCAR ARQUIVO PDF"} onPress={pickDocument} color={uploadedDocumentUri ? '#28a745' : '#FF9800'} disabled={isLoading} />
                            </View>
                        )}
                        <View style={{ marginTop: 30 }}>
                             <Message message={status.message} type={status.type} />
                             {/* Botão Principal: Inicia Transação e Avança para o Passo 2 (OTP) */}
                             <Button title="1. Iniciar Assinatura e Enviar OTP" onPress={handleStartSignature} color={templateId ? '#007BFF' : '#6c757d'} disabled={!templateId || isLoading} />
                        </View>
                    </>
                )}


                {/* 2. CÓDIGO OTP (Habilitado após o Passo 1) */}
                {flowStep === STEPS.OTP && (
                    <View style={{ marginTop: 20 }}>
                         {/* 🚩 CORREÇÃO: Informação de status Pós-Envio */}
                         <Text style={styles.infoText}>
                             {otpSent ? 'Código enviado com sucesso. Insira o código abaixo:' : 'Aguardando envio do OTP...'}
                         </Text>

                        <Text style={styles.label}>Código OTP Recebido:</Text>
                        <TextInput
                            style={styles.input} 
                            placeholder={`Insira o Código OTP (6 dígitos)`}
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="numeric"
                            maxLength={6}
                            editable={!isLoading}
                        />
                        <Text style={styles.label}>Título do Documento:</Text>
                        <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={!isLoading} />

                        {templateId === 'upload' && uploadedDocumentUri && <Text style={styles.helperText}>PDF Selecionado: {docTitle}</Text>}
                        
                        <Message message={status.message} type={status.type} />

                        {/* Botão Finalizar */}
                        <View style={{ marginTop: 20 }}>
                            <Button 
                                title="2. FINALIZAR ASSINATURA" 
                                onPress={assinarDocumentoFinal} 
                                color={otpCode.length === 6 && docTitle ? "#28a745" : "#6c757d"} 
                                disabled={otpCode.length !== 6 || !docTitle || isLoading}
                            />
                        </View>
                        <View style={{ marginTop: 10 }}>
                             {/* Volta ao PREPARE, onde o botão de reenvio implícito está (handleStartSignature) */}
                             <Button title="Voltar (Reenviar OTP)" onPress={() => setFlowStep(STEPS.PREPARE)} color="#bdc3c7" disabled={isLoading} />
                        </View>
                    </View>
                )}

            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeContainer}> 
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                {renderStepContent()}
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