/*
  Petit serveur proxy pour l'assistant "Demander au compagnon" de morning.html.

  But : appeler l'API Groq depuis un serveur (comme pour Coeli), pas depuis
  le navigateur, pour que GROQ_API_KEY ne soit jamais visible dans le repo
  public ni dans les requêtes réseau du navigateur.

  Déploiement sur Render (même compte que Coeli) :
    1. New + > Web Service, connecte ce repo GitHub
    2. Root Directory : server
    3. Build Command  : npm install
    4. Start Command  : npm start
    5. Onglet Environment > ajoute GROQ_API_KEY (ta clé Groq)
    6. Deploy

  Render donne une URL du style https://morning-companion-proxy.onrender.com
  Colle-la dans GROQ_PROXY_URL en haut du <script> de morning.html.

  Pas besoin de ping de maintien en vie ici : contrairement à un bot Discord,
  ce n'est utilisé qu'à la demande — un délai de 30-60s au premier appel
  après une période d'inactivité (comportement du plan gratuit Render) est
  sans conséquence pour ce cas d'usage.
*/

const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

// Adapte si ton GitHub Pages a une autre URL.
const ALLOWED_ORIGIN = 'https://croquy.github.io';
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['POST', 'OPTIONS'] }));

const SYSTEM_PROMPT =
  "Tu es un compagnon de travail bienveillant, doux et jamais culpabilisant. " +
  "Réponds en français, en te basant UNIQUEMENT sur le contexte fourni (extraits du journal de bord de l'utilisatrice). " +
  "Si l'information n'est pas dans le contexte, dis-le simplement plutôt que d'inventer. " +
  "Reste concis (quelques phrases), chaleureux, sans jugement sur le rythme de travail.";

app.post('/ask-companion', async (req, res) => {
  const { question, context } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question manquante' });
  }

  const userPrompt =
    "Contexte (extraits du journal) :\n" + (context || 'Aucun extrait trouvé.') +
    "\n\nQuestion : " + question;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 400
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Erreur Groq:', groqRes.status, errText);
      return res.status(502).json({ error: 'Erreur côté Groq' });
    }

    const data = await groqRes.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "Pas de réponse générée.";

    res.status(200).json({ answer });
  } catch (e) {
    console.error('Erreur serveur:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/', (req, res) => res.send('Morning companion proxy — OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Serveur démarré sur le port ' + PORT));
