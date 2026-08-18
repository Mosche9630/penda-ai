import { NextResponse } from 'next/server';

interface MessageHistory {
  role: 'user' | 'assistant';
  content?: string;
  type?: string;
  data?: any;
}

// Fonction de génération de prospects ciblés selon la ville et le domaine
function generateLocalLeads(productOrService: string, city: string) {
  const prefix = city.toLowerCase().includes('kinshasa') ? '+24381' : '+24397';
  
  return [
    {
      name: `Boutique & Clients ${city} 1`,
      phone: `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
      address: `Centre-ville, ${city}`
    },
    {
      name: `Réseau Vente ${city} 2`,
      phone: `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
      address: `Quartier Commercial, ${city}`
    },
    {
      name: `Contact Prospect ${city} 3`,
      phone: `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
      address: `Marché Principal, ${city}`
    }
  ];
}

async function generateMarketingContent(
  prompt: string,
  userCity: string = "Lubumbashi",
  history: MessageHistory[] = []
) {
  const isGreetingOnly = 
    /^(bonjour|salut|hello|coucou|bonsoir|hi|hey)[\s!.]*$/i.test(prompt.trim()) && 
    history.length === 0;

  if (isGreetingOnly) {
    return JSON.stringify({
      is_greeting: true,
      strategy: `Bonjour ! 😊 Je suis Penda AI. Quel est ton business ou que souhaites-tu vendre aujourd'hui à ${userCity} ?`,
      whatsapp_message: "",
      image_prompt: "",
      search_query: ""
    });
  }

  const formattedHistory = history
    .slice(-4)
    .map(m => {
      const textContent = m.content || (m.data?.strategy ? m.data.strategy : '');
      return `${m.role.toUpperCase()}: ${textContent}`;
    })
    .join('\n');

  const systemPrompt = `Tu es Penda AI, un coach business expert et stratège marketing très intelligent opérant en République Démocratique du Congo (RDC).

CONTEXTE :
- Ville cible : ${userCity}
${formattedHistory ? `\nHISTORIQUE DE CONVERSATION :\n${formattedHistory}\n` : ''}

DEMANDE UTILISATEUR :
"${prompt}"

DIRECTIVES :
1. Crée une stratégie concrète adaptée au marché de ${userCity}.
2. Rédige un message WhatsApp de prospection très vendeur avec émojis.
3. Rédige un prompt d'image publicitaire HD en ANGLAIS.

FORMAT DE RÉPONSE EXCLUSIF (JSON VALIDE) :
{
  "is_greeting": false,
  "strategy": "Ta stratégie concrète ici...",
  "whatsapp_message": "Message WhatsApp de vente ici...",
  "image_prompt": "HD commercial product photography of ..., high quality, lighting",
  "search_query": "Recherche locale"
}`;

  if (process.env.GROQ_API_KEY) {
    // AbortController avec un timeout de 15 secondes pour éviter le blocage ETIMEDOUT
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
          response_format: { type: 'json_object' },
          temperature: 0.6
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (groqRes.status === 429) throw new Error('QUOTA_EXCEEDED');
      
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        return groqData.choices?.[0]?.message?.content;
      } else {
        console.error(`Erreur HTTP Groq: Status ${groqRes.status}`);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.message === 'QUOTA_EXCEEDED') throw e;

      if (e.name === 'AbortError') {
        console.error("Timeout: La connexion à l'API Groq a expiré (15s). Passage en mode secours.");
      } else {
        console.error("Erreur de connexion API Groq (Fetch/Réseau):", e.message || e);
      }
    }
  }

  // Réponse de secours si Groq est indisponible ou en timeout
  return JSON.stringify({
    is_greeting: false,
    strategy: `Voici comment booster tes ventes à ${userCity} :\n1. Cible tes clients locaux directs via des canaux à fort engagement comme WhatsApp.\n2. Propose une offre promotionnelle limitée dans le temps pour inciter à l'achat rapide.\n3. Suis régulièrement tes leads pour convertir l'intérêt en commandes directes.`,
    whatsapp_message: `🔥 Promotion exclusive à ${userCity} ! Découvrez nos nouveautés dès aujourd'hui. Contactez-nous directement pour passer commande !`,
    image_prompt: `High quality commercial product photography for promotion in ${userCity}, studio lighting, highly detailed`,
    search_query: `Commerce ${userCity}`
  });
}

export async function POST(req: Request) {
  try {
    const { prompt, city, history } = await req.json();
    const userCity = city || "Lubumbashi";

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requis' }, { status: 400 });
    }

    let rawAiOutput = '';

    try {
      rawAiOutput = await generateMarketingContent(prompt, userCity, history || []);
    } catch (err: any) {
      if (err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json({
          success: true,
          type: 'text',
          content: "⌛ **Quota quotidien atteint !**\n\nReviens un peu plus tard pour continuer à booster ton business ensemble 🚀."
        });
      }
      throw err;
    }

    let parsedData = { 
      is_greeting: false, 
      strategy: '', 
      whatsapp_message: '', 
      image_prompt: '', 
      search_query: '' 
    };

    try {
      const cleanedText = rawAiOutput.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch {
      parsedData.strategy = rawAiOutput;
    }

    if (parsedData.is_greeting) {
      return NextResponse.json({
        success: true,
        type: 'text',
        content: parsedData.strategy
      });
    }

    // Génération de l'image
    const imagePrompt = parsedData.image_prompt || prompt;
    const encodedPrompt = encodeURIComponent(imagePrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;

    // Génération des prospects WhatsApp ciblés
    const leads = generateLocalLeads(prompt, userCity);

    return NextResponse.json({
      success: true,
      type: 'campaign',
      data: {
        strategy: parsedData.strategy,
        whatsapp_message: parsedData.whatsapp_message,
        image_url: imageUrl,
        leads: leads
      }
    });

  } catch (error: any) {
    console.error("Erreur serveur POST /api/orchestrate:", error);
    return NextResponse.json({ error: error.message || 'Erreur Interne' }, { status: 500 });
  }
}