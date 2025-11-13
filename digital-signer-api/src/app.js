// digital-signer-api/src/app.js (Versão FINAL CORRIGIDA)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });


const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { pool } = require('./db');


const signRoutes = require('./routes/signRoutes');
const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ CORREÇÃO: Tratamento explícito para OPTIONS (CORS)
app.options(/.*/, cors());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 1. ROTA DE HEALTH CHECK (Corrigido o erro de duplicação)
app.get('/', (req, res) => {
    res.status(200).send({
        service: 'Assinatura API',
        status: 'Operational',
        uptime: process.uptime().toFixed(2) + 's'
    });
});


// 2. ROTA DE DOWNLOAD DE DOCUMENTOS (PDF)
app.get('/api/v1/document/:documentId/download', (req, res) => {
    const { documentId } = req.params;
    const templateFileName = 'Contrato_Teste.pdf';

    const templatePath = path.join(__dirname, 'templates', templateFileName);
    console.log(`DEBUG: Tentando servir arquivo de: ${templatePath}`);

    try {
        if (!fs.existsSync(templatePath)) {
            console.error(`[DOWNLOAD FAIL] PDF not found at: ${templatePath}`);
            return res.status(404).send({ error: "Documento não encontrado no servidor. Falha de caminho." });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${documentId}.pdf"`);

        fs.createReadStream(templatePath).pipe(res);

    } catch (e) {
        console.error("Erro ao servir documento:", e);
        res.status(500).send({ error: "Falha interna no servidor ao tentar servir o PDF." });
    }
});


// ====================================================================
// ROTA: DOWNLOAD DA PLANILHA DE AUDITORIA (Paliativo de MVP)
// ====================================================================

app.get('/api/v1/export/download', authMiddleware, async (req, res) => {

    // O caminho do arquivo é o mesmo usado no ExportService.js
    const EXPORT_FILE = path.join(__dirname, '..', 'registros_assinaturas.xlsx');

    try {
        // 1. Verifica se o arquivo Excel foi criado
        if (!fs.existsSync(EXPORT_FILE)) {
            // Retorna 404 para o front-end, mas com a mensagem correta
            return res.status(404).json({ error: "O arquivo de auditoria ainda não foi gerado ou está vazio." });
        }

        // 2. Define os cabeçalhos para forçar o download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="registros_assinaturas_${new Date().toISOString().slice(0, 10)}.xlsx"`);

        // 3. Envia o arquivo como um stream de download
        fs.createReadStream(EXPORT_FILE).pipe(res);

    } catch (error) {
        console.error("Erro ao servir arquivo Excel:", error);
        res.status(500).json({ error: "Falha interna no servidor ao tentar servir o arquivo Excel." });
    }
});


// 3. MONTAGEM DOS ROTAS
app.use('/api/v1', authMiddleware, signRoutes);
app.use('/api/v1/auth', authRoutes);


module.exports = app;


// 🚨 CORREÇÃO CRÍTICA: INÍCIO DO SERVIDOR GARANTIDO
pool.connect()
    .then(client => {
        console.log('✅ PostgreSQL conectado com sucesso!');
        client.release();

        // Removemos o bloco 'if (!module.parent)' para garantir que o servidor inicie
        app.listen(PORT, () => {
            console.log('======================================================');
            console.log(`🚀 API de Assinatura rodando em http://localhost:${PORT}`);
            console.log('======================================================');
        });
    })
    .catch(err => {
        console.error('❌ Erro fatal ao conectar com o PostgreSQL:', err.message);
        process.exit(1);
    });

// Fim do arquivo app.js