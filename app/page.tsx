'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface User {
  id?: string;
  email?: string;
  name?: string;
  businessName?: string;
  city?: string;
  avatar?: string | null;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content?: string;
  type?: 'text' | 'campaign';
  data?: {
    strategy?: string;
    whatsapp_message?: string;
    image_url?: string;
    leads?: Array<{ name: string; phone: string; address: string }>;
  };
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function Dashboard() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('penda_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (parsedUser.id) {
          loadConversations(parsedUser.id);
        }
      } catch (e) {
        console.error("Erreur penda_user:", e);
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleScroll = () => {
    if (!mainScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainScrollRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 80;
    setShowScrollBottom(!isBottom && messages.length > 0);
  };

  const loadConversations = async (userId: string) => {
    try {
      const res = await fetch(`/api/chat/save?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error("Erreur chargement conversations:", e);
    }
  };

  const loadConversationMessages = async (convId: string) => {
    setActiveConvId(convId);
    setLoading(true);
    setMobileMenuOpen(false);
    try {
      const res = await fetch(`/api/chat/save?conversationId=${convId}`);
      const data = await res.json();
      if (data.success) {
        const formattedMsgs: Message[] = data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          type: m.metadata?.type || 'text',
          data: m.metadata?.data || null
        }));
        setMessages(formattedMsgs);
      }
    } catch (e) {
      console.error("Erreur chargement messages:", e);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setPrompt('');
    setMobileMenuOpen(false);
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filename}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt.trim();
    setPrompt('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userText, type: 'text' }];
    setMessages(newMessages);
    setLoading(true);

    if (user?.id) {
      fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          conversationId: activeConvId,
          title: userText.slice(0, 30) + '...',
          role: 'user',
          content: userText
        })
      }).then(res => res.json()).then(d => {
        if (d.conversationId && !activeConvId) {
          setActiveConvId(d.conversationId);
          loadConversations(user.id!);
        }
      });
    }

    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, city: user?.city || 'Lubumbashi' }),
      });
      const data = await res.json();

      if (data.success) {
        const assistantMsg: Message = data.type === 'text'
          ? { role: 'assistant', type: 'text', content: data.content }
          : { role: 'assistant', type: 'campaign', data: data.data };

        setMessages([...newMessages, assistantMsg]);

        if (user?.id) {
          fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              conversationId: activeConvId,
              role: 'assistant',
              content: data.type === 'text' ? data.content : 'Campagne marketing générée',
              metadata: data.type === 'campaign' ? { type: 'campaign', data: data.data } : { type: 'text' }
            })
          });
        }
      }
    } catch (err) {
      console.error("Erreur Orchestrateur:", err);
      setMessages([...newMessages, { role: 'assistant', content: 'Désolé, une erreur est survenue lors du traitement. Réessayez.', type: 'text' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-screen bg-[#0B0F17] text-white overflow-hidden relative font-sans">
      
      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar - Fixée à gauche */}
      <aside className={`
        fixed md:static top-0 left-0 bottom-0 z-50 w-72 bg-[#070A10] border-r border-gray-800/80 p-4 
        flex flex-col justify-between flex-shrink-0 transition-transform duration-300 ease-in-out h-full
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-gray-700/80 shadow-md">
                <Image src="/logo.png" alt="Logo" fill sizes="36px" className="object-cover" priority />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-wide">Penda <span className="text-[#06B6D4]">AI</span></h1>
                <p className="text-[10px] text-gray-400 font-mono">COACH BUSINESS RDC</p>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-white p-1 text-lg"
            >
              ✕
            </button>
          </div>

          <button
            onClick={startNewChat}
            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED]/20 to-[#06B6D4]/20 text-white flex items-center gap-2 border border-[#7C3AED]/40 hover:border-[#7C3AED] transition text-xs md:text-sm font-semibold shadow-sm"
          >
            <span className="text-base font-normal">+</span> Nouvelle discussion
          </button>

          {/* Liste des conversations */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <p className="text-[10px] font-mono text-gray-500 px-2 uppercase tracking-wider mb-2">Historique</p>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversationMessages(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition flex items-center gap-2.5 ${
                  activeConvId === conv.id 
                    ? 'bg-gray-800/90 text-white border border-gray-700/60 font-medium' 
                    : 'text-gray-400 hover:bg-gray-900/80 hover:text-gray-200'
                }`}
              >
                <span className="text-xs">💬</span>
                <span className="truncate">{conv.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Profil Utilisateur */}
        {mounted && user ? (
          <div className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 flex items-center gap-3 mt-4 flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-[#7C3AED] object-cover" suppressHydrationWarning />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#06B6D4] flex items-center justify-center font-bold text-xs text-white border border-gray-700 flex-shrink-0">
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'AI'}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="font-bold text-xs truncate text-gray-200">{user.name || 'Utilisateur'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.city || 'Lubumbashi'}</p>
            </div>
          </div>
        ) : (
          <Link href="/login" className="p-2.5 bg-[#7C3AED]/20 border border-[#7C3AED]/50 rounded-xl text-center text-xs font-bold text-[#06B6D4] block hover:bg-[#7C3AED]/30 transition mt-4 flex-shrink-0">
            🔑 Se connecter
          </Link>
        )}
      </aside>

      {/* Conteneur de Chat principal */}
      <div className="flex-1 flex flex-col h-[100dvh] min-h-0 w-full bg-[#0B0F17] relative min-w-0">
        
        {/* Header Mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800/80 bg-[#070A10]/95 backdrop-blur z-20 flex-shrink-0">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-gray-900 rounded-xl border border-gray-800 text-gray-300 hover:text-white"
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-gray-700">
              <Image src="/logo.png" alt="Logo" fill sizes="24px" className="object-cover" priority />
            </div>
            <span className="font-bold text-sm">Penda AI</span>
          </div>
          <button 
            onClick={startNewChat}
            className="p-2 bg-[#7C3AED]/20 text-[#06B6D4] rounded-xl border border-[#7C3AED]/40 text-xs font-bold"
          >
            + Nouveau
          </button>
        </header>

        {/* Zone des Messages - Prend exactement la hauteur restante */}
        <main 
          ref={mainScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 md:px-8 py-4 md:py-6 space-y-6 w-full custom-scrollbar min-h-0"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="min-h-[50vh] md:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 py-8 px-2">
                <div className="w-14 h-14 md:w-16 md:h-16 relative rounded-2xl overflow-hidden border border-gray-800 shadow-2xl mb-2">
                  <Image src="/logo.png" alt="Penda" fill sizes="(max-width: 768px) 56px, 64px" className="object-cover" priority />
                </div>
                <h2 className="text-xl md:text-3xl font-extrabold tracking-tight">
                  {mounted && user?.name ? `Salut ${user.name} 👋` : 'Bienvenue sur Penda AI'}
                </h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-md leading-relaxed">
                  Dis-moi ce que tu veux vendre ou promouvoir aujourd'hui. Je vais élaborer ta stratégie, concevoir ton visuel et trouver tes futurs clients.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl overflow-hidden relative border border-gray-700 flex-shrink-0 mt-1">
                      <Image src="/logo.png" alt="Penda" fill sizes="(max-width: 768px) 28px, 32px" className="object-cover" />
                    </div>
                  )}

                  <div className={`max-w-[92%] md:max-w-2xl space-y-4 ${
                    msg.role === 'user' 
                      ? 'bg-[#7C3AED] text-white p-3 md:p-4 rounded-2xl rounded-tr-none text-xs md:text-sm shadow-md' 
                      : 'w-full'
                  }`}>
                    {msg.type === 'text' && (
                      <div className={msg.role === 'assistant' ? 'bg-gray-900/80 p-3.5 md:p-4 rounded-2xl border border-gray-800/90 text-xs md:text-sm text-gray-200 whitespace-pre-line leading-relaxed shadow-sm' : ''}>
                        {msg.content}
                      </div>
                    )}

                    {msg.type === 'campaign' && msg.data && (
                      <div className="space-y-4 md:space-y-5 bg-gray-900/70 p-3.5 md:p-6 rounded-2xl border border-gray-800/90 shadow-lg">
                        
                        {/* Étape 1 : Stratégie */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#06B6D4]/20 text-[#06B6D4] text-[10px] md:text-xs font-bold">1</span>
                            <span className="text-[10px] md:text-xs font-mono text-[#06B6D4] font-bold uppercase tracking-wider">Conseil & Stratégie Marketing</span>
                          </div>
                          <div className="bg-gray-950 p-3 md:p-4 rounded-xl border border-gray-800/80 text-xs md:text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                            {msg.data.strategy}
                          </div>
                        </div>

                        {/* Étape 2 : Visuel */}
                        {msg.data.image_url && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#7C3AED]/20 text-[#7C3AED] text-[10px] md:text-xs font-bold">2</span>
                                <span className="text-[10px] md:text-xs font-mono text-[#7C3AED] font-bold uppercase tracking-wider">Visuel Publicitaire HD</span>
                              </div>
                              <button
                                onClick={() => handleDownloadImage(msg.data!.image_url!, 'visuel-penda-ai')}
                                className="text-[11px] text-[#06B6D4] hover:underline flex items-center gap-1 font-medium"
                              >
                                📥 Télécharger
                              </button>
                            </div>
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
                              <img src={msg.data.image_url} alt="Visuel publicitaire" className="w-full h-full object-cover" suppressHydrationWarning />
                            </div>
                          </div>
                        )}

                        {/* Étape 3 : WhatsApp & Leads */}
                        {msg.data.whatsapp_message && (
                          <div className="space-y-3 pt-2 border-t border-gray-800/80">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] md:text-xs font-bold">3</span>
                              <span className="text-[10px] md:text-xs font-mono text-[#10B981] font-bold uppercase tracking-wider">Prospection & WhatsApp</span>
                            </div>

                            <div className="bg-gray-950 p-3 md:p-3.5 rounded-xl border border-gray-800/80 text-xs text-gray-300">
                              <span className="text-[9px] md:text-[10px] text-gray-500 font-mono block mb-1">MESSAGE CONSEILLÉ</span>
                              {msg.data.whatsapp_message}
                            </div>

                            {msg.data.leads && msg.data.leads.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                {msg.data.leads.map((lead, idx) => (
                                  <div key={idx} className="bg-gray-950 p-2.5 md:p-3 rounded-xl border border-gray-800/80 flex justify-between items-center gap-2">
                                    <div className="overflow-hidden">
                                      <p className="font-semibold text-xs text-gray-200 truncate">{lead.name}</p>
                                      <p className="text-[10px] text-gray-500 truncate">{lead.address}</p>
                                    </div>
                                    <a
                                      href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg.data!.whatsapp_message || '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 font-bold text-[10px] md:text-[11px] px-2.5 py-1.5 rounded-lg transition whitespace-nowrap"
                                    >
                                      Envoyer
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-3 text-gray-400 text-xs font-mono">
                <div className="w-5 h-5 relative rounded-lg overflow-hidden border border-gray-800 animate-pulse">
                  <Image src="/logo.png" alt="Penda" fill sizes="20px" className="object-cover" />
                </div>
                <span>Penda AI réfléchit à la meilleure réponse...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Bouton Scroll de retour en bas */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-16 md:bottom-20 right-4 md:right-6 z-30 w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700/80 text-gray-300 hover:text-white flex items-center justify-center shadow-lg transition duration-200 backdrop-blur-md opacity-90 hover:opacity-100 text-xs"
            aria-label="Défiler vers le bas"
          >
            ↓
          </button>
        )}

        {/* Barre de Saisie Fixée Réellement en Bas sans Débordement */}
        <footer className="p-2.5 md:p-4 border-t border-gray-800/80 bg-[#070A10]/95 backdrop-blur-md w-full flex-shrink-0">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center bg-gray-900/90 rounded-2xl border border-gray-800 p-1 md:p-2 focus-within:border-[#7C3AED] transition shadow-inner">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Vente de robes de soirée..."
              className="flex-1 bg-transparent px-3 md:px-4 py-2 outline-none text-white text-base md:text-sm placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90 text-white px-3.5 md:px-5 py-2 rounded-xl font-medium text-xs md:text-sm transition disabled:opacity-40 flex-shrink-0"
            >
              Envoyer
            </button>
          </form>
        </footer>

      </div>
    </div>
  );
}