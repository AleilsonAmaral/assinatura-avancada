const { cpf } = require('cpf-cnpj-validator');

/**
 * Função para formatar um CPF numérico (11 dígitos) com pontos e traço.
 * É usada principalmente para logs e mensagens de erro/sucesso.
 * @param {string} rawCpf - O CPF que pode conter ou não formatação.
 * @returns {string} O CPF formatado (ex: 123.456.789-00) ou a string original.
 */
const formatarCpf = (rawCpf) => {
    // 1. Garante que só há dígitos para a formatação
    const cpfLimpo = String(rawCpf).replace(/\D/g, ''); 
    
    if (cpfLimpo.length === 11) {
        // Aplica a máscara de formatação: XXX.XXX.XXX-XX
        return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    // Retorna o valor original se não tiver 11 dígitos, para CPFs incompletos/inválidos
    return rawCpf; 
};


/**
 * Middleware para validar o formato e os dígitos verificadores do CPF.
 * Sobrescreve req.body.signerId com o valor LIMPO (apenas números).
 */
const cpfValidationMiddleware = (req, res, next) => {
    const { signerId } = req.body;
    
    // 1. Verificação de presença
    if (!signerId) {
        return res.status(400).json({ error: 'O CPF (signerId) é obrigatório para esta operação.' });
    }

    // 2. Limpeza do CPF (remove TUDO que não é dígito)
    const cpfLimpo = String(signerId).replace(/\D/g, ''); 

    // 3. Validação do formato e dígitos verificadores
    if (!cpf.isValid(cpfLimpo)) {
        // Usa a função de formatação no ERRO para dar feedback ao usuário
        const cpfFormatado = formatarCpf(cpfLimpo);
        console.warn(`[VALIDAÇÃO CPF] Tentativa de uso de CPF inválido: ${cpfFormatado}`);
        
        return res.status(400).json({ 
            // Mensagem de erro que utiliza o CPF formatado
            error: `O CPF fornecido (${cpfFormatado}) é inválido. Por favor, insira um CPF válido com 11 dígitos.`,
        });
    }

    // 4. Sobrescreve o campo com o CPF LIMPO (APENAS NÚMEROS) 
    // É esta linha que resolve o requisito de aceitar a entrada sem formatação.
    req.body.signerId = cpfLimpo;

    // 5. Continua para a próxima função
    next();
};

// EXPORTAÇÃO COMPLETA: Exporta tanto o middleware quanto a função auxiliar
module.exports = {
    cpfValidationMiddleware,
    formatarCpf,
};