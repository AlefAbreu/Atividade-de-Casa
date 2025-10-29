import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { generateNivelamentoTest } from '../services/geminiService';

interface NivelamentoTestProps {
  onComplete: (results: { [subject: string]: { correct: number; total: number } }) => void;
  studentGrade: string;
}

const NivelamentoTest: React.FC<NivelamentoTestProps> = ({ onComplete, studentGrade }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setIsLoading(true);
        const generatedQuestions = await generateNivelamentoTest(studentGrade);
        setQuestions(generatedQuestions);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar o teste.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [studentGrade]);

  const handleAnswer = (option: string) => {
    const newAnswers = { ...answers, [currentQuestionIndex]: option };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Test finished
      calculateResults(newAnswers);
    }
  };

  const calculateResults = (finalAnswers: { [key: number]: string }) => {
    const results: { [subject: string]: { correct: number; total: number } } = {};

    questions.forEach((q, index) => {
        if (!results[q.subject]) {
            results[q.subject] = { correct: 0, total: 0 };
        }
        results[q.subject].total++;
        if (finalAnswers[index] === q.correctAnswer) {
            results[q.subject].correct++;
        }
    });

    onComplete(results);
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
        <p className="mt-4 text-slate-500">Gerando sua avaliação de nivelamento com a IA... Por favor, aguarde.</p>
      </div>
    );
  }
  
  if (error) {
     return (
        <div className="w-full max-w-2xl mx-auto p-8 text-center bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="font-semibold text-red-700 dark:text-red-300">Ocorreu um Erro</p>
            <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
     )
  }
  
  if (questions.length === 0) {
      return <div>Nenhuma questão encontrada.</div>
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Avaliação de Nivelamento</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Vamos ver o que você já sabe!</p>
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-sky-700 dark:text-sky-300">Questão {currentQuestionIndex + 1} de {questions.length}</span>
            <span className="text-sm font-medium bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 px-2 py-0.5 rounded-full">{currentQuestion.subject}</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
          <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
        </div>
      </div>
      
      <div className="bg-slate-100 dark:bg-slate-900/50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">{currentQuestion.question}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.options.map(option => (
            <button
              key={option}
              onClick={() => handleAnswer(option)}
              className="p-4 text-left bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NivelamentoTest;