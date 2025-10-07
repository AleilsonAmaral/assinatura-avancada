import React, { useState } from 'react';
import {
        StyleSheet,
        Text,
        View,
        TextInput,
        Button,
        Alert,
        ActivityIndicator,
        SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL CRÍTICA: Endereço Público do seu Deploy no Render
const API_BASE_URL = 'https://assinatura-avancada.onrender.com/api/v1';

// CRÍTICO: Função renomeada para LoginScreen e recebendo a prop 'navigation'
export default function LoginScreen({ navigation }) {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [isLoggedIn, setIsLoggedIn] = useState(false);

        // Verifica o estado de login ao iniciar o app
        useState(() => {
                const checkLoginStatus = async () => {
                        const token = await AsyncStorage.getItem('jwtToken');
                        if (token) {
                                setIsLoggedIn(true);
                                // Se o token existir, navega diretamente para a tela de assinatura
                                // navigation.navigate('Signature'); // Descomente esta linha após o teste final
                        }
                };
                checkLoginStatus();
        }, []);

        // FUNÇÃO DE LOGIN
        const handleLogin = async () => {
                if (!email || !password) {
                        Alert.alert("Erro", "Preencha e-mail e senha para entrar.");
                        return;
                }

                setIsLoading(true);

                try {
                        const response = await fetch(`${API_BASE_URL}/auth/login`, {
                                method: 'POST',
                                headers: {
                                        'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ email, password, stayLoggedIn: true }),
                        });

                        const data = await response.json();

                        if (response.ok && data.token) {
                                // ARMAZENAMENTO DO JWT NO CELULAR
                                await AsyncStorage.setItem('jwtToken', data.token);
                                await AsyncStorage.setItem('userEmail', email);

                                Alert.alert("Sucesso!", "Login na Nuvem realizado com sucesso. Navegando...");

                                // CRÍTICO: SUBSTITUIÇÃO DO isLoggedIN PELA NAVEGAÇÃO
                                navigation.navigate('Signature');

                        } else {
                                Alert.alert("Falha no Login", data.message || "Credenciais inválidas. Verifique a senha.");
                        }
                } catch (error) {
                        console.error("Erro de Rede:", error);
                        Alert.alert("Erro de Conexão", "Não foi possível conectar ao Render. Verifique se a URL está correta.");
                } finally {
                        setIsLoading(false);
                }
        };

        // O BLOCO isLoggedIN É MANTIDO PARA FINS DE LOGOUT, MAS A NAVEGAÇÃO É FORÇADA NO SUCESSO
        if (isLoggedIn) {
                return (
                        <SafeAreaView style={styles.container}>
                                <Text style={styles.title}>API na Nuvem Conectada! ✅</Text>
                                <Text style={styles.subtitle}>O projeto está 100% funcional.</Text>
                                <Button title="Sair (Logout)" onPress={async () => {
                                        await AsyncStorage.removeItem('jwtToken');
                                        setIsLoggedIn(false);
                                        setEmail('');
                                        setPassword('');
                                }} />
                        </SafeAreaView>
                )
        }

        // Tela de Login Inicial
        return (
                <SafeAreaView style={styles.container}>
                        <Text style={styles.title}>Assinatura Digital - Login</Text>

                        <TextInput
                                style={styles.input}
                                placeholder="seu@email.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                        />

                        <TextInput
                                style={styles.input}
                                placeholder="Senha"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                        />

                        {isLoading ? (
                                <ActivityIndicator size="large" color="#007BFF" />
                        ) : (
                                <Button
                                        title="Entrar na API"
                                        onPress={handleLogin}
                                        color="#007BFF"
                                />
                        )}
                </SafeAreaView>
        );
}

const styles = StyleSheet.create({
        container: {
                flex: 1,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
        },
        title: {
                fontSize: 24,
                marginBottom: 10,
                fontWeight: 'bold',
        },
        subtitle: {
                fontSize: 16,
                marginBottom: 30,
                color: '#666'
        },
        input: {
                width: '90%',
                padding: 12,
                marginVertical: 8,
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 5,
        },
});