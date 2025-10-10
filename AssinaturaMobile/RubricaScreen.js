// Arquivo: RubricaScreen.js (Simplificado para evitar crash)

import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, SafeAreaView, ScrollView, Alert, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export default function RubricaScreen({ route, navigation }) {
    const { signerId } = route.params; 
    const [rubricaUri, setRubricaUri] = useState(null); 

    // ⭐️ FUNÇÃO SIMULADA: Retorna a URI para testar o fluxo
    const handleSimulateExport = () => {
        // Gera uma URI SIMULADA, pois não podemos salvar arquivo no Expo Web
        const simulatedUri = `SIMULACAO_URI_${signerId}_${Date.now()}`; 
        setRubricaUri(simulatedUri);

        Alert.alert("Rubrica Capturada", "Simulação de captura de assinatura concluída. Prossiga.");
    };

    // FUNÇÃO DE NAVEGAÇÃO
    const goToVerification = () => {
        if (!rubricaUri) {
            Alert.alert("Atenção", "É obrigatório simular a captura da assinatura antes de continuar.");
            return;
        }

        // Navega para a VerificationScreen passando a URI simulada
        navigation.navigate('Verification', { 
            signerId: signerId,
            signatureUri: rubricaUri
        });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Passo 1.5: Captura da Rubrica</Text>
                    <Text style={styles.subtitle}>Desenhe sua assinatura no espaço abaixo (Recurso nativo simulado no Web).</Text>
                    
                    {/* Placeholder Simplificado */}
                    <View style={styles.canvasPlaceholder}>
                        <Text style={styles.placeholderText}>ÁREA DO CANVAS (SIMULAÇÃO NO WEB)</Text>
                    </View>
                    
                    <Button 
                        title="Capturar Assinatura (Simulação)" 
                        onPress={handleSimulateExport} 
                        color="#007BFF" 
                        disabled={rubricaUri !== null}
                    />
                    
                    <Text style={{ marginTop: 15, color: rubricaUri ? '#28a745' : '#dc3545', fontWeight: 'bold', textAlign: 'center' }}>
                        Status: {rubricaUri ? '✅ Rubrica SIMULADA' : '❌ Aguardando Simulação...'}
                    </Text>

                    <View style={{ marginTop: 30 }}>
                        <Button 
                            title="2. AVANÇAR PARA VERIFICAÇÃO OTP" 
                            onPress={goToVerification} 
                            disabled={!rubricaUri}
                            color={rubricaUri ? "#28a745" : "#bdc3c7"}
                        />
                        <View style={{ marginTop: 10 }}>
                            <Button 
                                title="Voltar" 
                                onPress={() => navigation.goBack()} 
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
        width: width * 0.9, maxWidth: 700, backgroundColor: '#fff', padding: 30, 
        borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.1, shadowRadius: 6, elevation: 8, alignSelf: 'center',
    },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#007BFF', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
    canvasPlaceholder: {
        height: 200,
        borderWidth: 2,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    placeholderText: {
        color: '#aaa',
        fontSize: 16,
    }
});