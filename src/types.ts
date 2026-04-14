export type Language = 'en' | 'de';

export type QuestionType = 'choice' | 'input' | 'number' | 'summary' | 'info';

export interface Option {
  label: Record<Language, string>;
  value: string;
  recommendation?: Record<Language, string>;
}

export interface QuestionNode {
  id: string;
  field?: string;
  question: Record<Language, string>;
  type: QuestionType;
  options?: Option[];
  placeholder?: Record<Language, string>;
  unit?: string;
  next?: string | ((value: any, state: Record<string, any>) => string | null);
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  type?: 'text' | 'options' | 'summary';
  options?: Option[];
  questionId?: string;
}

export interface OfferState {
  service_type?: string;
  language: Language;
  [key: string]: any;
}
