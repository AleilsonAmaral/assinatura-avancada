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

// Configuração do Multer com memoryStorage (CRUCIAL para Render e estabilidade)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

// Campos esperados: documentFile (o documento) e signatureImage (a rubrica)
const uploadMiddleware = upload.fields([
    { name: 'documentFile', maxCount: 1 }, 
    { name: 'signatureImage', maxCount: 1 } 
]);

// ⭐️ Variável global para pré-carregar o template e evitar ENOENT (Mais seguro)
let CONTRATO_TEMPLATE_BUFFER = null;

try {
    const templateFileName = 'Contrato_Teste.pdf';
    // Caminho corrigido, assumindo que templates está no diretório pai de routes/
    const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
    CONTRATO_TEMPLATE_BUFFER = fs.readFileSync(templatePath);
    console.log(`Template ${templateFileName} pré-carregado com sucesso.`);
} catch (e) {
    console.error(`[ERRO CRÍTICO ENOENT]: Não foi possível carregar o template.`, e.message);
}


// ROTA 1: GERAR E ENVIAR O TOKEN OTP (PROTEGIDA POR JWT)
router.post('/otp/generate', authMiddleware, async (req, res) => {
    const { signerId, method, recipient } = req.body;

    if (!signerId || !method || !recipient) {
        return res.status(400).json({
            message: 'CPF do signatário (signerId), método (method) e destinatário (recipient) são obrigatórios.'
        });
    }

    try {
        // Assume que otpService e sendToken estão implementados
        const token = otpService.generateToken(signerId);
        const message = await otpService.sendToken(method, recipient, token);

        res.status(200).json({ message });

    } catch (error) {
        console.error('[ERRO NA ROTA /otp/generate]:', error);
        res.status(500).json({ message: 'Erro interno ao processar a solicitação de OTP: ' + error.message });
    }
});


// ROTA 2: Assinatura com Upload ou Template Fixo (COMPLETO)
router.post('/document/sign', authMiddleware, uploadMiddleware, async (req, res) => {

    const { signerId, signerName, contractTitle, documentId, submittedOTP, templateId } = req.body;
    
    const documentFile = req.files.documentFile ? req.files.documentFile[0] : null;
    const rubricaFile = req.files.signatureImage ? req.files.signatureImage[0] : null; 

    let fileBuffer;
    let fileName = '';
    let fileSource = '';
    // ⭐️ ALTERADO: Salvaremos o Hash ou uma URI de sucesso, não o Base64
    let visualRubricData = 'N/A'; 

    try {
        const isTemplateFlow = templateId && templateId !== 'upload';

        // 1. Validação Crítica dos Dados
        if (!documentId || !submittedOTP) {
             throw new Error("ID do Documento e OTP são obrigatórios.");
        }
        
        // ⭐️ Rubrica: Checagem de Buffer e Resiliência
        if (!rubricaFile || !rubricaFile.buffer) {
             return res.status(400).json({ error: "O arquivo da Rubrica está ausente ou corrompido no upload." });
        }
        
        // 2. Determinação da Fonte do Arquivo (Template ou Upload)
        if (isTemplateFlow) {
             if (templateId === 'template-servico') {
                 if (!CONTRATO_TEMPLATE_BUFFER) {
                      throw new Error('O Template pré-carregado não está disponível no servidor.');
                 }
                 fileBuffer = CONTRTRATO_TEMPLATE_BUFFER;
                 fileName = 'Contrato_Teste.pdf';
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

        // ⭐️ RESILIÊNCIA DE MEMÓRIA: Evita Buffer.toString('base64')
        // Salva o HASH da rubrica para provar que o Buffer chegou.
        const rubricaHash = cryptoService.generateDocumentHash(rubricaFile.buffer); 
        visualRubricData = `HASH_RECEIVED:${rubricaHash}`; 
        
        // Em um sistema real, o Buffer da rubrica seria enviado para o S3/Cloudinary aqui.

        // 3. AUTENTICAÇÃO E VALIDAÇÃO OTP
        const validationResult = otpService.validateToken(signerId, submittedOTP);
        if (!validationResult.valid) {
             return res.status(401).json({ error: validationResult.message }); 
        }

        // 4. HASH DO CONTEÚDO BINÁRIO e ASSINATURA
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
                visualRubric: visualRubricData // Hash de sucesso
            },
            signedAt: new Date().toISOString()
        };

        // 6. PERSISTÊNCIA 
        await dbService.saveSignatureRecord(signatureRecord);

        res.status(200).json({
            success: true,
            message: "Assinatura digital avançada concluída e evidência salva.",
            signatureRecord: { documentId: documentId } 
        });

    } catch (error) {
        console.error("Erro ao processar assinatura:", error);
        
        let errorMessage = "Falha interna no servidor. Tente novamente.";
        let statusCode = 500;
        
        if (error.code === 'LIMIT_FILE_SIZE') {
             errorMessage = 'Arquivo de assinatura muito grande.';
             statusCode = 413;
        } else if (error.message.includes("not valid")) { // Catch para falha de OTP do middleware
             errorMessage = "OTP inválido ou expirado.";
             statusCode = 401;
        } else if (error.message.includes("Template pré-carregado")) {
             errorMessage = "Falha interna: Template de documento não encontrado.";
             statusCode = 500;
        } else {
            // Caso de falha de conexão com DB ou outra falha crítica.
            errorMessage = error.message;
        }
        
        res.status(statusCode).json({ error: errorMessage });
    }
});


// ⭐️ ROTA 3: DOWNLOAD DO DOCUMENTO ASSINADO (CAUSA DO CANNOT GET)
router.get('/document/:documentId/download', async (req, res) => {
    const { documentId } = req.params;

    try {
        // Este caminho deve ser idêntico ao do pré-carregamento do Buffer.
        const templateFileName = 'Contrato_Teste.pdf';
        const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: "Arquivo de template não encontrado no servidor." });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${documentId}.pdf"`);
        
        // Serve o arquivo PDF.
        fs.createReadStream(templatePath).pipe(res);

    } catch (error) {
        console.error("Erro ao servir documento para download:", error);
        res.status(500).json({ error: "Falha interna ao servir o documento." });
    }
});


// ROTA 4: Buscar Evidência (MANTIDA)
router.get('/document/:searchTerm/evidence', async (req, res) => {
    // ... (código original mantido)
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