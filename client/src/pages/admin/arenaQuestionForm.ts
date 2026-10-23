import type { ArenaQuestionAdmin, ArenaQuestionCategory, ArenaQuestionDifficulty, ArenaQuestionRequest } from '../../types/api';
import type { FieldErrors } from '../../components/admin/ContentFields';
import { difficultyLabels } from '../../components/admin/adminFormat';

export const CONTENT_LIMIT = 500;
export const ANSWER_LIMIT = 200;
export const answerLetters = ['A', 'B', 'C', 'D'] as const;

export const categoryLabels: Record<ArenaQuestionCategory, string> = {
  WEB: 'Web',
  SIECI: 'Sieci',
  KRYPTOGRAFIA: 'Kryptografia',
  LINUX: 'Linux',
  OGOLNE: 'Ogólne',
};

export const arenaDifficultyLabels: Record<ArenaQuestionDifficulty, string> = {
  EASY: difficultyLabels.EASY,
  MEDIUM: difficultyLabels.MEDIUM,
  HARD: difficultyLabels.HARD,
};

export const categories = Object.keys(categoryLabels) as ArenaQuestionCategory[];
export const difficulties = Object.keys(arenaDifficultyLabels) as ArenaQuestionDifficulty[];

export interface QuestionForm {
  content: string;
  answers: string[];
  correctAnswer: number | null;
  category: ArenaQuestionCategory | '';
  difficulty: ArenaQuestionDifficulty | '';
}

export function formFor(question?: ArenaQuestionAdmin | null): QuestionForm {
  if (!question) return { content: '', answers: ['', '', '', ''], correctAnswer: null, category: '', difficulty: '' };
  const { content, answers, correctAnswer, category, difficulty } = question;
  return { content, answers: [...answers], correctAnswer, category, difficulty };
}

/** Mirrors the server rules so the administrator sees every problem before saving. */
export function validateQuestion(form: QuestionForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.content.trim()) errors.content = 'Treść pytania jest wymagana.';
  else if (form.content.length > CONTENT_LIMIT) errors.content = `Treść pytania może mieć najwyżej ${CONTENT_LIMIT} znaków.`;
  form.answers.forEach((answer, index) => {
    if (!answer.trim()) errors[`answer-${index}`] = 'Ta odpowiedź jest wymagana.';
    else if (answer.length > ANSWER_LIMIT) errors[`answer-${index}`] = `Odpowiedź może mieć najwyżej ${ANSWER_LIMIT} znaków.`;
  });
  const filled = form.answers.map((answer) => answer.trim().toLowerCase()).filter(Boolean);
  if (filled.length === form.answers.length && new Set(filled).size !== filled.length) errors.answers = 'Odpowiedzi muszą się od siebie różnić.';
  if (form.correctAnswer === null) errors.correctAnswer = 'Wskaż poprawną odpowiedź.';
  if (!form.category) errors.category = 'Wybierz kategorię.';
  if (!form.difficulty) errors.difficulty = 'Wybierz trudność.';
  return errors;
}

export function requestFrom(form: QuestionForm, version?: number): ArenaQuestionRequest {
  return {
    content: form.content.trim(),
    answers: form.answers.map((answer) => answer.trim()),
    correctAnswer: form.correctAnswer ?? -1,
    category: form.category as ArenaQuestionCategory,
    difficulty: form.difficulty as ArenaQuestionDifficulty,
    version,
  };
}
