// src/app.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// --- 1. IMPORTAÇÃO DOS DOIS ARQUIVOS DE ROTAS ---
const signRoutes = require('./routes/signRoutes'); 
const authRoutes = require('./routes/authRoutes'); // <-- ADICIONE ESTA LINHA

const app = express();
const PORT = process.env.PORT || 3000;

// ...

// --- Middlewares Essenciais ---

// 1. CONFIGURAÇÃO FLEXÍVEL DO CORS (Para compatibilidade com Mobile Apps)
// Se você está em ambiente de desenvolvimento, usar '*' é comum.
// Em produção, você listaria as URLs do seu app e do seu frontend.
app.use(cors({
    origin: '*', // Permite que qualquer origem (incluindo apps móveis) acesse a API
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); 
// ... (o restante do arquivo)

// --- 2. CONFIGURAÇÃO DAS ROTAS DA API ---
// Centraliza todas as suas rotas sob prefixos
app.use('/api/v1', signRoutes);
app.use('/api/v1/auth', authRoutes); // <-- ADICIONE ESTA LINHA

// --- Conexão com o MongoDB e Inicialização do Servidor ---
// A aplicação só começa a "ouvir" requisições DEPOIS de conectar ao banco
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB conectado com sucesso!');
        
        app.listen(PORT, () => {
            console.log('======================================================');
            console.log(`🚀 API de Assinatura rodando em http://localhost:${PORT}`);
            console.log('======================================================');
        });
    })
    .catch(err => {
        console.error('❌ Erro fatal ao conectar com o MongoDB:', err.message);
        process.exit(1); // Encerra a aplicação se não conseguir conectar ao DB
    });