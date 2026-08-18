import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// 1. Sauvegarder un message ou créer une nouvelle conversation
export async function POST(req: Request) {
  try {
    const { userId, conversationId, title, role, content, metadata } = await req.json();

    if (!userId || !role || !content) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    let activeConvId = conversationId;

    // Si aucune conversation n'est active, en créer une nouvelle
    if (!activeConvId) {
      const { data: convData, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          user_id: userId,
          title: title || content.slice(0, 30) + '...'
        })
        .select()
        .single();

      if (convError) throw convError;
      activeConvId = convData.id;
    }

    // Insérer le message dans la conversation
    const { data: messageData, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: activeConvId,
        role,
        content,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return NextResponse.json({
      success: true,
      conversationId: activeConvId,
      message: messageData
    });

  } catch (error: any) {
    console.error("Erreur Sauvegarde Chat (Supabase):", error.message || error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// 2. Charger les conversations ou les messages d'un utilisateur
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    // Charger l'historique des conversations
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, conversations: data });
    }

    // Charger les messages d'une conversation spécifique
    if (conversationId) {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, messages: data });
    }

    return NextResponse.json({ error: 'userId ou conversationId requis' }, { status: 400 });

  } catch (error: any) {
    console.error("Erreur Chargement Chat (Supabase):", error.message || error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}