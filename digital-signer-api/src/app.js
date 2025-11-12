// digital-signer-api/src/app.js (Versão Corrigida para incluir o download do Excel)

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
    // ... (Lógica de download de PDF mantida)
});


// ====================================================================
// 🚨 CORREÇÃO DE ROTA: DOWNLOAD DA PLANILHA DE AUDITORIA (Direto no app.js para teste)
// Adicionamos a rota aqui para garantir que ela seja carregada corretamente.
// O ideal é que esta rota esteja dentro do signRoutes.js, mas a colocamos aqui
// para evitar problemas de aninhamento enquanto testamos.
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
app.use('/api/v1', authMiddleware, signRoutes); // O signRoutes.js agora NÃO deve ter mais a rota de download do Excel.
app.use('/api/v1/auth', authRoutes);


module.exports = app;


pool.connect()
    .then(client => {
        console.log('✅ PostgreSQL conectado com sucesso!');
        client.release();
        // ... (Restante da lógica de inicialização)
    })
    .catch(err => {
        // ... (Lógica de erro de conexão)
    });

// Fim do arquivo app.js