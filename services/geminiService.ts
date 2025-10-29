import { Question, Student, Activity, StudentAnswer, TutorInsights, HubInfo } from '../types';

// Gemini API calls have been replaced with mock functions to run the app for free.

export async function generateNivelamentoTest(studentGrade: string): Promise<Question[]> {
  console.log(`[MOCK] Generating Nivelamento Test for grade: ${studentGrade}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  const mockQuestions = [
    {
      question: 'Qual é o sujeito da frase: "O cachorro correu pelo parque"?', subject: 'Português', options: ['O parque', 'correu', 'O cachorro', 'pelo'], correctAnswer: 'O cachorro'
    },
    {
      question: 'Qual palavra é um sinônimo de "feliz"?', subject: 'Português', options: ['Triste', 'Alegre', 'Cansado', 'Rápido'], correctAnswer: 'Alegre'
    },
    {
      question: 'Quanto é 15 + 27?', subject: 'Matemática', options: ['32', '42', '45', '52'], correctAnswer: '42'
    },
    {
      question: 'Se um quadrado tem um lado de 5cm, qual é sua área?', subject: 'Matemática', options: ['10cm²', '20cm²', '25cm²', '30cm²'], correctAnswer: '25cm²'
    },
    {
      question: 'Qual é o processo pelo qual as plantas produzem seu próprio alimento?', subject: 'Ciências', options: ['Respiração', 'Fotossíntese', 'Digestão', 'Evaporação'], correctAnswer: 'Fotossíntese'
    },
    {
      question: 'Qual planeta é conhecido como "Planeta Vermelho"?', subject: 'Ciências', options: ['Vênus', 'Marte', 'Júpiter', 'Saturno'], correctAnswer: 'Marte'
    },
    {
      question: 'Quem proclamou a Independência do Brasil?', subject: 'História', options: ['Tiradentes', 'Dom Pedro I', 'Dom João VI', 'Marechal Deodoro'], correctAnswer: 'Dom Pedro I'
    },
    {
      question: 'Em que ano o Brasil foi descoberto pelos portugueses?', subject: 'História', options: ['1500', '1600', '1700', '1822'], correctAnswer: '1500'
    },
    {
      question: 'Qual é a capital do Brasil?', subject: 'Geografia', options: ['Rio de Janeiro', 'São Paulo', 'Salvador', 'Brasília'], correctAnswer: 'Brasília'
    },
    {
      question: 'Qual destes rios é o maior em volume de água do mundo?', subject: 'Geografia', options: ['Nilo', 'Amazonas', 'Mississipi', 'Yangtzé'], correctAnswer: 'Amazonas'
    },
    {
      question: 'Se A é maior que B e B é maior que C, então A é ___ que C.', subject: 'Lógica', options: ['menor', 'igual', 'maior', 'não relacionado'], correctAnswer: 'maior'
    },
    {
      question: 'Qual número completa a sequência: 2, 4, 6, 8, __?', subject: 'Lógica', options: ['9', '10', '11', '12'], correctAnswer: '10'
    }
  ];
  return mockQuestions as any; // Cast to Question[] to satisfy type-checker. The app adds id/type later.
}

export async function generateActivityFromTopic(topic: string, subject: string, studentGrade: string): Promise<Question[]> {
  console.log(`[MOCK] Generating Activity for topic: ${topic}, subject: ${subject}, grade: ${studentGrade}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const mockQuestions = [
    {
      question: `Qual é a principal característica sobre "${topic}"?`,
      subject: subject,
      options: [`Resposta correta sobre ${topic}`, 'Opção B', 'Opção C', 'Opção D'],
      correctAnswer: `Resposta correta sobre ${topic}`,
    },
    {
      question: `Como "${topic}" se aplica no dia a dia?`,
      subject: subject,
      options: ['Exemplo prático correto', 'Exemplo B', 'Exemplo C', 'Exemplo D'],
      correctAnswer: 'Exemplo prático correto',
    },
    {
      question: `Qual das seguintes afirmações sobre "${topic}" é FALSA?`,
      subject: subject,
      options: ['Afirmação falsa (esta é a correta)', 'Afirmação verdadeira 1', 'Afirmação verdadeira 2', 'Afirmação verdadeira 3'],
      correctAnswer: 'Afirmação falsa (esta é a correta)',
    },
  ];
  return mockQuestions as any;
}

export async function generateTutorInsights(student: Student, activities: Activity[], answers: StudentAnswer[]): Promise<TutorInsights> {
    console.log(`[MOCK] Generating Tutor Insights for student: ${student.name}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const performanceBySubject: { [subject: string]: { correct: number; total: number } } = {};

    // Use nivelamento results as a baseline
    if (student.nivelamentoResults) {
        for (const subject in student.nivelamentoResults) {
            performanceBySubject[subject] = {
                correct: student.nivelamentoResults[subject],
                total: 100,
            };
        }
    }

    // Aggregate performance from activities
    activities.forEach(activity => {
        const studentAnswer = answers.find(a => a.activityId === activity.id);
        if (!studentAnswer) return;

        if (!performanceBySubject[activity.subject]) {
            performanceBySubject[activity.subject] = { correct: 0, total: 0 };
        }

        activity.content.forEach((q, index) => {
            if (q.type === 'multiple-choice') {
                performanceBySubject[activity.subject].total += 100; // Add to total score potential
                const isCorrect = studentAnswer.answers[index] === q.correctAnswer;
                if (isCorrect) {
                    performanceBySubject[activity.subject].correct += 100;
                }
            }
        });
    });

    const subjects = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia'];
    const hubData: HubInfo[] = subjects.map(subject => {
        const perf = performanceBySubject[subject];
        let score = 0;
        if (perf && perf.total > 0) {
            score = (perf.correct / perf.total) * 100;
        } else if (student.nivelamentoResults && student.nivelamentoResults[subject]) {
            score = student.nivelamentoResults[subject];
        }

        let level: string;
        let summary: string;
        let suggestions: string;

        if (score > 80) {
            level = 'Avançado';
            summary = `Excelente desempenho em ${subject}. O aluno demonstra domínio dos conceitos.`;
            suggestions = `Propor atividades de desafio e aprofundamento em ${subject}.`;
        } else if (score > 60) {
            level = 'Adequado';
            summary = `Bom desempenho em ${subject}, com acertos na maioria dos tópicos.`;
            suggestions = `Continuar praticando com exercícios variados para consolidar o conhecimento em ${subject}.`;
        } else if (score > 40) {
            level = 'Em Desenvolvimento';
            summary = `O aluno apresenta algumas dificuldades em ${subject} e precisa de reforço nos conceitos base.`;
            suggestions = `Revisar os fundamentos de ${subject} e focar em exercícios de fixação.`;
        } else {
            level = 'Iniciante';
            summary = `Foram observadas dificuldades significativas em ${subject}. É preciso uma atenção especial.`;
            suggestions = `Retomar os conceitos mais básicos de ${subject} com explicações detalhadas e atividades guiadas.`;
        }

        return { subject, level, summary, suggestions };
    });

    const strugglingSubjects = hubData.filter(d => d.level === 'Iniciante' || d.level === 'Em Desenvolvimento');
    
    const lessonSuggestions: string[] = [];
    if (strugglingSubjects.length > 0) {
        lessonSuggestions.push(`Focar na revisão de ${strugglingSubjects[0].subject}.`);
        if (strugglingSubjects.length > 1) {
            lessonSuggestions.push(`Trabalhar exercícios de base de ${strugglingSubjects[1].subject}.`);
        }
    }
    lessonSuggestions.push('Propor uma atividade lúdica para engajamento.');
    while(lessonSuggestions.length < 3) {
        lessonSuggestions.push('Revisar o último tópico estudado.');
    }


    return {
        lessonSuggestions: lessonSuggestions.slice(0, 3),
        hubData,
    };
}

export async function generateActivityFromTutorPrompt(
    title: string,
    instructions: string,
    studentGrade: string,
    pdfText?: string
): Promise<Question[]> {
    console.log(`[MOCK] Generating Activity from Tutor Prompt: ${title}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Basic subject detection
    let subject = "Personalizada";
    const subjects = ["Português", "Matemática", "História", "Geografia", "Ciências"];
    for (const s of subjects) {
        if (title.toLowerCase().includes(s.toLowerCase()) || instructions.toLowerCase().includes(s.toLowerCase())) {
            subject = s;
            break;
        }
    }
    
    const mockQuestions = [
        {
            question: `Com base nas instruções "${instructions.substring(0, 30)}...", qual é a resposta para a primeira questão?`,
            subject: subject,
            options: ['Opção 1', 'Opção 2', 'Opção 3 (correta)', 'Opção 4'],
            correctAnswer: 'Opção 3 (correta)',
        },
        {
            question: `Considerando o tópico "${title}", o que podemos concluir?`,
            subject: subject,
            options: ['Conclusão A (correta)', 'Conclusão B', 'Conclusão C', 'Conclusão D'],
            correctAnswer: 'Conclusão A (correta)',
        },
    ];

    if (pdfText) {
        mockQuestions.push({
            question: `O que o texto do PDF fornecido menciona?`,
            subject: subject,
            options: ['Tópico do PDF (correto)', 'Outro tópico', 'Tópico aleatório', 'Nenhuma das anteriores'],
            correctAnswer: 'Tópico do PDF (correto)',
        });
    }

    return mockQuestions as any;
}

// This function simulates extracting text from an uploaded PDF.
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log("[MOCK] Simulating PDF text extraction for file:", file.name);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
  return `Texto de exemplo extraído do arquivo ${file.name}. Este conteúdo pode ser usado como base para criar questões.`;
}
