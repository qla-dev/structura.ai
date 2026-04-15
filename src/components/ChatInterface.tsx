import { ArrowLeft, Bot, CheckCircle2, Download, Globe, RefreshCw, Send, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { QUESTION_FLOWS } from '../constants';
import { generateOfferPDF } from '../lib/pdfGenerator';
import { cn } from '../lib/utils';
import { ChatMessage, Language, OfferState, Option, QuestionNode } from '../types';
import { Typewriter } from './Typewriter';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const createInitialAssistantMessage = (lang: Language): ChatMessage => {
  const initialQuestion = QUESTION_FLOWS.initial[0];
  return {
    id: '1',
    role: 'assistant',
    content: initialQuestion.question[lang],
    timestamp: Date.now(),
    type: 'options',
    options: initialQuestion.options,
    questionId: initialQuestion.id
  };
};

export default function ChatInterface() {
  const [language, setLanguage] = useState<Language>('en');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createInitialAssistantMessage('en')]);
  const [offerState, setOfferState] = useState<OfferState>({ language: 'en' });
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('service_selection');
  const [history, setHistory] = useState<{ questionId: string; state: OfferState }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [languageSwitchTo, setLanguageSwitchTo] = useState<Language | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = (en: string, de: string) => (language === 'en' ? en : de);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const scrollToBottomAuto = useCallback(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  const startNewSession = useCallback((newLang: Language) => {
    setLanguage(newLang);
    setOfferState({ language: newLang });
    setHistory([]);
    setCurrentQuestionId('service_selection');
    setInputValue('');
    setIsTyping(false);
    setPendingMessages([]);
    setMessages([createInitialAssistantMessage(newLang)]);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isTyping, scrollToBottom]);

  const getCurrentQuestion = () => {
    const allQuestions = Object.values(QUESTION_FLOWS).flat();
    return allQuestions.find(q => q.id === currentQuestionId);
  };

  const handleOptionSelect = (option: Option) => {
    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: option.label[language],
      timestamp: Date.now()
    };

    const newOfferState = { ...offerState, [currentQuestion.field!]: option.value };
    setHistory(prev => [...prev, { questionId: currentQuestionId, state: offerState }]);
    setOfferState(newOfferState);
    setMessages(prev => [...prev, userMsg]);

    // Handle recommendation if any
    if (option.recommendation) {
      const recMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: option.recommendation[language],
        timestamp: Date.now() + 1
      };
      setMessages(prev => [...prev, recMsg]);
    }

    // Determine next question
    let nextId: string | null = null;
    if (typeof currentQuestion.next === 'function') {
      nextId = currentQuestion.next(option.value, newOfferState);
    } else {
      nextId = currentQuestion.next || null;
    }

    if (nextId) {
      askNextQuestion(nextId, newOfferState);
    }
  };

  const handleTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputValue.trim();
    if (!input) return;

    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // 1. Try to match to a structured option first
    if (currentQuestion.type === 'choice' && currentQuestion.options) {
      const matchedOption = currentQuestion.options.find(opt => 
        opt.label.en.toLowerCase() === input.toLowerCase() || 
        opt.label.de.toLowerCase() === input.toLowerCase() ||
        opt.value.toLowerCase() === input.toLowerCase()
      );

      if (matchedOption) {
        handleOptionSelect(matchedOption);
        return;
      }
    }

    // 2. If it's a number/input question and looks valid, process it
    const isNumeric = !isNaN(Number(input)) && input !== '';
    if ((currentQuestion.type === 'number' && isNumeric) || currentQuestion.type === 'input') {
      processStructuredInput(input, currentQuestion);
      return;
    }

    // 3. Otherwise, treat as a generic question for Gemini
    await handleGeminiQuery(input);
  };

  const processStructuredInput = (value: string, question: QuestionNode) => {
    const newOfferState = { ...offerState, [question.field!]: value };
    setHistory(prev => [...prev, { questionId: currentQuestionId, state: offerState }]);
    setOfferState(newOfferState);

    let nextId: string | null = null;
    if (typeof question.next === 'function') {
      nextId = question.next(value, newOfferState);
    } else {
      nextId = question.next || null;
    }

    if (nextId) {
      askNextQuestion(nextId, newOfferState);
    }
  };

  const handleGeminiQuery = async (query: string) => {
    setIsTyping(true);
    try {
      const currentQuestion = getCurrentQuestion();
      const systemPrompt = `
        You are Structura AI, a professional construction assistant. 
        The user is currently in a guided flow to generate a construction offer.
        Current Language: ${language === 'en' ? 'English' : 'German'}.
        Current Service: ${offerState.service_type || 'None selected yet'}.
        Current Question being asked: "${currentQuestion?.question[language]}".
        
        Your goals:
        1. Answer the user's generic question about construction, materials, or the process.
        2. Keep the answer professional, helpful, and concise.
        3. If the user's input indicates they want to CHANGE a previous answer or go BACK (e.g., "I want to change the thickness", "Go back", "I made a mistake in the last step"), acknowledge this and tell them they can use the "Back" button or that you will help them restart that section.
        4. If the user's input actually contains the answer to the current question (e.g. they typed "I want 10cm" when asked for thickness), acknowledge it and tell them to select the option or type it clearly.
        
        Answer in ${language === 'en' ? 'English' : 'German'}.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: query,
        config: {
          systemInstruction: systemPrompt
        }
      });

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.text || (language === 'en' ? "I'm sorry, I couldn't process that." : "Entschuldigung, das konnte ich nicht verarbeiten."),
        timestamp: Date.now(),
      };

      // If there's a flow question to repeat, queue it
      if (currentQuestion && currentQuestionId !== 'summary') {
        const repeatMsg: ChatMessage = {
          id: (Date.now() + 100).toString(),
          role: 'assistant',
          content: currentQuestion.question[language],
          timestamp: Date.now() + 100,
          type: currentQuestion.type === 'choice' ? 'options' : 'text',
          options: currentQuestion.options,
          questionId: currentQuestion.id
        };
        setPendingMessages([repeatMsg]);
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Gemini Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleTypewriterComplete = (msgId: string) => {
    // Only process if this was the last message in the list
    if (messages.length > 0 && messages[messages.length - 1].id === msgId) {
      if (pendingMessages.length > 0) {
        const nextMsg = pendingMessages[0];
        setMessages(prev => [...prev, nextMsg]);
        setPendingMessages(prev => prev.slice(1));
      }
    }
  };

  const askNextQuestion = (nextId: string, state: OfferState) => {
    console.log('Asking next question:', { nextId, serviceType: state.service_type });
    
    if (nextId === 'summary') {
      showSummary(state);
      return;
    }

    const flow = QUESTION_FLOWS[state.service_type as string] || QUESTION_FLOWS.initial;
    const nextQuestion = flow.find(q => q.id === nextId);

    if (nextQuestion) {
      setCurrentQuestionId(nextId);
      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: nextQuestion.question[language],
          timestamp: Date.now(),
          type: nextQuestion.type === 'choice' ? 'options' : 'text',
          options: nextQuestion.options,
          questionId: nextQuestion.id
        };
        setMessages(prev => [...prev, assistantMsg]);
      }, 600);
    } else {
      console.error('Question not found:', { nextId, flowId: state.service_type });
    }
  };

  const showSummary = (state: OfferState) => {
    setCurrentQuestionId('summary');
    setTimeout(() => {
      const summaryMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: t(
          "I've collected all the necessary information. Here is a summary of your request. You can now generate your professional PDF offer.",
          "Ich habe alle notwendigen Informationen gesammelt. Hier ist eine Zusammenfassung Ihrer Anfrage. Sie können nun Ihr professionelles PDF-Angebot erstellen."
        ),
        timestamp: Date.now(),
        type: 'summary'
      };
      setMessages(prev => [...prev, summaryMsg]);
    }, 600);
  };

  const resetChat = () => {
    startNewSession(language);
  };

  const handleBack = () => {
    if (history.length === 0) return;

    const last = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setHistory(newHistory);
    setOfferState(last.state);
    setCurrentQuestionId(last.questionId);

    const question = Object.values(QUESTION_FLOWS).flat().find(q => q.id === last.questionId);
    if (question) {
      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: t(`Returning to previous step: ${question.question.en}`, `Zurück zum vorherigen Schritt: ${question.question.de}`),
        timestamp: Date.now(),
        type: question.type === 'choice' ? 'options' : 'text',
        options: question.options,
        questionId: question.id
      };
      setMessages(prev => [...prev, assistantMsg]);
    }
  };

  const currentQuestion = getCurrentQuestion();

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F5F5F5] font-sans text-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Bot className="text-white w-5 h-5" />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Structura AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const newLang = language === 'en' ? 'de' : 'en';
              setLanguageSwitchTo(newLang);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors px-3 py-1.5 rounded-full border border-gray-200"
          >
            <Globe className="w-4 h-4" />
            {language.toUpperCase()}
          </button>
          <button
            onClick={handleBack}
            disabled={history.length === 0}
            className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-all disabled:opacity-20"
            title={t('Go Back', 'Zurück')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={resetChat}
            className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-all"
            title={t('Reset Chat', 'Chat zurücksetzen')}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-gray-200" : "bg-black"
                )}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-gray-600" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className="space-y-2">
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-black text-white rounded-tr-none" 
                      : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                  )}>
                    {msg.role === 'assistant' && msg.id !== '1' ? (
                      <Typewriter 
                        text={msg.content} 
                        onComplete={() => handleTypewriterComplete(msg.id)}
                        onUpdate={messages[messages.length - 1]?.id === msg.id ? scrollToBottomAuto : undefined}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>

                  {msg.type === 'options' && msg.options && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionSelect(opt)}
                          disabled={messages[messages.length - 1].id !== msg.id}
                          className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                            "hover:bg-black hover:text-white hover:border-black",
                            "bg-white text-gray-700 border-gray-200",
                            messages[messages.length - 1].id !== msg.id && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {opt.label[language]}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.type === 'summary' && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-md">
                      <div className="flex items-center gap-2 text-green-600 font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        {t('Ready to Generate Offer', 'Bereit zur Angebotserstellung')}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(offerState).map(([key, value]) => {
                          if (key === 'language') return null;
                          return (
                            <div key={key} className="space-y-1">
                              <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">{key.replace('_', ' ')}</span>
                              <p className="font-medium text-gray-900 capitalize">{String(value)}</p>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => generateOfferPDF(offerState)}
                        className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]"
                      >
                        <Download className="w-5 h-5" />
                        {t('Download PDF Offer', 'PDF-Angebot herunterladen')}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 mr-auto"
              >
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-100 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center">
                  <span className="text-sm font-medium text-gray-400 animate-pulse">
                    {t('Thinking', 'Denkt nach')}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 md:p-6 shrink-0 sticky bottom-0 z-20">
        <div className="max-w-3xl mx-auto">
          {currentQuestionId !== 'summary' ? (
            <form onSubmit={handleTextInput} className="relative flex items-center gap-2">
              <input
                type={currentQuestion?.type === 'number' ? 'number' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={currentQuestion?.placeholder?.[language] || t('Type your answer...', 'Geben Sie Ihre Antwort ein...')}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base md:text-[15px] focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all pr-14"
                autoFocus
              />
              {currentQuestion?.unit && (
                <span className="absolute right-16 text-gray-400 font-medium text-sm">
                  {currentQuestion.unit}
                </span>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="absolute right-2 p-2.5 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <div className="h-14 flex items-center justify-center text-gray-400 text-sm italic">
              {t('Offer completed. Download above.', 'Angebot abgeschlossen. Oben herunterladen.')}
            </div>
          )}
          <p className="text-center text-[9px] text-gray-400 mt-3 uppercase tracking-widest font-medium">
            Powered by Structura AI • Professional Construction Estimates
          </p>
        </div>
      </footer>

      {languageSwitchTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('Restart required', 'Neustart erforderlich')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {t(
                'Changing the language starts a fresh chat session and clears your current progress. Continue?',
                'Das Wechseln der Sprache startet eine neue Chat-Sitzung und löscht Ihren aktuellen Fortschritt. Fortfahren?'
              )}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setLanguageSwitchTo(null)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-all"
              >
                Abort
              </button>
              <button
                onClick={() => {
                  startNewSession(languageSwitchTo);
                  setLanguageSwitchTo(null);
                }}
                className="px-4 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-all"
              >
                Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
