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
import { Picker } from '@react-native-picker/picker'; // Requer instalação se não estiver no expo install
//import SignatureCanvas from 'react-native-signature-canvas'; // Este componente é complexo e deve ser instalado separadamente, usaremos TextInput simples para o teste final.
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const API_BASE_URL = 'https://assinatura-avancada.onrender.com/api/v1'; 
const SIGNER_NAME = 'Usuário de Teste'; // Do armazenamento local

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
    // Dados recebidos do Passo 1 (SignatureScreen)
    const { signerId } = route.params; 
    
    const [otpCode, setOtpCode] = useState('');
    const [docTitle, setDocTitle] = useState('Contrato de Serviço Assinado');
    const [docId, setDocId] = useState('DOC-' + Date.now());
    const [templateId, setTemplateId] = useState('');
    const [signatureImageBase64, setSignatureImageBase64] = useState(''); // Simula a rubrica
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    // Lógica para alternar inputs de Templates/Uploads
    useEffect(() => {
        if (templateId && templateId !== 'upload') {
            // Preenche metadados do template
             if (templateId === 'template-servico') {
                setDocTitle('Contrato de Serviço Padrão (V1.0)');
                setDocId('TPL-SERV-' + Date.now());
             }
        }
    }, [templateId]);


    // FUNÇÃO PARA FINALIZAR ASSINATURA (Baseada no seu código web)
    const assinarDocumento = async () => {
        const isTemplateFlow = templateId && templateId !== 'upload';
        
        // Simulação de validação (Não temos o arquivo de upload no React Native aqui)
        if (!isTemplateFlow) {
            setStatus({ message: "O upload de arquivos não está implementado neste demo mobile.", type: 'error' });
            return;
        }
        if (!otpCode || !docId) {
             setStatus({ message: "OTP e ID do Documento são obrigatórios.", type: 'error' });
             return;
        }

        setIsLoading(true);
        setStatus({ message: 'Verificando OTP e solicitando assinatura...', type: 'info' });

        try {
            const token = await AsyncStorage.getItem('jwtToken'); 
            const signerName = await AsyncStorage.getItem('userEmail'); // Usamos o email como nome para fins de teste
            
            // NOTE BEM: O React Native não envia FormData facilmente, usaremos JSON para teste
            const payload = {
                signerId: signerId,
                submittedOTP: otpCode,
                documentId: docId,
                templateId: isTemplateFlow ? templateId : undefined,
                signerName: signerName || SIGNER_NAME,
                contractTitle: docTitle,
                signatureImage: "Simulacao_Rubrica_Base64", // Simula uma rubrica preenchida
            };

            const response = await fetch(`${API_BASE_URL}/document/sign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Usamos JSON aqui para simplificar o fetch
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ 
                    message: `✅ Assinatura Concluída! ${data.message}`, 
                    type: 'success' 
                });
                Alert.alert("Sucesso!", `Evidência salva. Doc ID: ${docId}`);
                
                // Navega para a tela de busca de evidências
                navigation.navigate('Evidence', { documentId: docId }); 

            } else {
                setStatus({ message: `❌ Falha na Assinatura: ${data.message || data.error || 'Erro desconhecido.'}`, type: 'error' });
            }

        } catch (error) {
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
                            <Picker.Item label="-- Selecione um Modelo --" value="" />
                            <Picker.Item label="Contrato de Serviço (Padrão)" value="template-servico" />
                            {/* O fluxo de upload será ignorado por simplicidade no mobile */}
                            <Picker.Item label="Upload de Arquivo (Demo)" value="upload" /> 
                        </Picker>
                    </View>

                    {/* Metadados */}
                    <Text style={styles.label}>Título do Contrato:</Text>
                    <TextInput style={styles.input} value={docTitle} onChangeText={setDocTitle} editable={!templateId} />
                    
                    <Text style={styles.label}>ID Único do Documento:</Text>
                    <TextInput style={styles.input} value={docId} onChangeText={setDocId} editable={!templateId} />

                    <Message message={status.message} type={status.type} />

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="2. FINALIZAR ASSINATURA" 
                            onPress={assinarDocumento} 
                            color="#28a745" // Cor verde para finalizar
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
});