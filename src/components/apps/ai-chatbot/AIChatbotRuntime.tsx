'use client';

import { useState } from 'react';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

const DUMMY_RESPONSES = [
  'Entendido. ¿Te gustaría agendar una demo con nuestro equipo?',
  'Puedo ayudarte con eso. ¿Sobre qué producto necesitas más información?',
  'Gracias por tu pregunta. Te conectaré con un especialista en breve.',
  'Claro, aquí tienes un resumen de nuestras opciones de precios.',
  'Déjame buscar esa información para ti.',
];

export default function AIChatbotRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const botName = String(config.botName || 'Asistente AI');
  const welcomeMessage = String(
    config.welcomeMessage || 'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte hoy?'
  );
  const suggestedQuestions = Array.isArray(config.suggestedQuestions)
    ? (config.suggestedQuestions as string[])
    : ['¿Qué servicios ofrecen?', '¿Cómo puedo agendar una reunión?', '¿Cuáles son los precios?'];
  const primaryColor = String(config.primaryColor || '#8B5CF6');

  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'bot', text: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = DUMMY_RESPONSES[Math.floor(Math.random() * DUMMY_RESPONSES.length)];
      const botMsg: Message = { id: `b-${Date.now()}`, role: 'bot', text: response };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 900);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">{botName}</h2>
          <p className="text-xs text-gray-400">{companyName} • Asistente virtual</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            En línea
          </div>
          <AppBackButton />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-auto p-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                msg.role === 'bot' ? 'text-white' : 'bg-gray-700 text-white'
              }`}
              style={msg.role === 'bot' ? { backgroundColor: primaryColor } : {}}
            >
              {msg.role === 'bot' ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'bot'
                  ? 'rounded-tl-none border border-gray-800 bg-gray-900 text-gray-100'
                  : 'rounded-tr-none bg-gray-700 text-white'
              }`}
              style={msg.role === 'bot' ? { borderLeft: `3px solid ${primaryColor}` } : {}}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-none border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:0.1s]">.</span>
                <span className="animate-bounce [animation-delay:0.2s]">.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && (
        <div className="border-t border-gray-800 bg-gray-900/40 px-6 py-3">
          <p className="mb-2 text-xs text-gray-500">Preguntas sugeridas</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-gray-800 bg-gray-900/60 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 border-none bg-transparent text-sm text-white outline-none placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: primaryColor }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
