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

// 🎯 CORREÇÃO: URL Base do Heroku (Já estava correta)
const API_BASE_URL = 'https://pure-waters-90275-3c59d1664433.herokuapp.com/api/v1'; 
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

// ⭐️ FUNÇÃO AUXILIAR: Adiciona +55 se for SMS/WhatsApp e o prefixo estiver faltando
const formatPhoneNumber = (number, method) => {
    // Apenas aplica a formatação se o método for SMS ou WhatsApp
    if (method !== 'SMS' && method !== 'WhatsApp') {
        return number;
    }

    // 1. Remove todos os caracteres não numéricos
    const cleaned = ('' + number).replace(/\D/g, '');
    
    // 2. Se já começar com +55, retorna o número limpo (com o '+')
    if (cleaned.startsWith('55') && cleaned.length >= 12) { // Ex: 5511999998888
        return '+' + cleaned;
    }
    
    // 3. Se tiver o formato de DDD + número (10 ou 11 dígitos), adiciona +55
    if (cleaned.length === 10 || cleaned.length === 11) { 
        return '+55' + cleaned;
    }
    
    // Retorna o original para o email ou se o formato estiver errado
    return number;
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


    // FUNÇÃO PARA SOLICITAR OTP
    const solicitarOTP = async () => {
        if (!signerId || !recipient) {
            setStatus({ message: "CPF e Destinatário são obrigatórios.", type: 'error' });
            return;
        }
        
        // APLICA A FORMATAÇÃO ANTES DE ENVIAR PARA A API
        const formattedRecipient = formatPhoneNumber(recipient, method);

        setIsLoading(true);
        setStatus({ message: 'Solicitando OTP...', type: 'info' });

        try {
            // REMOÇÃO DE TOKEN: Esta rota não deve depender de um JWT de sessão.
            // const token = await AsyncStorage.getItem('jwtToken'); 
            // if (!token) { /* ... */ } // Não é necessário, pois a rota é pública.

            const payload = {
                signerId: signerId,
                method: method,
                email: formattedRecipient, 
            };
            
            // 🎯 CORREÇÃO FINAL: Usa o prefixo do backend /auth e a rota correta /request-otp
            const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 🎯 REMOÇÃO DO HEADER: O token JWT NÃO DEVE ser enviado para a rota pública de OTP.
                    // 'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });
            
            // Tratamento de resposta para evitar loop em erro de servidor
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                data = { message: `Erro HTTP ${response.status}. Servidor inacessível ou retornou corpo vazio.` };
            }

            if (response.ok) {
                
                // Navegação para VerificationScreen (Passo 2)
                navigation.navigate('Verification', { 
                    signerId: signerId,
                    signatureUri: 'file:///simulacao-uri-valida-de-teste-png' 
                }); 
                
                setStatus({ message: `✅ ${data.message}. Navegação bem-sucedida.`, type: 'success' });
                
            } else {
                setStatus({ message: `❌ Erro: ${data.message || 'Falha ao solicitar OTP.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro fatal na solicitação de OTP:", error);
            setStatus({ message: "Erro de Rede: Não foi possível conectar ao servidor. Tente novamente.", type: 'error' });
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
                        placeholder={method === 'Email' ? "exemplo@email.com" : "99 99999-9999"}
                        value={recipient}
                        onChangeText={setRecipient}
                        // ⭐️ MUDANÇA: Usa 'phone-pad' para SMS/WhatsApp
                        keyboardType={method === 'Email' ? 'email-address' : 'phone-pad'}
                    />
                    <Text style={styles.helperText}>
                        {method !== 'Email' 
                            ? "Apenas o DDD e o número são necessários. O prefixo internacional (+55) será adicionado automaticamente." 
                            : "Digite o e-mail."}
                    </Text>

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
        textAlign: 'center'
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