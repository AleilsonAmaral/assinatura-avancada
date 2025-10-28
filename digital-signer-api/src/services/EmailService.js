const MailgunService = require('./MailgunService'); // O transportador real (que você já implementou)

// Função auxiliar para montar o corpo do e-mail com os dados de segurança
function createEmailHtml(details) {
    // Este HTML contém todos os dados de segurança exigidos: ID, Hash, Data/Hora, Nome, CPF/CNPJ e Forma de Token.
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <h2 style="color: #007BFF;">Confirmação e Evidência de Assinatura Digital</h2>
            <p>Prezado(a),</p>
            <p>Este é um registro de segurança confirmando a conclusão da assinatura digital. Os dados abaixo servem como prova criptográfica e legal da transação.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                <tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #f7f7f7; width: 40%;"><strong>ID da Assinatura:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${details.id}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #f7f7f7;"><strong>Data e Hora da Assinatura:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${details.dataHora}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #f7f7f7;"><strong>Nome do Signatário:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${details.nome}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #f7f7f7;"><strong>CPF/CNPJ:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${details.documento}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #f7f7f7;"><strong>Forma de Autenticação (Token):</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${details.tokenMethod}</td></tr>
            </table>

            <h3 style="margin-top: 30px; color: #dc3545;">Hash Criptográfico (Evidência)</h3>
            <p style="font-size: 13px; word-break: break-all; background-color: #eee; padding: 15px; border-radius: 5px; font-weight: bold;">
                ${details.hash}
            </p>
            <p style="font-size: 12px; color: #6c757d;">Este hash garante que o documento não foi alterado desde o momento da assinatura. Guarde este e-mail como evidência legal.</p>
            <hr style="margin-top: 20px; border: 0; border-top: 1px solid #eee;">
            <p style="text-align: center; font-size: 11px; color: #aaa;">Serviço de Assinatura Digital</p>
        </div>
    `;
}

const EmailService = {
    /**
     * Envia o e-mail de notificação de segurança para o signatário e o remetente.
     * * @param {Object} data
     * @param {Object} data.signer - Dados do signatário (deve ter email, name, cpfCnpj).
     * @param {string} data.senderEmail - Email do remetente do documento.
     * @param {Object} data.signatureData - Detalhes da assinatura (id, hash, tokenMethod).
     */
    sendSignatureConfirmation: async ({ signer, senderEmail, signatureData }) => {
        
        const formattedDataHora = new Date().toLocaleString('pt-BR'); 

        const emailDetails = {
            id: signatureData.id,
            hash: signatureData.hash,
            dataHora: formattedDataHora,
            nome: signer.name,
            documento: signer.cpfCnpj, // Assumindo que 'cpfCnpj' vem do objeto signer
            tokenMethod: signatureData.tokenMethod,
        };
        
        const emailBodyHtml = createEmailHtml(emailDetails);
        const subject = `[Segurança] Assinatura Digital Concluída: ${signatureData.id}`;

        try {
            // 1. Enviar para o Signatário (Usuário Logado)
            await MailgunService.sendEmail(signer.email, subject, emailBodyHtml);
            
            // 2. Enviar para o Remetente (Iniciador do Documento)
            await MailgunService.sendEmail(senderEmail, subject, emailBodyHtml);

            console.log(`[LOG - EMAIL SERVICE] Notificações de assinatura enviadas para ${signer.email} e ${senderEmail}.`);

        } catch (error) {
            // Loga a falha, mas NÃO relança a exceção (o processo de assinatura foi concluído)
            console.error("[ERRO CRÍTICO EMAIL SERVICE]: Falha ao enviar e-mail de segurança.", error.message);
        }
    }
};

module.exports = EmailService;