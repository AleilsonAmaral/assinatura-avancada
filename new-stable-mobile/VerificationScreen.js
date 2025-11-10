// Arquivo: VerificationScreen.js (FINAL COM INTEGRAÇÃO DE API REAL)

import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    TextInput, 
    Button, 
    SafeAreaView,
    ScrollView, 
    Alert,
    ActivityIndicator,
    TouchableOpacity, 
    Linking, 
    Platform 
} from 'react-native';

// 🚨 Dependências do Fluxo
import * as DocumentPicker from 'expo-document-picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Buffer } from 'buffer';

// --- Variáveis Globais ---
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}
const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1'; 
const SIGNER_NAME = 'Usuário de Teste'; 


// =========================================================
// 🚨 SEÇÃO 1: FUNÇÕES DE SERVIÇO (INTEGRAÇÃO API REAL)
// =========================================================

// Função auxiliar (mantida para evitar ReferenceError no generateMockHash do uploadSignature)
function generateMockHash(data) {
    const combinedData = data + new Date().getTime();
    return `sha256-${Math.random().toString(36).substring(2, 12)}${btoa(combinedData).substring(0, 10)}`; 
}

// 1. INÍCIO DE ASSINATURA (SOLICITA OTP) - AGORA USA FETCH REAL
async function uploadSignature(intentionPayload, signerId) { 
    const response = await fetch(`${API_BASE_URL}/signature/start`, { // Endpoint Real
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentionPayload, signerId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro de resposta da API.' }));
        throw new Error(errorData.message || `Falha HTTP: ${response.status}. Falha ao enviar OTP.`);
    }
    
    // A API real deve retornar os metadados do selo (name, date, validationUrl, hash)
    return response.json(); 
}

// 2. VALIDAÇÃO DE OTP - AGORA USA FETCH REAL (SEM LÓGICA DE TESTE INTERNA)
async function validateOTP(otpCode, signatureHash) {
    // 🛑 REMOVIDO: A lógica de teste `if (otpCode === TEST_OTP_CODE)`
    const response = await fetch(`${API_BASE_URL}/signature/validate`, { // Endpoint Real
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode, signatureHash }),
    });

    const data = await response.json().catch(() => ({ message: 'Erro de resposta da API.' }));

    if (!response.ok || data.success === false) {
        // O erro agora virá do seu backend.
        throw new Error(data.message || `Validação OTP falhou. Verifique o código.`);
    }
    
    return data;
}

// ⭐️ FUNÇÃO AUXILIAR: Converte URI local em um Blob
async function uriToBlob(uri) {
    try {
        const response = await fetch(uri);
        return await response.blob();
    } catch (error) {
        throw new Error("Falha ao preparar o arquivo para upload.");
    }
}


// =========================================================
// 🎨 SEÇÃO 2: COMPONENTE DigitalStamp (Carimbo de Validação)
// =========================================================

const SignatureCanvasContainer = ({ 
    signerName, 
    signatureDate, 
    validationUrl,
    documentHash
}) => {
    const handlePressValidation = () => {
        if (validationUrl) {
            Linking.openURL(validationUrl).catch(err => console.error("Falha ao abrir URL:", err));
        }
    };

    const formatDate = (isoDate) => {
        try {
            const date = new Date(isoDate);
            return date.toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZoneName: 'short'
            });
        } catch (e) { return 'Data Inválida'; }
    };

    return (
        <View style={stampStyles.container}>
            <Text style={stampStyles.header}>Documento assinado digitalmente</Text>
            <Text style={stampStyles.name}>{signerName.toUpperCase()}</Text>
            <Text style={stampStyles.dataLabel}>
                Data: <Text style={stampStyles.dataValue}>{formatDate(signatureDate)}</Text>
            </Text>
            <TouchableOpacity onPress={handlePressValidation} style={stampStyles.linkContainer}>
                <Text style={stampStyles.linkText}>Verifique em</Text>
                <Text style={stampStyles.linkUrl}>{validationUrl}</Text>
            </TouchableOpacity>
            {documentHash && (
                <Text style={stampStyles.hashText}>
                    Hash: {documentHash.substring(0, 8)}...
                </Text>
            )}
        </View>
    );
};

const stampStyles = StyleSheet.create({
    container: { borderWidth: 2, borderColor: '#dc3545', padding: 15, backgroundColor: '#f8f9fa', borderRadius: 4, alignSelf: 'stretch', marginVertical: 15, },
    header: { fontSize: 13, fontWeight: 'bold', marginBottom: 5, color: '#343a40', textAlign: 'center', },
    name: { fontSize: 16, fontWeight: '900', color: '#000', marginTop: 4, },
    dataLabel: { fontSize: 12, marginTop: 4, color: '#6c757d', },
    dataValue: { fontWeight: 'bold', color: '#000', },
    linkContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ccc', },
    linkText: { fontSize: 11, color: '#6c757d', },
    linkUrl: { fontSize: 12, color: '#007bff', textDecorationLine: 'underline', fontWeight: 'bold', },
    hashText: { fontSize: 10, color: '#6c757d', marginTop: 4, }
});


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


export default function VerificationScreen({ route, navigation }) {
    
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
    const [signatureMetaData, setSignatureMetaData] = useState(null); // Dados para o Carimbo

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
    
    // Variáveis de Controle
    const isDocumentSelected = !!templateId; 
    const isTitleEntered = isDocumentSelected && docTitle.trim().length > 0 && docTitle !== 'Clique em Buscar PDF...';

    // ⭐️ FUNÇÃO PARA ABRIR O SELETOR DE ARQUIVOS (PDF)
    const pickDocument = async () => {
        // ... (Lógica de pickDocument)
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf', 
                copyToCacheDirectory: true,
            });

            if (result.canceled === false) {
                const selectedUri = result.assets[0].uri;
                const selectedName = result.assets[0].name;

                setUploadedDocumentUri(selectedUri);
                setDocTitle(selectedName); 
                setStatus({ message: `✅ Arquivo ${selectedName} carregado.`, type: 'success' });
            } else {
                setStatus({ message: "Seleção de arquivo cancelada.", type: 'info' });
            }
        } catch (error) {
            console.error("Erro ao buscar documento:", error);
            Alert.alert("Erro Nativo", "Falha ao abrir seletor de arquivos. Verifique o EAS Build.");
        }
    };
    
    // 1. INICIAR A ASSINATURA e avançar para o OTP (Simula a intenção)
    const handleStartSignature = async () => {
        // 🚨 VALIDAÇÃO: Pelo menos um tipo de documento deve ser selecionado.
        if (!templateId) {
              setStatus({ message: "❌ Selecione o tipo de documento (Padrão ou Upload).", type: 'error' });
              return;
        }

        setIsLoading(true);
        try {
            const intentionPayload = `Intent_Sign_${docId}_by_${signerId}`; 
            
            // ✅ CHAMADA REAL: Envia intenção e aguarda resposta
            const { name, date, validationUrl, hash } = await uploadSignature(
                intentionPayload, signerId
            );

            setSignatureMetaData({ signerName: name, signatureDate: date, validationUrl, documentHash: hash });
            
            // Mensagem atualizada para o usuário
            Alert.alert("Sucesso", "Token de OTP enviado. Verifique seu telefone ou e-mail.");
            setFlowStep(STEPS.OTP);
            
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            Alert.alert("Erro", "Falha ao iniciar o processo de assinatura. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };


    // 2. CONFIRMAÇÃO DO OTP E UPLOAD FINAL DO DOCUMENTO
    const assinarDocumentoFinal = async () => {
        
        // 🚨 O documento só pode ser assinado na etapa OTP
        if (flowStep !== STEPS.OTP) return;

        // VALIDAÇÕES
        if (templateId === 'upload' && !uploadedDocumentUri) {
            setStatus({ message: "❌ Selecione um arquivo PDF para upload.", type: 'error' });
            return;
        }
        if (!otpCode || otpCode.length !== 6 || !docTitle) {
            setStatus({ message: "❌ O código OTP e o Título do Documento são obrigatórios.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            // 1. Validação OTP (CHAMADA REAL)
            await validateOTP(otpCode, signatureMetaData.documentHash); 
            
            // 2. Continua com o Upload/Assinatura (Se o OTP for OK)
            const token = await AsyncStorage.getItem('jwtToken'); 
            const signerName = (await AsyncStorage.getItem('userEmail')) || SIGNER_NAME;
            const finalDocIdToSend = String(docId || '').trim(); 
            
            if (finalDocIdToSend.length === 0) throw new Error("ID do Documento ausente.");
            
            // 3. Prepara o FormData
            const formData = new FormData();
            formData.append('signerId', signerId);
            formData.append('submittedOTP', otpCode);
            formData.append('documentId', finalDocIdToSend); 
            formData.append('templateId', templateId); 
            formData.append('signerName', signerName);
            formData.append('contractTitle', docTitle); 
            
            // 🚨 SÓ ANEXA O PDF SE FOR FLUXO DE UPLOAD
            if (templateId === 'upload' && uploadedDocumentUri) {
                const documentBlob = await uriToBlob(uploadedDocumentUri); 
                formData.append('documentFile', documentBlob, docTitle); 
            }

            // Requisição Final
            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, 
                body: formData, 
            });

            // Tratamento de resposta
            let data;
            try { data = await response.json(); } catch (jsonError) { data = { message: `Erro HTTP ${response.status}. Servidor inacessível.` }; }

            if (response.ok) {
                setStatus({ message: "✅ Assinatura concluída. Navegando para Evidência.", type: 'success' });
                setFlowStep(STEPS.CONFIRMED); // Não navega, apenas atualiza a tela
            } else {
                setStatus({ message: `❌ Falha na Assinatura: ${data.message || 'Erro desconhecido.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro na requisição de assinatura:", error);
            // Se falhar no OTP, o status será atualizado pelo catch interno do validateOTP
            setStatus({ message: error.message || "Erro de Conexão. Tente novamente.", type: 'error' });
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
                        documentHash={signatureMetaData.hash} // Adicionamos o hash para o carimbo
                    />
                    <Button title="Ver Evidência (Navegar)" onPress={() => navigation.navigate('Evidence', { documentId: docId })} color="#007BFF" />
                </View>
            );
        }
        
        // Renderiza a Interface de Input/Assinatura (PREPARE e OTP)
        return (
            <View style={styles.card}>
                <Text style={styles.header}>
                    {flowStep === STEPS.PREPARE ? 'Passo 1: Confirmação de Intenção' : 'Passo 2: Verificação OTP e Finalização'}
                </Text>
                
                {/* 1. SELETOR DE DOCUMENTOS */}
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
                        {/* Botão de Iniciar Assinatura */}
                        <View style={{ marginTop: 30 }}>
                            <Button title="1. Iniciar Assinatura e Enviar OTP" onPress={handleStartSignature} color={templateId ? '#007BFF' : '#6c757d'} disabled={!templateId || isLoading} />
                        </View>
                    </>
                )}


                {/* 2. CÓDIGO OTP (Habilitado após o Passo 1) */}
                {flowStep === STEPS.OTP && (
                    <View style={{ marginTop: 20 }}>
                        <Text style={styles.label}>Código OTP Recebido:</Text>
                        <TextInput
                            style={styles.input} 
                            placeholder={`Insira o Código OTP (Será enviado pelo seu sistema)`}
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="numeric"
                            maxLength={6}
                        />
                        <Text style={styles.label}>Título do Documento:</Text>
                        <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={true} />

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
                             <Button title="Voltar (Reenviar OTP)" onPress={() => setFlowStep(STEPS.PREPARE)} color="#bdc3c7" />
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