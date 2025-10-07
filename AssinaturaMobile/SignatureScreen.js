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
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

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


export default function SignatureScreen({ navigation }) {
    const [signerId, setSignerId] = useState('');
    const [method, setMethod] = useState('Email');
    const [recipient, setRecipient] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    
    // Lógica para alternar inputs de E-mail/Celular
    useEffect(() => {
        if (method === 'Email') {
            AsyncStorage.getItem('userEmail').then(email => {
                if (email) setRecipient(email);
            });
        } else {
            setRecipient('');
        }
    }, [method]);


    // FUNÇÃO PARA SOLICITAR OTP (Baseada no seu código web)
    const solicitarOTP = async () => {
        if (!signerId || !recipient) {
            setStatus({ message: "CPF e Destinatário são obrigatórios.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: 'Solicitando OTP...', type: 'info' });

        try {
            const token = await AsyncStorage.getItem('jwtToken'); 
            if (!token) {
                setStatus({ message: "Erro: Usuário deslogado. Faça login novamente.", type: 'error' });
                return;
            }

            const payload = {
                signerId: signerId,
                method: method,
                recipient: recipient
            };

            const response = await fetch(`${API_BASE_URL}/otp/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ message: `✅ ${data.message}. Navegando para o Passo 2.`, type: 'success' });
                
                // CRÍTICO: NAVEGAÇÃO PARA A PRÓXIMA TELA (Passo 2)
                navigation.navigate('Verification', { signerId: signerId }); 
                
            } else {
                setStatus({ message: `❌ Erro: ${data.message || 'Falha ao solicitar OTP.'}`, type: 'error' });
            }

        } catch (error) {
            setStatus({ message: "Erro de Rede: Não foi possível conectar ao servidor.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Passo 1: Autenticação OTP</Text>
                    <Text style={styles.subtitle}>Gere e receba o código de uso único (OTP) no seu dispositivo.</Text>

                    {/* Input CPF */}
                    <Text style={styles.label}>CPF do Signatário:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="000.000.000-00"
                        value={signerId}
                        onChangeText={setSignerId}
                        keyboardType="numeric"
                    />

                    {/* Seletor de Método */}
                    <Text style={styles.label}>Método de Envio do Token:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={method}
                            onValueChange={(itemValue) => setMethod(itemValue)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Email" value="Email" />
                            <Picker.Item label="SMS (Simulado)" value="SMS" />
                            <Picker.Item label="WhatsApp (Simulado)" value="WhatsApp" />
                        </Picker>
                    </View>

                    {/* Input de Destinatário */}
                    <Text style={styles.label}>Enviar para:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={method === 'Email' ? "exemplo@email.com" : "+5511999998888"}
                        value={recipient}
                        onChangeText={setRecipient}
                        keyboardType={method === 'Email' ? 'email-address' : 'phone-pad'}
                    />
                    <Text style={styles.helperText}>Certifique-se de que o número inclui o código do país e DDD.</Text>

                    <Message message={status.message} type={status.type} />

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="1. SOLICITAR OTP" 
                            onPress={solicitarOTP} 
                            color="#007BFF"
                        />
                    )}
                    
                    <View style={{ marginTop: 30 }}>
                        <Button title="Voltar para Login" onPress={() => navigation.navigate('Login')} color="#bdc3c7" />
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
    title: {
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
    helperText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 5,
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
});