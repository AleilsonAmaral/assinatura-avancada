// 1. Importamos a biblioteca do Resend 
const { Resend } = require('resend');

// 2. Inicializamos o Resend com a nossa chave secreta do arquivo .env
//    É como "fazer login" no serviço.
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envia um e-mail usando a API do Resend.
 * Esta função é "async" porque enviar um e-mail leva tempo (é uma chamada de rede).
 * * @param {string} to O e-mail do destinatário (ex: "usuario@exemplo.com").
 * @param {string} subject O assunto do e-mail.
 * @param {string} html O corpo do e-mail em formato HTML.
 * @returns {Promise<{success: boolean, messageId: string}>} Uma promessa que resolve com o status do envio.
 */
async function sendEmail(to, subject, html) {
    // 3. Usamos um bloco try...catch. É uma boa prática, pois o envio de e-mail pode falhar
    //    por muitos motivos (API fora do ar, chave errada, etc.).
    try {
        console.log(`[Email Service] Preparando para enviar e-mail para: ${to}`);

        // 4. Esta é a chamada principal. Usamos o método "send" do Resend.
        const { data, error } = await resend.emails.send({
            // 'from' é quem envia. Para testes, use 'onboarding@resend.dev'.
            // Para produção, use seu e-mail de domínio verificado (ex: 'contato@seusite.com').
            from: 'Assinatura Avançada <onboarding@resend.dev>',
            
            to: [to],         // O destinatário. Resend espera um array.
            subject: subject, // O assunto que definimos.
            html: html,       // O corpo HTML que criamos.
        });

        // 5. Verificamos se a API do Resend retornou um erro específico.
        if (error) {
            console.error('[Email Service] Erro retornado pela API do Resend:', error);
            throw new Error('Falha no serviço de envio de e-mail.');
        }

        console.log(`[Email Service] E-mail enviado com sucesso! Message ID: ${data.id}`);
        
        // 6. Retornamos um objeto indicando sucesso e o ID da mensagem.
        return { success: true, messageId: data.id };

    } catch (err) {
        console.error('[Email Service] Exceção capturada ao tentar enviar e-mail:', err);
        // Se ocorrer um erro, nós o lançamos novamente para que a função que chamou saiba que algo deu errado.
        throw err;
    }
}

// 7. Exportamos a função "sendEmail" para que outros arquivos possam usá-la.
module.exports = {
    sendEmail
};