const express = require('express');
const router = express.Router();
const fs = require('fs'); 
const multer = require('multer'); 

// Assumindo que você importou e configurou o authMiddleware e services em app.js
const authMiddleware = require('../middleware/authMiddleware'); 
const cryptoService = require('../services/cryptoService');
const tsaService = require('../services/tsaService');
const otpService = require('../services/otpService');
const dbService = require('../services/dbService'); 

// Configuração do Multer: armazena os arquivos temporariamente na pasta 'uploads'
const upload = multer({ dest: 'uploads/' }); 


// ROTA 1: GERAR E ENVIAR O TOKEN OTP (PROTEGIDA POR JWT)

router.post('/otp/generate', authMiddleware, async (req, res) => {
    const { signerId, method, recipient } = req.body;

    if (!signerId || !method || !recipient) {
        return res.status(400).json({ 
            message: 'CPF do signatário (signerId), método (method) e destinatário (recipient) são obrigatórios.' 
        });
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



// ROTA 2: Assinatura com Upload ou Template Fixo (COMPLETO)

router.post('/document/sign', authMiddleware, upload.single('documentFile'), async (req, res) => {
    
    const { signerId, signerName, contractTitle, documentId, submittedOTP, signatureImage, templateId } = req.body;
    const documentFile = req.file; 
    let fileCleanupNeeded = false; 

    let fileBuffer;
    let fileName = '';
    let fileSource = '';

    try {
        const isTemplateFlow = templateId && templateId !== 'upload';

        // 1. Validação Crítica dos Dados
        if (!documentId) {
            throw new Error("O ID do Documento é obrigatório.");
        }
        if (!submittedOTP) {
            throw new Error("O Código OTP é obrigatório.");
        }
        
        // 2. Determinação da Fonte do Arquivo (Template ou Upload)
        if (isTemplateFlow) {
            // --- FLUXO TEMPLATE FIXO ---
            if (templateId === 'template-servico') {
                const templatePath = 'templates/Contrato_Teste.pdf';
                fileBuffer = fs.readFileSync(templatePath); 
                fileName = templatePath;
                fileSource = 'Template Fixo: Contrato Serviço';
            } else {
                throw new Error('Template fixo não encontrado na API.');
            }
        } else {
            // --- FLUXO UPLOAD TRADICIONAL ---
            if (!documentFile) { 
                return res.status(400).json({ error: "Arquivo de upload ausente." });
            }
            fileBuffer = fs.readFileSync(documentFile.path); 
            fileName = documentFile.originalname;
            fileSource = 'Upload do Cliente';
            fileCleanupNeeded = true;
        }

        // 3. AUTENTICAÇÃO E VALIDAÇÃO OTP
        const validationResult = otpService.validateToken(signerId, submittedOTP);
        if (!validationResult.valid) {
             throw new Error(validationResult.message);
        }

        // 4. HASH DO CONTEÚDO BINÁRIO 
        const documentHash = cryptoService.generateDocumentHash(fileBuffer);
        
        // 5. TSA, SIGN, e REGISTRO DE EVIDÊNCIA
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
            },
            signatureData: {
                hash: documentHash,
                signatureValue: signatureValue,
                timestampData: timestampData,
                authMethod: 'OTP',
                visualRubric: signatureImage || 'N/A' 
            },
            signedAt: new Date().toISOString()
        };

        // 6. PERSISTÊNCIA e LIMPEZA
        await dbService.saveSignatureRecord(signatureRecord);
        
        // Limpa o arquivo temporário SOMENTE se foi um upload
        if (fileCleanupNeeded) {
            fs.unlinkSync(req.file.path);
        }

        res.status(200).json({
            success: true,
            message: "Assinatura digital avançada concluída e evidência salva.",
            signatureRecord
        });

    } catch (error) {
        // Garante a limpeza do arquivo temporário em caso de erro no upload
        if (fileCleanupNeeded && req.file) {
            fs.unlinkSync(req.file.path);
        }
        console.error("Erro ao processar assinatura:", error);
        res.status(500).json({ error: "Falha no serviço: " + error.message });
    }
});


// ROTA 3: Buscar Evidência (AGORA É ASYNC/AWAIT)

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


// ESTA LINHA FINAL É CRÍTICA PARA RESOLVER O 'TypeError' NO APP.JS
module.exports = router;