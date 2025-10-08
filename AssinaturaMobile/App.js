import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importa as Telas
import LoginScreen from './LoginScreen';
import SignatureScreen from './SignatureScreen';
import VerificationScreen from './VerificationScreen';
import EvidenceScreen from './EvidenceScreen'; // <--- NOVO: Importa a Tela de Auditoria

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

        {/* ROTA 2: GERAÇÃO DE OTP (Passo 1) */}
        <Stack.Screen
          name="Signature"
          component={SignatureScreen}
          options={{ title: 'Passo 1: Gerar OTP' }}
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

      </Stack.Navigator>
    </NavigationContainer>
  );
}