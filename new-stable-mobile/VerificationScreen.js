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
    ActivityIndicator
} from 'react-native';
// 🚨 Importações corrigidas
import * as DocumentPicker from 'expo-document-picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// 🚨 NOVO: Importação do Buffer para Polyfill (Assumindo que 'buffer' foi instalado)
import { Buffer } from 'buffer';

// 🚨 POLYFILL PARA GARANTIR QUE O BUFFER ESTEJA DISPONÍVEL GLOBALMENTE
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

// 🚨 URL CORRIGIDA: Aponta para o Backend Local
const API_BASE_URL = 'https://pure-waters-90275.herokuapp.com/api/v1';
const SIGNER_NAME = 'Usuário de Teste'; 

// Componente para exibir mensagens de status
const Message = ({ message, type }) => {
    if (!message) return null;
    const color = type === 'success' ? '#28a745' : (type === 'error' ? '#dc3545' : '#007BFF');
    return (
        <View style={{ marginTop: 10, padding: 10, backgroundColor: color + '20', borderColor: color, borderWidth: 1, borderRadius: 5 }}>
            <Text style={{ color: color, fontWeight: 'bold' }}>{message}</Text>
        </View>
    );
};

// ⭐️ FUNÇÃO AUXILIAR: Converte URI local em um Blob para ser anexado ao FormData
const uriToBlob = async (uri) => {
    // Dados Base64 mockados para simulação de rubrica (Pixel PNG transparente)
    const mockDataBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
    
    // 🚨 CORREÇÃO: Usa Buffer.from(..., 'base64') para decodificar o mock
    if (uri && uri.includes('simulacao-uri-valida')) {
        
        // 1. Decodifica o Base64 usando Buffer (agora disponível globalmente)
        const mockBuffer = Buffer.from(mockDataBase64, 'base64');
        
        // 2. Cria o Blob a partir do Buffer
        return new Blob([mockBuffer], { type: 'image/png' });
    }
    
    // Se não for simulação, tenta o fetch (para URI real)
    try {
        const response = await fetch(uri);
        return await response.blob();
    } catch (error) {
        // Agora, o erro não deve mais ser 'Failed to fetch' na URI de simulação.
        throw new Error("Falha ao preparar o arquivo da rubrica para upload.");
    }
};

export default function VerificationScreen({ route, navigation }) {
    
    const signerId = route.params?.signerId;
    const signatureUri = route.params?.signatureUri;
    const otpData = route.params?.otpData; // Dados do OTP passados da SignatureScreen
    
    // O finalSignatureUri é a URI da rubrica/assinatura visual que vem da tela anterior
    const finalSignatureUri = signatureUri || null; 
    
    const [otpCode, setOtpCode] = useState(''); 
    
    const [templateId, setTemplateId] = useState(''); 
    const [docTitle, setDocTitle] = useState(''); 
    const [docId, setDocId] = useState('');
    const [uploadedDocumentUri, setUploadedDocumentUri] = useState(null); 
    
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '', data: null }); 

    // Lógica para preencher Título e ID quando o Template é Selecionado
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
    
    // VARIÁVEIS DE CONTROLE DA CASCATA
    const isDocumentSelected = !!templateId; 
    const isTitleEntered = isDocumentSelected && docTitle.trim().length > 0 && docTitle !== 'Clique em Buscar PDF...';
    

    // ⭐️ FUNÇÃO PARA ABRIR O SELETOR DE ARQUIVOS (PDF)
    const pickDocument = async () => {
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


    // FUNÇÃO PARA FINALIZAR ASSINATURA (CORRIGIDA)
    const assinarDocumento = async () => {
        
        const isTemplateFlow = templateId === 'template-servico'; 
        
        // 1. VALIDAÇÃO DE FLUXO DE UPLOAD (Se o usuário escolheu Upload, mas não buscou o PDF)
        if (templateId === 'upload' && !uploadedDocumentUri) {
            setStatus({ message: "❌ Selecione um arquivo PDF para upload.", type: 'error' });
            return;
        }

        // 2. VALIDAÇÃO DE RUBRICA E DEMAIS CAMPOS
        if (!finalSignatureUri || finalSignatureUri === 'AUSENTE_RUBRICA' || !otpCode || !docTitle) {
            setStatus({ message: "❌ Todos os campos (Rubrica, OTP, Título) são obrigatórios.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            const token = await AsyncStorage.getItem('jwtToken'); 
            const signerName = (await AsyncStorage.getItem('userEmail')) || SIGNER_NAME;
            
            // 🚨 GARANTINDO O ID: Força o docId a ser string antes do envio
            const finalDocIdToSend = String(docId || '').trim(); 
            
            if (finalDocIdToSend.length === 0) {
                 throw new Error("ID do Documento ausente. Falha de estado.");
            }
            
            // 1. Converte a URI da Rubrica em um Blob
            const rubricaBlob = await uriToBlob(finalSignatureUri); 
            
            // 2. Converte o PDF do upload (se for o caso)
            let documentBlob = null;
            let documentFileName = '';
            
            if (templateId === 'upload' && uploadedDocumentUri) {
                documentBlob = await uriToBlob(uploadedDocumentUri); 
                documentFileName = docTitle;
            }
            
            const formData = new FormData();
            const signatureFileName = finalDocIdToSend + '_signature.png'; 

            // 3. Adicionar os dados de texto/metadados
            formData.append('signerId', signerId);
            formData.append('submittedOTP', otpCode);
            formData.append('documentId', finalDocIdToSend); // ✅ Enviado o valor STRING garantido
            formData.append('templateId', templateId); 
            formData.append('signerName', signerName);
            formData.append('contractTitle', docTitle); 
            
            // 4. Anexar o arquivo binário da Rubrica
            formData.append('signatureImage', rubricaBlob, signatureFileName); 
            
            // 5. 🚨 NOVO: Anexar o Documento PDF para o fluxo 'upload'
            if (documentBlob) {
                formData.append('documentFile', documentBlob, documentFileName); 
            }

            // 🚨 CORREÇÃO DA URL: A URL deve ser /document/sign (SEM o ID na URL)
            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, }, 
                body: formData, 
            });

            // Tratamento de resposta
            let data;
            try { data = await response.json(); } catch (jsonError) { data = { message: `Erro HTTP ${response.status}. Servidor inacessível ou corpo inválido.` }; }

            if (response.ok) {
                // Se o salvamento no DB foi um sucesso (200 OK)
                setStatus({ message: "✅ Assinatura concluída. Navegando para Evidência.", type: 'success' });
                // ✅ NAVEGAÇÃO FINAL: Leva para a tela de busca (que agora navegará para a tela de Detalhes)
                navigation.navigate('Evidence', { documentId: finalDocIdToSend }); 
            } else {
                setStatus({ message: `❌ Falha na Assinatura: ${data.message || data.error || 'Erro desconhecido.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro na requisição de assinatura:", error);
            // Retorna a mensagem de erro detalhada, incluindo a falha de estado (ID nulo)
            setStatus({ message: error.message || "Erro de Conexão ou Servidor. Tente novamente.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    // ----------------------------------------------------
    // RENDERIZAÇÃO
    // ----------------------------------------------------
    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.header}>Passo 2: Assinatura Final</Text>
                    <Text style={styles.subtitle}>Verifique o código e o documento para finalizar a assinatura de: {signerId}</Text>
                    
                    {/* Exibe o status da rubrica */}
                    <Text style={[styles.label, {color: finalSignatureUri && finalSignatureUri !== 'AUSENTE_RUBRICA' ? '#28a745' : '#dc3545'}]}>
                        Status da Rubrica: {finalSignatureUri && finalSignatureUri !== 'AUSENTE_RUBRICA' ? '✅ URI Carregada' : '❌ URI Ausente'}
                    </Text>
                    
                    {/* 1. SELETOR DE DOCUMENTOS (Usando Botões e Estado) */}
                    <Text style={styles.label}>Selecione o Documento:</Text>
                    
                    <View style={styles.buttonGroup}>
                        {/* Botão de Template */}
                        <Button
                            title="Contrato Padrão"
                            onPress={() => setTemplateId('template-servico')}
                            color={templateId === 'template-servico' ? '#007BFF' : '#bdc3c7'}
                        />
                        {/* Botão de Upload */}
                        <Button
                            title="Upload PDF Próprio"
                            onPress={() => setTemplateId('upload')}
                            color={templateId === 'upload' ? '#007BFF' : '#bdc3c7'}
                        />
                    </View>

                    {/* ⭐️ Renderiza o Seletor de Arquivo APENAS se for o FLUXO DE UPLOAD */}
                    {templateId === 'upload' && (
                        <View style={{ marginTop: 15, width: '100%' }}>
                            <Button
                                title={uploadedDocumentUri ? `✅ PDF: ${docTitle}` : "BUSCAR ARQUIVO PDF"}
                                onPress={pickDocument}
                                color={uploadedDocumentUri ? '#28a745' : '#FF9800'}
                                disabled={isLoading}
                            />
                            <Text style={styles.helperText}>
                                {uploadedDocumentUri ? `Arquivo pronto para ser enviado.` : `Selecione um PDF do seu aparelho.`}
                            </Text>
                        </View>
                    )}


                    {/* 2. TÍTULO DO CONTRATO */}
                    <Text style={styles.label}>Título do Contrato:</Text>
                    <TextInput 
                        style={[styles.input, !isDocumentSelected && styles.disabledInput]} 
                        placeholder={isDocumentSelected ? "Título do contrato" : "Selecione um documento"}
                        value={docTitle} 
                        onChangeText={setDocTitle} 
                        editable={isDocumentSelected} 
                    />
                    
                    {/* 3. ID ÚNICO DO DOCUMENTO */}
                    <Text style={styles.label}>ID Único do Documento:</Text>
                    <TextInput 
                        style={[styles.input, styles.disabledInput]} 
                        placeholder={isDocumentSelected ? "ID Gerado" : "Selecione um documento"}
                        value={docId} 
                        editable={false} 
                    />

                    {/* 4. CÓDIGO OTP RECEBIDO (Habilitado após o Título ser preenchido) */}
                    <Text style={styles.label}>Código OTP Recebido:</Text>
                    <TextInput
                        style={[styles.input, !isTitleEntered && styles.disabledInput]} 
                        placeholder="123456"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="numeric"
                        maxLength={6}
                        editable={isTitleEntered}
                    />

                    <Message message={status.message} type={status.type} />

                    {/* 5. BOTÃO FINALIZAR ASSINATURA */}
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="2. FINALIZAR ASSINATURA" 
                            onPress={assinarDocumento} 
                            // Lógica Final: Requer Rubrica, OTP, Template/Upload, e Título/ID
                            color={finalSignatureUri && finalSignatureUri !== 'AUSENTE_RUBRICA' && otpCode && templateId && docTitle ? "#28a745" : "#6c757d"} 
                            disabled={!finalSignatureUri || finalSignatureUri === 'AUSENTE_RUBRICA' || !otpCode || !templateId || !docTitle}
                        />
                    )}
                    
                    <View style={{ marginTop: 30 }}>
                        <Button title="Voltar para Geração de OTP" onPress={() => navigation.goBack()} color="#bdc3c7" />
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    card: {
        width: '90%',
        maxWidth: 700,
        backgroundColor: '#fff',
        padding: 30,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 8,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#007BFF',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#6c757d',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 15,
        marginBottom: 5,
        color: '#343a40',
    },
    input: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        width: '100%',
        backgroundColor: '#fff',
    },
    buttonGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 10,
    },
    disabledInput: {
        backgroundColor: '#f0f0f0',
        color: '#6c757d'
    },
    helperText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 5,
    },
});