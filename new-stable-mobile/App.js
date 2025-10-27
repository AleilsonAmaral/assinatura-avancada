import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importa as Telas
import LoginScreen from './LoginScreen';
import SignatureScreen from './SignatureScreen';
import VerificationScreen from './VerificationScreen';
import EvidenceScreen from './EvidenceScreen';
import RubricaScreen from './RubricaScreen';
import RegisterScreen from './RegisterScreen';
import EvidenceDetailsScreen from './EvidenceDetailsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">

                {/* ROTA 1: LOGIN */}
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                />

                {/* ⭐️ ROTA 1.5: CRIAR CONTA */}
                <Stack.Screen
                    name="Register"
                    component={RegisterScreen}
                    options={{ title: 'Criar Nova Conta' }}
                />

                {/* ROTA 2: GERAÇÃO DE OTP (Passo 1) */}
                <Stack.Screen
                    name="Signature"
                    component={SignatureScreen}
                    options={{ title: 'Passo 1: Gerar OTP' }}
                />

                {/* ⭐️ ROTA 2.5: CAPTURA DA RUBRICA (Passo 1.5) */}
                <Stack.Screen
                    name="Rubrica"
                    component={RubricaScreen}
                    options={{ title: 'Passo 1.5: Captura da Rubrica' }}
                />

                {/* ROTA 3: VERIFICAÇÃO E ASSINATURA (Passo 2) */}
                <Stack.Screen
                    name="Verification"
                    component={VerificationScreen}
                    options={{ title: 'Passo 2: Finalizar Assinatura' }}
                />

                {/* ROTA 4: BUSCA DE EVIDÊNCIAS (Auditoria) */}
                <Stack.Screen
                    name="Evidence"
                    component={EvidenceScreen}
                    options={{ title: 'Auditoria de Assinaturas' }}
                />

                {/* 🚀 ADIÇÃO DA ROTA DE DETALHES 🚀 */}
                <Stack.Screen
                    name="EvidenceDetails"
                    component={EvidenceDetailsScreen}
                    options={{ title: 'Detalhes da Evidência Legal' }}
                />

            </Stack.Navigator>
        </NavigationContainer>
    );
}