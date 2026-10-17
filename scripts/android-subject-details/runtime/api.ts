import {catalog, subject} from './fixtures';
const delayed = <T,>(data: T, ms: number) => new Promise<T>(resolve => setTimeout(() => resolve(data), ms));
export const getSubject = async () => delayed({...subject, data: {...subject.data}}, 600);
export const getSubjects = async (_token: string, filter: any = {}) => delayed({data: catalog.filter(s => !filter.ids || filter.ids.includes(s.id))}, 500);
export const getAssignmentsForSubjectsCached = async () => delayed({data: [{id: 1001, data: {subject_id: 2652, srs_stage: 5, spaced_repetition_system_id: 1, available_at: '2026-10-13T12:00:00Z'}}]}, 1200);
export const getReviewStatistics = async () => delayed({data: [{data: {subject_id: 2652, meaning_correct: 12, meaning_incorrect: 2, reading_correct: 10, reading_incorrect: 4, meaning_current_streak: 5, reading_current_streak: 3, percentage_correct: 78}}]}, 1600);
export const getStudyMaterials = async () => delayed({data: [{id: 1002, data: {subject_id: 2652, meaning_synonyms: ['Recently'], meaning_note: 'Remember what happened the other day.', reading_note: 'せん + じつ'}}]}, 900);
export const getSpacedRepetitionSystems = async () => delayed({data: [{data: {stages: ['Initiate','Apprentice 1','Apprentice 2','Apprentice 3','Apprentice 4','Guru 1','Guru 2','Master','Enlightened','Burned'].map(name => ({name}))}}]}, 350);
export const createStudyMaterial = async () => ({});
export const updateStudyMaterial = async () => ({});
export const isAssignmentInReviewQueueState = (a: any) => a.data?.srs_stage > 0;
export class ApiError extends Error {}
export const isRateLimitError = () => false;
export const isUnauthorizedError = () => false;
