'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabasePublic } from '@/lib/supabase/admin';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  // Écoute de la session Supabase (Callback Google OAuth)
  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabasePublic.auth.getSession();
      if (session?.user) {
        await saveProfile(
          session.user.id,
          session.user.email!,
          session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
        );

        // Sauvegarde locale pour l'interface
        const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        localStorage.setItem('penda_user', JSON.stringify({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
          avatar: avatarUrl || null,
          isLoggedIn: true
        }));

        router.push('/');
      }
    };

    syncSession();
  }, [router]);

  const saveProfile = async (id: string, email: string, name: string) => {
    try {
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email, full_name: name })
      });
    } catch (e) {
      console.error("Erreur de synchronisation du profil:", e);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabasePublic.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`
      }
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (isSignUp) {
      const { data, error } = await supabasePublic.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        await saveProfile(data.user.id, email, fullName);
        alert('Compte créé ! Vous pouvez maintenant vous connecter.');
        setIsSignUp(false);
      }
    } else {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        const userName = data.user.user_metadata?.full_name || email.split('@')[0];
        await saveProfile(data.user.id, email, userName);

        localStorage.setItem('penda_user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          name: userName,
          avatar: null,
          isLoggedIn: true
        }));

        router.push('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-dvh w-full bg-[#0B0F17] text-white flex items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md bg-gray-900/90 sm:bg-gray-900/80 p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-5 sm:space-y-6 shadow-2xl backdrop-blur-md">
        
        {/* Logo & En-tête */}
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="flex justify-center">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-gray-700 shadow-lg shadow-[#7C3AED]/20">
              <Image 
                src="/logo.png" 
                alt="Penda AI Logo" 
                fill 
                sizes="(max-width: 640px) 48px, 56px" 
                className="object-cover" 
                priority 
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Penda <span className="text-[#06B6D4]">AI</span></h1>
            <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">Ton Coach Business & Assistant Marketing</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Bouton Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-200 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-3 transition shadow-sm active:scale-[0.99]"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span className="truncate">Continuer avec Google</span>
        </button>

        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-gray-800 w-full"></div>
          <span className="bg-[#0B0F17] sm:bg-gray-900 px-3 text-[10px] font-mono text-gray-500 absolute uppercase">ou avec email</span>
        </div>

        {/* Formulaire Classique */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">NOM COMPLET</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alain Kabongo"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:border-[#7C3AED] outline-none transition placeholder-gray-600"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:border-[#7C3AED] outline-none transition placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">MOT DE PASSE</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:border-[#7C3AED] outline-none transition placeholder-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] font-semibold py-3 rounded-xl text-sm hover:opacity-90 active:scale-[0.99] transition shadow-lg shadow-[#7C3AED]/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Traitement...' : isSignUp ? 'S\'inscrire' : 'Se connecter'}
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-gray-400 hover:text-[#06B6D4] transition py-1 px-2"
          >
            {isSignUp ? 'Déjà un compte ? Connectez-vous' : "Pas encore de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}