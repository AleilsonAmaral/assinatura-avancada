const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path'); 
// 🚨 CORREÇÃO: Importe o módulo 'cpf' para a validação interna na ROTA 2
const { cpf } = require('cpf-cnpj-validator'); 

const authMiddleware = require('../middleware/authMiddleware');
// 🚨 MUDANÇA: Importação correta com desestruturação para obter o formatter
const { cpfValidationMiddleware, formatarCpf } = require('../middleware/cpfValidationMiddleware');
const cryptoService = require('../services/cryptoService');
const tsaService = require('../services/tsaService');

// Importações do pool do DB e serviços básicos
const { pool } = require('../db'); 
const dbService = require('../services/dbService');
const otpService = require('../services/otpService');

// 🚨 SERVIÇOS DE NOTIFICAÇÃO E BUSCA DE DADOS (CRÍTICOS)
const EmailService = require('../services/EmailService');
const UserService = require('../services/UserService'); 
const DocumentService = require('../services/DocumentService'); 


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
    const templatePath = path.join(__dirname, '..', '..', 'templates', TEMPLATE_FILENAME);
    CONTRATO_TEMPLATE_BUFFER = fs.readFileSync(templatePath);
    console.log(`Template ${TEMPLATE_FILENAME} pré-carregado com sucesso.`);
} catch (e) {
    console.error(`[ERRO CRÍTICO ENOENT]: Não foi possível carregar o template.`, e.message);
}


// ROTA 1: GERAR E ENVIAR O TOKEN OTP 
// ✅ ROTA 1 USA O MIDDLEWARE
router.post('/otp/generate', authMiddleware, cpfValidationMiddleware, async (req, res) => {
    // signerId JÁ ESTÁ LIMPO aqui (apenas números)
    const { signerId, method, recipient } = req.body;

    if (!method || !recipient) {
        return res.status(400).json({ message: 'Método e destinatário são obrigatórios.' });
    }

    try {
        const token = otpService.generateToken(signerId);
        const message = await otpService.sendToken(method, recipient, token); 

        // Retorno formatado para o UX
        res.status(200).json({ 
            message: `${message} CPF: ${formatarCpf(signerId)}.`,
            signerCpfFormatted: formatarCpf(signerId)
        });

    } catch (error) {
        console.error('[ERRO NA ROTA /otp/generate]:', error);
        res.status(500).json({ message: 'Erro interno ao processar a solicitação de OTP: ' + error.message });
    }
});


// ROTA 2: Assinatura com Upload ou Template Fixo (POST)
// 🚨 MUDANÇA: REMOVEMOS O cpfValidationMiddleware da cadeia
router.post('/document/sign', authMiddleware, uploadMiddleware, async (req, res) => {

    const { signerId, signerName, contractTitle, documentId, submittedOTP, templateId } = req.body; 

    // GARANTIA DO ID
    const finalDocumentId = String(documentId || '').trim();
    
    const documentFile = req.files && req.files.documentFile ? req.files.documentFile[0] : null;
    const rubricaFile = req.files && req.files.signatureImage ? req.files.signatureImage[0] : null; 

    let fileBuffer;
    let fileName = '';
    let fileSource = '';
    let visualRubricData = 'N/A'; 
    let client; 
    
    try {
        // 🚨 NOVO: VALIDAÇÃO DO CPF MOVIDA PARA DENTRO
        
        // 1. Limpeza e Validação de segurança do CPF
        const cpfLimpo = String(signerId || '').replace(/\D/g, ''); 
        
        if (!cpf.isValid(cpfLimpo)) { 
             const cpfFormatado = formatarCpf(cpfLimpo);
             console.warn(`[VALIDAÇÃO CPF] Inválido: ${cpfFormatado}`);
             // Retorno 400 se o CPF for inválido
             return res.status(400).json({ error: `O CPF ${cpfFormatado} é inválido ou ausente.` });
        }
        
        // 2. Sobrescreve o campo com o CPF LIMPO (apenas números)
        req.body.signerId = cpfLimpo;
        
        // FIM DA VALIDAÇÃO DO CPF MOVIDA

        const isTemplateFlow = templateId && templateId !== 'upload';

        // VALIDAÇÕES BÁSICAS
        if (finalDocumentId.length === 0 || !submittedOTP) {
             return res.status(400).json({ error: "ID do Documento e OTP são obrigatórios. Falha de dados." });
        }
        
        if (!rubricaFile || !rubricaFile.buffer) {
             return res.status(400).json({ error: "O arquivo da Rubrica está ausente ou corrompido no upload." });
        }
        
        // VALIDAÇÃO DO FLUXO: Define o Buffer do Documento
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

        // --- INÍCIO DA LÓGICA CRÍTICA DE AUTENTICAÇÃO E CRIPTOGRAFIA ---
        
        // 1. VALIDAÇÃO SQL DO OTP
        client = await pool.connect();
        
        const validationQuery = `
            SELECT signer_id FROM otps 
            WHERE signer_id = $1 
              AND code = $2 
              AND expires_at > NOW();
        `;
        
        const validationResult = await client.query(validationQuery, [signerId, submittedOTP]);
        
        if (validationResult.rows.length === 0) {
            // Se o OTP falhar, o status correto é 401
            return res.status(401).json({ error: 'Código OTP inválido ou expirado.' }); 
        }
        
        // 2. CRIPTOGRAFIA E ASSINATURA
        const rubricaHash = cryptoService.generateDocumentHash(rubricaFile.buffer); 
        visualRubricData = `HASH_RECEIVED:${rubricaHash}`; 
        
        const documentHash = cryptoService.generateDocumentHash(fileBuffer);
        const timestampData = tsaService.getTrustedTimestamp();
        const dataToSign = `${documentHash}|${timestampData.timestamp}|${signerId}`;
        const signatureValue = cryptoService.signData(dataToSign);

        // 3. EXCLUIR O OTP (Garante uso único)
        await client.query('DELETE FROM otps WHERE signer_id = $1', [signerId]);
        
        // 4. PERSISTÊNCIA NO BANCO DE DADOS
        const signatureRecord = {
            documentId: finalDocumentId,
            signerId: signerId, // JÁ ESTÁ LIMPO
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
        
        // Salva no DB e recupera o ID gerado ou usa o documentId como fallback
        const dbResponse = await dbService.saveSignatureRecord(signatureRecord); 
        const signatureIdFromDB = dbResponse.id || finalDocumentId; 

        
        // 🚨 5. AÇÃO CRÍTICA: ENVIO DE NOTIFICAÇÃO DE SEGURANÇA
        try {
            const signatarioDados = await UserService.getSignerDataByCpf(signerId); 
            const remetenteEmail = await DocumentService.getSenderEmailByDocumentId(finalDocumentId); 
            
            const emailUsuarioLogado = req.user && req.user.email ? req.user.email : null;
            
            // Objeto de dados para o corpo do e-mail
            const emailData = {
                signer: signatarioDados,
                signatureData: {
                    id: signatureIdFromDB, 
                    hash: documentHash, 
                    tokenMethod: 'OTP', 
                    dataHora: new Date(),
                }
            };
            
            // --- INÍCIO DO ENVIO DUPLO ---

            // 1. Enviar para o USUÁRIO LOGADO
            if (emailUsuarioLogado) {
                 await EmailService.sendSignatureConfirmation(emailData, emailUsuarioLogado); 
            }

            // 2. Enviar para o REMETENTE
            if (remetenteEmail) {
                await EmailService.sendSignatureConfirmation(emailData, remetenteEmail); 
            }


            if (!emailUsuarioLogado && !remetenteEmail) {
                 console.warn(`[WARN - MAIL] Notificação NÃO enviada. Emails de Logado e Remetente não encontrados.`);
            }

        } catch (emailError) {
            console.error("[ERRO CRÍTICO - NOTIFICAÇÃO]: Falha ao enviar e-mail de evidência.", emailError.message);
        }


        // 6. RESPOSTA DE SUCESSO FINAL
        res.status(200).json({
            success: true,
            // Retorno formatado para o usuário
            message: `Assinatura digital avançada concluída para CPF: ${formatarCpf(signerId)}. Notificação de segurança acionada.`,
            signatureRecord: { 
                documentId: finalDocumentId, 
                signatureId: signatureIdFromDB,
                signerCpfFormatted: formatarCpf(signerId) 
            } 
        });

    } catch (error) {
        console.error("Erro ao processar assinatura:", error);
        
        let errorMessage = error.message || "Falha interna no servidor.";
        let statusCode = 500;
        
        if (error.code === 'LIMIT_FILE_SIZE') { statusCode = 413; errorMessage = 'Arquivo de assinatura muito grande.'; } 
        // Se o erro foi Multer, o Multer já deveria ter retornado o erro 
        
        res.status(statusCode).json({ error: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ROTA 3: Buscar Evidência (GET)
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