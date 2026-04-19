/**
 * QUIZZONE - APPLICATION PRINCIPALE
 * Module core: stockage, initialisation, navigation, gestion des quizzes
 * Modules externes: vocab-module.js, results-module.js
 */

// ============================================================================
// CONFIGURATION ET CONSTANTES GLOBALES
// ============================================================================

const STORAGE_PREFIX = 'qz_';
const VALID_TYPES = ['single', 'multiple', 'word', 'text'];
const DEFAULT_USERS = ['Zoé', 'Timéo', 'Tom', 'Noé'];

/** Quiz tutoriel par défaut */
const TUTORIAL_QUIZ = {
  id: '__tutorial__',
  title: '🎓 Tutoriel — Comment utiliser QuizZone',
  subject: 'Tutoriel',
  description: 'Apprends à utiliser QuizZone avec ce quiz de démonstration. Tu peux le refaire autant de fois que tu veux !',
  isTutorial: true,
  replay: true,
  questions: [
    { id: 1, type: 'single', text: '🎯 Question à choix UNIQUE — Une seule bonne réponse. Quelle est la capitale de la France ?', options: ['Londres', 'Berlin', 'Paris', 'Madrid'], correct: [2], explanation: 'Paris est la capitale de la France depuis le Xe siècle.' },
    { id: 2, type: 'multiple', text: '☑️ Question à choix MULTIPLES — Plusieurs réponses possibles ! Quels sont des mammifères ?', options: ['Dauphin', 'Requin', 'Baleine', 'Truite'], correct: [0, 2], explanation: 'Le dauphin et la baleine sont des mammifères marins. Le requin et la truite sont des poissons.' },
    { id: 3, type: 'word', text: '✏️ Question MOT — Tape la réponse courte dans le champ. Quel animal fait "miaou" ?', options: [], correct: ['chat', 'le chat', 'un chat'], explanation: 'Le chat (ou "le chat" / "un chat") est la bonne réponse. La casse et les espaces sont ignorés.' },
    { id: 4, type: 'single', text: '🔢 Combien font 7 × 8 ?', options: ['54', '56', '48', '64'], correct: [1], explanation: '7 × 8 = 56. Une bonne table de multiplication !' },
    { id: 5, type: 'multiple', text: '🌍 Quels pays font partie de l\'Union Européenne ?', options: ['Allemagne', 'Norvège', 'Italie', 'Suisse'], correct: [0, 2], explanation: 'L\'Allemagne et l\'Italie sont membres de l\'UE. La Norvège et la Suisse ne le sont pas.' },
    { id: 6, type: 'word', text: '🧪 Quel est le symbole chimique de l\'eau ?', options: [], correct: ['h2o', 'h₂o'], explanation: 'H2O est la formule chimique de l\'eau : 2 atomes d\'hydrogène + 1 atome d\'oxygène.' },
    { id: 7, type: 'text', text: '📝 Question TEXTE (correction manuelle) — En quelques mots, explique pourquoi le ciel est bleu.', options: [], correct: [], explanation: 'Réponse attendue : diffusion de Rayleigh — les courtes longueurs d\'onde (bleu) sont plus diffusées par l\'atmosphère que les grandes (rouge).' }
  ]
};

let tutorialQuiz = TUTORIAL_QUIZ;

// ============================================================================
// STORAGE ET STATE GLOBAUX
// ============================================================================

/** Référence DOM raccourcie */
const $ = id => document.getElementById(id);

/** Store localStorage avec prefix pour isolation */
const store = {
  get(key) { 
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)); } 
    catch { return null; } 
  },
  set(key, value) { 
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); 
  }
};

/** État global de l'application */
const state = { 
  currentQuiz: null, 
  currentUser: '', 
  currentAnswers: [], 
  currentIndex: 0, 
  adminLoggedIn: false 
};


// ============================================================================
// FIREBASE
// ============================================================================

let firebaseEnabled = false;

/**
 * Initialise le stockage Firebase si disponible
 */
async function initFirebaseStorage() {
  if (!window.FirestoreService) {
    console.warn('Firebase service non chargé.');
    return;
  }
  try {
    const config = window.firebaseConfig;
    if (!config || !config.projectId) {
      console.warn('Firebase config manquante. Complète firebase-service.js avec ta configuration.');
      return;
    }
    FirestoreService.init(config);
    firebaseEnabled = true;
    console.log('✅ Firebase connecté avec succès');
    await loadRemoteData();
    console.log('✅ Données chargées depuis Firebase');
  } catch (error) {
    console.warn('❌ Impossible de se connecter à Firebase :', error);
    firebaseEnabled = false;
  }
}

/**
 * Nettoie un ID pour Firebase (alphanumeric, tirets, underscores)
 */
function sanitizeDocId(value) {
  return (value || '').toString().trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase() || `id-${Date.now()}`;
}

/**
 * Charge les données depuis Firebase et met à jour le localStorage
 */
async function loadRemoteData() {
  if (!firebaseEnabled) return;
  try {
    const [usersDocs, quizzesDocs, resultsDocs, vocabDocs] = await Promise.all([
      FirestoreService.getCollection('users'),
      FirestoreService.getCollection('quizzes'),
      FirestoreService.getCollection('results'),
      FirestoreService.getCollection('vocab_words')
    ]);

    const adminDoc = await FirestoreService.getDoc('settings', 'admin');
    if (adminDoc && adminDoc.admin_pwd) {
      store.set('admin_pwd', adminDoc.admin_pwd);
    }

    if (usersDocs.length) {
      const users = usersDocs.map(doc => doc.name).filter(Boolean);
      if (users.length) store.set('users', users);
    }
    if (quizzesDocs.length) {
      const quizzes = quizzesDocs.map(doc => {
        const { id, ...data } = doc;
        return { id, ...data };
      });
      store.set('quizzes', quizzes);
    }
    if (resultsDocs.length) {
      const results = resultsDocs.map(doc => {
        const { id, ...data } = doc;
        return { id, ...data };
      });
      store.set('results', results);
    }
    if (vocabDocs.length) {
      const vocab = vocabDocs.map(doc => {
        const { id, ...data } = doc;
        return data;
      });
      store.set('vocab', vocab);
    }
  } catch (error) {
    console.warn('Erreur lecture Firebase :', error);
  }
}

/**
 * Exécute une action Firebase en toute sécurité (gère si Firebase est désactivé)
 */
function safeFirebaseAction(action, label) {
  if (!firebaseEnabled) {
    console.log('🔄 Firebase désactivé, action ignorée:', label);
    return;
  }
  action().catch(error => console.warn(`❌ ${label} :`, error));
}

// Sync functions
async function syncUsersToFirebase() {
  if (!firebaseEnabled) return;
  const users = store.get('users') || [];
  const docs = users.map(name => ({ id: sanitizeDocId(name), name }));
  await FirestoreService.batchSet('users', docs);
}

async function syncQuizToFirebase(quiz) {
  if (!firebaseEnabled || !quiz || !quiz.id) return;
  await FirestoreService.setDoc('quizzes', quiz.id, quiz);
}

async function deleteQuizFromFirebase(quizId) {
  if (!firebaseEnabled || !quizId) return;
  await FirestoreService.deleteDoc('quizzes', quizId);
}

async function syncResultToFirebase(result) {
  if (!firebaseEnabled || !result || !result.id) return;
  await FirestoreService.setDoc('results', result.id, result);
}

async function deleteResultFromFirebase(resultId) {
  if (!firebaseEnabled || !resultId) return;
  await FirestoreService.deleteDoc('results', resultId);
}

async function deleteUserFromFirebase(name) {
  if (!firebaseEnabled || !name) return;
  await FirestoreService.deleteDoc('users', sanitizeDocId(name));
}

async function syncAdminPasswordToFirebase() {
  if (!firebaseEnabled) return;
  await FirestoreService.setDoc('settings', 'admin', { admin_pwd: store.get('admin_pwd') });
}

// ============================================================================
// INITIALISATION STOCKAGE
// ============================================================================

/**
 * Initialise le localStorage avec les données par défaut si vides
 */
function initStore() {
  if (!store.get('users')) store.set('users', DEFAULT_USERS);
  if (!store.get('quizzes')) store.set('quizzes', []);
  if (!store.get('results')) store.set('results', []);
  if (!store.get('admin_pwd')) store.set('admin_pwd', 'admin');
  if (!store.get('vocab')) store.set('vocab', []);
}

/**
 * Charge le quiz tutoriel depuis le fichier quiz-model.json si disponible
 */
async function loadTutorialQuiz() {
  try {
    const response = await fetch('quiz-model.json');
    if (!response.ok) throw new Error('Fichier quiz-model.json introuvable');
    const data = await response.json();
    if (data && Array.isArray(data.questions) && data.questions.length > 0) {
      tutorialQuiz = {
        ...data,
        id: '__tutorial__',
        isTutorial: true,
        replay: true,
        title: data.title || '🎓 Tutoriel — Quiz modèle',
        subject: data.subject || 'Tutoriel',
        description: data.description || 'Quiz de démonstration généré depuis quiz-model.json.'
      };
    }
  } catch (error) {
    console.warn('⚠️ Impossible de charger quiz-model.json pour le tutoriel :', error);
    tutorialQuiz = TUTORIAL_QUIZ;
  }
}



function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

function showModal(id) { $(id).style.display = 'flex'; }
function closeModal(id) { $(id).style.display = 'none'; }
function goHome() { renderHome(); showPage('page-home'); }

function renderHome() {
  const users = store.get('users') || [];
  const select = $('user-select');
  select.innerHTML = '<option value="">-- Sélectionne ton prénom --</option>';
  users.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.appendChild(option); });
  $('quiz-list-wrap').style.display = 'none';
}

function normalizeString(value) { return (value || '').toString().trim().toLowerCase(); }
function quizBelongsToUser(quiz, user) {
  const target = normalizeString(quiz.for);
  const selected = normalizeString(user);
  return !target || target === 'tout le monde' || target === 'tous' || target === selected;
}
function isReplayableQuiz(quiz) { return !!quiz.isTutorial || !!quiz.replay; }

function getResultScore(result) {
  if (!result) return null;
  const pct = result.maxScore > 0 ? Math.round(result.score / result.maxScore * 100) : null;
  return result.hasPending ? (pct !== null ? `${result.score}/${result.maxScore} ⏳` : '⏳') : (pct !== null ? `${result.score}/${result.maxScore} (${pct}%)` : null);
}

function validateQuizData(data) {
  if (!data || typeof data !== 'object') throw new Error('Quiz invalide.');
  if (!data.title || typeof data.title !== 'string') throw new Error('Le quiz doit avoir un titre.');
  if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('Le quiz doit contenir au moins une question.');

  const textCount = data.questions.filter(q => q.type === 'text').length;
  if (textCount > 1) throw new Error('Un quiz ne peut contenir qu\'une seule question de type "text".');

  data.questions.forEach((question, index) => {
    if (!question || typeof question !== 'object') throw new Error(`Question ${index + 1} invalide.`);
    if (!VALID_TYPES.includes(question.type)) throw new Error(`Type inconnu pour la question ${index + 1} : ${question.type}.`);
    if (!question.text || typeof question.text !== 'string') throw new Error(`La question ${index + 1} doit contenir du texte.`);
    if (['single', 'multiple'].includes(question.type)) {
      if (!Array.isArray(question.options) || question.options.length < 2) throw new Error(`La question ${index + 1} doit posséder au moins 2 options.`);
      if (!Array.isArray(question.correct) || question.correct.length === 0) throw new Error(`La question ${index + 1} doit indiquer la ou les bonnes réponses.`);
    }
    if (question.type === 'word' && (!Array.isArray(question.correct) || question.correct.length === 0)) {
      throw new Error(`La question ${index + 1} de type "word" doit contenir des réponses acceptées.`);
    }
    if (question.type === 'text' && question.correct && question.correct.length > 0) {
      throw new Error(`La question ${index + 1} de type "text" ne doit pas contenir de bonnes réponses.`);
    }
  });

  return data;
}

function saveQuiz(data) {
  const quizzes = store.get('quizzes') || [];
  data.id = 'quiz_' + Date.now();
  quizzes.push(data);
  store.set('quizzes', quizzes);
  safeFirebaseAction(() => syncQuizToFirebase(data), 'Erreur sauvegarde quiz Firebase');
}

function deleteQuizById(id) {
  const quizzes = (store.get('quizzes') || []).filter(quiz => quiz.id !== id);
  store.set('quizzes', quizzes);
  safeFirebaseAction(() => deleteQuizFromFirebase(id), 'Erreur suppression quiz Firebase');
}

function importQuizFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const json = JSON.parse(event.target.result);
      saveQuiz(validateQuizData(json));
      alert(`✅ Quiz "${json.title}" importé avec succès !`);
      renderAdminAndHome();
    } catch (error) {
      alert(`❌ Import impossible : ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function importQuizFromJsonText(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const json = JSON.parse(cleaned);
  saveQuiz(validateQuizData(json));
  renderAdminAndHome();
}

function renderQuizList(user) {
  const listWrap = $('quiz-list-wrap');
  const listEl = $('quiz-list');
  const quizzes = store.get('quizzes') || [];
  const results = store.get('results') || [];
  const hideDone = $('hide-done-quizzes')?.checked;
  const hideOthers = $('hide-others-quizzes')?.checked;

  const entries = quizzes.map(quiz => {
    const forMe = quizBelongsToUser(quiz, user);
    const doneResult = results.filter(r => r.user === user && r.quizId === quiz.id && r.finished).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return { quiz, forMe, done: !!doneResult, doneResult, isReplayable: isReplayableQuiz(quiz) };
  });

  const sorted = [
    ...entries.filter(item => item.forMe && !item.done),
    ...entries.filter(item => !item.forMe && !item.done),
    { quiz: tutorialQuiz, forMe: true, done: false, doneResult: null, isReplayable: true, isTutorial: true },
    ...entries.filter(item => item.done && !item.isReplayable).sort((a, b) => new Date(b.doneResult.date) - new Date(a.doneResult.date)),
    ...entries.filter(item => item.done && item.isReplayable).sort((a, b) => new Date(b.doneResult.date) - new Date(a.doneResult.date))
  ];

  let visible = sorted;
  if (hideDone) visible = visible.filter(item => !item.done);
  if (hideOthers) visible = visible.filter(item => item.forMe || item.isTutorial);
  
  listEl.innerHTML = '';
  if (!user) { listWrap.style.display = 'none'; $('quiz-selection-count').textContent = ''; return; }
  listWrap.style.display = 'block';
  
  let countMsg = `${visible.length} quiz affiché(s)`;
  const filters = [];
  if (hideDone) filters.push('quiz déjà faits masqués');
  if (hideOthers) filters.push('quiz des autres masqués');
  if (filters.length > 0) countMsg += ` · ${filters.join(', ')}`;
  $('quiz-selection-count').textContent = countMsg;

  if (visible.length === 1 && visible[0].isTutorial) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-info';
    msg.textContent = 'Aucun quiz disponible. Importe un fichier JSON ou utilise le Prompt IA pour en créer un.';
    listEl.appendChild(msg);
  }

  visible.forEach(entry => {
    const { quiz, forMe, done, doneResult, isReplayable, isTutorial } = entry;
    const div = document.createElement('div');
    let classes = 'quiz-item';
    if (isTutorial) classes += ' tuto';
    else if (done && !isReplayable) classes += ' locked quiz-done';
    else if (!forMe) classes += ' quiz-not-mine';
    else classes += ' quiz-mine';

    const scoreLabel = getResultScore(doneResult);
    const scoreHtml = done && scoreLabel ? `<div style="font-size:12px;font-weight:700;margin-top:3px;color:var(--muted);">Score : ${scoreLabel}</div>` : '';
    const dateHtml = doneResult ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">Fait le ${new Date(doneResult.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>` : '';

    let badgeClass = 'badge-open';
    let badgeText = '🚀 Commencer';
    if (isTutorial) { badgeClass = 'badge-tuto'; badgeText = '🎓 Tuto'; }
    else if (done && !isReplayable) { badgeClass = 'badge-done'; badgeText = '✅ Fait'; }
    else if (done && isReplayable) { badgeClass = 'badge-open'; badgeText = '🔁 Refaire'; }
    else if (!forMe) { badgeClass = 'badge-notme'; badgeText = '👤 Pas pour moi'; }

    const forTag = quiz.for && !isTutorial
      ? `<span class="quiz-for-tag" style="font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700;margin-left:6px;${forMe ? 'background:#d4edda;color:#155724;' : 'background:#f8d7da;color:#721c24;'}">👤 ${quiz.for}</span>`
      : '';

    div.className = classes;
    div.innerHTML = `<div style="flex:1;min-width:0;">
      <div class="quiz-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">${quiz.title}${forTag}</div>
      <div class="quiz-meta">${quiz.questions.length} question${quiz.questions.length > 1 ? 's' : ''} · ${quiz.subject || 'Général'}${(isTutorial || isReplayable) ? ' · ∞ rejouable' : ''}</div>
      ${scoreHtml}${dateHtml}
    </div>
    <div class="badge ${badgeClass}" style="margin-left:10px;flex-shrink:0;">${badgeText}</div>`;

    if (!done || isTutorial || isReplayable) {
      div.addEventListener('click', () => startQuiz(quiz, state.currentUser));
    }
    listEl.appendChild(div);
  });
}

function onUserChange() {
  state.currentUser = $('user-select').value;
  renderQuizList(state.currentUser);
}

function startQuiz(quiz, user) {
  state.currentQuiz = quiz;
  state.currentUser = user;
  state.currentAnswers = quiz.questions.map(() => ({ selected: [], text: '', word: '' }));
  state.currentIndex = 0;
  $('quiz-title-display').textContent = quiz.title;
  showPage('page-quiz');
  renderQuestion();
}

function renderQuestion() {
  const quiz = state.currentQuiz;
  const question = quiz.questions[state.currentIndex];
  const total = quiz.questions.length;
  $('progress-bar').style.width = `${Math.round((state.currentIndex / total) * 100)}%`;
  $('progress-label').textContent = `Question ${state.currentIndex + 1} sur ${total}`;
  $('btn-prev').style.visibility = state.currentIndex === 0 ? 'hidden' : 'visible';
  $('btn-next').textContent = state.currentIndex === total - 1 ? '✅ Terminer' : 'Suivant →';

  const typeLabels = { single: '☝️ Choix unique', multiple: '☑️ Choix multiples', word: '✏️ Réponse courte', text: '📝 Réponse développée' };
  const typeClasses = { single: 'q-type-single', multiple: 'q-type-multiple', word: 'q-type-word', text: 'q-type-text' };
  const answer = state.currentAnswers[state.currentIndex];
  let optionHtml = '';

  if (question.type === 'single') {
    question.options.forEach((option, idx) => {
      const selectedClass = answer.selected.includes(idx) ? 'selected' : '';
      optionHtml += `<button class="option-btn ${selectedClass}" data-idx="${idx}" data-type="single"><div class="opt-circle">${String.fromCharCode(65 + idx)}</div><span>${option}</span></button>`;
    });
  } else if (question.type === 'multiple') {
    question.options.forEach((option, idx) => {
      const selectedClass = answer.selected.includes(idx) ? 'selected' : '';
      const marker = selectedClass ? '✓' : '';
      optionHtml += `<button class="option-btn ${selectedClass}" data-idx="${idx}" data-type="multiple"><div class="checkbox-opt">${marker}</div><span>${option}</span></button>`;
    });
  } else if (question.type === 'word') {
    optionHtml = `<div class="word-answer-wrap"><input type="text" class="word-answer" id="word-ans" placeholder="Tape ta réponse..." value="${answer.word || ''}" autocomplete="off" spellcheck="false"></div><p class="word-hint">✏️ Entre un mot ou une courte expression</p>`;
  } else {
    optionHtml = `<textarea class="text-answer" id="text-ans" placeholder="Écris ta réponse développée ici...">${answer.text || ''}</textarea><p class="text-note">📝 Cette réponse sera lue et corrigée manuellement par un adulte.</p>`;
  }

  $('question-container').innerHTML = `
    <div class="question-card">
      <div class="q-num">Question ${state.currentIndex + 1} / ${total}</div>
      <div class="q-text">${question.text}</div>
      <span class="q-type-label ${typeClasses[question.type] || 'q-type-single'}">${typeLabels[question.type] || question.type}</span>
      <div class="option-list">${optionHtml}</div>
    </div>`;

  document.querySelectorAll('.option-btn').forEach(button => {
    button.addEventListener('click', () => {
      const idx = parseInt(button.dataset.idx, 10);
      if (button.dataset.type === 'single') {
        state.currentAnswers[state.currentIndex].selected = [idx];
      } else {
        const selectedList = state.currentAnswers[state.currentIndex].selected;
        const pos = selectedList.indexOf(idx);
        if (pos >= 0) selectedList.splice(pos, 1);
        else selectedList.push(idx);
      }
      renderQuestion();
    });
  });

  const wordInput = $('word-ans');
  if (wordInput) {
    wordInput.addEventListener('input', () => { state.currentAnswers[state.currentIndex].word = wordInput.value; });
    wordInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('btn-next').click(); });
    wordInput.focus();
  }

  const textInput = $('text-ans');
  if (textInput) textInput.addEventListener('input', () => { state.currentAnswers[state.currentIndex].text = textInput.value; });
}

function prevQuestion() {
  if (state.currentIndex > 0) { state.currentIndex -= 1; renderQuestion(); }
}

function nextOrFinish() {
  if (state.currentIndex < state.currentQuiz.questions.length - 1) { state.currentIndex += 1; renderQuestion(); }
  else finishQuiz();
}

function normalizeWord(value) {
  return (value || '').toString().toLowerCase().replace(/\s+/g, '');
}

function finishQuiz() {
  let score = 0;
  let maxScore = 0;
  let hasPending = false;

  const details = state.currentQuiz.questions.map((question, index) => {
    const answer = state.currentAnswers[index];
    let status = 'skip';
    let normalizedWord = '';

    if (question.type === 'text') {
      status = 'pending';
      hasPending = true;
    } else if (question.type === 'word') {
      maxScore += 1;
      normalizedWord = normalizeWord(answer.word);
      const accepted = (question.correct || []).map(normalizeWord);
      status = accepted.includes(normalizedWord) ? 'ok' : 'nok';
      if (status === 'ok') score += 1;
    } else {
      maxScore += 1;
      const expected = (question.correct || []).slice().sort().join(',');
      const selected = (answer.selected || []).slice().sort().join(',');
      status = expected === selected && selected !== '' ? 'ok' : 'nok';
      if (status === 'ok') score += 1;
    }

    return {
      q: question.text,
      type: question.type,
      selected: answer.selected,
      text: answer.text,
      word: answer.word,
      correct: question.correct,
      options: question.options,
      explanation: question.explanation,
      status
    };
  });

  const result = {
    id: 'r_' + Date.now(),
    user: state.currentUser,
    quizId: state.currentQuiz.id,
    quizTitle: state.currentQuiz.title,
    isTutorial: !!state.currentQuiz.isTutorial,
    isReplay: !!state.currentQuiz.replay,
    date: new Date().toISOString(),
    score,
    maxScore,
    hasPending,
    finished: true,
    details,
    textCorrections: {}
  };

  const results = store.get('results') || [];
  results.push(result);
  store.set('results', results);
  safeFirebaseAction(() => syncResultToFirebase(result), 'Erreur sauvegarde résultat Firebase');

  renderResult(result);
  showPage('page-result');
}

function renderResult(result) {
  const pct = result.maxScore > 0 ? Math.round(result.score / result.maxScore * 100) : 0;
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low';
  const config = {
    high: ['#00b894', '#e8f8f5', '🎉 Excellent !', 'Tu maîtrises ce sujet !'],
    mid: ['#fdcb6e', '#fffbf0', '💪 Pas mal !', 'Continue à t\'entraîner !'],
    low: ['#e17055', '#fff4f2', '📖 Courage !', 'Relis tes leçons et réessaie.']
  };
  const [color, background, title, subtitle] = config[level];

  const circle = $('score-circle');
  circle.style.background = background;
  circle.style.color = color;
  $('score-num').textContent = `${result.score}/${result.maxScore}`;
  $('score-pct').textContent = result.maxScore > 0 ? `${pct}%` : '';
  $('result-title').textContent = title;

  let subText = subtitle;
  if (result.hasPending) subText += '\n⚠️ Une réponse développée attend une correction manuelle par un adulte.';
  if (result.isTutorial) subText += '\n🎓 Tu peux refaire ce tutoriel autant de fois que tu veux !';
  if (result.isReplay) subText += '\n🔁 Ce quiz est rejouable, tu peux recommencer quand tu veux !';
  $('result-sub').textContent = subText;

  let html = '<h3 style="font-family:\'Fredoka One\',cursive;color:var(--c6);margin-bottom:14px;">Détail des réponses</h3>';
  result.details.forEach((detail, index) => {
    const cls = { ok: 'ok', nok: 'nok', pending: 'pending' }[detail.status] || '';
    const icon = { ok: '✅', nok: '❌', pending: '⏳', skip: '➖' }[detail.status] || '➖';
    let body = '';

    if (detail.type === 'text') {
      body = `<div class="rq-ans">Ta réponse : <em>${detail.text || '(vide)'}</em></div><div class="rq-ans">⏳ Correction par un adulte en attente</div>`;
      if (detail.explanation) body += `<div class="rq-ans" style="font-style:italic;margin-top:4px;">💡 ${detail.explanation}</div>`;
    } else if (detail.type === 'word') {
      const accepted = (detail.correct || []).join(', ');
      body = `<div class="rq-ans">Ta réponse : <em>${detail.word || '(vide)'}</em></div>`;
      if (detail.status === 'nok') body += `<div class="rq-correct">✅ Réponse(s) acceptée(s) : ${accepted}</div>`;
      if (detail.explanation) body += `<div class="rq-ans" style="font-style:italic;margin-top:4px;">💡 ${detail.explanation}</div>`;
    } else {
      const given = (detail.selected || []).map(i => detail.options[i]).join(', ') || '(aucune)';
      const correct = (detail.correct || []).map(i => detail.options[i]).join(', ');
      body = `<div class="rq-ans">Ta réponse : <em>${given}</em></div>`;
      if (detail.status === 'nok') body += `<div class="rq-correct">✅ Bonne(s) réponse(s) : ${correct}</div>`;
      if (detail.explanation) body += `<div class="rq-ans" style="font-style:italic;margin-top:4px;">💡 ${detail.explanation}</div>`;
    }

    html += `<div class="result-q ${cls}"><div class="rq-text">${icon} Q${index + 1}. ${detail.q}</div>${body}</div>`;
  });
  $('result-details').innerHTML = html;
}



const avatarColors = ['#6C5CE7', '#fd79a8', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#a29bfe'];
function renderUsersList() {
  const users = store.get('users') || [];
  const wrapper = $('users-list');
  if (!users.length) { wrapper.innerHTML = '<div class="alert alert-warn">Aucun utilisateur.</div>'; return; }
  wrapper.innerHTML = users.map((name, index) => `<div class="user-row"><div class="user-avatar" style="background:${avatarColors[index % avatarColors.length]}">${name[0].toUpperCase()}</div><div class="user-name">${name}</div><button class="btn-danger" data-action="del" data-name="${name}">Supprimer</button><button class="btn-success-sm" data-action="reset" data-name="${name}">Réinitialiser</button></div>`).join('');
  wrapper.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.name;
    if (button.dataset.action === 'del') {
      if (confirm(`Supprimer "${name}" ? Ses résultats seront conservés.`)) {
        store.set('users', (store.get('users') || []).filter(user => user !== name));
        safeFirebaseAction(() => deleteUserFromFirebase(name), 'Erreur suppression utilisateur Firebase');
        renderUsersList();
      }
    } else {
      if (confirm(`Réinitialiser toute la progression de "${name}" ? Cette action est irréversible.`)) {
        store.set('results', (store.get('results') || []).filter(result => result.user !== name));
        alert(`Progression de "${name}" réinitialisée.`);
        renderUsersList();
      }
    }
  }));
}

function renderAdminQuizList() {
  const quizzes = store.get('quizzes') || [];
  const wrapper = $('admin-quiz-list');
  const currentFilterUser = $('admin-quiz-filter-for')?.value || '';
  const userOptions = getVocabUsersOptions(currentFilterUser);
  const filteredQuizzes = currentFilterUser
    ? quizzes.filter(quiz => normalizeString(quiz.for || '') === normalizeString(currentFilterUser))
    : quizzes;

  let html = `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;"><div class="settings-group" style="min-width:220px;"><label>Filtrer par utilisateur</label><select id="admin-quiz-filter-for" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">${userOptions}</select></div><div style="align-self:center;font-size:13px;color:var(--muted);">${filteredQuizzes.length}/${quizzes.length} quiz affiché(s)</div></div>`;
  html += `<div class="user-row" style="background:#fffdf0;border-radius:10px;padding:12px 16px;border:2px solid #ffe082;margin-bottom:4px;"><div style="font-size:24px;margin-right:4px;">🎓</div><div style="flex:1"><strong>${tutorialQuiz.title}</strong><div style="font-size:12px;color:var(--muted);">${tutorialQuiz.questions.length} questions · Intégré — non supprimable · ∞ rejouable</div></div><span style="font-size:12px;background:#fff3cd;color:#856404;border-radius:8px;padding:3px 10px;font-weight:700;">Tuto</span></div>`;
  if (!quizzes.length) { wrapper.innerHTML = html + '<div class="alert alert-info" style="margin-top:12px;">Aucun quiz importé.</div>'; wrapper.querySelectorAll('#admin-quiz-filter-for').forEach(el => el.addEventListener('change', renderAdminQuizList)); return; }

  html += filteredQuizzes.map(quiz => {
    const forTag = quiz.for ? `<span style="font-size:11px;background:#e8f4fd;color:#0c5460;border-radius:8px;padding:2px 7px;font-weight:700;margin-left:6px;">👤 ${quiz.for}</span>` : `<span style="font-size:11px;background:#f0f0ff;color:#555;border-radius:8px;padding:2px 7px;font-weight:700;margin-left:6px;">👥 Tout le monde</span>`;
    return `<div class="user-row"><div style="flex:1"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;"><strong>${quiz.title}</strong>${forTag}</div><div style="font-size:12px;color:var(--muted);">${quiz.questions.length} questions · ${quiz.subject || 'Général'}</div></div><button class="btn-danger" data-action="del-quiz" data-id="${quiz.id}">Supprimer</button></div>`;
  }).join('');

  wrapper.innerHTML = html;
  wrapper.querySelectorAll('#admin-quiz-filter-for').forEach(el => el.addEventListener('change', renderAdminQuizList));
  wrapper.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', () => {
    if (confirm('Supprimer ce quiz ? Les résultats associés resteront.')) {
      deleteQuizById(button.dataset.id);
      renderAdminQuizList();
    }
  }));
}

function openPasteModal() {
  $('paste-json-input').value = '';
  $('paste-json-error').style.display = 'none';
  showModal('modal-paste-json');
  setTimeout(() => $('paste-json-input').focus(), 100);
}

function processPastedJson() {
  const raw = $('paste-json-input').value.trim();
  const errorElement = $('paste-json-error');
  errorElement.style.display = 'none';

  if (!raw) {
    errorElement.textContent = '❌ Le champ est vide.';
    errorElement.style.display = 'block';
    return;
  }

  try {
    importQuizFromJsonText(raw);
    closeModal('modal-paste-json');
    alert('✅ Quiz importé avec succès !');
  } catch (error) {
    errorElement.textContent = `❌ JSON invalide : ${error.message}`;
    errorElement.style.display = 'block';
  }
}

function renderAdminAndHome() {
  if (state.adminLoggedIn) renderAdmin();
  if (state.currentUser) renderQuizList(state.currentUser);
}

function bindEvents() {
  $('btn-quit-quiz').addEventListener('click', () => showModal('modal-quit'));
  $('btn-admin-access').addEventListener('click', () => {
    if (state.adminLoggedIn) { renderAdmin(); showPage('page-admin'); return; }
    $('admin-pwd-input').value = '';
    $('login-error').style.display = 'none';
    showModal('modal-login');
  });
  $('user-select').addEventListener('change', onUserChange);
  $('btn-prev').addEventListener('click', prevQuestion);
  $('btn-next').addEventListener('click', nextOrFinish);
  $('btn-result-home').addEventListener('click', goHome);
  $('btn-login-cancel').addEventListener('click', () => closeModal('modal-login'));
  $('btn-login-confirm').addEventListener('click', () => {
    const inputPwd = $('admin-pwd-input').value.trim();
    const storedPwd = (store.get('admin_pwd') || '').toString();
    if (inputPwd && inputPwd === storedPwd) {
      state.adminLoggedIn = true;
      closeModal('modal-login');
      renderAdmin();
      showPage('page-admin');
    } else {
      $('login-error').style.display = 'block';
    }
  });
  $('admin-pwd-input').addEventListener('keydown', event => { if (event.key === 'Enter') $('btn-login-confirm').click(); });
  $('btn-prompt-close').addEventListener('click', () => closeModal('modal-prompt'));
  $('btn-copy-prompt').addEventListener('click', async () => {
    const text = $('prompt-text-content').textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      const button = $('btn-copy-prompt');
      button.textContent = '✅ Copié !';
      setTimeout(() => { button.textContent = '📋 Copier le prompt'; }, 2000);
    } catch {
      alert('Sélectionne et copie le texte manuellement.');
    }
  });
  $('btn-quit-cancel').addEventListener('click', () => closeModal('modal-quit'));
  $('btn-quit-confirm').addEventListener('click', () => { closeModal('modal-quit'); goHome(); });
  $('btn-detail-close').addEventListener('click', () => closeModal('modal-detail'));
  $('btn-paste-cancel').addEventListener('click', () => closeModal('modal-paste-json'));
  $('btn-paste-confirm').addEventListener('click', processPastedJson);
  $('paste-json-input').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) processPastedJson(); });
  $('btn-logout').addEventListener('click', () => { state.adminLoggedIn = false; goHome(); });
  $('btn-add-user').addEventListener('click', () => {
    const input = $('new-user-input');
    const name = input.value.trim();
    if (!name) return;
    const users = store.get('users') || [];
    if (users.includes(name)) { alert('Ce prénom existe déjà.'); return; }
    users.push(name);
    store.set('users', users);
    input.value = '';
    renderUsersList();
    safeFirebaseAction(syncUsersToFirebase, 'Erreur sauvegarde des utilisateurs Firebase');
  });
  $('btn-import-admin').addEventListener('click', () => $('file-input-admin').click());
  $('file-input-admin').addEventListener('change', event => importQuizFromFile(event.target.files[0]));
  $('btn-paste-admin').addEventListener('click', openPasteModal);
  $('btn-change-pwd').addEventListener('click', () => {
    const pwd = $('new-pwd-input').value;
    const confirmPwd = $('new-pwd-confirm').value;
    const message = $('pwd-msg');
    if (!pwd) { message.textContent = '❌ Mot de passe vide.'; message.style.color = '#e74c3c'; return; }
    if (pwd !== confirmPwd) { message.textContent = '❌ Les mots de passe ne correspondent pas.'; message.style.color = '#e74c3c'; return; }
    store.set('admin_pwd', pwd);
    safeFirebaseAction(syncAdminPasswordToFirebase, 'Erreur sauvegarde du mot de passe Firebase');
    message.textContent = '✅ Mot de passe mis à jour !';
    message.style.color = '#00b894';
    $('new-pwd-input').value = '';
    $('new-pwd-confirm').value = '';
  });
  $('btn-export-data').addEventListener('click', () => {
    const backup = {
      _version: 1,
      _exportedAt: new Date().toISOString(),
      users: store.get('users') || [],
      quizzes: store.get('quizzes') || [],
      results: store.get('results') || [],
      admin_pwd: store.get('admin_pwd') || 'Admin8587'
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quizzone-backup-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });
  $('btn-restore-data').addEventListener('click', () => $('file-input-restore').click());
  $('file-input-restore').addEventListener('change', event => {
    const file = event.target.files[0];
    const message = $('restore-msg');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data._version || !Array.isArray(data.users) || !Array.isArray(data.quizzes)) throw new Error('Fichier invalide — ce n\'est pas une sauvegarde QuizZone.');
        if (!confirm(`Restaurer la sauvegarde du ${new Date(data._exportedAt).toLocaleDateString('fr-FR')} ?\n\nCela remplacera TOUTES les données actuelles (utilisateurs, quiz, résultats).`)) {
          event.target.value = '';
          return;
        }
        store.set('users', data.users);
        store.set('quizzes', data.quizzes);
        store.set('results', data.results || []);
        store.set('admin_pwd', data.admin_pwd || 'Admin8587');
        event.target.value = '';
        message.textContent = '✅ Sauvegarde restaurée avec succès !';
        message.style.color = '#00b894';
        renderAdmin();
        setTimeout(() => { message.textContent = ''; }, 4000);
      } catch (error) {
        message.textContent = '❌ ' + error.message;
        message.style.color = '#e74c3c';
      }
    };
    reader.readAsText(file);
  });
  $('btn-clear-all').addEventListener('click', () => {
    if (!confirm('Effacer toutes les données ?\n\nUtilisateurs, quiz et résultats seront supprimés.\nLe mot de passe admin sera conservé.')) return;
    const savedPwd = store.get('admin_pwd');
    localStorage.clear();
    store.set('admin_pwd', savedPwd);
    initStore();
    renderAdmin();
    alert('✅ Données effacées. Les prénoms et quiz par défaut ont été restaurés.');
  });

  const tabsContainer = document.querySelector('.tabs');
  if (tabsContainer) {
    tabsContainer.addEventListener('click', event => {
      const tab = event.target.closest('.tab');
      if (!tab) return;
      document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      tab.classList.add('active');
      const target = $(tab.dataset.tab);
      if (target) target.classList.add('active');
      const refreshFn = {
        'tab-results': renderResultsTable,
        'tab-correct': renderCorrectionList,
        'tab-users': renderUsersList,
        'tab-quiz': renderAdminQuizList,
        'tab-vocab': renderVocabGenerator
      }[tab.dataset.tab];
      if (refreshFn) refreshFn();
    });
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.addEventListener('click', event => { if (event.target === overlay) overlay.style.display = 'none'; }));

  // Event listeners for quiz list filters
  const hideDoneCheckbox = $('hide-done-quizzes');
  const hideOthersCheckbox = $('hide-others-quizzes');
  if (hideDoneCheckbox) hideDoneCheckbox.addEventListener('change', () => renderQuizList(state.currentUser));
  if (hideOthersCheckbox) hideOthersCheckbox.addEventListener('change', () => renderQuizList(state.currentUser));
}

function renderAdmin() {
  renderResultsTable();
  renderUsersList();
  renderAdminQuizList();
}

async function initApp() {
  await initFirebaseStorage();
  initStore();
  await loadTutorialQuiz();
  renderHome();
  bindEvents();
}

initApp();
