
import { Student, Activity, StudentAnswer, Badge } from '../types';
import { StarIcon, ZapIcon, TrendingUpIcon } from '../components/Icons';

export const ALL_BADGES: Badge[] = [
    {
        id: 'first_activity',
        name: 'Primeiros Passos',
        description: 'Concluiu sua primeira atividade.',
        icon: ZapIcon,
    },
    {
        id: 'perfect_score',
        name: 'Mestre do Saber',
        description: 'Conseguiu uma pontuação perfeita em uma atividade.',
        icon: StarIcon,
    },
    {
        id: 'three_completed',
        name: 'Trio de Sucesso',
        description: 'Concluiu 3 atividades.',
        icon: TrendingUpIcon,
    },
];

interface CheckNewBadgesArgs {
    student: Student;
    studentActivities: Activity[];
    studentAnswers: StudentAnswer[];
    completedActivityId: string;
    score: { correct: number; total: number };
}

export const checkNewBadges = ({ student, studentActivities, studentAnswers, score }: CheckNewBadgesArgs): string[] => {
    const newBadges: string[] = [];
    const existingBadges = new Set(student.gamification.badges);

    const completedActivitiesCount = studentAnswers.filter(ans => {
        const activity = studentActivities.find(act => act.id === ans.activityId);
        return activity ? Object.keys(ans.answers).length === activity.content.length : false;
    }).length;

    // Badge 1: First Activity
    if (!existingBadges.has('first_activity') && completedActivitiesCount >= 1) {
        newBadges.push('first_activity');
    }

    // Badge 2: Perfect Score
    if (!existingBadges.has('perfect_score') && score.correct === score.total && score.total > 0) {
        newBadges.push('perfect_score');
    }

    // Badge 3: Three Completed
    if (!existingBadges.has('three_completed') && completedActivitiesCount >= 3) {
        newBadges.push('three_completed');
    }

    return newBadges;
};
