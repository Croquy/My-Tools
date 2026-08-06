/*
  Petit serveur proxy pour morning.html :
    - /ask-companion   : assistant IA (Groq) qui répond en s'appuyant sur le journal
    - /search-media    : recherche de jeux/films/séries/jeux de société (RAWG/TMDB/BGG)
    - /media-detail    : récupère la fiche complète (synopsis, note, pochette...)

  But : ces clés d'API ne doivent jamais être visibles dans le repo public
  ni dans les requêtes réseau du navigateur.

  Déploiement sur Render (même compte que Coeli) :
    1. New + > Web Service, connecte ce repo GitHub
    2. Root Directory : server
    3. Build Command  : npm install
    4. Start Command  : npm start
    5. Onglet Environment > ajoute GROQ_API_KEY, RAWG_API_KEY, TMDB_API_KEY
    6. Deploy

  Render donne une URL du style https://morning-companion-proxy.onrender.com
  Colle-la dans SERVER_BASE_URL en haut du <script> de morning.html.

  Pas besoin de ping de maintien en vie ici : contrairement à un bot Discord,
  ce n'est utilisé qu'à la demande — un délai de 30-60s au premier appel
  après une période d'inactivité (comportement du plan gratuit Render) est
  sans conséquence pour ce cas d'usage.
*/

const express = require('express');
const cors = require('cors');
const { parseStringPromise } = require('xml2js');

const app = express();
app.use(express.json());

// Adapte si ton GitHub Pages a une autre URL.
const ALLOWED_ORIGIN = 'https://croquy.github.io';
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['POST', 'OPTIONS'] }));

// ═══════════════════════════════════════════════════════════════════
// Enrichissement médias — RAWG (jeux), TMDB (films/séries), BGG (jeux
// de société, avec repli Groq si BGG bloque Render comme pour Coeli).
// Repris et adapté de enricher.js (bot Coeli).
// ═══════════════════════════════════════════════════════════════════

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

async function callGroq(prompt, maxTokens = 300) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error('Groq error: ' + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function summarizeInFrench(text, name) {
  const clean = stripHtml(text).slice(0, 1500);
  if (!clean) {
    return callGroq(`Écris un synopsis en français de 2 phrases pour "${name}". Réponds uniquement avec le synopsis.`, 150);
  }
  return callGroq(`Résume en français en 2-3 phrases. Réponds uniquement avec le résumé :\n\n${clean}`, 200);
}

// ── RAWG — jeux vidéo ─────────────────────────────────────────────
async function searchJeux(query) {
  const key = process.env.RAWG_API_KEY;
  const res = await fetch(`https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(query)}&page_size=6`);
  if (!res.ok) throw new Error('RAWG search: ' + res.status);
  const data = await res.json();
  return (data.results || []).map(g => ({ id: g.id, title: g.name, year: g.released?.slice(0, 4) || '?' }));
}

async function getJeuDetail(id) {
  const key = process.env.RAWG_API_KEY;
  const [detailRes, storesRes] = await Promise.all([
    fetch(`https://api.rawg.io/api/games/${id}?key=${key}`),
    fetch(`https://api.rawg.io/api/games/${id}/stores?key=${key}`),
  ]);
  if (!detailRes.ok) throw new Error('RAWG detail: ' + detailRes.status);
  const d = await detailRes.json();
  const storesData = storesRes.ok ? await storesRes.json() : { results: [] };
  const steamEntry = storesData.results?.find(s => s.store_id === 1);

  const tags = d.tags?.map(t => t.slug) || [];
  const synopsis = await summarizeInFrench(d.description_raw || d.description, d.name);

  return {
    category: 'jeu',
    title: d.name,
    year: d.released?.slice(0, 4) || '?',
    genres: d.genres?.map(g => g.name) || [],
    note: d.rating ? `${d.rating.toFixed(1)}/5` : null,
    synopsis,
    cover: d.background_image || null,
    link: `https://rawg.io/games/${d.slug}`,
    extra: {
      coop: tags.some(t => ['co-op', 'coop', 'local-co-op', 'online-co-op'].includes(t)),
      fr: tags.some(t => t.includes('french')),
      steamLink: steamEntry?.url || null,
    },
  };
}

// ── TMDB — films / séries ────────────────────────────────────────
async function searchFilms(query) {
  const key = process.env.TMDB_API_KEY;
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(query)}&language=fr-FR`);
  if (!res.ok) throw new Error('TMDB search: ' + res.status);
  const data = await res.json();
  return (data.results || [])
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 6)
    .map(r => ({
      id: r.id,
      title: r.title || r.name,
      year: (r.release_date || r.first_air_date || '').slice(0, 4) || '?',
      mediaType: r.media_type,
    }));
}

async function getFilmDetail(id, type) {
  const key = process.env.TMDB_API_KEY;
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${key}&language=fr-FR&append_to_response=release_dates,content_ratings`);
  if (!res.ok) throw new Error('TMDB detail: ' + res.status);
  const d = await res.json();

  let ageRating = null;
  if (type === 'movie' && d.release_dates?.results) {
    const src = d.release_dates.results.find(r => r.iso_3166_1 === 'FR') || d.release_dates.results.find(r => r.iso_3166_1 === 'US');
    ageRating = src?.release_dates?.find(r => r.certification)?.certification || null;
  } else if (type === 'tv' && d.content_ratings?.results) {
    const src = d.content_ratings.results.find(r => r.iso_3166_1 === 'FR') || d.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    ageRating = src?.rating || null;
  }

  return {
    category: 'film',
    title: d.title || d.name,
    year: (d.release_date || d.first_air_date || '').slice(0, 4) || '?',
    genres: d.genres?.map(g => g.name) || [],
    note: d.vote_average ? `${d.vote_average.toFixed(1)}/10` : null,
    synopsis: d.overview || 'Pas de synopsis disponible.',
    cover: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
    link: `https://www.themoviedb.org/${type}/${d.id}`,
    extra: { ageRating, isTV: type === 'tv' },
  };
}

// ── BGG — jeux de société (avec repli Groq si bloqué) ────────────
const BGG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; MorningCompanion/1.0)',
  'Accept': 'application/xml, */*',
};

async function searchBoardgames(query) {
  try {
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`, { headers: BGG_HEADERS });
    if (res.ok) {
      const xml = await res.text();
      const data = await parseStringPromise(xml);
      const items = data?.items?.item || [];
      if (items.length) {
        return items.slice(0, 6).map(item => ({
          id: item.$.id,
          title: item.name?.[0]?.$.value || '?',
          year: item.yearpublished?.[0]?.$.value || '?',
        }));
      }
    }
  } catch (e) { console.log('BGG search error, repli Groq:', e.message); }
  return searchBoardgamesGroq(query);
}

async function getBoardgameDetail(id, name) {
  if (!id || String(id).startsWith('groq_')) return getBoardgameDetailGroq(name || id);
  try {
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`, { headers: BGG_HEADERS });
    if (res.ok) {
      const xml = await res.text();
      const data = await parseStringPromise(xml);
      const item = data?.items?.item?.[0];
      if (item) return parseBggItem(item, id);
    }
  } catch (e) { console.log('BGG detail error, repli Groq:', e.message); }
  return getBoardgameDetailGroq(name || String(id));
}

async function parseBggItem(item, id) {
  const names = item.name || [];
  const primary = names.find(n => n.$.type === 'primary');
  const title = primary?.$.value || names[0]?.$.value || '?';
  const links = item.link || [];
  const genres = links.filter(l => l.$.type === 'boardgamecategory').map(l => l.$.value).slice(0, 4);
  const stats = item.statistics?.[0]?.ratings?.[0];
  const noteRaw = parseFloat(stats?.average?.[0]?.$.value || '0');
  const synopsis = await summarizeInFrench(item.description?.[0] || '', title);
  const min = item.minplayers?.[0]?.$.value, max = item.maxplayers?.[0]?.$.value;
  const dmin = item.minplaytime?.[0]?.$.value, dmax = item.maxplaytime?.[0]?.$.value;

  return {
    category: 'boardgame',
    title,
    year: item.yearpublished?.[0]?.$.value || '?',
    genres,
    note: noteRaw > 0 ? `${noteRaw.toFixed(1)}/10` : null,
    synopsis,
    cover: item.image?.[0] ? (item.image[0].startsWith('http') ? item.image[0] : `https:${item.image[0]}`) : null,
    link: `https://boardgamegeek.com/boardgame/${id}`,
    extra: {
      players: (!min && !max) ? '?' : (min === max ? `${min} joueurs` : `${min || '?'}–${max || '?'} joueurs`),
      duration: (!dmin && !dmax) ? '?' : (dmin === dmax ? `${dmin} min` : `${dmin || '?'}–${dmax || '?'} min`),
      minAge: item.minage?.[0]?.$.value || null,
      coop: links.some(l => l.$.value?.toLowerCase().includes('cooperative')),
    },
  };
}

async function searchBoardgamesGroq(query) {
  try {
    const text = await callGroq(
      `Tu es une base de données BoardGameGeek. Cherche les jeux de société dont le nom ressemble à "${query}". Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour : [{"id":"groq_1","title":"Nom exact","year":"AAAA"}] Si tu ne connais pas ce jeu, retourne []. Maximum 4 résultats.`,
      200
    );
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (e) { console.error('Groq search BGG:', e.message); return []; }
}

async function getBoardgameDetailGroq(nameOrId) {
  const text = await callGroq(
    `Tu es BoardGameGeek. Donne les VRAIES infos du jeu "${nameOrId}". Si tu ne le connais pas à 90%, réponds {"unknown":true}. Sinon, réponds UNIQUEMENT avec ce JSON sans backticks : {"title":"nom","year":"AAAA","genres":["Stratégie"],"note":"X.X/10","players":"X-Y joueurs","duration":"X-Y min","minAge":"X","synopsis":"2 phrases en français","coop":false,"bggId":"ID_numérique_si_connu_sinon_null"}`,
    300
  );
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Jeu non trouvé');
  const info = JSON.parse(match[0]);
  if (info.unknown) throw new Error(`Jeu "${nameOrId}" inconnu de l'assistant`);

  return {
    category: 'boardgame',
    title: info.title || nameOrId,
    year: info.year || '?',
    genres: info.genres || [],
    note: info.note || null,
    synopsis: info.synopsis || 'Pas de synopsis disponible.',
    cover: null,
    link: (info.bggId && info.bggId !== 'null') ? `https://boardgamegeek.com/boardgame/${info.bggId}` : null,
    extra: { players: info.players || '?', duration: info.duration || '?', minAge: info.minAge || null, coop: info.coop || false },
  };
}

// ── Routes recherche / fiche détaillée ───────────────────────────
app.post('/search-media', async (req, res) => {
  const { category, query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Recherche manquante' });
  try {
    let results;
    if (category === 'jeu') results = await searchJeux(query);
    else if (category === 'film') results = await searchFilms(query);
    else if (category === 'boardgame') results = await searchBoardgames(query);
    else return res.status(400).json({ error: 'Catégorie inconnue' });
    res.status(200).json({ results });
  } catch (e) {
    console.error('Erreur search-media:', e);
    res.status(502).json({ error: e.message || 'Erreur de recherche' });
  }
});

app.post('/media-detail', async (req, res) => {
  const { category, id, mediaType, title } = req.body || {};
  if (!category || !id) return res.status(400).json({ error: 'Paramètres manquants' });
  try {
    let detail;
    if (category === 'jeu') detail = await getJeuDetail(id);
    else if (category === 'film') detail = await getFilmDetail(id, mediaType || 'movie');
    else if (category === 'boardgame') detail = await getBoardgameDetail(id, title);
    else return res.status(400).json({ error: 'Catégorie inconnue' });
    res.status(200).json({ detail });
  } catch (e) {
    console.error('Erreur media-detail:', e);
    res.status(502).json({ error: e.message || 'Erreur de récupération de fiche' });
  }
});

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