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
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// A importação 'mime' permanece removida para evitar o crash.

const API_BASE_URL = 'https://assinatura-avancada.onrender.com/api/v1'; 
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
    
    // Desestruturação segura
    const signerId = route.params?.signerId;
    const signatureUri = route.params?.signatureUri;
    const finalSignatureUri = signatureUri || null; 
    
    const [otpCode, setOtpCode] = useState(''); 
    
    // Inicia os metadados como vazio/genérico
    const [docTitle, setDocTitle] = useState(''); 
    const [docId, setDocId] = useState('');
    
    // Inicia o templateId como vazio, forçando a seleção
    const [templateId, setTemplateId] = useState(''); 
    
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' }); 

    // Lógica para preencher Título e ID quando o Template é Selecionado
    useEffect(() => {
        if (templateId === 'template-servico') {
            // Preenche o Título com o Padrão para que possa ser editado em seguida
            setDocTitle('Contrato de Serviço Padrão (V1.0)'); 
            setDocId('TPL-SERV-' + Date.now());
        } else if (!templateId) {
             // Limpa/Reseta se nada for selecionado
            setDocTitle('');
            setDocId('');
        }
    }, [templateId]);
    
    // VARIÁVEL DE CONTROLE: Checa se um template válido foi selecionado
    const isDocumentSelected = !!templateId; 
    

    // FUNÇÃO PARA FINALIZAR ASSINATURA
    const assinarDocumento = async () => {
        const isTemplateFlow = templateId && templateId !== 'upload';
        
        // VALIDAÇÃO DA RUBRICA
        if (!finalSignatureUri || finalSignatureUri === 'AUSENTE_RUBRICA') {
            setStatus({ message: "❌ Rubrica ausente. Por favor, volte e capture a assinatura.", type: 'error' });
            return;
        }

        if (!isTemplateFlow) {
             setStatus({ message: "O upload de arquivos não está implementado neste demo mobile. Selecione um Template.", type: 'error' });
             return;
        }
        
        // VALIDAÇÃO CRÍTICA: Título do contrato não pode ser vazio
        if (!otpCode || !docId || !docTitle) {
             setStatus({ message: "OTP, Título e ID do Documento são obrigatórios.", type: 'error' });
             return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            const token = await AsyncStorage.getItem('jwtToken'); 
            const userEmail = await AsyncStorage.getItem('userEmail'); 
            const signerName = userEmail || SIGNER_NAME;
            
            // Criação do FormData para envio binário estável
            const formData = new FormData();
            const fileType = 'image/png'; 
            const fileName = docId + '_signature.png'; 

            // 1. Adicionar os dados de texto/metadados
            formData.append('signerId', signerId);
            formData.append('submittedOTP', otpCode);
            formData.append('documentId', docId);
            formData.append('templateId', isTemplateFlow ? templateId : undefined);
            formData.append('signerName', signerName);
            formData.append('contractTitle', docTitle); // Usa o título editável

            // 2. Adicionar o arquivo binário da Rubrica
            formData.append('signatureImage', {
                uri: finalSignatureUri, 
                type: fileType, 
                name: fileName,    
            });
            
            // Requisição com FormData
            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`, 
                },
                body: formData, 
            });

            // Tratamento de resposta para evitar loop
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                data = { message: `Erro HTTP ${response.status}. Servidor inacessível ou corpo inválido.` };
            }

            if (response.ok) {
                // SUCESSO
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
                    
                    {/* Seletor de Templates */}
                    <Text style={styles.label}>Selecione o Documento:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={templateId}
                            onValueChange={(itemValue) => setTemplateId(itemValue)}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- Selecione um Modelo --" value="" enabled={false} /> 
                            <Picker.Item label="Contrato de Serviço (Padrão)" value="template-servico" />
                        </Picker>
                    </View>

                    {/* Metadados */}
                    <Text style={styles.label}>Título do Contrato:</Text>
                    <TextInput 
                        style={[styles.input, !isDocumentSelected && styles.disabledInput]} 
                        placeholder={isDocumentSelected ? "Digite o título do contrato" : "Selecione um documento"}
                        value={docTitle} 
                        onChangeText={setDocTitle} 
                        // ⭐️ CORREÇÃO: Fica editável se o documento foi selecionado
                        editable={isDocumentSelected} 
                    />
                    
                    <Text style={styles.label}>ID Único do Documento:</Text>
                    <TextInput 
                        // ⭐️ CORREÇÃO: ID Único fica preenchido e sempre desabilitado
                        style={[styles.input, styles.disabledInput]} 
                        value={docId} 
                        editable={false} 
                    />

                    <Message message={status.message} type={status.type} />

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="2. FINALIZAR ASSINATURA" 
                            onPress={assinarDocumento} 
                            // Habilita apenas se URI (válida), OTP, Template, e TÍTULO (não vazio) estiverem preenchidos
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
    // NOVO ESTILO: Para dar feedback visual de campo desabilitado
    disabledInput: {
        backgroundColor: '#f0f0f0',
        color: '#6c757d'
    }
});