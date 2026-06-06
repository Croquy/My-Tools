/*
  app.js — logique principale pour Aventure
  - extrait de la version inline initiale (aventure.html)
  - objectif : centraliser le JS pour faciliter la maintenance
  - TODO: découper en modules `init-firebase.js`, `codex.js`, `print.js` plus tard
*/

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const S={
  edit:false, view:'aventures',
  avId:null, djNum:null,
  diceSides:6, diceRolls:[],
  delCb:null, codexTab:'loots',
  editAvId:null, editLootId:null
};

let aventureDataCache = null;

// ═══════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════
// Fragments : objets de quête dans le codex (fragment_1 à fragment_10 = donjons 11–20)
// Mapping donjon → index fragment
const FRAGMENT_MAP={11:1,12:2,13:3,14:4,15:5,16:6,17:7,18:8,19:9,20:10};

const PROGRESSION=[
  {label:'Niveau 1 — Libres',         nums:[1,2,3,4,5],           req:[null,null,null,null,null]},
  {label:'Niveau 2 — 1 objet requis', nums:[6,7,8,9,10],          req:[[2],[3],[4],[5],[2]]},
  {label:'Niveau 3 — 2 objets requis',nums:[11,12,13,14,15,16,17,18,19],req:[[2,9],[1,7],[4,7],[2,8],[3,10],[1,6],[10,9],[7,6],[4,8]]},
  {label:'Niveau 4 — Boss final 🏆',  nums:[20],                  req:[null]}
];

// ═══════════════════════════════════════════
// DONNÉES PAR DÉFAUT
// ═══════════════════════════════════════════
function buildDefault(){
  return {
    aventures:[{
      id:'contes_fees',
      nom:'Le Royaume des Contes',
      scenario:"Plus personne ne peut dormir depuis une semaine. Le FBI vous a envoyé enquêter dans le Royaume des Contes de Fée pour découvrir pourquoi et qui a fait cela.",
      donjons:[{
        num:1,
        titre:'Forêt du Petit Chaperon Déformé',
        conte:'Le Petit Chaperon Rouge',
        theme:'La méchanceté',
        intro:"Les aventuriers franchissent une vieille porte de bois couverte de ronces et arrivent dans une forêt étrange. L'air semble lourd, presque malade. Les arbres changent discrètement de place dès qu'on détourne les yeux et certains troncs portent des affiches déchirées racontant différentes versions du Petit Chaperon Rouge.\n\nAu loin, une vieille femme hurle avant que le silence ne retombe brutalement. Plus les aventuriers avancent, plus la forêt semble se déformer autour d'eux.",
        c1:{
          nom:'Petit Chaperon Rouge',
          narration:"Après plusieurs heures à errer entre les chemins mouvants, ils aperçoivent finalement une silhouette rouge courir entre les arbres.\n\nEn s'approchant, les aventuriers découvrent une jeune fille vêtue d'une cape rouge déchirée. Ses vêtements sont couverts de griffures, mais aucune ne semble provenir d'un animal. Elle se retourne brusquement et pointe une vieille hache rouillée dans leur direction.\n\n« Vous aussi vous travaillez pour eux ? Vous voulez me ramener dans l'histoire ? Je refuse de mourir encore ! »\n\nSans attendre davantage, elle attaque les aventuriers.",
          apres:""
        },
        c2:{
          nom:'Bûcheron fatigué',
          narration:"Après ce combat, les aventuriers restent troublés par les paroles de la jeune fille. La forêt paraît encore plus silencieuse qu'avant, comme si elle observait leurs réactions. En avançant, ils découvrent une clairière parfaitement immobile où un vieux bûcheron abat inlassablement le même arbre. À chaque coup de hache, le tronc repousse lentement sous leurs yeux.\n\nLe bûcheron semble épuisé, comme s'il n'avait pas dormi depuis des années. Il regarde les aventuriers avec lassitude avant de reprendre son travail.\n\nIl leur explique que la forêt est déboussolée, comme si les règles des contes avaient disparu.\n\n« Les histoires possèdent des règles. Quand les règles meurent… les royaumes se transforment. »\n\nLe bûcheron accepte d'aider les aventuriers, mais uniquement s'ils prouvent qu'ils comprennent encore comment fonctionnent les histoires. Il pose alors son épreuve.",
          enigme:"Dans une histoire, il y a toujours un héros, un méchant et une leçon. Le Petit Chaperon Rouge a peur du loup. Mais dans cette forêt, de qui le loup a-t-il peur ?",
          reponse:"De lui-même — il a peur de son propre rôle dans l'histoire, d'être condamné à être le méchant pour toujours.",
          apres:""
        },
        c3:{
          nom:'Le Loup Parleur',
          narration:"Après avoir résolu l'épreuve du bûcheron, les aventuriers poursuivent leur route. Les arbres deviennent immenses et les murmures de la forêt se changent peu à peu en voix humaines. Finalement, ils découvrent une vieille maison de grand-mère suspendue dans les branches d'un arbre gigantesque.\n\nLa porte s'ouvre toute seule. À l'intérieur, un grand loup noir habillé comme un noble boit calmement du thé dans une petite tasse fragile. Il ne semble pas agressif, mais son regard est particulièrement intelligent. Lui aussi paraît extrêmement fatigué.\n\n« Je vous attendais depuis longtemps. Asseyez-vous. »\n\nLe loup révèle alors une vérité inquiétante : les personnages des contes savent désormais qu'ils vivent dans des histoires. Certains deviennent fous, d'autres cherchent à changer leur destin, et certains veulent détruire complètement les récits.\n\n« Nous existons uniquement tant que les humains rêvent. Mais les humains ont cessé de rêver… et quand ils cessent de rêver, nous mourons. »",
          verite:"Il n'a peut-être jamais été le véritable monstre de cette histoire.",
          apres:"Avant leur départ, le loup leur confie le Fil Narratif, un étrange fil lumineux capable de guider les voyageurs entre les histoires.\n\n« Grâce à ceci, vous pourrez traverser d'autres contes et peut-être tous nous sauver. Partez vite maintenant… nous comptons sur vous. »"
        },
        fin:"Maintenant qu'ils possèdent ces nouvelles informations, les aventuriers retournent vers la porte magique et quittent la forêt afin de poursuivre leur enquête dans les autres royaumes des contes."
      }]
    }],
    loots: buildDefaultLoots(),
    rules: buildDefaultRules()
  };
}

function buildDefaultLoots(){
  return [
    {id:'fil_narratif',nom:'Fil narratif',cat:'quete',bonus:'',desc:"Un fil d'or qui relie les contes entre eux.",from:1,unlock:[12,16]},
    {id:'boussole_mondes',nom:'Boussole des mondes',cat:'quete',bonus:'',desc:"Indique les portails entre les histoires.",from:2,unlock:[6,10,11,14]},
    {id:'cristal_gele',nom:'Cristal gelé',cat:'quete',bonus:'',desc:"Emprisonne un fragment de conte incomplet.",from:3,unlock:[7,15]},
    {id:'montre_gousset',nom:'Montre à gousset',cat:'quete',bonus:'',desc:"Tourne à l'envers — le temps des contes n'est pas le nôtre.",from:4,unlock:[8,13,19]},
    {id:'engrais_magique',nom:'Engrais magique',cat:'quete',bonus:'',desc:"Poudre qui fait pousser les histoires comme des graines.",from:5,unlock:[9,11]},
    {id:'cristal_memoire',nom:'Cristal mémoire',cat:'quete',bonus:'',desc:"Contient les souvenirs effacés d'un personnage.",from:6,unlock:[16,18]},
    {id:'miroir_verites',nom:'Miroir des vérités',cat:'quete',bonus:'',desc:"Ne montre pas le reflet mais la vérité cachée.",from:7,unlock:[12,13,18]},
    {id:'masque_illusion',nom:"Masque d'illusion",cat:'quete',bonus:'',desc:"Permet de prendre l'apparence d'un personnage de conte.",from:8,unlock:[14,19]},
    {id:'graine_magique',nom:'Graine magique',cat:'quete',bonus:'',desc:"Plantée, fait pousser un donjon entier.",from:9,unlock:[11,17]},
    {id:'carte_solaire',nom:'Carte solaire',cat:'quete',bonus:'',desc:"Se révèle uniquement en pleine lumière.",from:10,unlock:[15,17]},
    {id:'baton_force',nom:'Bâton de force',cat:'arme',bonus:'+1d6 attaque',desc:"Bâton noueux taillé dans le bois des contes."},
    {id:'plume_ecriture',nom:"Plume d'écriture",cat:'arme',bonus:'+1d6 attaque',desc:"Tranche aussi bien que n'importe quelle lame."},
    {id:'harpon_magique',nom:'Harpon magique',cat:'arme',bonus:'+1d6 attaque',desc:"Revient toujours dans la main de son porteur."},
    {id:'marteau_magique',nom:'Marteau magique',cat:'arme',bonus:'+1d6 attaque',desc:"Résonne comme le tonnerre quand il frappe."},
    {id:'epee_lumiere',nom:'Épée de lumière',cat:'arme',bonus:'+1d6 attaque',desc:"Forgée d'un rayon de soleil figé."},
    {id:'lance_etoile',nom:'Lance étoilée',cat:'arme',bonus:'+1d6 attaque',desc:"Taillée dans une étoile filante."},
    {id:'arc_vent',nom:'Arc des vents',cat:'arme',bonus:'+1d6 attaque',desc:"Ses flèches ne ratent jamais leur cible."},
    {id:'fouet_liane',nom:'Fouet de liane',cat:'arme',bonus:'+1d6 attaque',desc:"Souple et redoutable, tressé par les elfes."},
    {id:'hache_glace',nom:'Hache de glace',cat:'arme',bonus:'+1d6 attaque',desc:"Tranche même le temps par grand froid."},
    {id:'dague_ombre',nom:"Dague d'ombre",cat:'arme',bonus:'+1d6 attaque',desc:"Invisible à la lumière, mortelle dans l'obscurité."},
    {id:'cape_ombre',nom:"Cape d'ombre",cat:'armure',subcat:'corps',bonus:'-1 dégât',desc:"Taillée dans la nuit, absorbe les impacts."},
    {id:'armure_ecorce',nom:"Armure d'écorce",cat:'armure',subcat:'corps',bonus:'-1 dégât',desc:"Cuirasse de bois vivant qui repousse les coups."},
    {id:'plastron_cristal',nom:'Plastron de cristal',cat:'armure',subcat:'corps',bonus:'-1 dégât',desc:"Renvoie une partie de la force des attaques."},
    {id:'manteau_plumes',nom:'Manteau de plumes',cat:'armure',subcat:'corps',bonus:'-1 dégât',desc:"Léger et résistant, cadeau d'un oiseau-phénix."},
    {id:'gant_isolant',nom:'Gant isolant',cat:'armure',subcat:'mains',bonus:'-1 dégât',desc:"Protège des coups et de la magie."},
    {id:'gant_alchimique',nom:'Gant alchimique',cat:'armure',subcat:'mains',bonus:'-1 dégât',desc:"Transforme l'énergie des coups reçus."},
    {id:'gant_renforce',nom:'Gant renforcé',cat:'armure',subcat:'mains',bonus:'-1 dégât',desc:"Forgé dans l'acier des nains."},
    {id:'gant_soie',nom:'Gant de soie enchantée',cat:'armure',subcat:'mains',bonus:'-1 dégât',desc:"Doux comme un nuage, dur comme du roc."},
    {id:'chaussures_silencieuses',nom:'Chaussures silencieuses',cat:'armure',subcat:'pieds',bonus:'-1 dégât',desc:"Amortissent autant les sons que les impacts."},
    {id:'chaussures_trace',nom:'Chaussures de trace',cat:'armure',subcat:'pieds',bonus:'-1 dégât',desc:"Laissent des empreintes lumineuses, absorbent les chocs."},
    {id:'bottes_roc',nom:'Bottes de roc',cat:'armure',subcat:'pieds',bonus:'-1 dégât',desc:"Lourdes mais indestructibles."},
    {id:'sandales_vent',nom:'Sandales du vent',cat:'armure',subcat:'pieds',bonus:'-1 dégât',desc:"Rapides et protectrices."},
    {id:'loupe_magique',nom:'Loupe magique',cat:'objet',bonus:'Aide narrative',desc:"Révèle les détails invisibles à l'œil nu."},
    {id:'cle_enchantee',nom:'Clé enchantée',cat:'objet',bonus:'Aide narrative',desc:"Ouvre n'importe quelle serrure ou secret."},
    {id:'livre_contes',nom:'Livre des contes',cat:'objet',bonus:'Aide narrative',desc:"Contient toutes les histoires du royaume."},
    {id:'anneau_naturel',nom:'Anneau naturel',cat:'objet',bonus:'Aide narrative',desc:"Parle aux animaux et aux plantes."},
    {id:'carte_tresor',nom:'Carte au trésor',cat:'objet',bonus:'Aide narrative',desc:"Indique toujours ce qui est caché à proximité."},
    {id:'boussole_pirate',nom:'Boussole pirate',cat:'objet',bonus:'Aide narrative',desc:"Pointe vers ce que l'on désire vraiment."},
    {id:'medaillon_sacre',nom:'Médaillon sacré',cat:'objet',bonus:'Aide narrative',desc:"Protège des illusions et des mensonges."},
    {id:'pomme_boost',nom:'Pomme boost',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Une bouchée et la force décuple."},
    {id:'potion_focus',nom:'Potion focus',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Concentre l'esprit et le corps en un instant."},
    {id:'ressort_reparateur',nom:'Ressort réparateur',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Remonte le mécanisme interne du corps."},
    {id:'fragment_etoile',nom:'Fragment étoile',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Éclat de météorite qui booste temporairement."},
    {id:'bombe_fumee',nom:'Bombe fumée',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Dans la confusion, une seconde chance."},
    {id:'potion_sommeil',nom:'Potion sommeil',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Endort la malchance le temps d'un jet."},
    {id:'encre_magique',nom:'Encre magique',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Réécrit le destin d'un seul trait."},
    {id:'pierre_reconstruction',nom:'Pierre de reconstruction',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Reconstruit le moment pour en changer l'issue."},
    {id:'oeil_verite',nom:'Œil de vérité',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Voit à travers les apparences."},
    {id:'poussiere_verite',nom:'Poussière de vérité',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Saupoudrée, révèle ce qui est caché."},
    {id:'encens_revelateur',nom:'Encens révélateur',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Ses volutes dessinent la réponse."},
    {id:'parfum_verite',nom:'Parfum de vérité',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Son odeur rend impossible le mensonge."},
    {id:'marque_page_magique',nom:'Marque-page magique',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Ouvre toujours à la bonne page."},
    {id:'livre_secret',nom:'Livre secret',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Contient les réponses à toutes les questions."},
    {id:'fil_ariane',nom:"Fil d'Ariane",cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Guide vers la sortie du labyrinthe."},
    {id:'carte_labyrinthe',nom:'Carte du labyrinthe',cat:'consommable',subcat:'indice',bonus:'Aide sur une énigme',desc:"Révèle la structure cachée de toute énigme."},
    {id:'elixir_titan',nom:'Élixir de titan',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Transforme brièvement celui qui le boit en titan."},
    {id:'biscuit_magique',nom:'Biscuit magique',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Une bouchée suffit à décupler les forces."},
    {id:'herbe_vigueur',nom:'Herbe de vigueur',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"Herbe rare qui réveille les muscles endormis."},
    {id:'poudre_colere',nom:'Poudre de colère',cat:'consommable',subcat:'force',bonus:'+2 à un jet',desc:"À inhaler — déclenche une fureur temporaire."},
    {id:'plume_chance',nom:'Plume de chance',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Souffler dessus avant un jet porte bonheur."},
    {id:'trefle_quatre',nom:'Trèfle à quatre feuilles',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Impossible à trouver, impossible de rater."},
    {id:'potion_arc_en_ciel',nom:'Potion arc-en-ciel',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Change la couleur du destin en une seconde."},
    {id:'des_truques',nom:'Dés truqués',cat:'consommable',subcat:'chance',bonus:'Relance un dé',desc:"Un seul usage — après ça, ils redeviennent normaux."},
    {id:'fragment_1', nom:'Fragment 1',  cat:'quete', bonus:'', desc:'Celui',                    from:11, unlock:[]},
    {id:'fragment_2', nom:'Fragment 2',  cat:'quete', bonus:'', desc:'qui a kidnappé',            from:12, unlock:[]},
    {id:'fragment_3', nom:'Fragment 3',  cat:'quete', bonus:'', desc:'le Marchand',               from:13, unlock:[]},
    {id:'fragment_4', nom:'Fragment 4',  cat:'quete', bonus:'', desc:'de Sable',                  from:14, unlock:[]},
    {id:'fragment_5', nom:'Fragment 5',  cat:'quete', bonus:'', desc:'voulait empêcher',          from:15, unlock:[]},
    {id:'fragment_6', nom:'Fragment 6',  cat:'quete', bonus:'', desc:'les enfants',               from:16, unlock:[]},
    {id:'fragment_7', nom:'Fragment 7',  cat:'quete', bonus:'', desc:'de dormir',                 from:17, unlock:[]},
    {id:'fragment_8', nom:'Fragment 8',  cat:'quete', bonus:'', desc:"c'est une créature",        from:18, unlock:[]},
    {id:'fragment_9', nom:'Fragment 9',  cat:'quete', bonus:'', desc:'avec de grandes oreilles',  from:19, unlock:[]},
    {id:'fragment_10',nom:'Fragment 10', cat:'quete', bonus:'', desc:'et une trompe',             from:20, unlock:[]},
  ];
}

function buildDefaultRules(){
  return [
    {id:'principe',titre:'🎯 Principe du jeu',corps:"Vous êtes des agents du FBI envoyés enquêter dans le Royaume des Contes de Fée. Vous explorez des donjons, rencontrez des personnages et collectez des objets pour avancer.\nLe MJ (toi) gère l'application, les enfants ont leurs fiches de personnage en main."},
    {id:'persos',titre:'👤 Personnages joueurs',corps:"Chaque joueur a une fiche avec :\n- Force : utilisée pour les combats (valeur 1–5)\n- Intelligence : utilisée pour les énigmes (valeur 1–5)\n- 10 PV : points de vie de départ\n- Inventaire : 1 arme max, 3 pièces d'armure (corps, mains, pieds)"},
    {id:'combat',titre:'⚔️ Combat',corps:"Attaque joueur = 1d6 + Force + 1d6 si arme équipée\nDéfense joueur = -1 dégât par pièce d'armure (corps, mains, pieds)\n\nPNJ Combat :\n- PV = 5 + numéro du donjon\n- Attaque = 1d6 par défaut\n\nLes combats sont au tour par tour. Les joueurs piochent leurs pions (1–6) dans leur pochette pour simuler le dé."},
    {id:'enigmes',titre:'🧩 Énigmes',corps:"Le MJ lit l'énigme à voix haute. Les joueurs discutent et proposent une réponse.\nEn cas de bonne réponse, la rencontre est réussie et le loot est obtenu.\nLe bouton spoil permet au MJ de vérifier la réponse discrètement."},
    {id:'narratif',titre:'📖 Narratif',corps:"Les personnages narratifs ne se battent pas. Ils donnent des informations, posent des choix ou révèlent une vérité à découvrir.\nLe MJ dialogue avec les joueurs jusqu'à ce qu'ils arrivent à la vérité. La vérité n'est visible que du MJ."},
    {id:'progression',titre:'🗺️ Progression & Donjons',corps:"Chaque donjon a 3 chapitres : Combat → Énigme → Narratif.\n\n- Donjons 1–5 : Libres d'accès. Lootent chacun un objet de quête.\n- Donjons 6–10 : Nécessitent 1 objet de quête.\n- Donjons 11–19 : Nécessitent 2 objets. Lootent des fragments de phrase.\n- Donjon 20 : Boss final. La phrase complète révèle le coupable."},
    {id:'loots',titre:'🎁 Loots',corps:"- Objets de quête 🔑 : clés pour débloquer d'autres donjons.\n- Armes ⚔️ : +1d6 attaque (1 seule équipable).\n- Armures 🛡️ : -1 dégât par pièce (corps, mains, pieds).\n- Objets 🎒 : aide narrative — le MJ les utilise pour un indice ou débloquer un dialogue.\n- Consommables 🧪 : usage unique — Force (+2 jet), Chance (relancer dé), Indice (aide énigme)."},
    {id:'des',titre:'🎲 Dés en voiture',corps:"Remplace les dés par des pochettes de pions numérotés 1–6.\nTu peux aussi utiliser l'onglet 🎲 Dés de l'application pour lancer en tant que MJ."}
  ];
}

// ═══════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════
function loadData(){try{const r=localStorage.getItem('av2');if(r)return JSON.parse(r);}catch(e){}return buildDefault();}
function saveData(d){
  try{ localStorage.setItem('av2',JSON.stringify(d)); }catch(e){ console.warn('Erreur stockage local saveData:', e); }
  if(window.FirestoreService && FirestoreService.initialized){
    try{
      FirestoreService.saveAventureData(d).catch(err=>console.warn('Erreur sauvegarde Firebase (async):',err));
    }catch(e){ console.warn('Erreur déclenchement sauvegarde Firebase:', e); }
  }
}
function getData(){return loadData();}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function showView(name){
  const navName = name==='donjons' || name==='donjon' ? 'donjon' : name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const view=document.getElementById('view-'+name);
  if(view) view.classList.add('active');
  ['aventures','donjon','codex','regles'].forEach(t=>{
    const el=document.getElementById('tab-'+t);
    if(el) el.classList.toggle('active',t===navName);
  });
  S.view=name;
  updateModeBtn();
  if(name==='aventures') renderAventures();
  if(name==='codex') renderCodex();
  if(name==='regles') renderRules();
}

function backToAventures(){S.avId=null;S.djNum=null;showView('aventures');}
function backToDj(){showDonjons(S.avId);}

function updateModeBtn(){
  const show=['aventures','donjons','donjon','codex','regles'].includes(S.view);
  document.getElementById('header-mode-toggle').style.display=show?'':'none';
}

function toggleMode(){
  S.edit=!S.edit;
  document.getElementById('toggle-icon').textContent=S.edit?'👁️':'✏️';
  document.getElementById('toggle-label').textContent=S.edit?'Mode jeu':'Mode édition';
  if(S.view==='aventures') renderAventures();
  else if(S.view==='donjons') showDonjons(S.avId);
  else if(S.view==='donjon') showDonjon(S.avId,S.djNum);
  else if(S.view==='codex') renderCodex();
  else if(S.view==='regles') renderRules();
}

// ═══════════════════════════════════════════
// VUE AVENTURES
// ═══════════════════════════════════════════
function renderAventures(){
  const data=getData();
  document.getElementById('btn-add-aventure').style.display=S.edit?'':'none';
  const c=document.getElementById('aventures-list');
  if(!data.aventures.length){
    c.innerHTML='<div class="empty-state"><div class="empty-state-icon">🗺️</div><p>Aucune aventure.</p></div>';return;
  }
  c.innerHTML='<div class="av-cards">'+data.aventures.map(av=>`
    <div class="av-card" onclick="showDonjons('${av.id}')">
      ${S.edit?`<div class="av-card-actions">
        <button class="btn-del-sm" onclick="event.stopPropagation();openAvModal('${av.id}')">✏️</button>
        <button class="btn-del-sm" onclick="event.stopPropagation();askDel('aventure','${av.id}')">🗑️</button>
      </div>`:''}
      <div class="av-card-title">${av.nom}</div>
      <div class="av-card-desc">${av.scenario||''}</div>
      <div class="av-card-meta">
        <span class="av-pill">${(av.donjons||[]).length}/20 donjons</span>
        <span class="av-pill cyan">→ Explorer</span>
      </div>
    </div>`).join('')+'</div>';
}

// ═══════════════════════════════════════════
// VUE DONJONS
// ═══════════════════════════════════════════
function showDonjons(avId){
  S.avId=avId; S.view='donjons';
  const data=getData();
  const av=data.aventures.find(a=>a.id===avId);
  if(!av) return;
  document.getElementById('bc-av').textContent=av.nom;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-donjons').classList.add('active');
  updateModeBtn();
  document.getElementById('edit-toolbar').style.display=S.edit?'flex':'none';

  document.getElementById('av-scenario-zone').innerHTML=av.scenario
    ?`<div class="scenario-block"><div class="scenario-label">📜 Scénario</div>${av.scenario}</div>`:'';

  const djMap={};(av.donjons||[]).forEach(d=>djMap[d.num]=d);
  let html='<div class="dungeon-tree">';
  PROGRESSION.forEach(tier=>{
    html+=`<div style="margin-bottom:4px;"><div class="dungeon-tier-title">${tier.label}</div><div class="dungeon-grid">`;
    tier.nums.forEach((num,i)=>{
      const d=djMap[num];
      const req=tier.req[i];
      const locked=req&&req!==null&&!S.edit;
      if(d){
        html+=`<div class="dungeon-node${locked?' locked':''}" onclick="${locked?`openPrereqModal('${avId}',${num},[${req}])`:` showDonjon('${avId}',${num})`}">
          <div class="dungeon-num">Donjon ${num}</div>
          <div class="dungeon-name">${d.titre}</div>
          ${d.conte?`<div style="font-size:10px;color:var(--purple);font-style:italic;">${d.conte}</div>`:''}
          ${req?`<div class="dungeon-lock">🔑 ${req.join(' + ')}</div>`:''}
          ${S.edit?`<button class="btn-del-sm" style="font-size:10px;padding:2px 6px;margin-top:4px;" onclick="event.stopPropagation();openDjModal(${num})">✏️</button>`:''}
        </div>`;
      } else {
        html+=`<div class="dungeon-node empty" onclick="${S.edit?`openDjModal(${num})`:''}">
          <div class="dungeon-num">Donjon ${num}</div>
          <div class="dungeon-name" style="color:var(--text-dim);font-style:italic;">${S.edit?'+ Ajouter':'À venir…'}</div>
          ${req?`<div class="dungeon-lock">🔑 ${req.join(' + ')}</div>`:''}
        </div>`;
      }
    });
    html+='</div></div>';
  });
  html+='</div>';
  document.getElementById('dungeon-tree').innerHTML=html;
}

// ═══════════════════════════════════════════
// VUE DÉTAIL DONJON
// ═══════════════════════════════════════════
function showDonjon(avId,num){
  S.avId=avId; S.djNum=num; S.view='donjon';
  const data=getData();
  const av=data.aventures.find(a=>a.id===avId);
  const dj=(av.donjons||[]).find(d=>d.num===num);
  if(!dj) return;

  document.getElementById('bc-av2').textContent=av.nom;
  document.getElementById('bc-dj').textContent=`Donjon ${num} — ${dj.titre}`;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-donjon').classList.add('active');
  updateModeBtn();

  let reqNums=null;
  PROGRESSION.forEach(tier=>{const i=tier.nums.indexOf(num);if(i!==-1&&tier.req[i])reqNums=tier.req[i];});

  const lootQ=data.loots.find(l=>l.cat==='quete'&&l.from===num);
  const fragIdx=FRAGMENT_MAP[num]||null;
  const fragLoot=fragIdx?data.loots.find(l=>l.id==='fragment_'+fragIdx):null;
  const fragment=fragLoot?fragLoot.desc:null;
  const c1=dj.c1||{};
  const c2=dj.c2||{};
  const c3=dj.c3||{};

  let html='<div style="display:flex;flex-direction:column;gap:0;">';

  html+=`<div class="dj-header">
    <div class="dj-num">Donjon ${num}${dj.conte?' · '+dj.conte:''}</div>
    <div class="dj-title">${dj.titre}</div>
    ${dj.theme?`<div style="font-size:12px;color:var(--purple);font-weight:700;margin-bottom:8px;">💡 ${dj.theme}</div>`:''}
    ${dj.intro?`<div class="dj-intro">${dj.intro}</div>`:''}
    ${reqNums?`<div class="dj-requires">
      <div style="font-size:11px;color:var(--text-dim);font-weight:600;">🔑 Prérequis :</div>
      ${reqNums.map(r=>{const l=data.loots.find(x=>x.cat==='quete'&&x.from===r);return`<div class="require-pill">🗝️ ${l?l.nom:'Donjon '+r}</div>`;}).join('')}
    </div>`:''}
  </div>`;

  if(S.edit){
    html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <button class="btn secondary" onclick="openDjModal(${num})">✏️ Modifier</button>
      <button class="btn secondary" style="border-color:rgba(255,85,85,.4);color:#ff5555;" onclick="askDel('donjon',${num})">🗑️ Supprimer</button>
    </div>`;
  }

  html+=`<div class="chapter">
    <div class="chapter-header combat">
      <div class="chapter-icon">⚔️</div>
      <div class="chapter-title combat">Chapitre 1 — Combat</div>
      ${c1.nom?`<div class="chapter-pnj">${c1.nom}</div>`:''}
    </div>
    <div class="chapter-body combat">
      ${c1.narration?`<div class="chapter-narration">${c1.narration}</div>`:''}
      ${c1.nom?`<div class="chapter-pnj-name">${c1.nom}</div>`:''}
      <div class="combat-stats">
        <div class="stat-box"><div class="stat-val">${5+num}</div><div class="stat-label">PV (5 + D${num})</div></div>
        <div class="stat-box"><div class="stat-val">1d6</div><div class="stat-label">Attaque</div></div>
      </div>
      <div class="piochage-box combat-piochage">
        <span class="piochage-icon">🎒</span>
        <span class="piochage-text">Piocher ${c1.piochage||1} équipement${(c1.piochage||1)>1?'s':''} dans l'enveloppe</span>
      </div>
      ${c1.apres?`<div class="chapitre-apres"><div class="chapitre-apres-label">— Après le combat —</div><div class="chapter-narration">${c1.apres}</div></div>`:''}
    </div>
  </div>`;

  html+=`<div class="chapter">
    <div class="chapter-header enigme">
      <div class="chapter-icon">🧩</div>
      <div class="chapter-title enigme">Chapitre 2 — Énigme</div>
      ${c2.nom?`<div class="chapter-pnj">${c2.nom}</div>`:''}
    </div>
    <div class="chapter-body enigme">
      ${c2.narration?`<div class="chapter-narration">${c2.narration}</div>`:''}
      ${c2.nom?`<div class="chapter-pnj-name">${c2.nom}</div>`:''}
      ${c2.enigme?`<div class="enigme-box">
        <div class="enigme-label">🧩 Énigme</div>
        <div class="enigme-text">${c2.enigme}</div>
        ${c2.reponse?`<button class="spoil-btn" onclick="toggleSpoil(this)">👁️ Voir la réponse</button>
        <div class="spoil-answer">${c2.reponse}</div>`:''}
      </div>`:''}
      <div class="piochage-box enigme-piochage">
        <span class="piochage-icon">🎒</span>
        <span class="piochage-text">Piocher ${c2.piochage||1} consommable${(c2.piochage||1)>1?'s':''} dans l'enveloppe</span>
      </div>
      ${c2.apres?`<div class="chapitre-apres"><div class="chapitre-apres-label">— Après l'énigme —</div><div class="chapter-narration">${c2.apres}</div></div>`:''}
    </div>
  </div>`;

  html+=`<div class="chapter">
    <div class="chapter-header narratif">
      <div class="chapter-icon">📖</div>
      <div class="chapter-title narratif">Chapitre 3 — Narratif</div>
      ${c3.nom?`<div class="chapter-pnj">${c3.nom}</div>`:''}
    </div>
    <div class="chapter-body narratif">
      ${c3.narration?`<div class="chapter-narration">${c3.narration}</div>`:''}
      ${c3.nom?`<div class="chapter-pnj-name">${c3.nom}</div>`:''}
      ${c3.verite?`<div class="verite-box">
        <div class="verite-label">🔒 Vérité à découvrir <span>MJ seulement</span></div>
        <button class="spoil-btn verite-spoil-btn" onclick="toggleSpoil(this)">👁️ Révéler la vérité</button>
        <div class="spoil-answer verite-spoil-answer">${c3.verite}</div>
      </div>`:''}
      ${c3.apres?`<div class="chapitre-apres"><div class="chapitre-apres-label">— Après la découverte —</div><div class="chapter-narration">${c3.apres}</div></div>`:''}
      ${fragLoot?`<div class="loot-narratif" style="background:linear-gradient(135deg,rgba(139,233,253,.08),rgba(189,147,249,.08));border-color:rgba(139,233,253,.3);">
        <div class="loot-narratif-label" style="color:var(--cyan);">🧩 Fragment</div>
        <div style="flex:1;">
          <div class="loot-narratif-name">${fragLoot.nom}</div>
          <div style="font-family:'Quicksand',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-top:4px;">"${fragLoot.desc}"</div>
        </div>
      </div>`:''}
      ${lootQ?`<div class="loot-narratif">
        <div class="loot-narratif-label">🔑 Loot</div>
        <div class="loot-narratif-name">${lootQ.nom}</div>
        ${lootQ.unlock&&lootQ.unlock.length?`<div class="loot-narratif-unlock">Débloque D${lootQ.unlock.join(', D')}</div>`:''}
      </div>`:''}
    </div>
  </div>`;

  if(dj.fin){
    html+=`<div class="dj-fin">
      <div class="dj-fin-label">🏁 Fin du donjon</div>
      <div class="dj-fin-text">${dj.fin}</div>
    </div>`;
  }

  html+='</div>';
  document.getElementById('donjon-detail').innerHTML=html;
}

function toggleSpoil(btn){
  const ans=btn.nextElementSibling;
  ans.classList.toggle('visible');
  btn.textContent=ans.classList.contains('visible')?'🙈 Masquer':'👁️ Voir la réponse';
}

// ═══════════════════════════════════════════
// DÉS
// ═══════════════════════════════════════════
function selectDice(s){
  S.diceSides=s;
  document.querySelectorAll('.dice-btn').forEach(b=>b.classList.toggle('selected',+b.dataset.sides===s));
  document.getElementById('dice-lbl').textContent=`d${s} — clique pour lancer`;
}

function rollDice(){
  const v=Math.floor(Math.random()*S.diceSides)+1;
  const el=document.getElementById('dice-num');
  el.classList.remove('rolling','crit-high','crit-low');
  void el.offsetWidth;
  el.textContent=v;
  el.classList.add('rolling');
  if(v===S.diceSides) el.classList.add('crit-high');
  else if(v===1) el.classList.add('crit-low');
  el.style.animation='diceShake .45s ease forwards';
  setTimeout(()=>{el.style.animation='';},460);
  document.getElementById('dice-lbl').textContent=v===S.diceSides?`🌟 Critique max ! (d${S.diceSides})`:v===1?`💀 Échec critique (d${S.diceSides})`:`d${S.diceSides}`;
  S.diceRolls.push({s:S.diceSides,v});
  renderCumul();
}

function resetDice(){
  S.diceRolls=[];
  document.getElementById('dice-num').textContent='—';
  document.getElementById('dice-lbl').textContent=`d${S.diceSides} — clique pour lancer`;
  document.getElementById('dice-cumul-wrap').style.display='none';
}

function renderCumul(){
  const w=document.getElementById('dice-cumul-wrap');
  if(!S.diceRolls.length){w.style.display='none';return;}
  w.style.display='';
  const total=S.diceRolls.reduce((s,r)=>s+r.v,0);
  document.getElementById('dice-cumul-table').innerHTML=
    S.diceRolls.map(r=>{
      const isCritH=r.v===r.s, isCritL=r.v===1;
      const col=isCritH?'var(--mint)':isCritL?'var(--pink)':'';
      return `<tr><td class="td-die">d${r.s}</td><td class="td-val" style="color:${col};">${isCritH?'🌟 ':isCritL?'💀 ':''}${r.v}</td></tr>`;
    }).join('')+
    `<tr class="tr-total"><td class="td-die">Total</td><td class="td-val">${total}</td></tr>`;
}

// ═══════════════════════════════════════════
// CODEX
// ═══════════════════════════════════════════
function showCodexTab(tab){
  S.codexTab=tab;
  document.getElementById('codex-content').style.display=tab==='loots'?'':'none';
  document.getElementById('codex-cartes-content').style.display=tab==='cartes'?'':'none';
  document.getElementById('ctab-loots').classList.toggle('active',tab==='loots');
  document.getElementById('ctab-cartes').classList.toggle('active',tab==='cartes');
  document.getElementById('btn-add-loot').style.display=(S.edit&&tab==='loots')?'block':'none';
  if(tab==='cartes') renderCartes();
}

function renderCodex(){
  const data=getData();
  document.getElementById('btn-add-loot').style.display=(S.edit&&S.codexTab==='loots')?'block':'none';
  const cats=[
    {key:'quete',  label:'🔑 Objets de quête', subs:null},
    {key:'arme',   label:'⚔️ Armes',            subs:null},
    {key:'armure', label:'🛡️ Armures',           subs:[{k:'corps',l:'Corps'},{k:'mains',l:'Mains'},{k:'pieds',l:'Pieds'}]},
    {key:'objet',  label:'🎒 Objets (aide narrative)', subs:null},
    {key:'consommable',label:'🧪 Consommables',  subs:[{k:'force',l:'Force (+2 à un jet)'},{k:'chance',l:'Chance (relance un dé)'},{k:'indice',l:'Indice (aide énigme)'}]},
  ];
  let html='';
  cats.forEach(cat=>{
    const items=data.loots.filter(l=>l.cat===cat.key);
    if(!items.length&&!S.edit) return;
    html+=`<div class="codex-section"><div class="section-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>${cat.label}</span>
      ${S.edit?`<button class="btn-sm" style="font-size:11px;" onclick="openLootModal(null,'${cat.key}')">+ Ajouter</button>`:''}
    </div>`;
    if(cat.subs){
      cat.subs.forEach(sub=>{
        const si=items.filter(l=>l.subcat===sub.k);
        if(!si.length&&!S.edit) return;
        html+=`<div class="codex-subsection"><div class="codex-sub-title">${sub.l}</div>
          <div class="codex-grid">${si.map(l=>lootCard(l)).join('')}</div></div>`;
      });
    } else {
      html+=`<div class="codex-grid">${items.map(l=>lootCard(l)).join('')}</div>`;
    }
    html+='</div>';
  });
  document.getElementById('codex-content').innerHTML=html||'<div class="empty-state"><div class="empty-state-icon">🎁</div><p>Aucun loot</p></div>';
}

const LOOT_ICONS={quete:'🔑',arme:'⚔️',armure:'🛡️',objet:'🎒',consommable:'🧪'};
function lootCard(l){
  const meta=[];
  if(l.from) meta.push(`Loot : D${l.from}`);
  if(l.unlock&&l.unlock.length) meta.push(`Débloque : D${l.unlock.join(', D')}`);
  return `<div class="codex-item">
    <div class="codex-item-header">
      <span class="codex-item-icon">${LOOT_ICONS[l.cat]||'📦'}</span>
      <div class="codex-item-name">${l.nom}</div>
      ${S.edit?`<button class="btn-del-sm" onclick="openLootModal('${l.id}')">✏️</button>
      <button class="btn-del-sm" onclick="askDel('loot','${l.id}')">🗑️</button>`:''}
    </div>
    ${l.bonus?`<div class="codex-item-bonus">${l.bonus}</div>`:''}
    <div class="codex-item-desc">${l.desc||''}</div>
    ${meta.length?`<div class="codex-item-meta">${meta.map(m=>`<span class="codex-meta-pill">${m}</span>`).join('')}</div>`:''}
  </div>`;
}

// ═══════════════════════════════════════════
// RÈGLES
// ═══════════════════════════════════════════
function renderRules(){
  const data=getData();
  const rules=data.rules||buildDefaultRules();
  const c=document.getElementById('rules-content');
  if(S.edit){
    c.innerHTML=rules.map(r=>`<div class="rule-block">
      <input class="rule-edit-input" value="${r.titre.replace(/"/g,'&quot;')}" onchange="updateRule('${r.id}','titre',this.value)">
      <textarea class="rule-edit-area" onchange="updateRule('${r.id}','corps',this.value)">${r.corps}</textarea>
    </div>`).join('');
  } else {
    c.innerHTML=rules.map(r=>`<div class="rule-block">
      <div class="rule-title">${r.titre}</div>
      <div class="rule-body">${r.corps}</div>
    </div>`).join('');
  }
}

function updateRule(id,field,val){
  const data=getData();
  if(!data.rules) data.rules=buildDefaultRules();
  const r=data.rules.find(x=>x.id===id);
  if(r){r[field]=val;saveData(data);}
}

// ═══════════════════════════════════════════
// CRUD AVENTURE
// ═══════════════════════════════════════════
function openAvModal(id){
  S.editAvId=id||null;
  const data=getData();
  const av=id?data.aventures.find(a=>a.id===id):null;
  document.getElementById('av-nom').value=av?av.nom:'';
  document.getElementById('av-scenario').value=av?(av.scenario||''):'';
  document.getElementById('modal-av-title').textContent=av?'Modifier':'Nouvelle aventure';
  openModal('modal-av');
}

function saveAv(){
  const nom=document.getElementById('av-nom').value.trim();
  if(!nom) return alert('Nom requis');
  const data=getData();
  if(S.editAvId){
    const av=data.aventures.find(a=>a.id===S.editAvId);
    av.nom=nom;
    av.scenario=document.getElementById('av-scenario').value;
  } else {
    data.aventures.push({id:'av_'+Date.now(),nom,scenario:document.getElementById('av-scenario').value,donjons:[]});
  }
  saveData(data);closeModal('modal-av');renderAventures();
}

// ═══════════════════════════════════════════
// CRUD DONJON
// ═══════════════════════════════════════════
function openDjModal(num){
  const data=getData();
  const av=data.aventures.find(a=>a.id===S.avId);
  const dj=num&&av?(av.donjons||[]).find(d=>d.num===num):null;
  const f=id=>document.getElementById(id);

  f('dj-num').value=num||'';
  f('dj-num').disabled=!!dj;
  f('dj-titre').value=dj?dj.titre:'';
  f('dj-conte').value=dj?(dj.conte||''):'';
  f('dj-theme').value=dj?(dj.theme||''):'';
  f('dj-intro').value=dj?(dj.intro||''):'';
  f('dj-c1-nom').value=dj&&dj.c1?(dj.c1.nom||''):'';
  f('dj-c1-narration').value=dj&&dj.c1?(dj.c1.narration||''):'';
  f('dj-c1-apres').value=dj&&dj.c1?(dj.c1.apres||''):'';
  document.getElementById('dj-c1-piochage').value=dj&&dj.c1&&dj.c1.piochage!==undefined?dj.c1.piochage:1;
  f('dj-c2-nom').value=dj&&dj.c2?(dj.c2.nom||''):'';
  f('dj-c2-narration').value=dj&&dj.c2?(dj.c2.narration||''):'';
  f('dj-c2-enigme').value=dj&&dj.c2?(dj.c2.enigme||''):'';
  f('dj-c2-reponse').value=dj&&dj.c2?(dj.c2.reponse||''):'';
  f('dj-c2-apres').value=dj&&dj.c2?(dj.c2.apres||''):'';
  document.getElementById('dj-c2-piochage').value=dj&&dj.c2&&dj.c2.piochage!==undefined?dj.c2.piochage:1;
  f('dj-c3-nom').value=dj&&dj.c3?(dj.c3.nom||''):'';
  f('dj-c3-narration').value=dj&&dj.c3?(dj.c3.narration||''):'';
  f('dj-c3-verite').value=dj&&dj.c3?(dj.c3.verite||''):'';
  f('dj-c3-apres').value=dj&&dj.c3?(dj.c3.apres||''):'';
  f('dj-fin').value=dj?(dj.fin||''):'';
  document.getElementById('modal-dj-title').textContent=dj?`Modifier Donjon ${num}`:`Nouveau Donjon${num?' '+num:''}`;
  openModal('modal-dj');
}

function saveDj(){
  const num=parseInt(document.getElementById('dj-num').value);
  const titre=document.getElementById('dj-titre').value.trim();
  if(!num||!titre) return alert('Numéro et titre requis');
  const f=id=>document.getElementById(id).value;
  const dj={
    num,titre,
    conte:f('dj-conte'),
    theme:f('dj-theme'),
    intro:f('dj-intro'),
    c1:{nom:f('dj-c1-nom'),narration:f('dj-c1-narration'),apres:f('dj-c1-apres'),piochage:parseInt(document.getElementById('dj-c1-piochage').value)||1},
    c2:{nom:f('dj-c2-nom'),narration:f('dj-c2-narration'),enigme:f('dj-c2-enigme'),reponse:f('dj-c2-reponse'),apres:f('dj-c2-apres'),piochage:parseInt(document.getElementById('dj-c2-piochage').value)||1},
    c3:{nom:f('dj-c3-nom'),narration:f('dj-c3-narration'),verite:f('dj-c3-verite'),apres:f('dj-c3-apres')},
    fin:f('dj-fin')
  };
  const data=getData();
  const av=data.aventures.find(a=>a.id===S.avId);
  if(!av) return;
  if(!av.donjons) av.donjons=[];
  const idx=av.donjons.findIndex(d=>d.num===num);
  if(idx!==-1) av.donjons[idx]=dj; else av.donjons.push(dj);
  saveData(data);closeModal('modal-dj');showDonjons(S.avId);
}

// ═══════════════════════════════════════════
// CRUD LOOT
// ═══════════════════════════════════════════
function openLootModal(id,defaultCat){
  const data=getData();
  const l=id?data.loots.find(x=>x.id===id):null;
  document.getElementById('lt-id').value=l?l.id:'';
  document.getElementById('lt-id').disabled=!!l;
  document.getElementById('lt-nom').value=l?l.nom:'';
  document.getElementById('lt-cat').value=l?l.cat:(defaultCat||'quete');
  document.getElementById('lt-bonus').value=l?(l.bonus||''):'';
  document.getElementById('lt-desc').value=l?(l.desc||''):'';
  document.getElementById('lt-from').value=l?(l.from||''):'';
  document.getElementById('lt-unlock').value=l&&l.unlock?l.unlock.join(', '):'';
  document.getElementById('lt-subcat').value=l?(l.subcat||''):'';
  document.getElementById('modal-loot-title').textContent=l?'Modifier':'Nouveau loot';
  updateLootFields();
  openModal('modal-loot');
}

function updateLootFields(){
  const cat=document.getElementById('lt-cat').value;
  document.getElementById('lt-quete-fields').style.display=cat==='quete'?'':'none';
  const sg=document.getElementById('lt-subcat-grp');
  sg.style.display=(cat==='armure'||cat==='consommable')?'':'none';
  const sel=document.getElementById('lt-subcat');
  if(cat==='armure') sel.innerHTML='<option value="corps">Corps</option><option value="mains">Mains</option><option value="pieds">Pieds</option>';
  else if(cat==='consommable') sel.innerHTML='<option value="force">Force</option><option value="chance">Chance</option><option value="indice">Indice</option>';
}

function saveLoot(){
  const id=document.getElementById('lt-id').value.trim();
  const nom=document.getElementById('lt-nom').value.trim();
  if(!id||!nom) return alert('ID et nom requis');
  const cat=document.getElementById('lt-cat').value;
  const l={id,nom,cat,bonus:document.getElementById('lt-bonus').value.trim(),desc:document.getElementById('lt-desc').value.trim()};
  if(cat==='quete'){
    l.from=parseInt(document.getElementById('lt-from').value)||null;
    l.unlock=document.getElementById('lt-unlock').value.split(',').map(s=>parseInt(s.trim())).filter(Boolean);
  }
  if(cat==='armure'||cat==='consommable') l.subcat=document.getElementById('lt-subcat').value;
  const data=getData();
  const idx=data.loots.findIndex(x=>x.id===id);
  if(idx!==-1) data.loots[idx]=l; else data.loots.push(l);
  saveData(data);closeModal('modal-loot');renderCodex();
}

// ═══════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════
function askDel(type,id){
  const msgs={aventure:'Supprimer cette aventure et tous ses donjons ?',donjon:`Supprimer le donjon ${id} ?`,loot:'Supprimer ce loot ?'};
  document.getElementById('confirm-msg').textContent=msgs[type]||'Supprimer ?';
  S.delCb=()=>{
    const data=getData();
    if(type==='aventure') data.aventures=data.aventures.filter(a=>a.id!==id);
    else if(type==='donjon'){const av=data.aventures.find(a=>a.id===S.avId);if(av)av.donjons=(av.donjons||[]).filter(d=>d.num!==id);}
    else if(type==='loot') data.loots=data.loots.filter(l=>l.id!==id);
    saveData(data);
    if(type==='aventure') renderAventures();
    else if(type==='donjon') showDonjons(S.avId);
    else if(type==='loot') renderCodex();
  };
  openModal('modal-confirm');
}

function confirmDel(){if(S.delCb)S.delCb();S.delCb=null;closeModal('modal-confirm');}

// ═══════════════════════════════════════════
// PRÉREQUIS DONJON
// ═══════════════════════════════════════════
function openPrereqModal(avId, num, reqNums){
  const data = getData();
  const list = document.getElementById('prereq-list');
  list.innerHTML = reqNums.map(r => {
    const loot = data.loots.find(l => l.cat === 'quete' && l.from === r);
    return `<div style="display:flex;align-items:center;gap:10px;background:rgba(255,121,198,.06);border:1px solid rgba(255,121,198,.25);border-radius:10px;padding:10px 14px;">
      <span style="font-size:18px;">🗝️</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">${loot ? loot.nom : 'Objet du donjon ' + r}</div>
        <div style="font-size:11px;color:var(--text-dim);">Loot du donjon ${r}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('prereq-confirm-btn').onclick = () => {
    closeModal('modal-prereq');
    showDonjon(avId, num);
  };
  openModal('modal-prereq');
}

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('visible');}
function closeModal(id){document.getElementById(id).classList.remove('visible');}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('visible');}));

// ═══════════════════════════════════════════
// EXPORT / IMPORT GLOBAL AVENTURE
// ═══════════════════════════════════════════
function exportAventure(){
  const data=getData();
  const av=data.aventures.find(a=>a.id===S.avId);
  if(!av){alert('Aventure introuvable.');return;}
  const json=JSON.stringify(av,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safeName=av.nom.replace(/[^a-z0-9]/gi,'_').toLowerCase();
  a.href=url;
  a.download=`aventure_${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importAventureFile(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const av=JSON.parse(e.target.result);
      if(!av.nom||!av.id) throw new Error('"nom" et "id" requis');
      const data=getData();
      const idx=data.aventures.findIndex(a=>a.id===av.id);
      if(idx!==-1){
        if(!confirm(`L'aventure "${av.nom}" existe déjà. Écraser ?`)) return;
        data.aventures[idx]=av;
      } else {
        data.aventures.push(av);
      }
      saveData(data);
      alert(`✅ Aventure "${av.nom}" importée avec ${(av.donjons||[]).length} donjon(s).`);
      showDonjons(av.id);
    } catch(err){
      alert('❌ JSON invalide : '+err.message);
    }
    input.value='';
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════
// IMPORT JSON DONJONS
// ═══════════════════════════════════════════
function openImportModal(){
  document.getElementById('import-json-input').value='';
  document.getElementById('import-feedback').textContent='';
  openModal('modal-import');
}

function importDonjonsFile(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById('import-json-input').value=e.target.result;
    importDonjons();
  };
  reader.readAsText(file);
  input.value='';
}

function importDonjons(){
  const raw=document.getElementById('import-json-input').value.trim();
  const fb=document.getElementById('import-feedback');
  if(!raw){fb.textContent='❌ Rien à importer.';fb.style.color='var(--pink)';return;}

  let donjons;
  try{
    const parsed=JSON.parse(raw);
    donjons=Array.isArray(parsed)?parsed:[parsed];
  } catch(e){
    fb.textContent='❌ JSON invalide : '+e.message;
    fb.style.color='var(--pink)';
    return;
  }

  const invalid=donjons.filter(d=>!d.num||!d.titre);
  if(invalid.length){
    fb.textContent=`❌ ${invalid.length} donjon(s) sans "num" ou "titre".`;
    fb.style.color='var(--pink)';
    return;
  }

  const data=getData();
  const av=data.aventures.find(a=>a.id===S.avId);
  if(!av){fb.textContent='❌ Aventure introuvable.';fb.style.color='var(--pink)';return;}
  if(!av.donjons) av.donjons=[];

  let added=0, replaced=0;
  donjons.forEach(dj=>{
    const num=parseInt(dj.num);
    const idx=av.donjons.findIndex(d=>d.num===num);
    const clean={
      num,
      titre:dj.titre||'',
      conte:dj.conte||'',
      theme:dj.theme||'',
      intro:dj.intro||'',
      c1:{nom:(dj.c1&&dj.c1.nom)||'',narration:(dj.c1&&dj.c1.narration)||'',apres:(dj.c1&&dj.c1.apres)||'',piochage:(dj.c1&&dj.c1.piochage)||1},
      c2:{nom:(dj.c2&&dj.c2.nom)||'',narration:(dj.c2&&dj.c2.narration)||'',enigme:(dj.c2&&dj.c2.enigme)||'',reponse:(dj.c2&&dj.c2.reponse)||'',apres:(dj.c2&&dj.c2.apres)||'',piochage:(dj.c2&&dj.c2.piochage)||1},
      c3:{nom:(dj.c3&&dj.c3.nom)||'',narration:(dj.c3&&dj.c3.narration)||'',verite:(dj.c3&&dj.c3.verite)||'',apres:(dj.c3&&dj.c3.apres)||''},
      fin:dj.fin||''
    };
    if(idx!==-1){av.donjons[idx]=clean;replaced++;}
    else{av.donjons.push(clean);added++;}
  });

  av.donjons.sort((a,b)=>a.num-b.num);
  saveData(data);

  const msg=`✅ Import réussi — ${added} ajouté(s), ${replaced} écrasé(s).`;
  fb.textContent=msg;
  fb.style.color='var(--mint)';

  setTimeout(()=>{
    closeModal('modal-import');
    showDonjons(S.avId);
  },1200);
}

// ═══════════════════════════════════════════
// CARTES À IMPRIMER
// ═══════════════════════════════════════════
const CAT_COLORS={
  quete:  {border:'#ff79c6', bg:'rgba(255,121,198,.07)', label:'Objet de quête'},
  arme:   {border:'#ff5555', bg:'rgba(255,85,85,.07)',   label:'Arme'},
  armure: {border:'#bd93f9', bg:'rgba(189,147,249,.07)', label:'Armure'},
  objet:  {border:'#8be9fd', bg:'rgba(139,233,253,.07)', label:'Objet'},
  consommable:{border:'#50fa7b',bg:'rgba(80,250,123,.07)',label:'Consommable'},
};

function renderCartes(){
  const data=getData();
  const container=document.getElementById('codex-cartes-content');
  let html=`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
    <button class="btn" onclick="printCartes()">🖨️ Imprimer la sélection</button>
    <button class="btn secondary" onclick="toggleAllCartes(true)">✅ Tout sélectionner</button>
    <button class="btn secondary" onclick="toggleAllCartes(false)">☐ Tout désélectionner</button>
    <span id="cartes-count" style="font-size:12px;color:var(--text-dim);"></span>
  </div>`;

  const cats=[
    {key:'quete',label:'🔑 Objets de quête'},
    {key:'arme',label:'⚔️ Armes'},
    {key:'armure',label:'🛡️ Armures',subs:[{k:'corps',l:'Corps'},{k:'mains',l:'Mains'},{k:'pieds',l:'Pieds'}]},
    {key:'objet',label:'🎒 Objets'},
    {key:'consommable',label:'🧪 Consommables',subs:[{k:'force',l:'Force'},{k:'chance',l:'Chance'},{k:'indice',l:'Indice'}]},
  ];

  cats.forEach(cat=>{
    const items=data.loots.filter(l=>l.cat===cat.key);
    if(!items.length) return;
    html+=`<div class="codex-section">
      <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;">
        <span>${cat.label}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm" style="font-size:11px;" onclick="toggleCatCartes('${cat.key}',true)">✅</button>
          <button class="btn-sm" style="font-size:11px;" onclick="toggleCatCartes('${cat.key}',false)">☐</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
        ${items.map(l=>`
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:7px 12px;font-size:12px;transition:all .15s;" class="carte-toggle-label" data-id="${l.id}">
            <input type="checkbox" class="carte-check" data-id="${l.id}" data-cat="${l.cat}" onchange="updateCartesCount()" style="accent-color:var(--purple);width:14px;height:14px;">
            <span>${LOOT_ICONS[l.cat]||'📦'} ${l.nom}</span>
          </label>`).join('')}
      </div>
    </div>`;
  });

  container.innerHTML=html;
  updateCartesCount();
}

function updateCartesCount(){
  const checked=[...document.querySelectorAll('.carte-check:checked')].length;
  const total=document.querySelectorAll('.carte-check').length;
  document.getElementById('cartes-count').textContent=`${checked} / ${total} sélectionné(s)`;
}

function toggleAllCartes(val){
  document.querySelectorAll('.carte-check').forEach(c=>{c.checked=val;});
  updateCartesCount();
}

function toggleCatCartes(cat,val){
  document.querySelectorAll(`.carte-check[data-cat="${cat}"]`).forEach(c=>{c.checked=val;});
  updateCartesCount();
}

function printCartes(){
  const data=getData();
  const selected=[...document.querySelectorAll('.carte-check:checked')].map(c=>c.dataset.id);
  if(!selected.length){alert('Sélectionne au moins une carte.');return;}
  const loots=selected.map(id=>data.loots.find(l=>l.id===id)).filter(Boolean);

  const cardsHtml=loots.map(l=>{
    const c=CAT_COLORS[l.cat]||{border:'#ccc',bg:'#fff',label:l.cat};
    return `<div class="print-card" style="border-color:${c.border};background:white;">
      <div class="print-card-name">${l.nom}</div>
      <div class="print-card-art"></div>
      <div class="print-card-footer">
        <span class="print-card-type" style="color:${c.border};">${c.label}</span>
        <span class="print-card-bonus">${l.bonus||''}</span>
      </div>
    </div>`;
  }).join('');

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cartes</title>
  <style>
    @page{size:A4 portrait;margin:1cm;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:white;font-family:'Nunito',sans-serif;}
    .cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:8px;}
    .print-card{border:3px solid #ccc;border-radius:12px;padding:10px;width:100%;aspect-ratio:2.5/3.5;display:flex;flex-direction:column;gap:0;page-break-inside:avoid;position:relative;background:white;}
    .print-card-name{font-family:'Quicksand',sans-serif;font-size:13px;font-weight:700;text-align:center;padding:6px 4px 8px;border-bottom:1px solid rgba(0,0,0,.1);line-height:1.3;}
    .print-card-art{flex:1;border:1px dashed rgba(0,0,0,.15);border-radius:6px;margin:8px 4px;}
    .print-card-footer{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 2px;border-top:1px solid rgba(0,0,0,.1);font-size:10px;font-weight:700;gap:4px;}
    .print-card-type{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
    .print-card-bonus{font-size:10px;color:#333;font-weight:700;text-align:right;}
    @media print{body{margin:0;}}
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@700&family=Nunito:wght@700&display=swap" rel="stylesheet">
  </head><body>
  <div class="cards-grid">${cardsHtml}</div>
  <script>window.onload=()=>window.print();</'+'script>
  </body></html>`);
  win.document.close();
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function initFirebase(){
  if(!window.FirestoreService) return;
  try{
    if(window.firebaseConfig) FirestoreService.init(window.firebaseConfig);
    await FirestoreService.loadAdminPassword();
  }catch(e){ console.warn('Init Firebase aventure:', e); }
}

async function loadDataFromFirebase(){
  if(!window.FirestoreService || !FirestoreService.initialized) return null;
  try{
    const doc = await FirestoreService.getAventureData();
    if(doc) return doc;
    return null;
  }catch(e){ console.warn('Erreur lecture Firebase aventure:', e); return null; }
}

(async () => {
  if (typeof initFirebase === 'function'){
    try{ await initFirebase(); }catch(e){ console.warn('initFirebase failed:',e); }
  } else { console.warn('initFirebase not available'); }
  const fbData = (typeof loadDataFromFirebase === 'function') ? await loadDataFromFirebase() : null;
  if (fbData) aventureDataCache = fbData;
  renderAventures();
  updateModeBtn();
  console.log('🎮 Aventure app prête (Firebase enabled)');
})();

