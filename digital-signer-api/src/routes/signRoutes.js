const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path'); 

// ⭐️ CONSOLIDAÇÃO DE IMPORTS
const authMiddleware = require('../middleware/authMiddleware');
const cryptoService = require('../services/cryptoService');
const tsaService = require('../services/tsaService');
const otpService = require('../services/otpService');
const dbService = require('../services/dbService');

// 1. CONFIGURAÇÃO DO MULTER
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadMiddleware = upload.fields([
    { name: 'documentFile', maxCount: 1 }, 
    { name: 'signatureImage', maxCount: 1 } 
]);

// 2. PRÉ-CARREGAMENTO DO TEMPLATE
const TEMPLATE_FILENAME = 'Contrato_Teste.pdf';
let CONTRATO_TEMPLATE_BUFFER = null;

try {
    const templatePath = path.join(__dirname, '..', 'templates', TEMPLATE_FILENAME);
    CONTRATO_TEMPLATE_BUFFER = fs.readFileSync(templatePath);
    console.log(`Template ${TEMPLATE_FILENAME} pré-carregado com sucesso.`);
} catch (e) {
    console.error(`[ERRO CRÍTICO ENOENT]: Não foi possível carregar o template.`, e.message);
}


// ROTA 1: GERAR E ENVIAR O TOKEN OTP
router.post('/otp/generate', authMiddleware, async (req, res) => {
    const { signerId, method, recipient } = req.body;

    if (!signerId || !method || !recipient) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    }

    try {
        const token = otpService.generateToken(signerId);
        const message = await otpService.sendToken(method, recipient, token);
        res.status(200).json({ message });
    } catch (error) {
        console.error('[ERRO NA ROTA /otp/generate]:', error);
        res.status(500).json({ message: 'Erro interno ao processar a solicitação de OTP: ' + error.message });
    }
});


// ROTA 2: Assinatura com Upload ou Template Fixo (POST)
router.post('/document/sign', authMiddleware, uploadMiddleware, async (req, res) => {

    const { signerId, signerName, contractTitle, documentId, submittedOTP, templateId } = req.body;
    
    // ⭐️ CONSOLIDAÇÃO DA DESESTRUTURAÇÃO (Mais conciso)
    const rubricaFile = req.files?.signatureImage?.[0]; 
    const documentFile = req.files?.documentFile?.[0]; 

    let fileBuffer;
    let fileName = '';
    let fileSource = '';
    let visualRubricData = 'N/A'; 

    try {
        const isTemplateFlow = templateId && templateId !== 'upload';

        // 1. Validação Crítica dos Dados
        if (!documentId || !submittedOTP) throw new Error("ID do Documento e OTP são obrigatórios.");
        if (!rubricaFile || !rubricaFile.buffer) return res.status(400).json({ error: "O arquivo da Rubrica está ausente ou corrompido." });
        
        // 2. Determinação da Fonte do Arquivo
        if (isTemplateFlow) {
             if (templateId === 'template-servico') {
                 if (!CONTRATO_TEMPLATE_BUFFER) throw new Error('O Template pré-carregado não está disponível no servidor.');
                 
                 fileBuffer = CONTRATO_TEMPLATE_BUFFER; // Usando o Buffer pré-carregado
                 fileName = TEMPLATE_FILENAME; // Usando a constante
                 fileSource = 'Template Fixo: Contrato Serviço';
             } else {
                 throw new Error('Template fixo não encontrado na API.');
             }
        } else {
             if (!documentFile) return res.status(400).json({ error: "Arquivo de upload (PDF/Documento) ausente no fluxo de upload." });
             
             fileBuffer = documentFile.buffer; 
             fileName = documentFile.originalname;
             fileSource = 'Upload do Cliente';
        }

        // ⭐️ RESILIÊNCIA DE MEMÓRIA (Gera Hash)
        const rubricaHash = cryptoService.generateDocumentHash(rubricaFile.buffer); 
        visualRubricData = `HASH_RECEIVED:${rubricaHash}`; 
        
        // 3. AUTENTICAÇÃO E VALIDAÇÃO OTP
        const validationResult = otpService.validateToken(signerId, submittedOTP);
        if (!validationResult.valid) return res.status(401).json({ error: validationResult.message }); 

        // 4. GERAÇÃO DO REGISTRO
        const documentHash = cryptoService.generateDocumentHash(fileBuffer);
        const timestampData = tsaService.getTrustedTimestamp();
        const signatureValue = cryptoService.signData(`${documentHash}|${timestampData.timestamp}|${signerId}`);

        const signatureRecord = {
            documentId, signerId, signerName, contractTitle,
            fileMetadata: { name: fileName, source: fileSource, rubricaSize: rubricaFile.size },
            signatureData: {
                hash: documentHash, signatureValue, timestampData,
                authMethod: 'OTP', visualRubric: visualRubricData 
            },
            signedAt: new Date().toISOString()
        };

        await dbService.saveSignatureRecord(signatureRecord);

        res.status(200).json({ success: true, message: "Assinatura concluída.", signatureRecord: { documentId } });

    } catch (error) {
        console.error("Erro ao processar assinatura:", error);
        
        let errorMessage = error.message || "Falha interna no servidor.";
        let statusCode = 500;
        
        if (error.code === 'LIMIT_FILE_SIZE') { statusCode = 413; errorMessage = 'Arquivo de assinatura muito grande.'; } 
        else if (error.message.includes("not valid")) { statusCode = 401; errorMessage = "OTP inválido ou expirado."; } 
        else if (error.message.includes("Template pré-carregado")) { statusCode = 500; errorMessage = "Falha interna: Template de documento não encontrado."; } 
        
        res.status(statusCode).json({ error: errorMessage });
    }
});


// ROTA 3: DOWNLOAD DO DOCUMENTO ASSINADO (GET)
router.get('/document/:documentId/download', async (req, res) => {
    const { documentId } = req.params;

    try {
        const templatePath = path.join(__dirname, '..', 'templates', TEMPLATE_FILENAME);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: "Arquivo de template não encontrado no servidor." });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${documentId}.pdf"`);
        
        fs.createReadStream(templatePath).pipe(res);

    } catch (error) {
        console.error("Erro ao servir documento para download:", error);
        res.status(500).json({ error: "Falha interna ao servir o documento." });
    }
});


// ROTA 4: Buscar Evidência (GET)
router.get('/document/:searchTerm/evidence', async (req, res) => {
    const { searchTerm } = req.params;

    if (!searchTerm) {
        return res.status(400).json({ error: "O termo de busca é obrigatório." });
    }

    try {
        const evidence = await dbService.getEvidence(searchTerm);

        if (!evidence) {
            return res.status(404).json({ success: false, message: "Registro de evidência legal não encontrado." });
        }

        res.status(200).json({ success: true, message: "Evidência legal recuperada.", evidenceRecord: evidence });

    } catch (error) {
        console.error("Erro ao buscar evidência:", error);
        res.status(500).json({ error: "Falha interna ao buscar evidência." });
    }
});


module.exports = router;