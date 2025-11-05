// Arquivo: RubricaScreen.js (USANDO RNSketchCanvas)

import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Button, SafeAreaView, ScrollView, Alert, Dimensions, Platform } from 'react-native';
// 🚨 COMPONENTE NOVO: RNSketchCanvas
import RNSketchCanvas from '@terrylinla/react-native-sketch-canvas'; 
import * as FileSystem from 'expo-file-system';
import { saveSignatureBase64 } from './BufferService'; // Sua função corrigida

const { width } = Dimensions.get('window');

// Dimensões do Canvas
const CANVAS_WIDTH = width * 0.9;
const CANVAS_HEIGHT = 200;

// 🚨 FUNÇÃO DE MOCK (Mantida para Web)
const MOCK_URI_PREFIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export default function RubricaScreen({ route, navigation }) {
    const { signerId, otpData } = route.params;
    const [rubricaUri, setRubricaUri] = useState(null);
    const [isSimulated, setIsSimulated] = useState(false);
    
    // 🚨 REFERÊNCIA PARA O NOVO CANVAS
    const sketchRef = useRef(null); 


    // ✅ FUNÇÃO CHAMADA PELO BOTÃO (Nova lógica para exportar)
    const handleExportSignature = async () => {
        if (rubricaUri !== null) {
            Alert.alert("Atenção", "A rubrica já está salva. Limpe para refazer.");
            return;
        }

        if (!sketchRef.current) {
             Alert.alert("Erro", "O Canvas de assinatura não foi inicializado.");
             return;
        }
        
        // 🚨 AÇÃO CRÍTICA: Chamada do método do novo Canvas para obter Base64
        // Parâmetros: 'png', transparência (false), somente Base64 pura (true)
        sketchRef.current.getBase64('png', false, true, async (error, base64StringPura) => {
            if (error) {
                Alert.alert("Erro", "Falha ao gerar a imagem da assinatura.");
                console.error("Erro RNSketchCanvas:", error);
                return;
            }
            if (!base64StringPura) {
                 Alert.alert("Atenção", "Nenhuma assinatura detectada.");
                 return;
            }
            
            // 🎯 CHAMA O BufferService com a Base64 PURA
            const savedUri = await saveSignatureBase64(base64StringPura, signerId);
            
            if (savedUri) {
                setRubricaUri(savedUri); 
                Alert.alert("Sucesso", "Assinatura capturada e salva.");
            } else {
                // O BufferService já mostra um alerta, mas podemos reforçar aqui
                Alert.alert("Erro", "Falha ao processar a assinatura. Tente novamente.");
            }
            setIsSimulated(false);
        });
    };

    // ⭐️ LÓGICA DE SIMULAÇÃO (USADO NO WEB)
    const handleSimulateExport = () => {
        if (Platform.OS === 'web') {
            // No Web, simulamos, pois o RNSketchCanvas não funciona
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

        navigation.navigate('Verification', {
            signerId: signerId,
            signatureUri: rubricaUri,
            otpData: otpData
        });
    };

    const handleClear = () => {
        setRubricaUri(null);
        setIsSimulated(false);
        // 🚨 MÉTODO DE LIMPEZA DO NOVO CANVAS
        if (sketchRef.current) sketchRef.current.clear(); 
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
                            // ✅ COMPONENTE NOVO: RNSketchCanvas
                            <RNSketchCanvas
                                ref={sketchRef} // ⬅️ CONECTAR A REFERÊNCIA AQUI
                                strokeColor={'black'}
                                strokeWidth={5}
                                containerStyle={styles.signatureContainer}
                                // Removido onOK e onClear pois usaremos o ref
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
                        {/* 🎯 BOTÃO CHAMA handleExportSignature para forçar a Base64 */}
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

// ... Estilos (Styles.create permanecem os mesmos, apenas a referência de nome de componente muda no container)
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
    // Removido signatureWrapper, não é usado pelo RNSketchCanvas
});