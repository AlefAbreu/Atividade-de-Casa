import { GoogleGenAI, Type } from "@google/genai";
import { Question, Student, Activity, StudentAnswer, TutorInsights, HubInfo } from '../types';

// Expanded content based on the provided PDF to give the AI a richer context.
const CURRICULUM_CONTENT = `
**Resumo do Roteiro Pedagógico Baseado na BNCC para Ensino Fundamental**

A Base Nacional Comum Curricular (BNCC) é o documento que rege os currículos das escolas públicas e privadas do Brasil, definindo as aprendizagens essenciais que todos os alunos devem desenvolver. O foco é na "educação integral" e no desenvolvimento de 10 competências gerais, que visam mobilizar conhecimentos, habilidades, atitudes e valores para resolver problemas complexos.

**Áreas do Conhecimento e Componentes Curriculares:**

1.  **Linguagens**:
    *   **Português**: Foco em alfabetização (1º-2º ano), leitura, escrita, oralidade e análise linguística/semiótica. Habilidades incluem decodificação, compreensão de textos, produção textual e domínio das convenções da escrita (ortografia, pontuação). Nos anos finais (6º-9º), a complexidade aumenta com análise de gêneros textuais diversos, figuras de linguagem e argumentação.
    *   **Arte**: Exploração de artes visuais, dança, música e teatro.
    *   **Educação Física**: Práticas corporais como jogos, esportes, danças e lutas.
    *   **Língua Inglesa**: Obrigatória a partir do 6º ano.

2.  **Matemática**:
    *   Desenvolvimento do raciocínio lógico e resolução de problemas.
    *   **Números**: Sistema de numeração decimal, operações (adição, subtração, multiplicação, divisão), frações, números racionais.
    *   **Álgebra**: (Anos Finais) Expressões algébricas, equações de 1º e 2º grau.
    *   **Geometria**: Figuras geométricas, grandezas e medidas (comprimento, área, volume, tempo).
    *   **Probabilidade e Estatística**: Leitura de gráficos e tabelas, noções de probabilidade.

3.  **Ciências da Natureza**:
    *   Investigação de fenômenos naturais.
    *   **Matéria e Energia**: Propriedades dos materiais, transformações (físicas e químicas), fontes de energia.
    *   **Vida e Evolução**: Seres vivos (características, ciclos de vida), corpo humano, saúde, ecossistemas.
    *   **Terra e Universo**: Sistema Solar, movimentos da Terra, ciclo da água.

4.  **Ciências Humanas**:
    *   **Geografia**: Estudo do espaço e das relações sociedade-natureza. Lugares de vivência, paisagens, mapas, população brasileira, dinâmicas urbanas e rurais, continentes.
    *   **História**: Estudo do tempo, das sociedades e culturas. Identidade pessoal e familiar, marcos históricos, povos indígenas, colonização do Brasil, República, eventos mundiais.

5.  **Ensino Religioso**: Conhecimento e respeito à diversidade de tradições religiosas e filosofias de vida.

**Lógica e Raciocínio**: Habilidades transversais incentivadas pela BNCC, envolvendo a capacidade de observar, identificar padrões, resolver problemas não-convencionais, argumentar com base em evidências e pensar criticamente.
`;


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function generateNivelamentoTest(studentGrade: string): Promise<Question[]> {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
    Você é um especialista em avaliação educacional para o Ensino Fundamental no Brasil. Baseado no resumo do currículo da BNCC fornecido, gere uma avaliação de nivelamento com 12 questões de múltipla escolha.

    **Informações do Aluno:**
    - Série/Ano: ${studentGrade}

    **Instruções:**
    1.  Crie 2 questões para cada uma das seguintes matérias: Português, Matemática, Ciências, História, Geografia e Lógica.
    2.  As questões devem ser representativas de conhecimentos fundamentais esperados para um aluno do **${studentGrade}**. Adapte a complexidade das perguntas para este nível escolar.
    3.  Para cada questão, forneça 4 opções de resposta, onde apenas uma é correta.
    4.  No campo "subject" de cada objeto, coloque o nome da matéria correspondente.

    **Conteúdo de Referência (Resumo da BNCC):**
    ---
    ${CURRICULUM_CONTENT}
    ---

    Formato de saída deve ser um JSON Array, sem nenhum texto adicional.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              subject: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "subject"]
          }
        },
      }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating nivelamento test with Gemini:", error);
    throw new Error("Falha ao gerar o teste de nivelamento. Tente novamente.");
  }
}

export async function generateActivityFromTopic(topic: string, subject: string, studentGrade: string): Promise<Question[]> {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
    Você é um tutor de IA criando uma atividade educacional.

    **Informações do Aluno:**
    Série/Ano: ${studentGrade}

    **Tópico da Atividade:** ${topic}
    **Matéria:** ${subject}

    **Conteúdo de Referência (BNCC):**
    ---
    ${CURRICULUM_CONTENT}
    ---

    Gere 3 questões de múltipla escolha sobre o tópico acima, adequadas para a série do aluno. Cada questão deve ter 4 opções. Certifique-se de que as questões sejam claras e relevantes para o tópico e a matéria. No campo "subject", use o valor "${subject}".

    Formato de saída deve ser um JSON Array, sem nenhum texto adicional.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              subject: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "subject"]
          }
        },
      }
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating activity with Gemini:", error);
    throw new Error("Falha ao gerar a atividade. Por favor, tente novamente.");
  }
}

export async function generateTutorInsights(student: Student, activities: Activity[], answers: StudentAnswer[]): Promise<TutorInsights> {
    try {
        const model = 'gemini-2.5-pro';

        const performanceData = activities.map(activity => {
            const studentAnswer = answers.find(a => a.activityId === activity.id);
            if (!studentAnswer) return { title: activity.title, subject: activity.subject, results: "Não iniciada" };

            let correct = 0;
            const details = activity.content.map((q, index) => {
                const isCorrect = studentAnswer.answers[index] === q.correctAnswer;
                if (isCorrect) correct++;
                return { question: q.question, isCorrect };
            });
            return { title: activity.title, subject: activity.subject, score: `${correct}/${activity.content.length}`, details };
        });

        const prompt = `
        Você é um psicopedagogo e analista de dados educacionais. Analise os dados de desempenho de um aluno e forneça insights para o tutor.

        **Dados do Aluno:**
        - Nome: ${student.name}
        - Série/Ano: ${student.grade}
        - Resultados do Teste de Nivelamento: ${JSON.stringify(student.nivelamentoResults) || "Não concluído"}

        **Desempenho nas Atividades:**
        ${JSON.stringify(performanceData, null, 2)}

        **Sua Tarefa:**
        Baseado em TODOS os dados acima (nivelamento e atividades), gere um objeto JSON com duas chaves: "lessonSuggestions" e "hubData".

        1.  **lessonSuggestions**: Um array de 3 strings. Cada string deve ser uma sugestão curta e acionável de tópico de aula para focar. Ex: "Revisar operações com frações."
        2.  **hubData**: Um array de objetos para o "Hub de Informações". Para cada matéria principal (Português, Matemática, Ciências, História, Geografia), crie um objeto com as seguintes chaves:
            *   **subject**: O nome da matéria.
            *   **level**: O nível de proficiência do aluno ('Iniciante', 'Em Desenvolvimento', 'Adequado', 'Avançado'), baseado em uma análise holística.
            *   **summary**: Um resumo conciso (1-2 frases) das principais dificuldades observadas. Se não houver dificuldades, mencione os pontos fortes.
            *   **suggestions**: Uma sugestão clara de temas e atividades para suprir as dificuldades. Seja específico, citando tipos de exercícios. Exemplo para matemática: 'Praticar problemas interpretativos envolvendo frações e operações com decimais.' Exemplo para português: 'Realizar exercícios de interpretação de texto com foco em identificar a ideia principal e inferir informações implícitas.'

        **Exemplo do Formato de Saída (JSON):**
        {
          "lessonSuggestions": [
            "Focar em problemas de matemática com frações",
            "Trabalhar a interpretação de textos em português",
            "Revisar os povos originários do Brasil em História"
          ],
          "hubData": [
            {
              "subject": "Matemática",
              "level": "Em Desenvolvimento",
              "summary": "O aluno demonstra dificuldade em problemas de multiplicação com mais de um dígito e conceitos de frações.",
              "suggestions": "Praticar com exercícios de operações matemáticas e problemas interpretativos que envolvam frações."
            }
          ]
        }
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lessonSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hubData: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    subject: { type: Type.STRING },
                                    level: { type: Type.STRING },
                                    summary: { type: Type.STRING },
                                    suggestions: { type: Type.STRING },
                                },
                                required: ["subject", "level", "summary", "suggestions"]
                            }
                        }
                    },
                    required: ["lessonSuggestions", "hubData"]
                }
            }
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating tutor insights with Gemini:", error);
        throw new Error("Falha ao analisar o progresso do aluno.");
    }
}

export async function generateActivityFromTutorPrompt(
    title: string,
    instructions: string,
    studentGrade: string,
    pdfText?: string
): Promise<Question[]> {
  try {
    const model = 'gemini-2.5-flash';
    let prompt = `
    Você é um assistente de IA para tutores, criando uma atividade educacional personalizada.

    **Informações da Atividade:**
    - Título: ${title}
    - Série/Ano do Aluno: ${studentGrade}
    - Instruções do Tutor: "${instructions}"

    **Conteúdo de Referência (BNCC):**
    ---
    ${CURRICULUM_CONTENT}
    ---
    `;

    if (pdfText) {
      prompt += `
      **Texto Extraído de um PDF Fornecido pelo Tutor (use como base principal):**
      ---
      ${pdfText}
      ---
      `;
    }

    prompt += `
    **Sua Tarefa:**
    Baseado nas instruções do tutor e no texto do PDF (se fornecido), gere até 5 questões de múltipla escolha.
    - Se as instruções do tutor já contiverem perguntas e opções formatadas, sua tarefa é apenas convertê-las para o formato JSON.
    - Caso contrário, sua tarefa é CRIAR as perguntas com base no conteúdo e nas instruções fornecidas.
    - As questões devem ser claras, bem formuladas e adequadas à série do aluno.
    - Cada questão deve ter 4 opções de resposta, com apenas uma correta.
    - O campo "subject" deve ser derivado do título ou instruções (ex: "Português", "Matemática", "História"). Se não for claro, use "Personalizada".

    Formato de saída deve ser um JSON Array, sem nenhum texto adicional.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              subject: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "subject"]
          }
        },
      }
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating tutor activity with Gemini:", error);
    throw new Error("Falha ao gerar a atividade personalizada. Verifique as instruções e tente novamente.");
  }
}


// This function simulates extracting text from an uploaded PDF.
// For this project, it returns the hardcoded curriculum content.
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log("Simulating PDF text extraction for file:", file.name);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
  return `Texto extraído do arquivo ${file.name}: ${CURRICULUM_CONTENT.substring(0, 500)}...`;
}