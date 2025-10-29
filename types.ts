// Fix: Import React to use React.FC type.
import React from 'react';

export enum UserRole {
  TUTOR = 'TUTOR',
  STUDENT = 'STUDENT',
  NONE = 'NONE'
}

export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
  nivelamentoCompleted: boolean;
  nivelamentoResults: { [subject: string]: number } | null; // e.g., { "Matemática": 80, "Português": 95 }
  gamification: {
    points: number;
    badges: string[]; // Array of badge IDs
    rewardedActivities?: string[]; // Array of activity IDs for which points have been awarded
  }
}

export interface Question {
  id: string;
  question: string;
  subject: string;
  type: 'multiple-choice' | 'open-ended';
  options?: string[];
  correctAnswer?: string;
}

export interface Activity {
  id: string;
  title: string;
  subject: string;
  type: 'manual' | 'pdf' | 'generated';
  content: Question[];
  studentId: string;
}

export interface StudentAnswer {
  activityId: string;
  answers: { [questionIndex: number]: string };
}

export interface StudyGoal {
  id: string;
  studentId: string;
  description: string;
  completed: boolean;
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: React.FC<{ className?: string }>;
}

export interface HubInfo {
  subject: string;
  level: string;
  summary: string;
  suggestions: string;
}

export interface TutorInsights {
    lessonSuggestions: string[];
    hubData: HubInfo[];
}