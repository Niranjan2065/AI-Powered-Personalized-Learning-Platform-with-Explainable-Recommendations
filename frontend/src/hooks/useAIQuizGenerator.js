// src/hooks/useAIQuizGenerator.js
// ─────────────────────────────────────────────────────────────
// Custom hook that manages the full AI quiz generation flow:
//   generate → review/edit → save → publish
// ─────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const axiosAuth = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const STEPS = {
  IDLE:       'idle',
  GENERATING: 'generating',
  REVIEWING:  'reviewing',
  SAVING:     'saving',
  DONE:       'done',
};

export function useAIQuizGenerator() {
  const [step,      setStep]      = useState(STEPS.IDLE);
  const [questions, setQuestions] = useState([]);
  const [meta,      setMeta]      = useState(null);
  const [preview,   setPreview]   = useState(null);   // full generate response
  const [savedQuiz, setSavedQuiz] = useState(null);
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(0);

  // ── Generate from lesson text ────────────────────────────────
  const generateFromLesson = useCallback(async ({ lessonId, numQuestions, difficulty, types, focusArea }) => {
    setError(null);
    setStep(STEPS.GENERATING);
    setProgress(20);

    try {
      setProgress(50);
      const { data } = await axiosAuth.post('/quizzes/generate', {
        lessonId, numQuestions, difficulty, types, focusArea,
      });
      setProgress(100);

      setPreview(data.data);
      setQuestions(data.data.questions);
      setMeta(data.data.meta);
      setStep(STEPS.REVIEWING);
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed. Please try again.');
      setStep(STEPS.IDLE);
    } finally {
      setProgress(0);
    }
  }, []);

  // ── Generate from PDF ────────────────────────────────────────
  const generateFromPdf = useCallback(async ({ file, lessonId, numQuestions, difficulty, types, focusArea }) => {
    setError(null);
    setStep(STEPS.GENERATING);

    const form = new FormData();
    form.append('pdf', file);
    if (lessonId)      form.append('lessonId',     lessonId);
    form.append('numQuestions', numQuestions);
    form.append('difficulty',   difficulty);
    form.append('types',        JSON.stringify(types));
    if (focusArea)     form.append('focusArea', focusArea);

    try {
      setProgress(40);
      const { data } = await axiosAuth.post('/quizzes/generate-from-pdf', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 40)),
      });
      setProgress(100);

      setPreview(data.data);
      setQuestions(data.data.questions);
      setMeta(data.data.meta);
      setStep(STEPS.REVIEWING);
    } catch (err) {
      setError(err.response?.data?.message || 'PDF generation failed. Please try again.');
      setStep(STEPS.IDLE);
    } finally {
      setProgress(0);
    }
  }, []);

  // ── Edit a question in the review state ──────────────────────
  const updateQuestion = useCallback((index, updated) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...updated } : q));
  }, []);

  const removeQuestion = useCallback(index => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addQuestion = useCallback(question => {
    setQuestions(prev => [...prev, question]);
  }, []);

  // ── Save after review ────────────────────────────────────────
  const saveQuiz = useCallback(async ({ title, timeLimit, passingScore, shuffleQuestions, shuffleOptions, maxAttempts }) => {
    if (!preview) return;
    setError(null);
    setStep(STEPS.SAVING);

    try {
      const { data } = await axiosAuth.post('/quizzes/save-generated', {
        lessonId:  preview.lessonId,
        courseId:  preview.courseId,
        title:     title || `Quiz: ${preview.lessonTitle}`,
        questions,
        timeLimit:        timeLimit        ?? 0,
        passingScore:     passingScore     ?? 70,
        shuffleQuestions: shuffleQuestions ?? false,
        shuffleOptions:   shuffleOptions   ?? true,
        maxAttempts:      maxAttempts      ?? 0,
        aiMeta: {
          sourceType: preview.sourceType || 'lesson_text',
          ...meta,
        },
      });

      setSavedQuiz(data.data);
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed. Please try again.');
      setStep(STEPS.REVIEWING);
    }
  }, [preview, questions, meta]);

  // ── Publish the saved quiz ───────────────────────────────────
  const publishQuiz = useCallback(async () => {
    if (!savedQuiz) return;
    const { data } = await axiosAuth.patch(`/quizzes/${savedQuiz._id}/publish`);
    setSavedQuiz(prev => ({ ...prev, isPublished: data.data.isPublished }));
  }, [savedQuiz]);

  const reset = useCallback(() => {
    setStep(STEPS.IDLE);
    setQuestions([]);
    setMeta(null);
    setPreview(null);
    setSavedQuiz(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    step, questions, meta, preview, savedQuiz, error, progress,
    generateFromLesson, generateFromPdf,
    updateQuestion, removeQuestion, addQuestion,
    saveQuiz, publishQuiz, reset,
  };
}