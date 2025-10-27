// Arquivo: RubricaScreen.js (Implementação de Desenho Real com Fallback para Web)

import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, SafeAreaView, ScrollView, Alert, Dimensions, Platform } from 'react-native';
// ⭐️ IMPORTAÇÃO DO COMPONENTE REAL DE ASSINATURA
import Signature from 'react-native-signature-canvas';

const { width } = Dimensions.get('window');

// Dimensões do Canvas
const CANVAS_WIDTH = width * 0.9;
const CANVAS_HEIGHT = 200;

// 🚨 FUNÇÃO DE MOCK: Usaremos a função de mock para o ambiente Web (navegador)
const MOCK_URI_PREFIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export default function RubricaScreen({ route, navigation }) {
    // Recebe os parâmetros de navegação (signerId e otpData)
    const { signerId, otpData } = route.params;
    const [rubricaUri, setRubricaUri] = useState(null);
    const [isSimulated, setIsSimulated] = useState(false);


    // FUNÇÃO CHAMADA QUANDO O USUÁRIO CONCLUI O DESENHO (onOK)
    const handleEndDrawing = (uri) => {
        setRubricaUri(uri);
        setIsSimulated(false);
        Alert.alert("Sucesso", "Assinatura capturada. Prossiga.");
    };

    // ⭐️ LÓGICA DE SIMULAÇÃO (USADO NO WEB)
    const handleSimulateExport = () => {
        if (Platform.OS === 'web') {
            setRubricaUri(MOCK_URI_PREFIX);
            setIsSimulated(true);
            Alert.alert("Simulação Completa", "Rubrica simulada. Prossiga para a verificação.");
        }
    };


    // FUNÇÃO DE NAVEGAÇÃO
    const goToVerification = () => {
        if (!rubricaUri) {
            Alert.alert("Atenção", "É obrigatório capturar a assinatura antes de continuar.");
            return;
        }

        // Navega para a VerificationScreen (Passo 2), passando a URI e os dados do OTP
        navigation.navigate('Verification', {
            signerId: signerId,
            signatureUri: rubricaUri,
            otpData: otpData
        });
    };

    const handleClear = () => {
        setRubricaUri(null);
        setIsSimulated(false);
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Passo 1.5: Captura da Rubrica</Text>
                    <Text style={styles.subtitle}>Desenhe sua assinatura abaixo.</Text>

                    {/* 🚨 IMPLEMENTAÇÃO CONDICIONAL (BLOCO DE ALTO RISCO - COMPACTADO) */}
                    <View style={styles.canvasContainer}>
                        {Platform.OS !== 'web' ? (
                            // ✅ COMPONENTE REAL: Android/iOS
                            <Signature
                                onOK={handleEndDrawing}
                                onClear={handleClear}
                                descriptionText="Assine aqui"
                                penColor="black"
                                backgroundColor="rgb(255,255,255)"
                                containerStyle={styles.signatureContainer}
                                wrapperStyle={styles.signatureWrapper}
                                webStyle={`.m-signature-pad--footer {display: none;} body {background-color: #FFF;}`}
                            />
                        ) : (
                            // ✅ PLACEHOLDER: WEB
                            <View style={styles.canvasPlaceholder}>
                                <Text style={styles.placeholderText}>
                                    CANVAS (Não suportado no Web. Clique para simular)
                                </Text>
                                <Button
                                    title="Capturar Assinatura (Simulação)"
                                    onPress={handleSimulateExport}
                                    color="#dc3545"
                                    disabled={rubricaUri !== null}
                                />
                            </View>
                        )}
                    </View>

                    <Text style={{ marginTop: 15, color: rubricaUri ? '#28a745' : '#dc3545', fontWeight: 'bold', textAlign: 'center' }}>
                        Status: {rubricaUri ? (isSimulated ? '✅ SIMULADO (Web)' : '✅ Capturado Real') : '❌ Aguardando Captura...'}
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
                                title="Limpar Assinatura"
                                onPress={handleClear}
                                color="#dc3545"
                            />
                        </View>
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
        width: CANVAS_WIDTH, maxWidth: 700, backgroundColor: '#fff', padding: 30,
        borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 6, elevation: 8, alignSelf: 'center',
    },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#007BFF', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
    canvasContainer: {
        height: CANVAS_HEIGHT,
        width: '100%',
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 20,
    },
    canvasPlaceholder: {
        height: CANVAS_HEIGHT,
        width: '100%',
        borderWidth: 2,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#f9f9f9'
    },
    placeholderText: {
        color: '#aaa',
        fontSize: 16,
        marginBottom: 10
    },
    signatureContainer: {
        flex: 1,
    },
    signatureWrapper: {
        flex: 1,
        borderWidth: 0,
    }
});