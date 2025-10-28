const path = require('path'); 
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });


const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { pool } = require('./db'); 


const signRoutes = require('./routes/signRoutes'); 
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 


app.get('/', (req, res) => {
    res.status(200).send({
        service: 'Assinatura API',
        status: 'Operational',
        uptime: process.uptime().toFixed(2) + 's'
    });
});


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


app.use('/api/v1', signRoutes);
app.use('/api/v1/auth', authRoutes); 


module.exports = app; 


pool.connect()
    .then(client => {
        console.log('✅ PostgreSQL conectado com sucesso!');
        client.release(); 

        if (!module.parent) {
            app.listen(PORT, () => {
                console.log('======================================================');
                console.log(`🚀 API de Assinatura rodando em http://localhost:${PORT}`);
                console.log('======================================================');
            });
        }
    })
    .catch(err => {
        console.error('❌ Erro fatal ao conectar com o PostgreSQL:', err.message);
        process.exit(1);
    });