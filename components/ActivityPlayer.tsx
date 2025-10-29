import React, { useState, useMemo } from 'react';
import { Activity, StudentAnswer, Badge } from '../types';
import { CheckCircleIcon, MedalIcon } from './Icons';
import { ALL_BADGES } from '../services/gamificationService';


interface ActivityPlayerProps {
  activity: Activity;
  studentAnswers: StudentAnswer | undefined;
  onSaveAnswer: (questionIndex: number, answer: string) => void;
  onComplete: (score: { correct: number; total: number; points: number; newBadges: Badge[] }) => void;
  completionData: { newBadges: Badge[], awardedPoints: number } | null;
  isRewarded: boolean;
}

const ActivityPlayer: React.FC<ActivityPlayerProps> = ({ activity, studentAnswers, onSaveAnswer, onComplete, completionData, isRewarded }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(studentAnswers?.answers[currentQuestionIndex] || null);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = activity.content[currentQuestionIndex];

  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
    onSaveAnswer(currentQuestionIndex, option);
  };

  const handleNext = () => {
    if (currentQuestionIndex < activity.content.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(studentAnswers?.answers[currentQuestionIndex + 1] || null);
    } else {
      setIsFinished(true);
      onComplete(calculateScore());
    }
  };
  
  const calculateScore = () => {
      let correct = 0;
      activity.content.forEach((q, index) => {
          if (q.type === 'multiple-choice' && studentAnswers?.answers[index] === q.correctAnswer) {
              correct++;
          }
      });
      const total = activity.content.filter(q => q.type === 'multiple-choice').length;
      const points = (correct * 10) + (correct === total && total > 0 ? 50 : 0);
      return { correct, total, points, newBadges: [] };
  }

  if (isFinished) {
    const { correct, total } = calculateScore();
    const percentage = Math.round((total > 0 ? (correct / total) : 0) * 100);
    const points = completionData 
        ? completionData.awardedPoints 
        : isRewarded 
            ? 0 
            : (correct * 10) + (correct === total && total > 0 ? 50 : 0);

    return (
        <div className="w-full max-w-2xl mx-auto p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border text-center">
            <MedalIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Atividade Concluída!</h2>
            <p className="text-slate-600 mb-6 text-lg">Excelente trabalho!</p>
            <div className="bg-sky-100 dark:bg-sky-900/50 p-6 rounded-lg mb-6">
                <div className="flex justify-around items-center">
                    <div>
                        <p className="text-xl font-semibold text-sky-800 dark:text-sky-200">Sua Pontuação</p>
                        <p className="text-5xl font-bold text-sky-600 dark:text-sky-400">{percentage}%</p>
                        <p className="text-slate-500">Você acertou {correct} de {total} questões.</p>
                    </div>
                    <div className="border-l-2 border-sky-200 dark:border-sky-700 h-20"></div>
                     <div>
                        <p className="text-xl font-semibold text-sky-800 dark:text-sky-200">Pontos Ganhos</p>
                        <p className="text-5xl font-bold text-sky-600 dark:text-sky-400">+{points}</p>
                        <p className="text-slate-500">XP</p>
                    </div>
                </div>
            </div>
            
            {(isRewarded || (completionData && completionData.awardedPoints === 0)) && (
                <p className="text-slate-500 text-sm -mt-4 mb-6">Você já havia completado esta atividade e não ganhou novos pontos desta vez.</p>
            )}

            {completionData && completionData.newBadges.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-700">Novas Conquistas!</h3>
                    <div className="flex justify-center gap-4 mt-2">
                        {completionData.newBadges.map(badge => (
                             <div key={badge.id} className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-3">
                                <badge.icon className="w-8 h-8 text-yellow-500" />
                                <div>
                                    <p className="font-bold text-yellow-800">{badge.name}</p>
                                    <p className="text-xs text-yellow-700">{badge.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={() => onComplete(calculateScore())}
                className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors"
            >
                Voltar ao Painel
            </button>
        </div>
    );
  }


  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{activity.title}</h2>
      <p className="text-slate-500 mb-6">Questão {currentQuestionIndex + 1} de {activity.content.length}</p>
      
      <div className="mb-4">
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / activity.content.length) * 100}%` }}></div>
        </div>
      </div>
      
      <div className="bg-slate-100 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{currentQuestion.question}</h3>
        {currentQuestion.type === 'multiple-choice' && currentQuestion.options ? (
            <div className="flex flex-col gap-3">
            {currentQuestion.options.map(option => {
                const isSelected = selectedOption === option;
                return (
                <button
                    key={option}
                    onClick={() => handleSelectOption(option)}
                    className={`p-4 text-left rounded-lg border-2 transition-all duration-200 flex items-center justify-between ${
                    isSelected ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-slate-300 bg-white hover:border-green-400'
                    }`}
                >
                    <span>{option}</span>
                    {isSelected && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                </button>
                )
            })}
            </div>
        ) : (
            <div>
                 <textarea 
                    value={selectedOption || ''}
                    onChange={(e) => handleSelectOption(e.target.value)}
                    rows={5}
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Digite sua resposta aqui..."
                 />
            </div>
        )}
      </div>

       <button
        onClick={handleNext}
        disabled={!selectedOption}
        className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
      >
        {currentQuestionIndex < activity.content.length - 1 ? 'Próxima Questão' : 'Finalizar Atividade'}
      </button>

    </div>
  );
};

export default ActivityPlayer;