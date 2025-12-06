// netlify/functions/gemini-proxy.js
// VERSÃO 4.5: ADIÇÃO DE TIMEOUT E TAG [TIMEOUT] para o frontend.

exports.handler = async (event, context) => {
    console.log("=== JOÃO IA - SISTEMA ATIVO (v4.5 - Timeout e Fallback) ===");
    
    // Configurações da API Gemini
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // Timeout para a requisição Gemini (15 segundos)
    const REQUEST_TIMEOUT = 15000; 

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ status: "error", resposta: "Método não permitido." }) };

    try {
        const { prompt } = JSON.parse(event.body || '{}');
        console.log("📝 Pergunta:", prompt);

        if (!prompt || prompt.trim() === '') {
            return { 
                statusCode: 400,
                headers,
                body: JSON.stringify({ status: "error", resposta: "Digite sua pergunta." }) 
            };
        }
        
        const lower = prompt.toLowerCase().trim();
        
        // ===================================
        // ========== 2. RESPOSTAS RÁPIDAS (Lógica Prioritária) ==========
        // ===================================
        
        // Saudações
        if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(lower)) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    status: "success", 
                    resposta: "Olá! Sou João, assistente pedagógico. Como posso ajudar com cultura afro-brasileira?" 
                })
            };
        }
        
        // Identificação
        if (lower.includes("qual seu nome") || lower.includes("quem é você") || lower === "joao") {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    status: "success", 
                    resposta: "Sou João, assistente da plataforma Somos Um. Especializado em educação sobre cultura afro-brasileira." 
                })
            };
        }
        
        // Comandos de menu
        const modulos = {
            "👨‍🏫": "Módulo Educador: recursos para professores (planos, materiais).",
            "📋": "Plano de Aula: crio planos personalizados. Exemplo: 'Plano sobre Zumbi para 8º ano'",
            "🎓": "Módulo Estudante: conteúdos, quizzes e biblioteca.",
            "📚": "Biblioteca: livros, artigos e vídeos especializados.",
            "⚖️": "Lei 10.639/2003: ensino obrigatório da cultura afro-brasileira.",
            "menu": "Módulos: 👨‍🏫 Educador | 📋 Plano Aula | 🎓 Estudante | 📚 Biblioteca | ⚖️ Lei 10.639"
        };
        
        for (const [key, resposta] of Object.entries(modulos)) {
            if (prompt.includes(key) || lower === key) {
                return { statusCode: 200, headers, body: JSON.stringify({ status: "success", resposta }) };
            }
        }
        
        // ===================================
        // ========== 3. FALLBACK PARA GOOGLE GEMINI (VIA fetch) ==========
        // ===================================

        // Configuração do AbortController para Timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        // 1. Definição da Persona (System Instruction)
        const systemInstruction = `Você é o João, um assistente pedagógico especializado no ensino de cultura afro-brasileira e na Lei 10.639/2003. Seja didático, objetivo e forneça exemplos de aplicação em sala de aula (ex: Fundamental I, Fundamental II, Ensino Médio). **Sua resposta deve ser curta e direta, com no máximo 150 palavras, devido a limitações de recursos.**`;

        // 2. Montagem do Corpo da Requisição
        const requestBody = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            system_instruction: systemInstruction,
            generationConfig: { 
                temperature: 0.7 
            }
        };

        let fetchResponse;
        let apiData;

        try {
            // 3. Chamada à API com o AbortController
            fetchResponse = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal // Adiciona o sinal de timeout
            });

            clearTimeout(timeoutId); // Limpa o timeout se a resposta for rápida
            apiData = await fetchResponse.json();

        } catch (error) {
            clearTimeout(timeoutId);

            // Verifica se o erro foi causado pelo timeout (aborted)
            if (error.name === 'AbortError') {
                console.error("💥 Erro de Timeout Gemini: A requisição excedeu 15 segundos.");
                
                // MENSAGEM COM TAG [TIMEOUT] PARA O FRONTEND
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "success",
                        // Adiciona a tag [TIMEOUT] no início para o frontend identificar
                        resposta: "[TIMEOUT]A IA está demorando demais para processar a resposta. Tente reformular sua pergunta."
                    })
                };
            }
            
            throw error; 
        }
        
        // 4. Tratamento de Erro da API (Respostas 4xx/5xx ou erro no payload)
        if (!fetchResponse.ok || apiData.error) {
            console.error("💥 Erro da API Gemini:", apiData.error ? (apiData.error.message || fetchResponse.statusText) : fetchResponse.statusText);
            
            // Retorna o fallback padrão em caso de falha da API
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: "success",
                    resposta: "Desculpe, a IA está indisponível. Tente novamente em instantes. Enquanto isso, posso ajudar com os módulos da plataforma (Módulo Educador, Biblioteca, etc)."
                })
            };
        }

        // 5. Extração da Resposta
        const iaResposta = apiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Não foi possível extrair a resposta da IA.";

        console.log("✅ Resposta Gemini:", iaResposta.substring(0, 100) + "...");

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "success",
                resposta: iaResposta 
            })
        };

    } catch (error) {
        // Erro genérico na execução da função (ex: JSON mal formatado ou erro de rede)
        console.error("💥 Erro capturado na função:", error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                status: "error", 
                resposta: "Desculpe, houve um erro interno na função. Tente novamente." 
            })
        };
    }
};