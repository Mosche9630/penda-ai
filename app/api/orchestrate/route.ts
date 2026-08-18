import { NextResponse } from 'next/server';

async function generateMarketingContent(prompt: string, userCity: string = "Lubumbashi") {
  // Détection rapide des salutations simples
  const isGreetingOnly = /^(bonjour|salut|hello|coucou|bonsoir|hi|hey)[\s!.]*$/i.test(prompt.trim());

  if (isGreetingOnly) {
    return JSON.stringify({
      is_greeting: true,
      strategy: "Bonjour ! 😊 Comment puis-je t'aider aujourd'hui dans ton business ?",
      whatsapp_message: "",
      image_prompt: "",
      search_query: ""
    });
  }

  const systemPrompt = `Tu es Penda AI, un coach business en RDC.
L'utilisateur dit : "${prompt}".

S'il s'agit d'une simple salutation sans projet business, réponds de façon amicale et demande comment tu peux l'aider.

S'il s'agit d'un produit, service ou question business :
1. Donne des conseils stratégiques adaptés à ${userCity}.
2. Rédige un message WhatsApp d'accroche.
3. Rédige un prompt d'image en anglais.
4. Fournis un mot-clé de recherche pour Google Maps à ${userCity}.

Réponds EXCLUSIVEMENT sous forme de JSON valide :
{
  "is_greeting": false,
  "strategy": "Tes conseils ou ta réponse amicale",
  "whatsapp_message": "Message WhatsApp (vide si salutation)",
  "image_prompt": "Prompt image (vide si salutation)",
  "search_query": "Mot-clé (vide si salutation)"
}`;

  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: systemPrompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (groqRes.status === 429) throw new Error('QUOTA_EXCEEDED');
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        return groqData.choices?.[0]?.message?.content;
      }
    } catch (e: any) {
      if (e.message === 'QUOTA_EXCEEDED') throw e;
    }
  }

  // Fallback direct si hors-ligne ou erreur
  return JSON.stringify({
    is_greeting: false,
    strategy: `Bonjour ! Comment puis-je t'aider avec ton activité à ${userCity} aujourd'hui ?`,
    whatsapp_message: "",
    image_prompt: "",
    search_query: ""
  });
}

export async function POST(req: Request) {
  try {
    const { prompt, city } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requis' }, { status: 400 });
    }

    let rawAiOutput = '';

    try {
      rawAiOutput = await generateMarketingContent(prompt, city || "Lubumbashi");
    } catch (err: any) {
      if (err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json({
          success: true,
          type: 'text',
          content: "⌛ **Quota quotidien atteint !**\n\nReviens demain pour continuer à booster ton business ensemble 🚀."
        });
      }
      throw err;
    }

    let parsedData = { is_greeting: false, strategy: '', whatsapp_message: '', image_prompt: '', search_query: '' };

    try {
      const cleanedText = rawAiOutput.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch {
      parsedData.strategy = rawAiOutput;
    }

    // Si c'est juste un bonjour / salutation
    if (parsedData.is_greeting || (!parsedData.whatsapp_message && !parsedData.image_prompt)) {
      return NextResponse.json({
        success: true,
        type: 'text',
        content: parsedData.strategy
      });
    }

    // Sinon, générer la campagne complète
    const encodedPrompt = encodeURIComponent(parsedData.image_prompt || prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;

    return NextResponse.json({
      success: true,
      type: 'campaign',
      data: {
        strategy: parsedData.strategy,
        whatsapp_message: parsedData.whatsapp_message,
        image_url: imageUrl,
        leads: []
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur Interne' }, { status: 500 });
  }
}