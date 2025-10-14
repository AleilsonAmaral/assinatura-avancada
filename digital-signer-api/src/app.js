require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// ⭐️ IMPORTAÇÕES ESSENCIAIS (Movidas para o topo)
const fs = require('fs');
const path = require('path'); 


// IMPORTAÇÃO DOS DOIS ARQUIVOS DE ROTAS 
const signRoutes = require('./routes/signRoutes'); 
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;


// Middlewares Essenciais 
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); 

// Rota de Saúde/Raiz
app.get('/', (req, res) => {
    res.status(200).send({
        service: 'Assinatura API',
        status: 'Operational',
        uptime: process.uptime() + 's' 
    });
});


// ⭐️ 1. ROTA DE DOWNLOAD PRIORITÁRIA (ISOLAMENTO DO 404)
app.get('/api/v1/document/:documentId/download', (req, res) => {
    const { documentId } = req.params;
    const templateFileName = 'Contrato_Teste.pdf';
    
    // ⭐️ CAMINHO: path.join(__dirname, '..', 'templates', filename) é a forma correta de
    // apontar da pasta /src/app.js (onde está __dirname) para /templates/
    const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
    
    // LOG DE DEBUG (CRÍTICO): Mostra o caminho que o Render está procurando
    console.log(`DEBUG: Tentando servir arquivo de: ${templatePath}`);
    
    try {
        if (!fs.existsSync(templatePath)) {
            console.error(`[DOWNLOAD FAIL] PDF not found at: ${templatePath}`);
            // Retorna 404 (para o navegador) OU 500 (para debug) se o arquivo não existir
            return res.status(404).send({ error: "Documento não encontrado no servidor. Falha de caminho. Verifique o log do Render." });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${documentId}.pdf"`);
        
        // Servir o arquivo
        fs.createReadStream(templatePath).pipe(res);

    } catch (e) {
        console.error("Erro ao servir documento:", e);
        res.status(500).send({ error: "Falha interna no servidor ao tentar servir o PDF." });
    }
});


// 2. CONFIGURAÇÃO DAS ROTAS DA API 
app.use('/api/v1', signRoutes);
app.use('/api/v1/auth', authRoutes); 

// Conexão com o MongoDB e Inicialização do Servidor 

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
        process.exit(1);
    });