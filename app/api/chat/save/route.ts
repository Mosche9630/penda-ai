import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { userId, conversationId, title, role, content, metadata } = await req.json();

    let currentConvId = conversationId;

    // Créer une nouvelle conversation si non existante
    if (!currentConvId && userId) {
      const { data: conv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({ user_id: userId, title: title || 'Nouvelle discussion' })
        .select()
        .single();

      if (convError) throw convError;
      currentConvId = conv.id;
    }

    // Sauvegarder le message
    if (currentConvId) {
      const { error: msgError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: currentConvId,
          role,
          content,
          metadata: metadata || {}
        });

      if (msgError) throw msgError;
    }

    return NextResponse.json({ success: true, conversationId: currentConvId });
  } catch (error: any) {
    console.error('Erreur sauvegarde chat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const conversationId = searchParams.get('conversationId');

  try {
    if (conversationId) {
      // Récupérer les messages d'une conversation
      const { data: messages, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, messages });
    }

    if (userId) {
      // Récupérer la liste des conversations
      const { data: conversations, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, conversations });
    }

    return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}