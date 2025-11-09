// Arquivo: new-stable-mobile/components/DigitalStamp.js
import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

/**
 * Componente de Carimbo de Assinatura Digital (Certificado de Validação)
 * Exibe os metadados de forma visualmente destacada.
 * @param {object} props - Dados de validação da assinatura.
 */
const SignatureCanvasConteiner = ({ 
    signerName, 
    signatureDate, 
    validationUrl,
    documentHash // Opcional, para exibição de segurança
}) => {

    const handlePressValidation = () => {
        if (validationUrl) {
            // Tenta abrir a URL no navegador
            Linking.openURL(validationUrl).catch(err => console.error("Falha ao abrir URL:", err));
        }
    };

    const formatDate = (isoDate) => {
        try {
            const date = new Date(isoDate);
            // Formato similar ao gov.br: DD/MM/AAAA HH:MM:SS FUSO
            return date.toLocaleString('pt-BR', {
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short' // Exibe o fuso horário (ex: GMT-3)
            });
        } catch (e) {
            return 'Data Inválida';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Documento assinado digitalmente</Text>
            
            {/* Nome do Signatário */}
            <Text style={styles.name}>{signerName.toUpperCase()}</Text>
            
            {/* Data e Hora */}
            <Text style={styles.dataLabel}>
                Data: <Text style={styles.dataValue}>{formatDate(signatureDate)}</Text>
            </Text>

            {/* Link de Verificação */}
            <TouchableOpacity onPress={handlePressValidation} style={styles.linkContainer}>
                <Text style={styles.linkText}>Verifique em</Text>
                <Text style={styles.linkUrl}>{validationUrl}</Text>
            </TouchableOpacity>

            {/* Opcional: Hash de integridade */}
            {documentHash && (
                <Text style={styles.hashText}>
                    Hash: {documentHash.substring(0, 8)}...
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderWidth: 2,
        borderColor: '#dc3545', // Vermelho para destaque (como o gov.br)
        padding: 15,
        backgroundColor: '#f8f9fa', // Fundo leve
        borderRadius: 4,
        alignSelf: 'stretch', // Ocupa a largura total do container pai
        marginVertical: 15,
    },
    header: {
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#343a40',
        textAlign: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
        marginTop: 4,
    },
    dataLabel: {
        fontSize: 12,
        marginTop: 4,
        color: '#6c757d',
    },
    dataValue: {
        fontWeight: 'bold',
        color: '#000',
    },
    linkContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    linkText: {
        fontSize: 11,
        color: '#6c757d',
    },
    linkUrl: {
        fontSize: 12,
        color: '#007bff', 
        textDecorationLine: 'underline',
        fontWeight: 'bold',
    },
    hashText: {
        fontSize: 10,
        color: '#6c757d',
        marginTop: 4,
    }
});

export default SignatureCanvasConteiner;