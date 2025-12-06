// netlify/functions/gemini-proxy.js
// VERSÃO 4.4: Otimização para Plano Gratuito (Banco de Dados Local Expandido + Limite de Tokens)

exports.handler = async (event, context) => {
    console.log("=== JOÃO IA - SISTEMA ATIVO (v4.4 - Otimizado) ===");
    
    // Configurações da API Gemini
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
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
        // Saudações e comandos simples (se o frontend não pegar)
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
        
        if (lower.includes("qual seu nome") || lower.includes("quem é você")) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    status: "success", 
                    resposta: "Sou João, assistente da plataforma Somos Um. Especializado em educação sobre cultura afro-brasileira." 
                })
            };
        }
        
        // ===================================
        // ========== BANCO DE DADOS LOCAL EXPANDIDO (para reduzir chamadas à API) ==========
        // Contém o conteúdo cultural e histórico com sugestões pedagógicas.
        // ===================================
        const respostasRapidasExpandidas = {
            // Tópicos Culturais e Históricos
            "quilombo": "Quilombos: Eram comunidades de resistência formadas por pessoas escravizadas fugidas. O mais famoso foi Palmares, liderado por Zumbi. Para Ensino Fundamental II: debata a organização social e econômica de um quilombo. Recurso: Assista ao filme 'Quilombo'.",
            "dandara": "Dandara: Guerreira crucial de Palmares, companheira de Zumbi. Sua história foca no papel da mulher negra na resistência. Para Ensino Médio: Pesquisa sobre o apagamento histórico de figuras femininas negras. Atividade: Crie um poema em homenagem a Dandara.",
            "escravidao": "Escravidão: O foco deve ser na resistência e no protagonismo negro, não apenas no sofrimento. Aborde a diáspora, o tráfico, mas principalmente as revoltas e a luta pela liberdade. Sugestão: Crie um linha do tempo das revoltas de escravizados no Brasil.",
            "abolição": "Abolição da Escravidão (1888): Foi um processo complexo, resultado de décadas de luta negra, como o movimento abolicionista e as fugas, e não apenas da Lei Áurea. Para aulas: Discuta o 'pós-abolição' e a marginalização social que se seguiu. Recurso: Luiz Gama (abolicionista negro).",
            "capoeira": "Capoeira: Arte marcial afro-brasileira, mistura de dança e luta, que se desenvolveu como forma de resistência. É Patrimônio Cultural Imaterial. Para aula: Introdução aos instrumentos (berimbau) e rodas de capoeira. Discuta sua evolução histórica.",
            "culinária": "Culinária Afro-Brasileira: Base de muitos pratos nacionais (acarajé, vatapá, feijoada). É uma fusão de técnicas e ingredientes africanos e locais. Atividade: Pesquisa sobre o significado cultural do dendê e do quiabo. Sugestão: Cozinhe um prato simples com a turma.",
            "música": "Música Afro-Brasileira: Engloba samba, maracatu, afoxé, jongo e funk. É central na identidade nacional. Para aula: Compare o ritmo do Maracatu com o do Samba. Recurso: Pesquisa sobre mestres como Pixinguinha ou Clementina de Jesus.",
            "religião": "Religiões Afro-Brasileiras (Candomblé, Umbanda): Aborde com respeito, destacando sua importância cultural e o combate à intolerância religiosa. Não as reduza a folclore. Atividade: Debate sobre a laicidade do Estado e a diversidade religiosa na escola.",
            "terreiro": "Terreiro/Axé: São espaços sagrados e centros comunitários das religiões afro-brasileiras. São fundamentais para a preservação de tradições e línguas africanas no Brasil. Sugestão: Convidar um(a) Mãe ou Pai de Santo para falar sobre a função social do terreiro (com autorização da escola e responsáveis).",
            "literatura": "Literatura Afro-Brasileira: Destaque autores como Carolina Maria de Jesus ('Quarto de Despejo'), Conceição Evaristo e Machado de Assis (por sua ascendência). Atividade: Análise de textos que abordam a vivência negra no Brasil.",
            
            // Regras Específicas e de Gatilho (migradas para o mapa)
            "zumbi": "Zumbi: líder do Quilombo dos Palmares (século XVII). Para aulas: contação de histórias (Fundamental I), análise de documentos (Fundamental II), debate sobre memória histórica (Médio). Recurso: documentário 'Quilombo' (1984).",
            "lei 10.639": "Lei 10.639/2003: ensino obrigatório da cultura afro-brasileira. Implementação: formação docente, materiais inclusivos, projetos interdisciplinares. Recurso: Coleção História Geral da África (UNESCO).",
            "lei 10639": "Lei 10.639/2003: ensino obrigatório da cultura afro-brasileira. Implementação: formação docente, materiais inclusivos, projetos interdisciplinares. Recurso: Coleção História Geral da África (UNESCO).",
            "umbanda": "Religiões afro-brasileiras: abordagem com respeito à diversidade religiosa. Atividade: estudo da influência na cultura brasileira (música, culinária, festas). Recurso: livro 'Orixás' de Pierre Verger.",
            "candomblé": "Religiões afro-brasileiras: abordagem com respeito à diversidade religiosa. Atividade: estudo da influência na cultura brasileira (música, culinária, festas). Recurso: livro 'Orixás' de Pierre Verger.",
            "candomble": "Religiões afro-brasileiras: abordagem com respeito à diversidade religiosa. Atividade: estudo da influência na cultura brasileira (música, culinária, festas). Recurso: livro 'Orixás' de Pierre Verger.",

            // Regra de "Outros Líderes"
            "outros líderes": "Além de Zumbi, destacam-se: Dandara (guerreira de Palmares), Luiza Mahin (Revolta dos Malês), Luiz Gama (abolicionista), e Carolina Maria de Jesus (escritora). Todos são essenciais para atender à Lei 10.639/2003. Sugestão: Crie um projeto 'Biografias da Resistência' para Ensino Fundamental II/Médio.",
            "outras figuras": "Além de Zumbi, destacam-se: Dandara (guerreira de Palmares), Luiza Mahin (Revolta dos Malês), Luiz Gama (abolicionista), e Carolina Maria de Jesus (escritora). Todos são essenciais para atender à Lei 10.639/2003. Sugestão: Crie um projeto 'Biografias da Resistência' para Ensino Fundamental II/Médio.",
            "além de zumbi": "Além de Zumbi, destacam-se: Dandara (guerreira de Palmares), Luiza Mahin (Revolta dos Malês), Luiz Gama (abolicionista), e Carolina Maria de Jesus (escritora). Todos são essenciais para atender à Lei 10.639/2003. Sugestão: Crie um projeto 'Biografias da Resistência' para Ensino Fundamental II/Médio.",
            "também": "Além de Zumbi, destacam-se: Dandara (guerreira de Palmares), Luiza Mahin (Revolta dos Malês), Luiz Gama (abolicionista), e Carolina Maria de Jesus (escritora). Todos são essenciais para atender à Lei 10.639/2003. Sugestão: Crie um projeto 'Biografias da Resistência' para Ensino Fundamental II/Médio."
        };
        
        // Verifica o banco de dados expandido
        for (const [key, resposta] of Object.entries(respostasRapidasExpandidas)) {
            if (lower.includes(key)) {
                return { statusCode: 200, headers, body: JSON.stringify({ status: "success", resposta }) };
            }
        }
        
        // ===================================
        // ========== 3. FALLBACK PARA GOOGLE GEMINI (VIA fetch) ==========
        // ===================================

        // 1. Definição da Persona (System Instruction)
        const systemInstruction = `Você é o João, um assistente pedagógico especializado no ensino de cultura afro-brasileira e na Lei 10.639/2003. Seja didático, objetivo e forneça exemplos de aplicação em sala de aula (ex: Fundamental I, Fundamental II, Ensino Médio).`;

        // 2. Montagem do Corpo da Requisição
        const requestBody = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            system_instruction: { 
                role: "system",
                parts: [{ text: systemInstruction }]
            },
            generationConfig: { 
                temperature: 0.7,
                // 💡 NOVO: Limita a saída para evitar estourar o limite de tokens da API gratuita.
                maxOutputTokens: 1500 
            }
        };

        // 3. Chamada à API
        const fetchResponse = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const apiData = await fetchResponse.json();

        // 4. Tratamento de Erro da API
        if (!fetchResponse.ok || apiData.error) {
            console.error("💥 Erro da API Gemini:", apiData.error ? (apiData.error.message || fetchResponse.statusText) : fetchResponse.statusText);
            
            // Retorna a sugestão de formatação como fallback em caso de falha da API
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: "success",
                    resposta: "Desculpe, a IA está indisponível. Tente novamente em instantes ou utilize as palavras-chave (Zumbi, Capoeira, Lei 10.639) para uma resposta rápida."
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
        // Erro genérico na execução da função (ex: JSON mal formatado)
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