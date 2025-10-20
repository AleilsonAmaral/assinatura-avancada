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
// ❌ REMOVIDO: Importação do Picker (usaremos Botões para evitar crashes)
import AsyncStorage from '@react-native-async-storage/async-storage'; 


const API_BASE_URL = 'https://pure-waters-90275-3c59d1664433.herokuapp.com/api/v1';; 
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

export default function VerificationScreen({ route, navigation }) {
    
    const signerId = route.params?.signerId;
    const signatureUri = route.params?.signatureUri;
    const finalSignatureUri = signatureUri || null; 
    
    const [otpCode, setOtpCode] = useState(''); 
    
    // Inicia os estados no modo 'vazio' para forçar a interação do usuário
    const [templateId, setTemplateId] = useState(''); 
    const [docTitle, setDocTitle] = useState(''); 
    const [docId, setDocId] = useState('');
    const [uploadedDocumentUri, setUploadedDocumentUri] = useState(null); // URI do PDF real
    
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' }); 

    // Lógica para preencher Título e ID quando o Template é Selecionado
    useEffect(() => {
        // Reseta a URI do documento sempre que o tipo de fluxo muda
        setUploadedDocumentUri(null); 
        
        if (templateId === 'template-servico') {
            setDocTitle('Contrato de Serviço Padrão (V1.0)'); 
            setDocId('TPL-SERV-' + Date.now());
        } else if (templateId === 'upload') {
            setDocTitle('Clique em Buscar PDF...');
            setDocId('USER-UP-' + Date.now());
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
                // Se o usuário selecionou, salva a URI
                const selectedUri = result.assets[0].uri;
                const selectedName = result.assets[0].name;

                setUploadedDocumentUri(selectedUri); // Guarda o URI real do PDF
                setDocTitle(selectedName); // Define o título com o nome do arquivo para UX
                setStatus({ message: `✅ Arquivo ${selectedName} carregado.`, type: 'success' });
            } else {
                setStatus({ message: "Seleção de arquivo cancelada.", type: 'info' });
            }
        } catch (error) {
            console.error("Erro ao buscar documento:", error);
            Alert.alert("Erro Nativo", "Falha ao abrir seletor de arquivos. Verifique o EAS Build.");
        }
    };


    // FUNÇÃO PARA FINALIZAR ASSINATURA
    const assinarDocumento = async () => {
        const isTemplateFlow = templateId === 'template-servico'; 
        
        // ⭐️ Determina o URI do documento principal a ser enviado (Template ou Upload)
        let documentUriToSend = isTemplateFlow ? finalSignatureUri : uploadedDocumentUri;
        
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
            
            const formData = new FormData();
            const fileType = 'image/png'; 
            const fileName = docId + '_signature.png'; 

            // ⭐️ O Documento principal a ser assinado (PDF)
            // NOTA: Para o fluxo de TEMPLATE, enviamos apenas o URI da rubrica + metadados
            // e o backend usa o PDF fixo (Contrato_Teste.pdf).
            
            // Se fosse necessário enviar o PDF upload, o código seria diferente e a API teria que mudar:
            // formData.append('documentFile', { uri: uploadedDocumentUri, type: 'application/pdf', name: 'document.pdf' });

            // 1. Adicionar os dados de texto/metadados
            formData.append('signerId', signerId);
            formData.append('submittedOTP', otpCode);
            formData.append('documentId', docId);
            formData.append('templateId', templateId); // Envia o tipo de fluxo
            formData.append('signerName', signerName);
            formData.append('contractTitle', docTitle); 

            // 2. Adicionar o arquivo binário da Rubrica
            formData.append('signatureImage', {
                uri: finalSignatureUri, 
                type: fileType, 
                name: fileName,    
            });
            
            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, },
                body: formData, 
            });

            // Tratamento de resposta
            let data;
            try { data = await response.json(); } catch (jsonError) { data = { message: `Erro HTTP ${response.status}. Servidor inacessível ou corpo inválido.` }; }

            if (response.ok) {
                setStatus({ message: "✅ Assinatura concluída. Navegando para Evidência.", type: 'success' });
                navigation.navigate('Evidence', { documentId: docId }); 
            } else {
                setStatus({ message: `❌ Falha na Assinatura: ${data.message || data.error || 'Erro desconhecido.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro na requisição de assinatura:", error);
            setStatus({ message: "Erro de Conexão ou Servidor. Tente novamente.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


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
                        placeholder={isDocumentSelected ? "Digite o título do contrato" : "Selecione um documento"}
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
                            // Lógica Final: Requer Rubrica, OTP, Template/Upload, e Título
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
    // NOVO ESTILO: Para dar feedback visual de campo desabilitado
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