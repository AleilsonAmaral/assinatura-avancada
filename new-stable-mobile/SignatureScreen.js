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

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = 'Usuário de Teste';
const JWT_LOGIN_KEY = 'jwtToken'; // Chave onde o token de login está salvo


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

// ⭐️ FUNÇÃO AUXILIAR: Remove formatação e adiciona prefixo BR se necessário
const formatPhoneNumber = (number, method) => {
    if (method !== 'SMS' && method !== 'WhatsApp') {
        return number;
    }
    const cleaned = ('' + number).replace(/\D/g, '');

    if (cleaned.startsWith('55') && cleaned.length >= 12) {
        return '+' + cleaned;
    }

    if (cleaned.length === 10 || cleaned.length === 11) {
        return '+55' + cleaned;
    }
    return number;
};


export default function SignatureScreen({ navigation }) {
    const [signerId, setSignerId] = useState('');
    const [method, setMethod] = useState('Email');
    const [recipient, setRecipient] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    // Lógica para alternar inputs de E-mail/Celular (Mantida)
    useEffect(() => {
        if (method === 'Email') {
            AsyncStorage.getItem('userEmail').then(email => {
                if (email) setRecipient(email);
            });
        } else {
            setRecipient('');
        }
    }, [method]);


    // FUNÇÃO PARA SOLICITAR OTP (CORRIGIDA PARA AUTORIZAÇÃO)
    const solicitarOTP = async () => {
        // 🚨 VALIDAÇÃO MAIS RÍGIDA NO FRONT-END
        const cleanedSignerId = signerId.replace(/\D/g, ''); // Remove pontos/traços
        
        if (cleanedSignerId.length !== 11) {
            setStatus({ message: "CPF deve ter 11 dígitos.", type: 'error' });
            return;
        }
        if (!recipient) {
            setStatus({ message: "O Destinatário (e-mail) é obrigatório.", type: 'error' });
            return;
        }

        const formattedRecipient = formatPhoneNumber(recipient, method);

        setIsLoading(true);
        setStatus({ message: 'Solicitando OTP...', type: 'info' });

        try {
            // 🔑 1. LER O JWT DE LOGIN (AUTORIZAÇÃO)
            const loggedInToken = await AsyncStorage.getItem(JWT_LOGIN_KEY);

            if (!loggedInToken) {
                // 🛑 CORRIGE O ERRO DE AUTORIZAÇÃO (401/Acesso Negado)
                setStatus({ message: "Sessão expirada. Faça login para iniciar a transação.", type: 'error' });
                navigation.navigate('Login'); 
                return;
            }

            const payload = {
                signerId: cleanedSignerId, // ✅ ENVIANDO CPF LIMPO
                method: method,
                email: formattedRecipient, // Enviando o destinatário formatado
            };

            const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // ✅ INJETANDO O JWT DE LOGIN NO CABEÇALHO PARA AUTORIZAR A CRIAÇÃO DA TRANSAÇÃO
                    'Authorization': `Bearer ${loggedInToken}`,
                },
                body: JSON.stringify(payload),
            });

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                data = { message: `Erro HTTP ${response.status}. Servidor inacessível.` };
            }

            if (response.ok) {
                
                // ✅ NAVEGAÇÃO FINAL CORRIGIDA: Passando os DADOS OBRIGATÓRIOS para a próxima tela
                navigation.navigate('Verification', { 
                    signerId: cleanedSignerId, // ENVIAR O VALOR LIMPO
                    otpRecipient: formattedRecipient,
                    otpMethod: method,
                });

                setStatus({ message: `✅ ${data.message}. Navegando para verificação.`, type: 'success' });

            } else {
                // 🛑 A API rejeitou (401 Acesso Negado, 400 CPF Inválido)
                setStatus({ message: `❌ Erro: ${data.message || 'Falha ao solicitar OTP.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro fatal na solicitação de OTP:", error);
            setStatus({ message: "Erro de Rede. Tente novamente.", type: 'error' });
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
                        // 🚨 MUDANÇA: Permitimos apenas números para simplificar a validação do backend
                        onChangeText={text => setSignerId(text.replace(/\D/g, ''))} 
                        keyboardType="numeric"
                        maxLength={11} 
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
                        keyboardType={method === 'Email' ? 'email-address' : 'phone-pad'}
                    />

                    {/* 🎯 CORREÇÃO DE TEXT NODE: Usamos um fragmento para evitar quebras */}
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

                    {/* 🎯 CORREÇÃO DE LAYOUT: Envolvemos o botão em uma view com margem consistente */}
                    <View style={{ marginTop: 15 }}>
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