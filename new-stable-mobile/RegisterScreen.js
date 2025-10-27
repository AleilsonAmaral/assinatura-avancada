// Arquivo: RegisterScreen.js
import React, { useState } from 'react';
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
    Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:3000/api/v1';
const { width } = Dimensions.get('window');

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


export default function RegisterScreen({ navigation }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    // ⭐️ FUNÇÃO DE CRIAÇÃO DE CONTA 
    const handleRegister = async () => {
        if (!name || !email || !password) {
            setStatus({ message: "Todos os campos são obrigatórios.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: 'Registrando usuário...', type: 'info' });

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // 💡 SUCCESSO: Navega de volta para a tela de Login
                Alert.alert("Sucesso", "Conta criada! Faça login agora.");
                navigation.navigate('Login');
            } else {
                setStatus({ message: `❌ Erro: ${data.message || 'Falha no registro.'}`, type: 'error' });
            }

        } catch (error) {
            console.error("Erro de Rede no Registro:", error);
            setStatus({ message: "Erro de conexão com o servidor. Tente novamente.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Criar Nova Conta</Text>
                    <Text style={styles.subtitle}>Acesso rápido para assinar documentos.</Text>

                    {/* 1. INPUT NOME */}
                    <Text style={styles.label}>Nome Completo:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Seu Nome"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />

                    {/* 2. INPUT EMAIL */}
                    <Text style={styles.label}>Email:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="seu.email@exemplo.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    {/* 3. INPUT SENHA */}
                    <Text style={styles.label}>Senha:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Sua senha segura"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={true}
                    />

                    <Message message={status.message} type={status.type} />

                    <View style={styles.buttonContainer}>
                        {/* 🎯 CORREÇÃO: COMPACTANDO O BLOCO TERNÁRIO */}
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#007BFF" />
                        ) : (
                            <Button
                                title="CRIAR CONTA"
                                onPress={handleRegister}
                                color="#007BFF"
                            />
                        )}
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title="Voltar para Login"
                                onPress={() => navigation.navigate('Login')}
                                color="#6c757d"
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f8f9fa' },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    card: {
        width: width * 0.9, maxWidth: 450, backgroundColor: '#fff', padding: 30,
        borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 6, elevation: 8,
    },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5, color: '#007BFF', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 5, color: '#343a40' },
    input: {
        height: 45, borderColor: '#ccc', borderWidth: 1, borderRadius: 5,
        paddingHorizontal: 10, width: '100%', backgroundColor: '#fff'
    },
    buttonContainer: { marginTop: 25, width: '100%' }
});