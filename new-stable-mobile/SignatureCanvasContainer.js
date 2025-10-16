// Arquivo: SignatureCanvasContainer.js

import React, { useRef } from 'react';
import { StyleSheet, View, Alert, Button } from 'react-native';
import * as FileSystem from 'expo-file-system';
import SignatureCanvas from 'react-native-signature-canvas'; // A importação nativa problemática


// ⭐️ FUNÇÃO CRÍTICA: Salva o Base64 da Assinatura em uma URI local
const saveBase64AsFile = async (base64Data, signerId, setRubricaUri) => {
    const base64 = base64Data.replace('data:image/png;base64,', '');
    const fileName = `rubrica_${signerId}_${Date.now()}.png`;
    const fileUri = FileSystem.cacheDirectory + fileName; 

    try {
        await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
        });
        
        setRubricaUri(fileUri);
        Alert.alert("Sucesso", "Assinatura capturada e salva.");
        
    } catch (error) {
        console.error("Erro ao salvar assinatura como URI:", error);
        Alert.alert("Erro", "Falha ao processar a assinatura. Tente novamente.");
    }
};

const SignatureCanvasContainer = ({ signerId, setRubricaUri, rubricaUri }) => {
    const signatureRef = useRef(null);
    
    const handleSignature = (signatureBase64) => {
        if (signatureBase64) {
            saveBase64AsFile(signatureBase64, signerId, setRubricaUri);
        } else {
            Alert.alert("Atenção", "Nenhuma assinatura detectada.");
        }
    };

    const handleExportSignature = () => {
        if (signatureRef.current) {
            signatureRef.current.readSignature(); 
        }
    };
    
    const styleCanvas = `.m-signature-pad--body { border: 1px solid #ccc; } .m-signature-pad--footer { display: none; }`;

    return (
        <>
            <View style={styles.canvasContainer}>
                <SignatureCanvas
                    ref={signatureRef}
                    webStyle={styleCanvas}
                    onOK={handleSignature} 
                    onEmpty={() => Alert.alert("Atenção", "Assinatura em branco.")}
                    dataURL={'data:image/png;base64,'}
                />
            </View>
            
            <Button 
                title="Limpar Assinatura" 
                onPress={() => {
                    if (signatureRef.current) signatureRef.current.clearSignature();
                    setRubricaUri(null); 
                }} 
                color="#dc3545" 
            />
            
            <View style={{ marginTop: 15 }}>
                <Button 
                    title="1. Salvar Rubrica" 
                    onPress={handleExportSignature}
                    color="#007BFF" 
                    disabled={rubricaUri !== null}
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    canvasContainer: {
        height: 200, 
        width: '100%',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ccc',
    },
});

export default SignatureCanvasContainer;