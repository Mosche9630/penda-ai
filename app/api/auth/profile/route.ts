import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { id, email, full_name } = await req.json();

    if (!id || !email) {
      return NextResponse.json({ error: 'ID et email requis' }, { status: 400 });
    }

    // Upsert du profil utilisateur
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id,
          email,
          full_name,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Erreur Supabase Profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}