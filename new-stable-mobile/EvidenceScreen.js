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
import * as Linking from 'expo-linking'; // ⭐️ Importação necessária para abrir URLs externas
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const API_BASE_URL = 'https://assinatura-avancada.onrender.com/api/v1'; 

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

// ⭐️ Componente EvidenceDisplay com Botão de Visualização de PDF
const EvidenceDisplay = ({ record }) => {
    const signedAt = new Date(record.signedAt).toLocaleString();
    
    const hashValue = record.signatureData.hash || 'Hash Ausente';
    const hashShort = hashValue.length > 40 ? hashValue.substring(0, 40) + '...' : hashValue;
    
    const rubricaData = record.signatureData.visualRubric || 'N/A'; 
    const RubricaStatus = rubricaData.includes('HASH_RECEIVED') || rubricaData.includes('URI_SIMULADA')
        ? (<Text style={[styles.dataValue, {color: '#28a745'}]}>Rubrica anexada (Prova de recebimento Hash).</Text>)
        : (<Text style={styles.dataValue}>Nenhuma rubrica visual registrada.</Text>);

    // ⭐️ FUNÇÃO PARA ABRIR O PDF
    const handleOpenPDF = async () => {
        // Rota do backend para download (necessita do documentId)
         const PDF_URL = `${API_BASE_URL}/document/${record.documentId}/download`; 
    
        try {
            const supported = await Linking.canOpenURL(PDF_URL);

            if (supported) {
                // Abre o PDF no visualizador nativo do aparelho
                await Linking.openURL(PDF_URL);
            } else {
                Alert.alert(`Erro`, `Não foi possível abrir a URL: ${PDF_URL}`);
            }
        } catch (e) {
            Alert.alert(`Erro`, `Falha ao abrir o documento: ${e.message}`);
        }
    };


    return (
        <View style={styles.evidenceCard}>
            <Text style={styles.evidenceHeader}>✅ EVIDÊNCIA LEGAL VERIFICADA</Text>
            
            {/* Seus campos de dados */}
            <Text style={styles.dataLabel}>Assinado em:</Text>
            <Text style={styles.dataValue}>{signedAt}</Text>
            <Text style={styles.dataLabel}>ID do Documento:</Text>
            <Text style={styles.dataValue}>{record.documentId}</Text>
            <Text style={styles.dataLabel}>Nome do Signatário:</Text>
            <Text style={styles.dataValue}>{record.signerName}</Text>
            <Text style={styles.dataLabel}>Hash Criptográfico (SHA-256):</Text>
            <Text selectable={true} style={[styles.dataValue, styles.hashText]}>{hashShort}</Text>
            <Text style={styles.dataLabel}>Método de Autenticação:</Text>
            <Text style={styles.dataValue}>{record.signatureData.authMethod} (OTP)</Text>
            <Text style={styles.dataLabel}>Status da Rubrica:</Text>
            {RubricaStatus}

            {/* ⭐️ NOVO BOTÃO DE VISUALIZAÇÃO DE PDF */}
            <View style={{ marginTop: 25 }}>
                <Button
                    title="VISUALIZAR DOCUMENTO ASSINADO (PDF)"
                    onPress={handleOpenPDF}
                    color="#28a745"
                />
            </View>

            <Text style={styles.helperText}>*A comparação do Hash em um sistema de auditoria comprova a integridade e não-repúdio.</Text>
        </View>
    );
};


export default function EvidenceScreen({ route, navigation }) {
    
    // ⭐️ CORREÇÃO: Inicializa com o documentId, se ele vier da rota 'Verification'
    const initialDocId = route.params?.documentId || '';

    const [searchTerm, setSearchTerm] = useState(initialDocId);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [evidenceRecord, setEvidenceRecord] = useState(null);
    
    // ⭐️ Correção: Se o documentId veio da rota (após a assinatura), busca-o imediatamente
    useEffect(() => {
        if (initialDocId) {
            // Chamamos a função com o ID recebido da rota
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
        setEvidenceRecord(null);
        setStatus({ message: `Buscando evidência para: ${id}...`, type: 'info' });

        try {
            // Rota GET /document/:searchTerm/evidence
            const response = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(id)}/evidence`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }, 
            });
            
            let data = {};
            try {
                data = await response.json();
            } catch (jsonError) {
                // Servidor retornou erro sem corpo JSON
                data = { message: `Erro HTTP ${response.status}. Servidor inacessível.` };
            }

            if (response.ok) {
                setEvidenceRecord(data.evidenceRecord);
                setStatus({ message: `Evidência encontrada para Doc ID: ${data.evidenceRecord.documentId}.`, type: 'success' });
            } else {
                setStatus({ message: data.message || "Evidência não encontrada no banco de dados.", type: 'error' });
            }

        } catch (error) {
            console.error("Erro de Rede ao buscar evidência:", error);
            setStatus({ message: "Erro de Conexão com a API. Verifique o Render.", type: 'error' });
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

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
                    ) : (
                        <Button 
                            title="Buscar Evidência Legal" 
                            onPress={() => buscarEvidencia()} // Chama a função com o searchTerm atual
                            color="#2c3e50"
                        />
                    )}

                    {evidenceRecord && (
                        // ⭐️ Renderiza o componente que agora contém o botão de PDF
                        <EvidenceDisplay record={evidenceRecord} />
                    )}
                    
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
    evidenceCard: {
        marginTop: 30,
        padding: 20,
        backgroundColor: '#ecf0f1',
        borderRadius: 8,
        borderLeftWidth: 5,
        borderLeftColor: '#2ecc71',
        width: '100%',
    },
    evidenceHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#2ecc71',
    },
    dataLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 10,
        color: '#34495e',
    },
    dataValue: {
        fontSize: 14,
        marginBottom: 5,
        color: '#555',
        marginLeft: 10,
    },
    hashText: {
        fontSize: 12,
        color: '#e74c3c',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
    },
    helperText: {
        fontSize: 10,
        marginTop: 10,
        color: '#7f8c8d',
        fontStyle: 'italic',
    }
});