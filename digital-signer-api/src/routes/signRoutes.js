const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path'); 

const authMiddleware = require('../middleware/authMiddleware');
const cryptoService = require('../services/cryptoService');
const tsaService = require('../services/tsaService');
const otpService = require('../services/otpService');
const dbService = require('../services/dbService');

// 1. CONFIGURAÇÃO DO MULTER COM memoryStorage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 5 * 1024 * 1024
    }
});

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
        return res.status(400).json({ message: 'CPF, método e destinatário são obrigatórios.' });
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
    
    const documentFile = req.files.documentFile ? req.files.documentFile[0] : null;
    const rubricaFile = req.files.signatureImage ? req.files.signatureImage[0] : null; 

    let fileBuffer;
    let fileName = '';
    let fileSource = '';
    let visualRubricData = 'N/A'; 

    try {
        const isTemplateFlow = templateId && templateId !== 'upload';

        if (!documentId || !submittedOTP) {
             throw new Error("ID do Documento e OTP são obrigatórios.");
        }
        
        if (!rubricaFile || !rubricaFile.buffer) {
             return res.status(400).json({ error: "O arquivo da Rubrica está ausente ou corrompido no upload." });
        }
        
        if (isTemplateFlow) {
             if (templateId === 'template-servico') {
                 if (!CONTRATO_TEMPLATE_BUFFER) {
                      throw new Error('O Template pré-carregado não está disponível no servidor.');
                 }
                 fileBuffer = CONTRATO_TEMPLATE_BUFFER;
                 fileName = TEMPLATE_FILENAME;
                 fileSource = 'Template Fixo: Contrato Serviço';
             } else {
                 throw new Error('Template fixo não encontrado na API.');
             }
        } else {
             if (!documentFile) {
                 return res.status(400).json({ error: "Arquivo de upload (PDF/Documento) ausente no fluxo de upload." });
             }
             fileBuffer = documentFile.buffer; 
             fileName = documentFile.originalname;
             fileSource = 'Upload do Cliente';
        }

        const rubricaHash = cryptoService.generateDocumentHash(rubricaFile.buffer); 
        visualRubricData = `HASH_RECEIVED:${rubricaHash}`; 
        
        const validationResult = otpService.validateToken(signerId, submittedOTP);
        if (!validationResult.valid) {
             return res.status(401).json({ error: validationResult.message }); 
        }

        const documentHash = cryptoService.generateDocumentHash(fileBuffer);
        const timestampData = tsaService.getTrustedTimestamp();
        const dataToSign = `${documentHash}|${timestampData.timestamp}|${signerId}`;
        const signatureValue = cryptoService.signData(dataToSign);

        const signatureRecord = {
            documentId: documentId,
            signerId: signerId,
            signerName: signerName,
            contractTitle: contractTitle,
            fileMetadata: {
                name: fileName,
                source: fileSource,
                rubricaSize: rubricaFile.size
            },
            signatureData: {
                hash: documentHash,
                signatureValue: signatureValue,
                timestampData: timestampData,
                authMethod: 'OTP',
                visualRubric: visualRubricData 
            },
            signedAt: new Date().toISOString()
        };

        await dbService.saveSignatureRecord(signatureRecord);

        res.status(200).json({
            success: true,
            message: "Assinatura digital avançada concluída e evidência salva.",
            signatureRecord: { documentId: documentId } 
        });

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


// ❌ ROTA 3: DOWNLOAD DO DOCUMENTO ASSINADO 
// ESTA ROTA FOI REMOVIDA DAQUI PARA SER PRIORIZADA NO app.js E RESOLVER O ERRO 404.


/*ROTA 4: Buscar Evidência (GET)
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
}); */


module.exports = router;