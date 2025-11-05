// Arquivo: SignatureCanvasContainer.js (USANDO RNSketchCanvas)

import React, { useRef } from 'react';
import { StyleSheet, View, Alert, Button } from 'react-native';
import * as FileSystem from 'expo-file-system';
// 🚨 NOVO COMPONENTE
import RNSketchCanvas from '@terrylinla/react-native-sketch-canvas'; 

// ⭐️ FUNÇÃO DE SALVAMENTO: MOVIDA PARA DENTRO do componente (Pode ser movida para o RubricaScreen, se preferir)
const saveBase64AsFile = async (base64Data, signerId, setRubricaUri) => {
    
    // **NOTA:** O RNSketchCanvas com o parâmetro 'true' na exportação JÁ retorna a Base64 PURA.
    // Se o seu RNSketchCanvas estiver configurado corretamente, a linha de substituição abaixo
    // não será estritamente necessária, mas é mantida por segurança (Opção A da nossa análise).
    const base64Clean = base64Data.includes('data:') ? base64Data.split(',')[1] : base64Data;
    
    const fileName = `rubrica_${signerId}_${Date.now()}.png`;
    const fileUri = FileSystem.cacheDirectory + fileName; 

    try {
        await FileSystem.writeAsStringAsync(fileUri, base64Clean, {
            encoding: FileSystem.EncodingType.Base64,
        });
        
        // 🎯 O ESTADO É ATUALIZADO AQUI
        setRubricaUri(fileUri);
        Alert.alert("Sucesso", "Assinatura capturada e salva.");
        
    } catch (error) {
        console.error("Erro ao salvar assinatura como URI:", error);
        Alert.alert("Erro", "Falha ao processar a assinatura. Tente novamente.");
    }
};

const SignatureCanvasContainer = ({ signerId, setRubricaUri, rubricaUri }) => {
    // 🚨 REFERÊNCIA PARA O NOVO CANVAS
    const sketchRef = useRef(null);
    
    // Chamado pelo botão '1. Salvar Rubrica'
    const handleExportSignature = () => {
        // Se já está salvo, impede um novo salvamento
        if (rubricaUri !== null) {
            Alert.alert("Atenção", "A rubrica já está salva. Limpe para refazer.");
            return;
        }

        if (sketchRef.current) {
            // 🚨 NOVO MÉTODO: getBase64() do RNSketchCanvas
            // Parâmetros: 'png', transparência (false), somente Base64 pura (true), callback
            sketchRef.current.getBase64('png', false, true, (error, base64StringPura) => {
                if (error) {
                    Alert.alert("Erro", "Falha ao gerar a Base64 da assinatura.");
                    return;
                }
                
                if (base64StringPura) {
                    // 🎯 CHAMA A FUNÇÃO DE SALVAMENTO COM A BASE64 PURA
                    saveBase64AsFile(base64StringPura, signerId, setRubricaUri);
                } else {
                    Alert.alert("Atenção", "Nenhuma assinatura detectada.");
                }
            });
            
        } else {
            Alert.alert("Erro", "O Canvas de assinatura não foi inicializado.");
        }
    };
    
    // Não precisamos de styleCanvas web, pois o RNSketchCanvas não é usado no Web
    // A lógica de Web deve estar no RubricaScreen (que é o que você tinha).

    return (
        <>
            <View style={styles.canvasContainer}>
                {/* 🚨 COMPONENTE NOVO */}
                <RNSketchCanvas
                    ref={sketchRef}
                    strokeColor={'black'} // Cor da caneta
                    strokeWidth={5} // Largura da caneta
                    containerStyle={{ flex: 1 }} // Ocupa o container
                    // Não precisa de onOK ou onEmpty, pois usamos o getBase64() no botão.
                />
            </View>
            
            {/* Botão de Limpar */}
            <Button 
                title="Limpar Assinatura" 
                onPress={() => {
                    if (sketchRef.current) sketchRef.current.clear(); // 🚨 NOVO MÉTODO DE LIMPEZA
                    setRubricaUri(null); // Define o URI como NULL
                }} 
                color="#dc3545" 
                disabled={rubricaUri === null} 
            />
            
            {/* Botão Salvar Rubrica */}
            <View style={{ marginTop: 15 }}>
                <Button 
                    title="1. Salvar Rubrica" 
                    onPress={handleExportSignature} // Chama a nova lógica de exportação
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
        // Adicionando flex para garantir que o RNSketchCanvas ocupe o espaço
        flexGrow: 1, 
    },
});

export default SignatureCanvasContainer;