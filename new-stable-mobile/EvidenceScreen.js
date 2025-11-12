import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    TextInput, 
    Button, 
    SafeAreaView,
    ScrollView, 
    ActivityIndicator,
    Alert,
} from 'react-native';
import * as Linking from 'expo-linking'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const JWT_LOGIN_KEY = 'jwtToken'; // Chave para o token de login

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

// ❌ REMOÇÃO: O componente EvidenceDisplay não deve estar nesta tela.

export default function EvidenceScreen({ route, navigation }) {
    
    // Assumimos que o documentId vem após a finalização da assinatura (VerificationScreen)
    const initialDocId = route.params?.documentId || ''; 

    const [searchTerm, setSearchTerm] = useState(initialDocId);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    // ⭐️ Busca imediata se o ID veio da rota de assinatura
    useEffect(() => {
        if (initialDocId) {
            buscarEvidencia(initialDocId);
        }
    }, [initialDocId]);


    const buscarEvidencia = async (idToSearch) => {
        const id = idToSearch || searchTerm;

        if (!id) {
            setStatus({ message: "Insira o ID do Documento ou Hash para buscar.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: `Buscando evidência para: ${id}...`, type: 'info' });

        try {
            // 🚨 ADICIONANDO O TOKEN (Resolve o 401 Unauthorized)
            const token = await AsyncStorage.getItem(JWT_LOGIN_KEY); // Usa o token de Login/Sessão

            if (!token) {
                // 🛑 Se o token de sessão não existir, a rota protegida falhará.
                setStatus({ message: "Sessão expirada. Faça login para auditar.", type: 'error' });
                await AsyncStorage.removeItem(JWT_LOGIN_KEY); 
                navigation.navigate('Login');
                setIsLoading(false);
                return; // Interrompe a execução
            }

            // Rota GET /document/:searchTerm/evidence
            const response = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(id)}/evidence`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // ✅ Token JWT para autorização da busca
                }, 
            });
            
            let data = {};
            try {
                data = await response.json();
            } catch (jsonError) {
                // Se a API retornar HTML (erro 500 ou 404), tratamos como falha de servidor
                data = { message: `Erro HTTP ${response.status}. Servidor inacessível ou falha interna.` };
            }

            if (response.ok) {
                if(data.evidenceRecord) {
                    
                    // 🚨 MUDANÇA CRÍTICA: NAVEGAR para a tela de detalhes
                    navigation.navigate('EvidenceDetails', { 
                        evidenceRecord: data.evidenceRecord // Passa o objeto completo
                    });

                    setIsLoading(false);
                    return; // Interrompe aqui após a navegação
                } else {
                    setStatus({ message: "Registro de evidência legal não encontrado.", type: 'error' });
                }
            } else {
                // Captura a mensagem de erro do backend (401, 404 real, 500)
                setStatus({ message: data.message || "Falha na busca de evidência. Verifique o log.", type: 'error' });
            }

        } catch (error) {
            console.error("Erro de Rede ao buscar evidência:", error);
            setStatus({ message: "Erro de Conexão com a API. Tente novamente.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Auditoria de Assinaturas</Text>
                    <Text style={styles.subtitle}>Verifique o status legal de qualquer documento por ID ou Hash.</Text>

                    <Text style={styles.label}>Buscar por ID do Documento:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: TPL-SERV-..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        autoCapitalize="none"
                    />

                    <Message message={status.message} type={status.type} />

                    {/* 🚨 Renderização de Busca */}
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="Buscar Evidência Legal" 
                            onPress={() => buscarEvidencia()} // Chama a função com o searchTerm atual
                            color="#2c3e50"
                        />
                    )}

                    {/* Botão de Volta */}
                    <View style={{ marginTop: 30 }}>
                        <Button title="Voltar para Assinatura" onPress={() => navigation.navigate('Signature')} color="#bdc3c7" />
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
        fontSize: 24,
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
});