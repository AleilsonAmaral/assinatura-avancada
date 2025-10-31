import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    Button,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';


export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Verifica o estado de login ao iniciar o app
    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const token = await AsyncStorage.getItem('jwtToken');
                if (token) {
                    setIsLoggedIn(true);
                }
            } catch (e) {
                console.error("Erro ao verificar login inicial:", e);
            }
        };
        checkLoginStatus();
    }, []);

    // FUNÇÃO DE LOGIN
    const handleLogin = async () => {
        if (!email || !password) {
            setStatusMessage("Preencha e-mail e senha para entrar.");
            return;
        }

        setStatusMessage("");
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, stayLoggedIn: true }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
                await AsyncStorage.setItem('jwtToken', data.token);
                await AsyncStorage.setItem('userEmail', email);

                Alert.alert("Sucesso!", "Login realizado. Navegando...");
                navigation.navigate('Signature');

            } else {
                setStatusMessage(data.message || "Credenciais inválidas. Verifique a senha.");
            }
        } catch (error) {
            console.error("Erro de Rede:", error);
            setStatusMessage("Falha de Conexão. O domínio da API está inacessível ou sendo bloqueado pela rede.");
        } finally {
            setIsLoading(false);
        }
    };

    // BLOCO DE RENDERIZAÇÃO (COMPACTADO)
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Assinatura Digital - Login</Text>

            {/* Mensagem de status */}
            {statusMessage ? (
                <View style={statusMessage.includes('sucesso') ? styles.successBox : styles.errorBox}>
                    <Text style={statusMessage.includes('sucesso') ? styles.successText : styles.errorText}>{statusMessage}</Text>
                </View>
            ) : null}

            <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            {/* Campo de Senha com Toggle */}
            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <FontAwesome
                        name={showPassword ? 'eye-slash' : 'eye'}
                        size={20}
                        color="#666"
                    />
                </TouchableOpacity>
            </View>


            {isLoading ? (
                <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
            ) : (
                <View style={styles.buttonContainer}>
                    <Button
                        title="ENTRAR NA API"
                        onPress={handleLogin}
                        color="#007BFF"
                    />
                </View>
            )}

            <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => navigation.navigate('Register')}
            >
                <Text style={styles.secondaryText}>Não tem conta? Crie uma</Text>
            </TouchableOpacity>

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
        marginBottom: 30,
        fontWeight: 'bold',
    },
    input: {
        width: '90%',
        padding: 12,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
    },
    // Estilos para o campo de senha
    passwordContainer: {
        flexDirection: 'row',
        width: '90%',
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        alignItems: 'center',
        paddingRight: 10,
    },
    passwordInput: {
        flex: 1,
        padding: 12,
    },
    toggleButton: {
        padding: 5,
    },
    buttonContainer: {
        width: '90%',
        marginTop: 15,
    },
    secondaryAction: {
        marginTop: 20,
        padding: 10,
    },
    secondaryText: {
        color: '#007BFF',
        fontSize: 14,
    },
    // Caixas de Mensagem para Status
    successBox: {
        width: '90%',
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#e8f5e9',
        borderColor: '#27ae60',
        borderWidth: 1,
        borderRadius: 5,
    },
    successText: {
        color: '#27ae60',
        textAlign: 'center',
    },
    errorBox: {
        width: '90%',
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#fce4e4',
        borderColor: '#e74c3c',
        borderWidth: 1,
        borderRadius: 5,
    },
    errorText: {
        color: '#e74c3c',
        textAlign: 'center',
    },
});