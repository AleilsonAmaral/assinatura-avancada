import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Button } from 'react-native-elements'; // Assumindo que você usa react-native-elements
// Importe a função de fetch da evidência, se houver:
// import { fetchEvidenceDetails } from '../services/evidenceService'; 


// --------------------------------------------------------
// ESTILOS (PLACEHOLDER)
// --------------------------------------------------------
const detailsStyles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#f4f4f4',
    },
    container: {
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#2c3e50',
    },
    subtitle: {
        fontSize: 16,
        color: '#e74c3c', // Cor vermelha para o erro
        marginBottom: 10,
    },
    detailLabel: {
        fontWeight: 'bold',
        marginTop: 10,
        color: '#34495e',
    },
    detailValue: {
        fontSize: 16,
        color: '#2c3e50',
    }
});


// --------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------
const EvidenceDetailsScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { recordId } = route.params; // Assumindo que a ID está nos parâmetros
    
    // Simulação do estado do registro (ajuste conforme seu código)
    const [record, setRecord] = useState(null); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Lógica de fetch da evidência aqui...
        // Exemplo:
        // const loadDetails = async () => {
        //     try {
        //         const data = await fetchEvidenceDetails(recordId);
        //         setRecord(data);
        //     } catch (error) {
        //         console.error('Erro ao buscar detalhes:', error);
        //         setRecord(false); // Sinaliza erro de dados ou ausência
        //     } finally {
        //         setLoading(false);
        //     }
        // };
        // loadDetails();

        // Simulação de delay para teste:
        setTimeout(() => {
            setLoading(false);
            // Simular erro de dados incompletos para testar o bloco de erro
            if (!recordId) { 
               setRecord(false); 
            } else {
               setRecord({
                  hash: '...',
                  signer: '...',
                  timestamp: '...'
               });
            }
        }, 1000);

    }, [recordId]);

    // -------------------------------------------------------------------
    // 🛑 BLOCO DE ERRO: MÁXIMA COMPACTAÇÃO APLICADA AQUI
    // -------------------------------------------------------------------
    if (!record && !loading) {
        return (
            <SafeAreaView style={detailsStyles.safeContainer}>
                <View style={[detailsStyles.card, { padding: 30 }]}>
                    {/* Título e Subtítulo em uma View única para isolamento */}
                    <View style={{alignItems: 'center'}}>
                        <Text style={detailsStyles.title}>Detalhes da Auditoria</Text>
                        <Text style={detailsStyles.subtitle}>Erro: Dados de evidência incompletos.</Text>
                    </View>

                    <View style={{ marginTop: 30 }}>
                        <Button 
                            title="Nova Busca" 
                            onPress={() => navigation.navigate('Evidence')} 
                            color="#2c3e50" 
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }
    // -------------------------------------------------------------------

    if (loading) {
        return (
            <SafeAreaView style={[detailsStyles.safeContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#2c3e50" />
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // RENDERIZAÇÃO PRINCIPAL (Dados carregados)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={detailsStyles.safeContainer}>
            <ScrollView style={detailsStyles.container}>
                <View style={detailsStyles.card}>
                    <Text style={detailsStyles.title}>Detalhes da Evidência Legal</Text>
                    <Text style={detailsStyles.detailLabel}>Hash da Assinatura:</Text>
                    <Text style={detailsStyles.detailValue}>{record.hash}</Text>
                    
                    <Text style={detailsStyles.detailLabel}>Assinante:</Text>
                    <Text style={detailsStyles.detailValue}>{record.signer}</Text>
                    
                    <Text style={detailsStyles.detailLabel}>Timestamp (Carimbo de Tempo):</Text>
                    <Text style={detailsStyles.detailValue}>{record.timestamp}</Text>
                    
                    {/* Adicione mais campos de detalhe conforme necessário */}
                </View>
                
                {/* Botões de Ação */}
                <Button 
                    title="VALIDAR CHAVE PÚBLICA" 
                    onPress={() => console.log('Validar')}
                    buttonStyle={{ backgroundColor: '#2980b9', marginTop: 15 }}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default EvidenceDetailsScreen;