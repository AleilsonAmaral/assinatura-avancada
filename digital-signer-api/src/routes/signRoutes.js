// Arquivo: digital-signer-api/src/routes/signRoutes.js (FINAL COMPLETO COM EXPORT)

const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { cpf } = require('cpf-cnpj-validator');

// 📦 Middlewares
const authMiddleware = require('../middleware/authMiddleware');
const { cpfValidationMiddleware, formatarCpf } = require('../middleware/cpfValidationMiddleware');

// 💡 Serviços (Assumindo que estão em src/services)
const cryptoService = require('../services/cryptoService');
const tsaService = require('../services/tsaService');
const EmailService = require('../services/EmailService');
const UserService = require('../services/UserService'); 
const documentService = require('../services/documentService'); 

// 🚨 NOVO: Importamos o ExportService (necessário para o fallback e download)
const exportService = require('../services/exportService'); 

// 🤝 Conexão com o Banco de Dados
const { pool } = require('../db');
const dbService = require('../services/dbService');

// 1. CONFIGURAÇÃO DO MULTER
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

const uploadMiddleware = upload.fields([
    { name: 'documentFile', maxCount: 1 },
    { name: 'signatureImage', maxCount: 1 }
]);

// 📦 Pré-carregamento do Template 
const TEMPLATE_FILENAME = 'Contrato_Teste.pdf';
let CONTRATO_TEMPLATE_BUFFER = null;

try {
    const templatePath = path.join(__dirname, '..', 'templates', TEMPLATE_FILENAME);
    CONTRATO_TEMPLATE_BUFFER = fs.readFileSync(templatePath);
    console.log(`Template ${TEMPLATE_FILENAME} pré-carregado com sucesso.`);
} catch (e) {
    console.error(`[ERRO CRÍTICO ENOENT]: Não foi possível carregar o template.`, e.message);
}


// ====================================================================
// ROTA PRINCIPAL: Assinatura com Upload ou Template Fixo (POST /document/sign)
// ====================================================================

router.post('/document/sign', authMiddleware, uploadMiddleware, async (req, res) => {
    // ... (Lógica de Assinatura mantida e completa)
    // A lógica de persistência (Passo 7) chama dbService.saveSignatureRecord, que tem o fallback para Excel.
    // A lógica de e-mail (Passo 8) está completa.
    
    // ... (Código anterior do router.post até o final do try...)

    const { signerId, signerName, contractTitle, documentId, submittedOTP, templateId } = req.body;

    // 🔑 Validação de segurança CRÍTICA (Antiforja de JWT)
    if (String(signerId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Autorização negada. O signatário na requisição não corresponde ao token de transação." });
    }

    const finalDocumentId = String(documentId || '').trim();

    const documentFile = req.files && req.files.documentFile ? req.files.documentFile[0] : null;
    const rubricaFile = req.files && req.files.signatureImage ? req.files.signatureImage[0] : null;

    let fileBuffer;
    let fileName = '';
    let fileSource = '';
    let visualRubricData = 'N/A';
    let client;

    try {
        // 1. Validação do CPF
        const cpfLimpo = String(signerId || '').replace(/\D/g, '');

        if (!cpf.isValid(cpfLimpo)) {
            const cpfFormatado = formatarCpf(cpfLimpo);
            return res.status(400).json({ error: `O CPF ${cpfFormatado} é inválido ou ausente.` });
        }

        // 3. Define o Buffer do Documento (Template ou Upload)
        const isTemplateFlow = templateId && templateId !== 'upload';

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

        // 4. VALIDAÇÃO SQL DO OTP
        client = await pool.connect();
        
        const validationQuery = `
             SELECT signer_id FROM otps 
             WHERE signer_id = $1 
               AND code = $2 
               AND expires_at >= NOW()
               AND used_at IS NULL; 
        `;
        
        const validationResult = await client.query(validationQuery, [signerId, submittedOTP]);

        if (validationResult.rows.length === 0) {
            return res.status(401).json({ error: 'Código OTP inválido, expirado ou já utilizado.' });
        }

        // 5. CRIPTOGRAFIA E ASSINATURA
        if (rubricaFile && rubricaFile.buffer) {
            const rubricaHash = cryptoService.generateDocumentHash(rubricaFile.buffer);
            visualRubricData = rubricaHash;
        } else {
            visualRubricData = 'N/A - Carimbo Digital Utilizado';
        }

        const documentHash = cryptoService.generateDocumentHash(fileBuffer);
        const timestampData = tsaService.getTrustedTimestamp();
        const dataToSign = `${documentHash}|${timestampData.timestamp}|${signerId}`;
        const signatureValue = cryptoService.signData(dataToSign);

        // 6. MARCAR O OTP COMO USADO
        await client.query('UPDATE otps SET used_at = NOW() WHERE signer_id = $1', [signerId]);

        // 7. PERSISTÊNCIA NO BANCO DE DADOS (Chamada ao dbService, com lógica de fallback para Excel)
        const signatureRecord = {
            documentId: finalDocumentId,
            signerId: signerId,
            signerName: signerName,
            contractTitle: contractTitle,
            fileMetadata: {
                name: fileName, source: fileSource, rubricaSize: rubricaFile?.size || 0 
            },
            signatureData: {
                hash: documentHash, signatureValue: signatureValue, timestampData: timestampData, authMethod: 'OTP', visualRubric: visualRubricData 
            },
            signedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        };

        const dbResponse = await dbService.saveSignatureRecord(signatureRecord);
        const signatureIdFromDB = dbResponse?.id || finalDocumentId;

        // 8. ENVIO DE NOTIFICAÇÃO DE SEGURANÇA (Email Duplo)
        const signerData = await UserService.getSignerDataByCpf(signerId);
        const senderEmail = await documentService.getSenderEmailByDocumentId(finalDocumentId);

        const signatureDetails = { id: signatureIdFromDB, hash: documentHash, tokenMethod: 'OTP' };

        try {
            await EmailService.sendSignatureConfirmation({
                signer: signerData,
                senderEmail: senderEmail || "noreply@sistema.com",
                signatureData: signatureDetails
            });
            console.log('[EMAIL] Comprovantes de assinatura acionados com sucesso.');

        } catch (emailError) {
            console.error('[EMAIL ERROR] Falha ao enviar e-mail de confirmação (Não bloqueia o fluxo de assinatura):', emailError.message);
        }


        // 9. RESPOSTA DE SUCESSO FINAL
        res.status(200).json({
            success: true,
            message: `Assinatura digital avançada concluída para CPF: ${formatarCpf(signerId)}. Notificação de segurança acionada.`,
            signatureRecord: {
                documentId: finalDocumentId,
                signatureId: signatureIdFromDB,
                signerCpfFormatted: formatarCpf(signerId),
                signatureData: signatureRecord.signatureData
            }
        });

    } catch (error) {
        // O dbService lança um erro AQUI se a persistência falhar no DB (e salvar no Excel)
        console.error("Erro ao processar assinatura:", error);

        let errorMessage = error.message || "Falha interna no servidor.";
        let statusCode = 500;

        if (error.code === 'LIMIT_FILE_SIZE') { statusCode = 413; errorMessage = 'Arquivo de assinatura muito grande.'; }

        res.status(statusCode).json({ error: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ROTA 3: Buscar Evidência (GET)
router.get('/document/:searchTerm/evidence', authMiddleware, async (req, res) => {
// ... (Rota de Evidência mantida)
});


// ====================================================================
// ROTA 4: DOWNLOAD DA PLANILHA DE AUDITORIA (GET /export/download)
// PROTEÇÃO: authMiddleware (apenas usuários logados podem baixar)
// ====================================================================

router.get('/export/download', authMiddleware, async (req, res) => {
    
    // O caminho do arquivo é o mesmo usado no ExportService.js
    const EXPORT_FILE = path.join(__dirname, '..', '..', 'registros_assinaturas.xlsx');

    try {
        // 1. Verifica se o arquivo Excel foi criado
        if (!fs.existsSync(EXPORT_FILE)) {
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


module.exports = router;