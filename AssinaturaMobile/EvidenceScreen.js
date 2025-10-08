import React, { useState } from 'react';
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

// Componente para exibir os detalhes da evidência
const EvidenceDisplay = ({ record }) => {
    const signedAt = new Date(record.signedAt).toLocaleString();
    const hashShort = record.signatureData.hash.substring(0, 40) + '...';
    
    // Tentamos exibir a rubrica se ela existir no registro (Base64)
    const Rubrica = record.signatureData.visualRubric && record.signatureData.visualRubric !== 'N/A' 
        ? (<Text style={styles.dataValue}>Rubrica visual anexada.</Text>)
        : (<Text style={styles.dataValue}>Nenhuma rubrica visual registrada.</Text>);


    return (
        <View style={styles.evidenceCard}>
            <Text style={styles.evidenceHeader}>✅ EVIDÊNCIA LEGAL VERIFICADA</Text>
            
            <Text style={styles.dataLabel}>Assinado em (Timestamp):</Text>
            <Text style={styles.dataValue}>{signedAt}</Text>

            <Text style={styles.dataLabel}>ID do Documento:</Text>
            <Text style={styles.dataValue}>{record.documentId}</Text>
            
            <Text style={styles.dataLabel}>Nome do Signatário:</Text>
            <Text style={styles.dataValue}>{record.signerName}</Text>

            <Text style={styles.dataLabel}>Hash Criptográfico (Prova de Integridade):</Text>
            <Text style={[styles.dataValue, styles.hashText]}>{hashShort}</Text>
            
            <Text style={styles.dataLabel}>Método de Autenticação:</Text>
            <Text style={styles.dataValue}>{record.signatureData.authMethod} (OTP)</Text>
            
            <Text style={styles.dataLabel}>Rubrica Manuscrita:</Text>
            {Rubrica}

            <Text style={styles.helperText}>*A comparação do Hash em um sistema de auditoria comprova a integridade e não-repúdio.</Text>
        </View>
    );
};


export default function EvidenceScreen({ navigation }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [evidenceRecord, setEvidenceRecord] = useState(null);
    

    const buscarEvidencia = async () => {
        if (!searchTerm) {
            setStatus({ message: "Insira o ID do Documento ou Hash para buscar.", type: 'error' });
            return;
        }

        setIsLoading(true);
        setEvidenceRecord(null);
        setStatus({ message: `Buscando evidência para: ${searchTerm}...`, type: 'info' });

        try {
            // Rota GET /document/:searchTerm/evidence
            const response = await fetch(`${API_BASE_URL}/document/${encodeURIComponent(searchTerm)}/evidence`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            
            const data = await response.json();

            if (response.ok) {
                setEvidenceRecord(data.evidenceRecord);
                setStatus({ message: `Evidência encontrada para Doc ID: ${data.evidenceRecord.documentId}.`, type: 'success' });
            } else {
                setStatus({ message: data.message || "Evidência não encontrada no banco de dados.", type: 'error' });
            }

        } catch (error) {
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
                        placeholder="Ex: DOC-ALUGUEL-001 ou CPF"
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
                            onPress={buscarEvidencia} 
                            color="#2c3e50"
                        />
                    )}

                    {evidenceRecord && (
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
