import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { UserRole, Student, Activity, StudentAnswer, StudyGoal, Badge, Question, TutorInsights, HubInfo } from './types';
import { useSharedState } from './hooks/useSharedState';
import { generateActivityFromTopic, extractTextFromPDF, generateTutorInsights, generateActivityFromTutorPrompt } from './services/geminiService';
import { checkNewBadges, ALL_BADGES } from './services/gamificationService';

import { BookOpenIcon, UserIcon, LockClosedIcon, PlusCircleIcon, UploadIcon, CheckCircleIcon, MedalIcon, StarIcon, LightbulbIcon, XCircleIcon } from './components/Icons';
import NivelamentoTest from './components/NivelamentoTest';
import ActivityPlayer from './components/ActivityPlayer';

// A predefined list of topics for random activity generation.
const ALL_TOPICS: { subject: string, topic: string }[] = [
    { subject: "Matemática", topic: "Operações com frações" },
    { subject: "Português", topic: "Identificação de sujeito e predicado" },
    { subject: "Ciências", topic: "O ciclo da água na natureza" },
    { subject: "História", topic: "As Grandes Navegações" },
    { subject: "Geografia", topic: "Biomas do Brasil" },
    { subject: "Matemática", topic: "Cálculo de área e perímetro" },
    { subject: "Português", topic: "Uso de pontuação (vírgula e ponto final)" },
    { subject: "Ciências", topic: "O sistema solar" },
    { subject: "Matemática", topic: "Problemas de lógica com números" },
    { subject: "Português", topic: "Interpretação de fábulas" },
];

// --- App Context for State Management ---
interface AppContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  answers: StudentAnswer[];
  setAnswers: React.Dispatch<React.SetStateAction<StudentAnswer[]>>;
  goals: StudyGoal[];
  setGoals: React.Dispatch<React.SetStateAction<StudyGoal[]>>;
  tutorInsights: { [studentId: string]: TutorInsights };
  
  addStudent: (name: string, age: number, grade: string) => void;
  addGeneratedActivity: (subject: string, topic: string, studentId: string) => Promise<void>;
  addActivity: (activityData: Omit<Activity, 'id'>) => void;
  saveStudentAnswer: (studentId: string, activityId: string, questionIndex: number, answer: string) => void;
  completeNivelamento: (studentId: string, results: { [subject: string]: { correct: number; total: number } }) => void;
  awardRewards: (studentId: string, activityId: string, score: { correct: number; total: number }) => { newBadges: Badge[], awardedPoints: number };
  getStudentInsights: (student: Student) => Promise<TutorInsights>;
}

const AppContext = React.createContext<AppContextType | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [students, setStudents] = useSharedState<Student[]>('students', []);
    const [activities, setActivities] = useSharedState<Activity[]>('activities', []);
    const [answers, setAnswers] = useSharedState<StudentAnswer[]>('answers', []);
    const [goals, setGoals] = useSharedState<StudyGoal[]>('goals', []);
    const [tutorInsights, setTutorInsights] = useSharedState<{ [studentId: string]: TutorInsights }>('tutorInsights', {});

    const addStudent = (name: string, age: number, grade: string) => {
        const newStudent: Student = { 
            id: `student-${Date.now()}`, 
            name, 
            age, 
            grade, 
            nivelamentoCompleted: false,
            nivelamentoResults: null,
            gamification: { points: 0, badges: [], rewardedActivities: [] } 
        };
        setStudents([...students, newStudent]);
    };
    
    const completeNivelamento = (studentId: string, results: { [subject: string]: { correct: number; total: number } }) => {
        const processedResults: { [subject: string]: number } = {};
        for(const subject in results) {
            const { correct, total } = results[subject];
            processedResults[subject] = total > 0 ? Math.round((correct / total) * 100) : 0;
        }
        setStudents(students.map(s => s.id === studentId ? { ...s, nivelamentoCompleted: true, nivelamentoResults: processedResults } : s));
    };

    const addGeneratedActivity = async (subject: string, topic: string, studentId: string) => {
        const student = students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");

        const generatedQuestions = await generateActivityFromTopic(topic, subject, student.grade);
        const newActivity: Activity = {
            id: `activity-${Date.now()}`,
            title: topic,
            subject: subject,
            type: 'generated',
            content: generatedQuestions.map((q, i) => ({
                ...q,
                id: `q-${Date.now()}-${i}`,
                type: 'multiple-choice',
            })),
            studentId,
        };
        setActivities(prev => [...prev, newActivity]);
    };
    
    const addActivity = (activityData: Omit<Activity, 'id'>) => {
        const newActivity: Activity = {
            id: `activity-${Date.now()}`,
            ...activityData,
        };
        setActivities(prev => [...prev, newActivity]);
    };

    const saveStudentAnswer = (studentId: string, activityId: string, questionIndex: number, answer: string) => {
        const existingAnswerIndex = answers.findIndex(a => a.activityId === activityId);
        if(existingAnswerIndex !== -1) {
            const updatedAnswers = [...answers];
            updatedAnswers[existingAnswerIndex].answers[questionIndex] = answer;
            setAnswers(updatedAnswers);
        } else {
            const newAnswer: StudentAnswer = {
                activityId,
                answers: { [questionIndex]: answer }
            };
            setAnswers([...answers, newAnswer]);
        }
    };
    
    const awardRewards = (studentId: string, activityId: string, score: { correct: number; total: number }) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return { newBadges: [], awardedPoints: 0 };

        const alreadyRewarded = student.gamification.rewardedActivities?.includes(activityId);

        let points = 0;
        if (!alreadyRewarded) {
            points = (score.correct * 10) + (score.correct === score.total && score.total > 0 ? 50 : 0);
        }
        
        const studentActivities = activities.filter(a => a.studentId === studentId);
        const studentAnswers = answers.filter(ans => studentActivities.some(act => act.id === ans.activityId));
        
        const newBadgeIds = checkNewBadges({ student, studentActivities, studentAnswers, completedActivityId: activityId, score });

        if (points > 0 || newBadgeIds.length > 0) {
            setStudents(students.map(s => {
                if (s.id === studentId) {
                    return {
                        ...s,
                        gamification: {
                            points: s.gamification.points + points,
                            badges: [...new Set([...s.gamification.badges, ...newBadgeIds])],
                            rewardedActivities: points > 0 ? [...(s.gamification.rewardedActivities || []), activityId] : (s.gamification.rewardedActivities || []),
                        }
                    };
                }
                return s;
            }));
        }

        const newBadges = ALL_BADGES.filter(b => newBadgeIds.includes(b.id));
        return { newBadges, awardedPoints: points };
    };
    
    const getStudentInsights = useCallback(async (student: Student): Promise<TutorInsights> => {
        if (tutorInsights[student.id]) {
            return tutorInsights[student.id];
        }
        const studentActivities = activities.filter(a => a.studentId === student.id);
        const studentAnswers = answers.filter(ans => studentActivities.some(act => act.id === ans.activityId));
        const result = await generateTutorInsights(student, studentActivities, studentAnswers);
        setTutorInsights(prev => ({...prev, [student.id]: result}));
        return result;
    }, [tutorInsights, activities, answers, setTutorInsights]);

    return (
        <AppContext.Provider value={{ students, setStudents, activities, setActivities, answers, setAnswers, goals, setGoals, tutorInsights, addStudent, addGeneratedActivity, addActivity, saveStudentAnswer, completeNivelamento, awardRewards, getStudentInsights }}>
            {children}
        </AppContext.Provider>
    );
};

const useAppContext = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within an AppProvider");
    return context;
};

// --- Main App Component ---
export default function App() {
  const [userRole, setUserRole] = useSharedState<UserRole>('userRole', UserRole.NONE);
  const [currentStudentId, setCurrentStudentId] = useSharedState<string | null>('currentStudentId', null);

  const handleRoleSelect = (role: UserRole) => {
    if (role !== UserRole.STUDENT) {
        setCurrentStudentId(null);
    }
    setUserRole(role);
  };
  
  const handleStudentLogin = (student: Student) => {
    setCurrentStudentId(student.id);
    setUserRole(UserRole.STUDENT);
  };
  
  const handleLogout = () => {
    setUserRole(UserRole.NONE);
    setCurrentStudentId(null);
  };

  const renderContent = () => {
    switch (userRole) {
      case UserRole.TUTOR:
        return <TutorDashboard onLogout={handleLogout} />;
      case UserRole.STUDENT:
        if (!currentStudentId) return <StudentLogin onLogin={handleStudentLogin} onBack={() => handleRoleSelect(UserRole.NONE)} />;
        return <StudentSessionWrapper studentId={currentStudentId} onLogout={handleLogout} />;
      default:
        return <RoleSelectionScreen onSelect={handleRoleSelect} />;
    }
  };

  return (
    <AppProvider>
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 md:p-8">
            {renderContent()}
        </div>
    </AppProvider>
  );
}

const StudentSessionWrapper: React.FC<{studentId: string, onLogout: () => void}> = ({ studentId, onLogout }) => {
    const { students } = useAppContext();
    const currentStudent = students.find(s => s.id === studentId);

    if (!currentStudent) {
        onLogout();
        return null;
    }

    if (!currentStudent.nivelamentoCompleted) {
        return <StudentNivelamentoWrapper student={currentStudent} onLogout={onLogout} />;
    }
    return <StudentDashboard student={currentStudent} onLogout={onLogout} />;
};

// --- Screen Components ---
const RoleSelectionScreen: React.FC<{ onSelect: (role: UserRole) => void }> = ({ onSelect }) => (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <BookOpenIcon className="w-20 h-20 text-sky-500 mb-4" />
        <h1 className="text-4xl font-bold mb-2 text-center">Bem-vindo ao Gemini EduTutor</h1>
        <p className="text-slate-500 mb-12 text-lg">Selecione seu perfil para começar.</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <button onClick={() => onSelect(UserRole.TUTOR)} className="flex-1 flex items-center justify-center gap-3 text-lg font-semibold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl p-6 hover:border-sky-500 dark:hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all">
                <LockClosedIcon /> Tutor
            </button>
            <button onClick={() => onSelect(UserRole.STUDENT)} className="flex-1 flex items-center justify-center gap-3 text-lg font-semibold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl p-6 hover:border-sky-500 dark:hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all">
                <UserIcon /> Aluno
            </button>
        </div>
    </div>
);

// --- Tutor Components ---

const ActivityReview: React.FC<{ activity: Activity; studentAnswer: StudentAnswer; onBack: () => void; }> = ({ activity, studentAnswer, onBack }) => {
    const { correct, total } = useMemo(() => {
        let correct = 0;
        const autoGradedQuestions = activity.content.filter(q => q.type === 'multiple-choice');
        
        activity.content.forEach((q, index) => {
            if (q.type === 'multiple-choice' && studentAnswer.answers[index] === q.correctAnswer) {
                correct++;
            }
        });

        return { correct, total: autoGradedQuestions.length };
    }, [activity, studentAnswer]);
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
        <div className="animate-fade-in">
            <button onClick={onBack} className="flex items-center gap-2 font-semibold text-slate-600 hover:text-sky-500 mb-4">
                &larr; Voltar para a lista
            </button>
            <div className="flex justify-between items-center mb-4 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                <div>
                    <h3 className="text-xl font-bold">{activity.title}</h3>
                    <p className="text-slate-500">{activity.subject}</p>
                </div>
                <div className="text-right">
                    <p className={`font-bold text-2xl ${percentage >= 70 ? 'text-green-500' : percentage > 40 ? 'text-yellow-500' : 'text-red-500'}`}>{percentage}%</p>
                    <p className="text-sm text-slate-500">{correct} de {total} corretas (auto-avaliadas)</p>
                </div>
            </div>
            <div className="space-y-4">
                {activity.content.map((question, index) => {
                    const studentAns = studentAnswer.answers[index];
                    const correctAns = question.correctAnswer;
                    
                    return (
                        <div key={index} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{index + 1}. {question.question}</p>
                            {question.type === 'multiple-choice' && question.options ? (
                                <div className="space-y-2">
                                    {question.options.map(option => {
                                        const isSelectedAnswer = option === studentAns;
                                        const isCorrectAnswer = option === correctAns;
                                        const isCorrect = studentAns === correctAns;
                                        let optionStyle = 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800';
                                        let icon = null;

                                        if (isSelectedAnswer) {
                                            if (isCorrect) {
                                                optionStyle = 'border-green-500 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200';
                                                icon = <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />;
                                            } else {
                                                optionStyle = 'border-red-500 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
                                                icon = <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />;
                                            }
                                        } else if (isCorrectAnswer) {
                                            optionStyle = 'border-green-500 bg-green-50 dark:bg-green-900/30';
                                            icon = <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 opacity-70" />;
                                        }

                                        return (
                                            <div key={option} className={`p-3 rounded-md border-2 ${optionStyle} flex items-center justify-between gap-3`}>
                                                <span>{option}</span>
                                                {icon}
                                            </div>
                                        );
                                    })}
                                </div>
                             ) : (
                                <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Resposta do Aluno:</p>
                                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{studentAns || "Não respondida"}</p>
                                </div>
                             )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CompletedActivitiesView: React.FC<{ student: Student }> = ({ student }) => {
    const { activities, answers } = useAppContext();
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

    const completedActivities = useMemo(() => {
        const studentActivities = activities.filter(a => a.studentId === student.id);
        return studentActivities.filter(act => {
            const ans = answers.find(a => a.activityId === act.id);
            return ans && Object.keys(ans.answers).length === act.content.length;
        });
    }, [activities, answers, student.id]);

    const selectedActivity = activities.find(a => a.id === selectedActivityId);
    const selectedActivityAnswers = answers.find(a => a.activityId === selectedActivityId);

    const calculateScore = (activity: Activity, answer: StudentAnswer) => {
        let correct = 0;
        const autoGraded = activity.content.filter(q => q.type === 'multiple-choice');
        activity.content.forEach((q, index) => {
            if (q.type === 'multiple-choice' && answer.answers[index] === q.correctAnswer) {
                correct++;
            }
        });
        return { correct, total: autoGraded.length };
    };

    if (selectedActivity && selectedActivityAnswers) {
        return <ActivityReview activity={selectedActivity} studentAnswer={selectedActivityAnswers} onBack={() => setSelectedActivityId(null)} />;
    }

    return (
        <div className="animate-fade-in">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Atividades Concluídas pelo Aluno</h3>
            {completedActivities.length === 0 ? (
                <div className="text-center py-8">
                    <CheckCircleIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500">O aluno ainda não concluiu nenhuma atividade.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {completedActivities.map(activity => {
                        const answer = answers.find(a => a.activityId === activity.id);
                        if (!answer) return null;
                        const { correct, total } = calculateScore(activity, answer);
                        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

                        return (
                            <div key={activity.id} onClick={() => setSelectedActivityId(activity.id)} className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-all">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{activity.title}</h4>
                                        <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">{activity.subject}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${percentage >= 70 ? 'text-green-500' : percentage > 40 ? 'text-yellow-500' : 'text-red-500'}`}>{percentage > 0 ? `${percentage}%` : '--'}</p>
                                        <p className="text-sm text-slate-500">{total > 0 ? `${correct}/${total} corretas` : 'Não avaliável'}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const TutorDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [password, setPassword] = useSharedState('tutorPassword', '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const { students } = useAppContext();

  React.useEffect(() => {
      if (password) setIsAuthenticated(false);
      else setIsAuthenticated(false);
  }, [password]);

  const handleLogin = () => {
    if (password) {
      if (input === password) {
          setError('');
          setIsAuthenticated(true);
      } else setError('Senha incorreta.');
    } else {
      if(input.length < 4) {
          setError('A senha deve ter pelo menos 4 caracteres.');
          return;
      }
      setPassword(input);
      setIsAuthenticated(true);
    }
  };

  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <LockClosedIcon className="w-16 h-16 text-sky-500 mb-4" />
            <h2 className="text-3xl font-bold mb-2">{password ? 'Login do Tutor' : 'Crie sua Senha de Tutor'}</h2>
            <p className="text-slate-500 mb-8">{password ? 'Digite sua senha para acessar.' : 'Esta senha será usada para futuros acessos.'}</p>
            <div className="w-full max-w-sm space-y-4">
                <input type="password" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} className="w-full p-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Digite sua senha"/>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={handleLogin} className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 transition-colors">{password ? 'Entrar' : 'Criar Senha e Entrar'}</button>
                <button onClick={onLogout} className="w-full text-slate-500 hover:text-sky-500 font-semibold mt-4">&larr; Voltar</button>
            </div>
        </div>
    );
  }

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Painel do Tutor</h1>
            <button onClick={onLogout} className="font-semibold text-slate-600 hover:text-sky-500">Sair</button>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md">
                <h2 className="text-xl font-bold mb-4">Alunos</h2>
                <StudentManager onSelectStudent={setSelectedStudentId} selectedStudentId={selectedStudentId} />
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md min-h-[400px]">
                {selectedStudent ? <StudentDetailView student={selectedStudent} /> : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <UserIcon className="w-12 h-12 text-slate-400 mb-4"/>
                        <p className="text-slate-500">Selecione um aluno para ver os detalhes e analisar seu progresso.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

const StudentManager: React.FC<{ onSelectStudent: (id: string) => void, selectedStudentId: string | null }> = ({ onSelectStudent, selectedStudentId }) => {
    const { students, addStudent } = useAppContext();
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [grade, setGrade] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const gradeOptions = [
        "Educação Infantil", "1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano", "6º Ano", "7º Ano", "8º Ano", "9º Ano"
    ];

    const handleAddStudent = () => {
        if (name && age && grade) {
            addStudent(name, parseInt(age), grade);
            setName(''); setAge(''); setGrade('');
            setIsAdding(false);
        }
    };
    
    return (
        <div>
            <div className="space-y-2 mb-4">
                {students.map(student => (
                    <button key={student.id} onClick={() => onSelectStudent(student.id)} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${selectedStudentId === student.id ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <UserIcon className="w-5 h-5"/>
                        <span className="font-semibold">{student.name}</span>
                        <span className="text-sm text-slate-500 ml-auto">{student.grade}</span>
                    </button>
                ))}
                 {students.length === 0 && <p className="text-slate-500 text-sm p-3">Nenhum aluno cadastrado.</p>}
            </div>

            {isAdding ? (
                <div className="space-y-3 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do aluno" className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md" />
                    <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Idade" className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md" />
                    <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md">
                        <option value="" disabled>Selecione a série/ano</option>
                        {gradeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button onClick={handleAddStudent} className="flex-1 bg-sky-600 text-white font-semibold py-2 rounded-md hover:bg-sky-500">Salvar</button>
                        <button onClick={() => setIsAdding(false)} className="flex-1 bg-slate-200 dark:bg-slate-600 font-semibold py-2 rounded-md hover:bg-slate-300">Cancelar</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setIsAdding(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-slate-200 dark:bg-slate-700 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                    <PlusCircleIcon /> Adicionar Aluno
                </button>
            )}
        </div>
    );
};

const StudentDetailView: React.FC<{ student: Student }> = ({ student }) => {
    const { tutorInsights, getStudentInsights } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'insights' | 'create' | 'review'>('insights');

    const currentInsights = tutorInsights[student.id] || null;

    // Reset tab when student changes
    useEffect(() => {
        setActiveTab('insights');
        setError('');
    }, [student.id]);

    const handleAnalyzeProgress = async () => {
        setIsLoading(true);
        setError('');
        try {
            await getStudentInsights(student);
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro na análise.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{student.name}</h2>
            </div>
            
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('insights')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'insights' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Análise IA</button>
                    <button onClick={() => setActiveTab('create')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'create' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Criar Atividade</button>
                    <button onClick={() => setActiveTab('review')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'review' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Revisar Atividades</button>
                </nav>
            </div>

            <div className="pt-6">
                {activeTab === 'insights' && (
                    <div className="animate-fade-in">
                        {!student.nivelamentoCompleted ? (
                            <div className="p-3 my-4 text-sm text-yellow-800 bg-yellow-100 rounded-lg dark:bg-yellow-900/30 dark:text-yellow-300">
                                <strong>Atenção:</strong> O aluno ainda não completou a avaliação de nivelamento. A análise de progresso está desabilitada.
                            </div>
                        ) : (
                            <button onClick={handleAnalyzeProgress} disabled={isLoading} className="w-full p-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed">
                                {isLoading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Analisando...</> : <><LightbulbIcon /> {currentInsights ? 'Reanalisar Progresso' : 'Analisar Progresso com IA'}</>}
                            </button>
                        )}
                        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                        {currentInsights && <TutorInsightsView insights={currentInsights} />}
                    </div>
                )}
                {activeTab === 'create' && <ActivityCreator student={student} />}
                {activeTab === 'review' && <CompletedActivitiesView student={student} />}
            </div>
        </div>
    );
};

const ActivityCreator: React.FC<{ student: Student }> = ({ student }) => {
    const { addActivity } = useAppContext();
    const [view, setView] = useState<'form' | 'edit'>('form');
    const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);
    
    const [title, setTitle] = useState('');
    const [instructions, setInstructions] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    const resetForm = useCallback(() => {
        setTitle('');
        setInstructions('');
        setPdfFile(null);
        setEditableQuestions([]);
        setError('');
        setView('form');
    }, []);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !instructions.trim()) {
            setError('O título e as instruções são obrigatórios.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            let pdfText: string | undefined = undefined;
            if (pdfFile) {
                pdfText = await extractTextFromPDF(pdfFile);
            }
            const generated = await generateActivityFromTutorPrompt(title, instructions, student.grade, pdfText);
            if (generated.length === 0) {
                throw new Error("A IA não conseguiu gerar questões. Tente ser mais específico.");
            }
            setEditableQuestions(generated.map((q, index) => ({
                ...q,
                id: `q-${Date.now()}-${index}`,
                type: 'multiple-choice',
                options: q.options || [],
            })));
            setView('edit');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveActivity = () => {
        if (editableQuestions.length === 0) {
            setError("A atividade deve ter pelo menos uma questão.");
            return;
        }
        addActivity({
            title,
            studentId: student.id,
            type: pdfFile ? 'pdf' : 'manual',
            subject: editableQuestions[0]?.subject || "Personalizada",
            content: editableQuestions,
        });
        setSuccessMessage('Atividade salva com sucesso!');
        resetForm();
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    const handleQuestionChange = (id: string, field: keyof Question, value: any) => {
        setEditableQuestions(qs => qs.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const handleOptionChange = (qId: string, optIndex: number, text: string) => {
        setEditableQuestions(qs => qs.map(q => {
            if (q.id === qId) {
                const newOptions = [...(q.options || [])];
                newOptions[optIndex] = text;
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };
    
    const handleAddOption = (qId: string) => {
        setEditableQuestions(qs => qs.map(q => q.id === qId ? {...q, options: [...(q.options || []), "Nova opção"]} : q))
    };

    const handleRemoveOption = (qId: string, optIndex: number) => {
        setEditableQuestions(qs => qs.map(q => {
             if (q.id === qId) {
                const newOptions = [...(q.options || [])];
                const removedOption = newOptions.splice(optIndex, 1)[0];
                const newCorrectAnswer = q.correctAnswer === removedOption ? undefined : q.correctAnswer;
                return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
            }
            return q;
        }));
    };
    
    const handleAddQuestion = (type: 'multiple-choice' | 'open-ended') => {
        const newQuestion: Question = {
            id: `q-${Date.now()}`,
            question: '',
            subject: editableQuestions[0]?.subject || 'Personalizada',
            type,
            ...(type === 'multiple-choice' && { options: [''], correctAnswer: '' })
        };
        setEditableQuestions(qs => [...qs, newQuestion]);
    }

    const handleRemoveQuestion = (id: string) => {
        setEditableQuestions(qs => qs.filter(q => q.id !== id));
    }

    if (view === 'edit') {
        return (
            <div className="animate-fade-in space-y-4">
                 <h3 className="text-xl font-bold">Editor de Atividade: {title}</h3>
                 {editableQuestions.map((q, index) => (
                    <div key={q.id} className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">Questão {index + 1}</p>
                            <button onClick={() => handleRemoveQuestion(q.id)} className="text-red-500 hover:text-red-700"><XCircleIcon /></button>
                        </div>
                         <textarea value={q.question} onChange={e => handleQuestionChange(q.id, 'question', e.target.value)} placeholder="Digite o enunciado da questão" className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md mb-2"></textarea>
                         <select value={q.type} onChange={e => handleQuestionChange(q.id, 'type', e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md mb-3">
                            <option value="multiple-choice">Múltipla Escolha</option>
                            <option value="open-ended">Resposta Aberta</option>
                        </select>
                        {q.type === 'multiple-choice' && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Opções (marque a correta):</p>
                                {q.options?.map((opt, optIndex) => (
                                    <div key={optIndex} className="flex items-center gap-2">
                                        <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt} onChange={() => handleQuestionChange(q.id, 'correctAnswer', opt)} />
                                        <input type="text" value={opt} onChange={e => handleOptionChange(q.id, optIndex, e.target.value)} className="flex-1 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md" />
                                        <button onClick={() => handleRemoveOption(q.id, optIndex)} className="text-red-500 hover:text-red-600 p-1"><XCircleIcon className="w-5 h-5"/></button>
                                    </div>
                                ))}
                                <button onClick={() => handleAddOption(q.id)} className="text-sm font-semibold text-sky-600 hover:text-sky-800">Adicionar opção</button>
                            </div>
                        )}
                    </div>
                 ))}
                 <div className="flex gap-2">
                    <button onClick={() => handleAddQuestion('multiple-choice')} className="flex-1 text-sm p-2 bg-slate-200 dark:bg-slate-700 rounded-md font-semibold hover:bg-slate-300">Adicionar Múltipla Escolha</button>
                    <button onClick={() => handleAddQuestion('open-ended')} className="flex-1 text-sm p-2 bg-slate-200 dark:bg-slate-700 rounded-md font-semibold hover:bg-slate-300">Adicionar Resposta Aberta</button>
                 </div>
                 <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={handleSaveActivity} className="flex-1 p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500">Salvar Atividade</button>
                    <button onClick={resetForm} className="flex-1 p-3 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-500">Cancelar</button>
                 </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleGenerate} className="space-y-4 animate-fade-in">
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Título da Atividade</label>
                <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500" placeholder="Ex: Interpretação de Texto" />
            </div>
            <div>
                <label htmlFor="instructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Instruções ou Conteúdo</label>
                <textarea id="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} rows={6} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500" placeholder="Digite um tópico (Ex: 'O ciclo da água') ou cole um texto, ou até mesmo escreva as perguntas e opções que você deseja."></textarea>
            </div>
            <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anexar PDF (Opcional)</label>
                <label htmlFor="pdf-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <UploadIcon className="w-5 h-5" />
                    <span>{pdfFile ? `Arquivo: ${pdfFile.name}` : 'Escolher arquivo PDF'}</span>
                </label>
                <input id="pdf-upload" type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {successMessage && <p className="text-green-600 text-sm">{successMessage}</p>}
            <button type="submit" disabled={isLoading} className="w-full p-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed">
                {isLoading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Gerando...</> : 'Gerar e Editar Atividade'}
            </button>
        </form>
    );
};

const KnowledgeChart: React.FC<{ hubData: HubInfo[] }> = ({ hubData }) => {
    const levelConfig: { [key: string]: { width: string; color: string; value: number } } = {
        'Iniciante': { width: '25%', color: 'bg-red-500', value: 25 },
        'Em Desenvolvimento': { width: '50%', color: 'bg-yellow-500', value: 50 },
        'Adequado': { width: '75%', color: 'bg-sky-500', value: 75 },
        'Avançado': { width: '100%', color: 'bg-green-500', value: 100 },
    };

    return (
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
            <h4 className="text-lg font-bold text-center mb-4">Gráfico de Conhecimento</h4>
            {hubData.map(data => (
                <div key={data.subject}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.subject}</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{data.level}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                        <div
                            className={`h-4 rounded-full transition-all duration-500 ${levelConfig[data.level]?.color || 'bg-slate-400'}`}
                            style={{ width: levelConfig[data.level]?.width || '0%' }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

const TutorInsightsView: React.FC<{ insights: TutorInsights }> = ({ insights }) => {
    const [activeTab, setActiveTab] = useState<'hub' | 'suggestions'>('hub');

    return (
        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                <button onClick={() => setActiveTab('hub')} className={`py-2 px-4 font-semibold ${activeTab === 'hub' ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-500'}`}>Hub de Informações</button>
                <button onClick={() => setActiveTab('suggestions')} className={`py-2 px-4 font-semibold ${activeTab === 'suggestions' ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-500'}`}>Sugestões de Aula</button>
            </div>

            {activeTab === 'hub' && (
                <div className="animate-fade-in">
                    <KnowledgeChart hubData={insights.hubData} />
                    <div className="space-y-4">
                        {insights.hubData.map(data => (
                            <div key={data.subject} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="text-lg font-bold">{data.subject}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2"><strong className="text-slate-800 dark:text-slate-200">Resumo:</strong> {data.summary}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400"><strong className="text-slate-800 dark:text-slate-200">Sugestão Prática:</strong> {data.suggestions}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'suggestions' && (
                <ul className="space-y-2 list-disc list-inside animate-fade-in">
                    {insights.lessonSuggestions.map((suggestion, index) => (
                        <li key={index} className="text-slate-700 dark:text-slate-300">{suggestion}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};


// --- Student Components ---
const StudentLogin: React.FC<{ onLogin: (student: Student) => void, onBack: () => void }> = ({ onLogin, onBack }) => {
    const { students } = useAppContext();
    const [selectedId, setSelectedId] = useState('');

    const handleLogin = () => {
        const student = students.find(s => s.id === selectedId);
        if (student) onLogin(student);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <UserIcon className="w-16 h-16 text-sky-500 mb-4" />
            <h2 className="text-3xl font-bold mb-2">Login do Aluno</h2>
            <p className="text-slate-500 mb-8">Selecione seu nome para começar a aprender!</p>
            <div className="w-full max-w-sm space-y-4">
                 {students.length > 0 ? (
                    <>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg">
                            <option value="" disabled>Selecione seu nome</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={handleLogin} disabled={!selectedId} className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 transition-colors disabled:bg-slate-400">
                            Entrar
                        </button>
                    </>
                ) : (
                    <p className="text-center text-slate-500 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        Nenhum aluno cadastrado. Peça ao seu tutor para adicioná-lo.
                    </p>
                )}
                 <button onClick={onBack} className="w-full text-slate-500 hover:text-sky-500 font-semibold mt-4">
                    &larr; Voltar
                </button>
            </div>
        </div>
    );
};

const StudentNivelamentoWrapper: React.FC<{student: Student, onLogout: () => void}> = ({student, onLogout}) => {
    const { completeNivelamento } = useAppContext();
    const handleComplete = (results: { [subject: string]: { correct: number; total: number } }) => {
        completeNivelamento(student.id, results);
    }
    return (
        <div>
            <header className="flex justify-between items-center mb-8 max-w-2xl mx-auto">
                <h1 className="text-xl font-bold">Olá, {student.name}!</h1>
                <button onClick={onLogout} className="font-semibold text-slate-600 hover:text-sky-500">Sair</button>
            </header>
            <NivelamentoTest onComplete={handleComplete} studentGrade={student.grade} />
        </div>
    );
}

const StudentDashboard: React.FC<{ student: Student, onLogout: () => void }> = ({ student, onLogout }) => {
    const { activities, answers, saveStudentAnswer, awardRewards, addGeneratedActivity, getStudentInsights } = useAppContext();
    const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);
    const [completionData, setCompletionData] = useState<{ newBadges: Badge[]; awardedPoints: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const studentActivities = useMemo(() => activities.filter(a => a.studentId === student.id), [activities, student.id]);
    
    useEffect(() => {
        const generateDailyActivities = async () => {
            const uncompletedActivities = studentActivities.filter(act => {
                const ans = answers.find(a => a.activityId === act.id);
                return !ans || Object.keys(ans.answers).length < act.content.length;
            });
            
            const needed = 3 - uncompletedActivities.length;
            if (needed <= 0 || isGenerating) return;

            setIsGenerating(true);
            try {
                // Get student insights to guide activity generation
                const insights = await getStudentInsights(student);
                const weights: { [key: string]: number } = {
                    'Iniciante': 4,
                    'Em Desenvolvimento': 3,
                    'Adequado': 1,
                    'Avançado': 0,
                };

                const weightedSubjects: string[] = [];
                insights.hubData.forEach(data => {
                    const weight = weights[data.level] || 1;
                    for (let i = 0; i < weight; i++) {
                        weightedSubjects.push(data.subject);
                    }
                });
                
                // If all subjects are advanced, give them all equal weight
                if (weightedSubjects.length === 0) {
                    insights.hubData.forEach(data => weightedSubjects.push(data.subject));
                }

                for (let i = 0; i < needed; i++) {
                    // Pick a weighted random subject
                    const randomSubject = weightedSubjects[Math.floor(Math.random() * weightedSubjects.length)];
                    
                    // Find available topics for that subject, excluding ones already in the uncompleted list
                    const availableTopics = ALL_TOPICS.filter(t => t.subject === randomSubject && !uncompletedActivities.some(ua => ua.title === t.topic));
                    
                    const topicToGenerate = availableTopics.length > 0 
                        ? availableTopics[Math.floor(Math.random() * availableTopics.length)]
                        // Fallback to any topic if no specific ones are available
                        : ALL_TOPICS[Math.floor(Math.random() * ALL_TOPICS.length)];
                        
                    await addGeneratedActivity(topicToGenerate.subject, topicToGenerate.topic, student.id);
                }
            } catch(e) {
                console.error("Failed to generate adaptive daily activities", e);
            } finally {
                setIsGenerating(false);
            }
        };

        if (student.nivelamentoCompleted) {
             generateDailyActivities();
        }
    }, [student.id, studentActivities.length, student.nivelamentoCompleted]);

    
    const handleSaveAnswer = (questionIndex: number, answer: string) => {
        if(currentActivityId) {
            saveStudentAnswer(student.id, currentActivityId, questionIndex, answer);
        }
    };

    const handleActivityComplete = (score: { correct: number; total: number; points: number; newBadges: Badge[] }) => {
        if (currentActivityId) {
            const { newBadges, awardedPoints } = awardRewards(student.id, currentActivityId, score);
            setCompletionData({ newBadges, awardedPoints });
        }
        if(completionData) { 
            setCurrentActivityId(null);
            setCompletionData(null);
        }
    };
    
    if (currentActivityId) {
        const activity = activities.find(a => a.id === currentActivityId);
        const studentAnswers = answers.find(a => a.activityId === currentActivityId);
        if (!activity) return <div>Atividade não encontrada.</div>;
        
        const isRewarded = student.gamification.rewardedActivities?.includes(currentActivityId) ?? false;

        return <ActivityPlayer activity={activity} studentAnswers={studentAnswers} onSaveAnswer={handleSaveAnswer} onComplete={handleActivityComplete} completionData={completionData} isRewarded={isRewarded} />;
    }
    
    const studentBadges = ALL_BADGES.filter(b => student.gamification.badges.includes(b.id));

    return (
        <div className="max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Olá, {student.name}!</h1>
                    <p className="text-slate-500">Pronto para aprender hoje?</p>
                </div>
                <button onClick={onLogout} className="font-semibold text-slate-600 hover:text-sky-500">Sair</button>
            </header>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md mb-8">
                 <h2 className="text-xl font-bold mb-4">Centro de Recompensas</h2>
                <div className="flex flex-wrap items-center gap-8">
                    <div className="text-center">
                        <p className="text-4xl font-bold text-sky-500">{student.gamification.points}</p>
                        <p className="font-semibold text-slate-600 dark:text-slate-400">Pontos (XP)</p>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold mb-2">Suas Medalhas</h3>
                        <div className="flex gap-3">
                            {ALL_BADGES.map(badge => {
                                const isUnlocked = studentBadges.some(b => b.id === badge.id);
                                return (
                                    <div key={badge.id} className="tooltip-container relative">
                                        <div className={`p-3 rounded-full ${isUnlocked ? 'bg-yellow-100 dark:bg-yellow-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <badge.icon className={`w-8 h-8 ${isUnlocked ? 'text-yellow-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div className="tooltip-text absolute bottom-full mb-2 w-48 bg-slate-800 text-white text-xs rounded py-1 px-2 text-center left-1/2 -translate-x-1/2 opacity-0 transition-opacity">
                                            <p className="font-bold">{badge.name}</p>
                                            <p>{badge.description}</p>
                                            {!isUnlocked && <p className="font-bold text-red-400">(Bloqueada)</p>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                 <style>{` .tooltip-container:hover .tooltip-text { opacity: 1; visibility: visible; } `}</style>
            </div>
            
             <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Suas Atividades Diárias</h2>
                {isGenerating && <p className="text-slate-500 text-center py-4">Gerando novas atividades adaptativas para você...</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {studentActivities.map(act => {
                        const studentAnswer = answers.find(ans => ans.activityId === act.id);
                        const isCompleted = studentAnswer && Object.keys(studentAnswer.answers).length === act.content.length;
                        const isInProgress = studentAnswer && !isCompleted && Object.keys(studentAnswer.answers).length > 0;
                        
                        let statusColor = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
                        if (isCompleted) statusColor = 'bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-700';
                        if (isInProgress) statusColor = 'bg-yellow-50 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700';

                        return (
                             <div key={act.id} className={`p-6 rounded-2xl shadow-md cursor-pointer transition-all transform hover:-translate-y-1 border ${statusColor}`} onClick={() => setCurrentActivityId(act.id)}>
                                <div className="flex items-center justify-between mb-2">
                                     <h3 className="font-bold text-lg">{act.title}</h3>
                                     {isCompleted ? <CheckCircleIcon className="w-8 h-8 text-green-500" /> : <BookOpenIcon className="w-8 h-8 text-sky-500" />}
                                </div>
                                <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">{act.subject}</span>
                                <p className="text-sm text-slate-500 mt-3">{act.content.length} questões</p>
                                <button className="w-full mt-4 bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">
                                    {isCompleted ? 'Revisar' : (isInProgress ? 'Continuar' : 'Começar')}
                                </button>
                            </div>
                        )
                    })}
                    {studentActivities.length === 0 && !isGenerating && (
                        <div className="md:col-span-2 lg:col-span-3 text-center py-10">
                            <p className="text-slate-500">Nenhuma atividade disponível. As atividades diárias serão geradas em breve!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};