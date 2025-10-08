import React, { useState, useEffect, useRef } from 'react';
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
    Platform 
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
// REMOVIDO: Importação direta do Signature aqui para evitar crash no web
import * as DocumentPicker from 'expo-document-picker'; 

const API_BASE_URL = 'https://assinatura-avancada.onrender.com/api/v1'; 
const SIGNER_NAME = 'Usuário de Teste'; 

// Importa o Canvas de Rubrica APENAS se não for web
let SignatureComponent;
if (Platform.OS !== 'web') {
    // Usamos um bloco try/catch para a importação dinâmica, caso o Expo Go não suporte o módulo
    try {
        SignatureComponent = require('react-native-signature-canvas').default;
    } catch (e) {
        console.warn("Módulo de rubrica indisponível na web ou build.", e);
        SignatureComponent = () => <Text style={{ color: 'red' }}>Rubrica Nativa Indisponível</Text>;
    }
} else {
    SignatureComponent = () => <Text style={{ color: '#7f8c8d' }}>*Rubrica não disponível no Navegador.</Text>;
}


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
    const { signerId } = route.params; 
    const signatureRef = useRef(null); 
    
    const [otpCode, setOtpCode] = useState('');
    const [docTitle, setDocTitle] = useState('Contrato de Serviço Assinado');
    const [docId, setDocId] = useState('DOC-' + Date.now());
    const [templateId, setTemplateId] = useState('');
    
    const [signatureImageBase64, setSignatureImageBase64] = useState(null); 
    const [uploadedFile, setUploadedFile] = useState(null); 
    
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    // Lógica para Metadados
    useEffect(() => {
        if (templateId === 'template-servico') {
             setDocTitle('Contrato de Serviço Padrão (V1.0)');
             setDocId('TPL-SERV-' + Date.now());
             setUploadedFile(null); 
        } else if (templateId === 'upload') {
             setDocTitle('Upload de Arquivo Externo');
             setDocId('UPLOAD-' + Date.now());
        } else {
             setDocTitle('Contrato de Serviço Assinado');
             setDocId('DOC-' + Date.now());
             setUploadedFile(null);
        }
    }, [templateId]);
    
    // ----------------------------------------------------
    // FUNÇÃO: SELECIONAR DOCUMENTO (BUSCA NATIVA)
    // ----------------------------------------------------
    const buscarDocumento = async () => {
        if (templateId !== 'upload') {
            setStatus({ message: 'Selecione a opção "Upload de Arquivo" primeiro.', type: 'error' });
            return;
        }
        
        try {
            // DocumentPicker abre a interface nativa do Android/iOS
            if (Platform.OS === 'web') {
                 setStatus({ message: 'Busca de arquivos nativa não suportada no Navegador. Teste no celular.', type: 'error' });
                 return;
            }
            
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });

            if (result.canceled === true) {
                setStatus({ message: 'Seleção de documento cancelada.', type: 'info' });
                return;
            }
            
            const asset = result.assets[0];

            if (asset) {
                // Guarda o arquivo para ser enviado no FormData
                setUploadedFile(asset); 
                setDocTitle(asset.name);
                setDocId('UPLOAD-' + Date.now());
                setStatus({ message: `Arquivo '${asset.name}' selecionado com sucesso.`, type: 'success' });
            }

        } catch (err) {
            setStatus({ message: 'Erro ao acessar arquivos do dispositivo. Verifique as permissões.', type: 'error' });
        }
    };
    
    // ----------------------------------------------------
    // HANDLER DE SUCESSO DO CANVAS (INICIA O UPLOAD)
    // ----------------------------------------------------
    const handleSignature = async (signatureBase64) => {
        if (!signatureBase64 || signatureBase64.length < 100) {
            setStatus({ message: 'A rubrica não pode estar vazia. Por favor, assine.', type: 'error' });
            return;
        }
        
        // Retira o prefixo "data:image/png;base64,"
        const base64Data = signatureBase64.replace('data:image/png;base64,', '');
        setSignatureImageBase64(base64Data); 
        
        await enviarAssinatura(base64Data); // Inicia o envio real
    };

    const assinarDocumento = async () => {
        const isTemplateFlow = templateId && templateId !== 'upload';
        
        // 1. Validações Essenciais
        if (!templateId || templateId === '') {
             setStatus({ message: "Selecione a fonte do documento.", type: 'error' });
             return;
        }
        if (templateId === 'upload' && !uploadedFile) {
             setStatus({ message: "Busque um arquivo para upload.", type: 'error' });
             return;
        }
        if (!otpCode) {
             setStatus({ message: "Código OTP é obrigatório.", type: 'error' });
             return;
        }
        
        // 2. Captura a assinatura do Canvas
        if (Platform.OS !== 'web') {
            // Aciona a captura do Base64, que chama handleSignature, que envia o formulário.
            if (signatureRef.current) {
                signatureRef.current.readSignature(); 
            } else {
                 setStatus({ message: "Erro no componente de rubrica. Recarregue o app.", type: 'error' });
            }
        } else if (Platform.OS === 'web') {
            // Simulação para o navegador (para que ele não trave)
            await enviarAssinatura("SIMULACAO_RUBRICA_WEB_OK");
        }
    };
    
    const enviarAssinatura = async (base64Rubrica) => {
        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            const token = await AsyncStorage.getItem('jwtToken'); 
            const signerName = await AsyncStorage.getItem('userEmail'); 
            
            const formData = new FormData();
            formData.append('submittedOTP', otpCode);
            formData.append('signerId', signerId);
            formData.append('signerName', signerName || SIGNER_NAME);
            formData.append('contractTitle', docTitle);
            formData.append('documentId', docId);
            formData.append('signatureImage', base64Rubrica); // Rubrica Manuscrita
            
            // Lógica de upload vs. Template
            if (templateId === 'upload' && uploadedFile) {
                // Anexa o arquivo real (Multer espera este formato)
                formData.append('documentFile', {
                    uri: uploadedFile.uri,
                    type: uploadedFile.mimeType || 'application/octet-stream', 
                    name: uploadedFile.name,
                });
            } else if (templateId !== 'upload') {
                 // Template Flow (Conteúdo de texto para Hash)
                 formData.append('documentContent', `Conteúdo do Template: ${templateId}`);
            }

            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData, // Envia o FormData (Multipart)
            });

            const data = await response.json();

            if (response.ok) {
                // SUCESSO: Navega para a tela de Evidências
                navigation.navigate('Evidence', { 
                    documentId: docId,
                    signatureRecord: data.signatureRecord 
                }); 
            } else {
                setStatus({ message: `❌ Falha: ${data.message || data.error}`, type: 'error' });
            }

        } catch (error) {
            setStatus({ message: `Erro fatal de conexão: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.header}>Passo 2: Assinatura Final</Text>
                    <Text style={styles.subtitle}>Finalize a assinatura, anexando o documento e a rubrica de {signerId}.</Text>
                    
                    {/* Input OTP */}
                    <Text style={styles.label}>Código OTP Recebido:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="123456"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="numeric"
                        maxLength={6}
                    />
                    
                    {/* Seletor de Templates/Upload */}
                    <Text style={styles.label}>Selecione a Fonte do Documento:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={templateId}
                            onValueChange={(itemValue) => setTemplateId(itemValue)}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- Selecione um Modelo --" value="" />
                            <Picker.Item label="Contrato de Serviço (Padrão)" value="template-servico" />
                            <Picker.Item label="Acordo de Não Divulgação (NDA)" value="template-nda" />
                            <Picker.Item label="Upload de Arquivo (PDF/DOCX)" value="upload" /> 
                        </Picker>
                    </View>
                    
                    {/* Upload de Documento: CAMPO OPERÁVEL */}
                    {templateId === 'upload' && (
                        <View style={{ marginTop: 20, width: '100%' }}>
                            <Text style={styles.label}>Arquivo Selecionado:</Text>
                            <Text style={styles.fileNameDisplay}>{uploadedFile ? uploadedFile.name : 'Nenhum arquivo selecionado...'}</Text>
                            <Button 
                                title="Buscar Arquivo no Dispositivo" 
                                onPress={buscarDocumento}
                                color="#007BFF" 
                            />
                            <Text style={styles.helperText}>Atenção: A busca de arquivo só funciona após o build EAS (APK ou Dev Client).</Text>
                        </View>
                    )}

                    {/* Rubrica: ESPAÇO DE DESENHO REAL */}
                    {Platform.OS !== 'web' ? (
                        <>
                            <Text style={styles.label}>Rubrica (Assinatura Manuscrita):</Text>
                            <View style={styles.signaturePadContainer}>
                                <SignatureComponent
                                    ref={signatureRef}
                                    onOK={handleSignature} 
                                    onEmpty={() => setStatus({ message: 'A rubrica não pode estar vazia. Por favor, assine.', type: 'error' })}
                                    descriptionText="Assine acima para confirmar"
                                    webStyle={`.m-signature-pad--footer {display: none;} body,html {width:100%; height:100%; margin: 0; padding: 0;}`}
                                />
                            </View>
                            <TouchableOpacity onPress={() => signatureRef.current.clear()}>
                                <Text style={styles.clearText}>Limpar Rubrica</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <Text style={styles.helperText}>*Rubrica não disponível no Navegador. Use o Mobile para desenhar.</Text>
                    )}
                    
                    {/* Metadados */}
                    <Text style={styles.label}>Título do Contrato:</Text>
                    <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={false} />
                    
                    <Text style={styles.label}>ID Único do Documento:</Text>
                    <TextInput style={styles.input} value={docId} onChangeText={setDocId} editable={false} />

                    <Message message={status.message} type={status.type} />

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="2. FINALIZAR ASSINATURA" 
                            onPress={assinarDocumento} 
                            color="#28a745" 
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
        color: '#34495e',
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
    pickerContainer: {
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        overflow: 'hidden',
        height: 40,
        justifyContent: 'center',
        marginBottom: 15,
    },
    picker: {
        height: 40,
        width: '100%',
    },
    signaturePadContainer: {
        height: 180, 
        borderColor: '#007BFF', 
        borderWidth: 2,
        borderRadius: 5,
        backgroundColor: '#ecf0f1',
        overflow: 'hidden',
        marginBottom: 10,
        marginTop: 5,
    },
    fileNameDisplay: {
        fontSize: 14,
        color: '#2c3e50',
        padding: 10,
        backgroundColor: '#ecf0f1',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 10,
    },
    clearText: {
        color: '#e74c3c',
        textAlign: 'right',
        marginRight: 5,
        marginBottom: 10,
        fontSize: 14,
    },
    helperText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 5,
        marginBottom: 10,
    }
});
