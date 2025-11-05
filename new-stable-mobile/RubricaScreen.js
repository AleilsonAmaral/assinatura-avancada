// Arquivo: RubricaScreen.js (Implementação de Desenho Real com Fallback para Web)

import React, { useState, useRef } from 'react'; // 🚨 ADICIONADO: useRef
import { StyleSheet, Text, View, Button, SafeAreaView, ScrollView, Alert, Dimensions, Platform } from 'react-native';
import Signature from 'react-native-signature-canvas';
import * as FileSystem from 'expo-file-system'; // Importação necessária para salvar o arquivo

const { width } = Dimensions.get('window');

// Dimensões do Canvas
const CANVAS_WIDTH = width * 0.9;
const CANVAS_HEIGHT = 200;

// 🚨 FUNÇÃO DE MOCK: Usaremos a função de mock para o ambiente Web (navegador)
const MOCK_URI_PREFIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// ⭐️ FUNÇÃO CRÍTICA: Salva o Base64 da Assinatura em uma URI local
const saveBase64AsFile = async (base64Data, signerId, setRubricaUri) => {
    // 🎯 CORREÇÃO: Usar REGEX para limpar qualquer prefixo MIME (mais robusto)
    if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:')) {
        Alert.alert("Erro", "O Canvas não capturou o desenho. Tente novamente.");
        return; 
    }

    // Remove o prefixo de tipo de dado ("data:image/png;base64,") para obter apenas a Base64
    const base64Clean = base64Data.split(',')[1]; 

    const fileName = `rubrica_${signerId}_${Date.now()}.png`;
    const fileUri = FileSystem.cacheDirectory + fileName; 

    try {
        await FileSystem.writeAsStringAsync(fileUri, base64Clean, { 
            encoding: FileSystem.EncodingType.Base64,
        });
        
        setRubricaUri(fileUri); 
        Alert.alert("Sucesso", "Assinatura capturada e salva.");
        
    } catch (error) {
        console.error("Erro ao salvar assinatura como URI (FileSystem):", error);
        Alert.alert("Erro", "Falha ao processar a assinatura. Tente novamente.");
    }
};


export default function RubricaScreen({ route, navigation }) {
    const { signerId, otpData } = route.params;
    const [rubricaUri, setRubricaUri] = useState(null);
    const [isSimulated, setIsSimulated] = useState(false);
    
    const signatureRef = useRef(null); // ⬅️ 1. ADICIONADO: Referência para o Canvas


    // ✅ FUNÇÃO CHAMADA PELO onOK DO COMPONENTE NATIVO
    const handleEndDrawing = (uriBase64) => {
        if (uriBase64) {
            saveBase64AsFile(uriBase64, signerId, setRubricaUri); 
        } else {
            Alert.alert("Atenção", "Nenhuma assinatura detectada.");
        }
        setIsSimulated(false);
    };

    // ⭐️ LÓGICA DE SIMULAÇÃO (USADO NO WEB)
    const handleSimulateExport = () => {
        if (Platform.OS === 'web') {
            setRubricaUri(MOCK_URI_PREFIX);
            setIsSimulated(true);
            Alert.alert("Simulação Completa", "Rubrica simulada. Prossiga para a verificação.");
        }
    };

    // 🎯 FUNÇÃO PARA EXPORTAR (CHAMADA PELO BOTÃO)
    const handleExportSignature = () => {
        if (rubricaUri !== null) {
            Alert.alert("Atenção", "A rubrica já está salva. Limpe para refazer.");
            return;
        }
        
        // 🚨 AÇÃO CRÍTICA: Força o componente a exportar o desenho
        if (signatureRef.current) { 
            signatureRef.current.readSignature(); // ⬅️ ACIONA O onOK/handleEndDrawing
        } else {
            Alert.alert("Erro", "O Canvas de assinatura não foi inicializado."); 
        }
    };


    // FUNÇÃO DE NAVEGAÇÃO
    const goToVerification = () => {
        if (!rubricaUri) {
            Alert.alert("Atenção", "É obrigatório capturar a assinatura antes de continuar.");
            return;
        }

        navigation.navigate('Verification', {
            signerId: signerId,
            signatureUri: rubricaUri,
            otpData: otpData
        });
    };

    const handleClear = () => {
        setRubricaUri(null);
        setIsSimulated(false);
        // Garante que o canvas seja limpo (só funciona se o ref não for nulo)
        if (signatureRef.current) signatureRef.current.clearSignature(); 
    };


    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <Text style={styles.title}>Passo 1.5: Captura da Rubrica</Text>
                    <Text style={styles.subtitle}>Desenhe sua assinatura abaixo.</Text>

                    {/* 🚨 IMPLEMENTAÇÃO CONDICIONAL */}
                    <View style={styles.canvasContainer}>
                        {Platform.OS !== 'web' ? (
                            // ✅ COMPONENTE REAL: Android/iOS
                            <Signature
                                ref={signatureRef} // ⬅️ CONECTAR A REFERÊNCIA AQUI
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
                        {/* 🎯 NOVO BOTÃO: 1. SALVAR RUBRICA (Ação Crítica) */}
                         <Button
                            title="1. Salvar Rubrica"
                            onPress={handleExportSignature} 
                            disabled={rubricaUri !== null} 
                            color="#007BFF" 
                        />
                        
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title="2. AVANÇAR PARA VERIFICAÇÃO OTP"
                                onPress={goToVerification}
                                disabled={!rubricaUri} 
                                color={rubricaUri ? "#28a745" : "#bdc3c7"}
                            />
                        </View>
                        
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title="Limpar Assinatura"
                                onPress={handleClear}
                                color="#dc3545"
                                disabled={!rubricaUri} 
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