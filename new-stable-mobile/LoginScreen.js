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
    TouchableOpacity // Necessário para o ícone de "ver senha"
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons'; // Para o ícone de olho

// URL CRÍTICA: Endereço Público do seu Deploy no Render
const API_BASE_URL = 'https://pure-waters-90275-3c59d1664433.herokuapp.com/api/v1';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false); // ESTADO PARA CONTROLAR A VISIBILIDADE

    // Verifica o estado de login ao iniciar o app
    useEffect(() => { // CORRIGIDO: Deve ser useEffect para funções assíncronas
        const checkLoginStatus = async () => {
             try {
                const token = await AsyncStorage.getItem('jwtToken');
                if (token) {
                    setIsLoggedIn(true);
                    // Navega diretamente para a tela de assinatura se o token existir
                    // navigation.navigate('Signature'); 
                }
            } catch (e) {
                console.error("Erro ao verificar login inicial:", e);
            }
        };
        checkLoginStatus();
    }, []); // O array vazio garante que roda apenas uma vez

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
                navigation.navigate('Signature'); // Navega para a próxima tela

            } else {
                setStatusMessage(data.message || "Credenciais inválidas. Verifique a senha.");
            }
        } catch (error) {
            console.error("Erro de Rede:", error);
            setStatusMessage("Erro de Conexão. Não foi possível conectar ao Render.");
        } finally {
            setIsLoading(false);
        }
    };

    // BLOCO DE RENDERIZAÇÃO
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
            
            {/* NOVO: Campo de Senha com Toggle */}
            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Senha"
                    value={password}
                    onChangeText={setPassword}
                    // CRÍTICO: Alterna entre texto visível (false) e oculto (true)
                    secureTextEntry={!showPassword} 
                />
                <TouchableOpacity 
                    style={styles.toggleButton} 
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <FontAwesome 
                        // CRÍTICO: Troca o ícone (olho aberto ou fechado)
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

            {/* NOVO: Opção Criar Conta */}
            <TouchableOpacity style={styles.secondaryAction} onPress={() => Alert.alert("Registro", "Esta funcionalidade exige a rota /auth/register no Backend.")}>
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
