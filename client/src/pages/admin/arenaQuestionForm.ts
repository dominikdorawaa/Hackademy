import type { ArenaQuestionAdmin, ArenaQuestionCategory, ArenaQuestionDifficulty, ArenaQuestionRequest } from '../../types/api';
import type { FieldErrors } from '../../components/admin/ContentFields';
import { arenaDifficulties, arenaDifficultyLabels } from '../../components/arena/arenaDifficulty';

export const CONTENT_LIMIT = 500;
export const ANSWER_LIMIT = 200;
export const WRONG_ANSWERS = 3;

export const categoryLabels: Record<ArenaQuestionCategory, string> = {
  WEB: 'Web',
  SIECI: 'Sieci',
  KRYPTOGRAFIA: 'Kryptografia',
  LINUX: 'Linux',
  OGOLNE: 'Ogólne',
};

export { arenaDifficultyLabels };

export const categories = Object.keys(categoryLabels) as ArenaQuestionCategory[];
export const difficulties = arenaDifficulties;

export interface QuestionForm {
  content: string;
  correctAnswer: string;
  wrongAnswers: string[];
  category: ArenaQuestionCategory | '';
  difficulty: ArenaQuestionDifficulty | '';
}

export function formFor(question?: ArenaQuestionAdmin | null): QuestionForm {
  if (!question) return { content: '', correctAnswer: '', wrongAnswers: Array(WRONG_ANSWERS).fill(''), category: '', difficulty: '' };
  const { content, correctAnswer, wrongAnswers, category, difficulty } = question;
  return { content, correctAnswer, wrongAnswers: [...wrongAnswers], category, difficulty };
}

function answerProblem(answer: string, missing: string) {
  if (!answer.trim()) return missing;
  if (answer.length > ANSWER_LIMIT) return `Odpowiedź może mieć najwyżej ${ANSWER_LIMIT} znaków.`;
  return undefined;
}

/** Mirrors the server rules so the administrator sees every problem before saving. */
export function validateQuestion(form: QuestionForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.content.trim()) errors.content = 'Treść pytania jest wymagana.';
  else if (form.content.length > CONTENT_LIMIT) errors.content = `Treść pytania może mieć najwyżej ${CONTENT_LIMIT} znaków.`;
  const correct = answerProblem(form.correctAnswer, 'Poprawna odpowiedź jest wymagana.');
  if (correct) errors.correctAnswer = correct;
  form.wrongAnswers.forEach((answer, index) => {
    const problem = answerProblem(answer, 'Ta odpowiedź jest wymagana.');
    if (problem) errors[`wrong-${index}`] = problem;
  });
  const all = [form.correctAnswer, ...form.wrongAnswers];
  const filled = all.map((answer) => answer.trim().toLowerCase()).filter(Boolean);
  if (filled.length === all.length && new Set(filled).size !== filled.length) errors.answers = 'Odpowiedzi muszą się od siebie różnić.';
  if (!form.category) errors.category = 'Wybierz kategorię.';
  if (!form.difficulty) errors.difficulty = 'Wybierz trudność.';
  return errors;
}

export function requestFrom(form: QuestionForm, version?: number): ArenaQuestionRequest {
  return {
    content: form.content.trim(),
    correctAnswer: form.correctAnswer.trim(),
    wrongAnswers: form.wrongAnswers.map((answer) => answer.trim()),
    category: form.category as ArenaQuestionCategory,
    difficulty: form.difficulty as ArenaQuestionDifficulty,
    version,
  };
}
