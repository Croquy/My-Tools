/**
 * VOCABULAIRE MODULE
 * Gère la génération de quiz de vocabulaire, l'import CSV, et la gestion des mots
 */

// ============================================================================
// UTILITAIRES VOCABULAIRE
// ============================================================================

/**
 * Normalise un niveau scolaire en format standard (6, 5, 4, 3, 2, 1)
 * @param {string} value - Niveau à normaliser ('6ème', '6', 'lycée', etc.)
 * @returns {string} - Niveau normalisé
 */
function normalizeVocabLevel(value) {
  const cleaned = (value || '').toString().trim().toLowerCase();
  if (/[1-6]/.test(cleaned)) {
    const match = cleaned.match(/[1-6]/);
    if (match) return match[0];
  }
  if (cleaned.includes('lyc')) return '2';
  if (cleaned.includes('6')) return '6';
  if (cleaned.includes('5')) return '5';
  if (cleaned.includes('4')) return '4';
  if (cleaned.includes('3')) return '3';
  if (cleaned.includes('2')) return '2';
  if (cleaned.includes('1')) return '1';
  return '6';
}

/**
 * Formate un niveau en texte lisible (ex: '6' → '6ème')
 * @param {string} level - Niveau à formater
 * @returns {string} - Niveau formaté
 */
function formatVocabLevel(level) {
  const normalized = normalizeVocabLevel(level);
  const map = { '6': '6ème', '5': '5ème', '4': '4ème', '3': '3ème', '2': '2nde', '1': '1ère' };
  return map[normalized] || '6ème';
}

/**
 * Parse des plages de pages depuis un texte (ex: "1-3, 4-6" → [[1,3], [4,6]])
 * @param {string} rangeText - Texte à parser
 * @returns {Array<Array<number>>} - Tableau de [min, max]
 */
function parsePageRanges(rangeText = '') {
  const ranges = rangeText.trim().split('\n').map(line => line.trim()).filter(Boolean);
  if (ranges.length === 0) return [[1, Infinity]];
  return ranges.map(line => {
    const parts = line.split('-').map(s => s.trim());
    const min = parseInt(parts[0], 10);
    const max = parts[1] ? parseInt(parts[1], 10) : min;
    return [!isNaN(min) ? min : 1, !isNaN(max) ? max : (!isNaN(min) ? min : Infinity)];
  }).filter(([min, max]) => !isNaN(min) && !isNaN(max));
}

function generateVocabDocId(item, idx = 0) {
  return sanitizeDocId(`${item.fr}-${item.en}-${item.page}-${item.level}-${Date.now()}-${idx}`);
}

async function syncVocabWordsToFirebase(words) {
  if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !Array.isArray(words) || words.length === 0) return;
  const docs = words.map((word, idx) => ({ id: generateVocabDocId(word, idx), ...word }));
  await FirestoreService.batchSet('vocab_words', docs);
}

/**
 * Génère les options <select> pour les utilisateurs du vocabulaire
 * @param {string} selected - Utilisateur sélectionné
 * @returns {string} - HTML des options
 */
function getVocabUsersOptions(selected = '') {
  const users = store.get('users') || [];
  return `<option value="">Tous</option>${users.map(u => `<option value="${u}"${u === selected ? ' selected' : ''}>${u}</option>`).join('')}`;
}

/**
 * Génère les options <select> pour les niveaux scolaires
 * @param {string} selected - Niveau sélectionné
 * @returns {string} - HTML des options
 */
function getVocabLevelOptions(selected = '') {
  const levels = ['6', '5', '4', '3', '2', '1'];
  return levels.map(level => `<option value="${level}"${level === selected ? ' selected' : ''}>${formatVocabLevel(level)}</option>`).join('');
}

/**
 * Compte les mots éligibles avec les filtres donnés
 * @param {Array} vocab - Liste de mots
 * @param {Array} pageRanges - Plages de pages [[min, max]]
 * @param {string} levelFilter - Niveau à filtrer
 * @param {string} forFilter - Utilisateur ciblé
 * @returns {number} - Nombre de mots éligibles
 */
function getFilteredVocabCount(vocab, pageRanges, levelFilter = '', forFilter = '') {
  const normalizedFor = normalizeString(forFilter);
  return vocab.filter(item => {
    const itemLevel = normalizeVocabLevel(item.level);
    const itemFor = normalizeString(item.for || '');
    const withinPage = pageRanges.some(([min, max]) => item.page >= min && item.page <= max);
    const matchesLevel = !levelFilter || itemLevel === levelFilter;
    const matchesFor = !forFilter || itemFor === normalizedFor;
    return withinPage && matchesLevel && matchesFor;
  }).length;
}

/**
 * Shuffle un tableau de manière aléatoire
 * @param {Array} arr - Tableau à mélanger
 * @returns {Array} - Tableau mélangé
 */
function shuffleArray(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

// ============================================================================
// PARSING CSV ET TRAITEMENT DONNÉES
// ============================================================================

/**
 * Parse un fichier CSV de vocabulaire
 * Format: page,français,anglais,niveau,utilisateur_optionnel
 * @param {string} csvText - Contenu CSV
 * @returns {Array} - Tableau d'objets {page, fr, en, level, for}
 */
function parseVocabCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => {
    const parts = line.split(',').map(s => s.trim());
    const page = parseInt(parts[0], 10);
    const fr = parts[1] || '';
    const en = parts[2] || '';
    const levelRaw = parts[3] || '';
    const forUser = parts[4] || '';
    if (!page || isNaN(page) || !fr || !en || !levelRaw) return null;
    const level = normalizeVocabLevel(levelRaw);
    return { page, fr, en, level, for: forUser };
  }).filter(Boolean);
}

/**
 * Génère des variantes orthographiques d'un mot pour les QCM
 * @param {string} word - Mot à transformer
 * @returns {Array} - Tableau de variantes
 */
function generateOrthographicVariants(word) {
  const variants = [];
  const lower = word.toLowerCase();
  
  // Variante 1: ajouter une lettre en double
  if (word.length > 1) {
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] !== word[i + 1]) {
        variants.push(word.substring(0, i + 1) + word[i] + word.substring(i + 1));
      }
    }
  }
  
  // Variante 2: enlever une lettre
  for (let i = 0; i < word.length; i++) {
    if (i > 0 || word.length > 2) {
      variants.push(word.substring(0, i) + word.substring(i + 1));
    }
  }
  
  // Variante 3: inverser deux lettres
  for (let i = 0; i < word.length - 1; i++) {
    variants.push(word.substring(0, i) + word[i + 1] + word[i] + word.substring(i + 2));
  }
  
  // Retirer les doublons et au max 3 variantes
  return [...new Set(variants)].filter(v => v !== word && v.length > 0).slice(0, 3);
}

// ============================================================================
// GÉNÉRATION DE QUIZ
// ============================================================================

/**
 * Génère des quiz de vocabulaire à partir d'une liste de mots
 * @param {Array} vocab - Liste de mots {page, fr, en, level, for}
 * @param {Array} pageRange - [minPage, maxPage]
 * @param {string} quizType - 'word' | 'qcm' | 'mixed'
 * @param {string} levelFilter - Niveau à filtrer
 * @param {string} forFilter - Utilisateur ciblé
 * @returns {Object|null} - Objet quiz ou null si aucun mot trouvé
 */
function generateVocabQuizzes(vocab, pageRange, quizType, levelFilter = '', forFilter = '') {
  const [minPage, maxPage] = pageRange;
  const normalizedFor = normalizeString(forFilter);
  let filtered = vocab.filter(item => {
    const itemLevel = normalizeVocabLevel(item.level);
    const itemFor = normalizeString(item.for || '');
    const withinPage = item.page >= minPage && item.page <= maxPage;
    const matchesLevel = !levelFilter || itemLevel === levelFilter;
    const matchesFor = !forFilter || itemFor === normalizedFor;
    return withinPage && matchesLevel && matchesFor;
  });
  
  if (filtered.length === 0) return null;
  if (filtered.length > 20) filtered = shuffleArray(filtered).slice(0, 20);
  
  const title = minPage === 1 && maxPage === Infinity
    ? '📚 Vocabulaire - Toutes les pages'
    : minPage === maxPage
      ? `📚 Vocabulaire - Page ${minPage}`
      : `📚 Vocabulaire - Page ${minPage}-${maxPage}`;
  const description = `Apprends le vocabulaire des pages ${minPage === 1 && maxPage === Infinity ? 'toutes' : `${minPage} à ${maxPage}`}`;
  const questions = filtered.map((item, idx) => {
    const isWord = quizType === 'word' || (quizType === 'mixed' && idx % 2 === 0);
    if (isWord) {
      return {
        id: idx + 1,
        type: 'word',
        text: `Traduis en anglais : <strong>${item.fr}</strong>`,
        options: [],
        correct: [item.en.toLowerCase(), item.en.toLowerCase().split(' ')[0]],
        explanation: `La traduction de "${item.fr}" est "${item.en}"`
      };
    }
    const variants = generateOrthographicVariants(item.en);
    const options = [item.en, ...variants.slice(0, 3)];
    const shuffled = options.map((opt, i) => ({ opt, originalIdx: i }))
      .sort(() => Math.random() - 0.5);
    return {
      id: idx + 1,
      type: 'single',
      text: `Traduis en anglais : <strong>${item.fr}</strong>`,
      options: shuffled.map(s => s.opt),
      correct: [shuffled.findIndex(s => s.originalIdx === 0)],
      explanation: `La traduction de "${item.fr}" est "${item.en}"`
    };
  });
  
  const quizId = quizType === 'word' ? 'vocab_word_' : quizType === 'mixed' ? 'vocab_mix_' : 'vocab_qcm_';
  return {
    id: quizId + Date.now(),
    title,
    subject: 'Vocabulaire',
    description,
    replay: true,
    questions
  };
}

// ============================================================================
// IMPORT ET GESTION FICHIERS
// ============================================================================

/**
 * Importe un fichier CSV de vocabulaire et génère les quiz correspondants
 * @param {File} file - Fichier CSV
 * @param {Array} pageRanges - Plages de pages [[min, max]]
 * @param {string} quizType - Type de quiz
 * @param {string} levelFilter - Niveau à filtrer
 * @param {string} forFilter - Utilisateur ciblé
 */
async function importVocabCSV(file, pageRanges, quizType, levelFilter = '', forFilter = '') {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      // Force encodage UTF-8 pour éviter les problèmes d'accents
      const csv = event.target.result;
      const vocab = parseVocabCSV(csv);
      
      if (vocab.length === 0) {
        alert('❌ Aucun mot valide trouvé dans le CSV.');
        return;
      }
      
      // Ajouter les mots à la liste locale
      let storedVocab = store.get('vocab') || [];
      storedVocab = [...storedVocab, ...vocab];
      store.set('vocab', storedVocab);
      safeFirebaseAction(() => syncVocabWordsToFirebase(vocab), 'Erreur sauvegarde vocab Firebase');
      
      let createdCount = 0;
      for (const [minPage, maxPage] of pageRanges) {
        const quiz = generateVocabQuizzes(storedVocab, [minPage, maxPage], quizType, levelFilter, forFilter);
        if (quiz) {
          saveQuiz(quiz);
          createdCount++;
        }
      }
      
      alert(`✅ ${vocab.length} mot(s) importé(s) et ${createdCount} quiz généré(s) !`);
      renderVocabGenerator();
      renderAdminAndHome();
    } catch (error) {
      alert(`❌ Erreur : ${error.message}`);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ============================================================================
// ÉDITION D'UN MOT
// ============================================================================

/**
 * Édite un mot de vocabulaire
 * @param {number} index - Index du mot à éditer
 */
function editVocabWord(index) {
  const vocab = store.get('vocab') || [];
  const word = vocab[index];
  
  if (!word) {
    alert('⚠️ Mot non trouvé.');
    return;
  }

  // Créer un modal d'édition simple
  const newFr = prompt('Modifie le mot en français :', word.fr);
  if (newFr === null) return; // Annulation
  
  if (!newFr.trim()) {
    alert('⚠️ Le mot ne peut pas être vide.');
    return;
  }

  // Optionnellement éditer aussi l'anglais
  const newEn = prompt('Modifie le mot en anglais :', word.en);
  if (newEn === null) return;
  
  if (!newEn.trim()) {
    alert('⚠️ Le mot ne peut pas être vide.');
    return;
  }

  // Mettre à jour le mot
  vocab[index] = {
    ...word,
    fr: newFr.trim(),
    en: newEn.trim()
  };
  
  store.set('vocab', vocab);
  renderVocabList();
  updateVocabEligibleCount();
  alert(`✅ Mot modifié : "${newFr}" → "${newEn}"`);
}

// ============================================================================
// MISE À JOUR DU COMPTEUR DE MOTS
// ============================================================================

/**
 * Met à jour le nombre de mots éligibles affiché
 */
function updateVocabEligibleCount() {
  const pageRanges = parsePageRanges($('vocab-page-ranges').value);
  const levelFilter = $('vocab-filter-level')?.value || '';
  const forFilter = $('vocab-filter-for')?.value || '';
  const vocab = store.get('vocab') || [];
  const count = getFilteredVocabCount(vocab, pageRanges, levelFilter, forFilter);
  const countEl = $('vocab-eligible-count');
  if (countEl) countEl.textContent = `Nombre de mots éligibles : ${count}`;
}

// ============================================================================
// RENDU UI - GÉNÉRATEUR DE VOCABULAIRE
// ============================================================================

/**
 * Rend l'interface de gestion du vocabulaire (générateur, import, ajout)
 */
function renderVocabGenerator() {
  const wrapper = $('vocab-preview');
  const userOptions = getVocabUsersOptions('');
  const levelOptions = getVocabLevelOptions('6');

  let html = `
    <div class="admin-card" style="margin-top:20px;">
      <h4>📌 Légende</h4>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Niveaux : 6 = 6ème, 5 = 5ème, 4 = 4ème, 3 = 3ème, 2 = 2nde, 1 = 1ère. Utilisateur optionnel : laisse vide pour tout le monde.</p>
    </div>

    <div class="admin-card" style="margin-top:20px;">
      <h4>🎯 Options de génération</h4>
      <div class="settings-group">
        <label>Type de quiz</label>
        <select id="vocab-quiz-type" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">
          <option value="word">✏️ Réponse courte</option>
          <option value="qcm">☑️ QCM</option>
          <option value="mixed">🔀 Mixte</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="settings-group">
          <label>Filtrer par niveau</label>
          <select id="vocab-filter-level" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">
            <option value="">Toutes</option>
            ${levelOptions}
          </select>
        </div>
        <div class="settings-group">
          <label>Filtrer par utilisateur</label>
          <select id="vocab-filter-for" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">
            ${userOptions}
          </select>
        </div>
      </div>
      <div class="settings-group">
        <label>Plages de pages (ex: 1-3, 4-6)</label>
        <textarea id="vocab-page-ranges" style="width:100%;height:80px;padding:10px;border-radius:8px;border:2px solid #e0e0ff;font-family:monospace;font-size:13px;" placeholder="Laisse vide pour toutes les pages"></textarea>
      </div>
      <div id="vocab-eligible-count" style="font-size:13px;color:var(--muted);margin-bottom:12px;">Nombre de mots éligibles : 0</div>
      <button class="btn-add" id="btn-generate-vocab-quizzes" style="width:100%;padding:12px;font-size:14px;">🎯 Générer les quiz</button>
    </div>

    <div class="admin-card" style="margin-top:20px;">
      <h4>📥 Import CSV</h4>
      <input type="file" id="file-input-vocab" accept=".csv" style="display:none;">
      <div class="settings-group">
        <label>Fichier CSV (Page,Français,Anglais,niveau,utilisateur optionnel)</label>
        <button class="btn-outline" id="btn-import-vocab-csv" style="width:100%;padding:10px;">📂 Charger CSV</button>
      </div>
    </div>

    <div class="admin-card" style="margin-top:20px;">
      <h4>➕ Ajouter un mot</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="settings-group">
          <label>Page</label>
          <input type="number" id="vocab-page" min="1" placeholder="1" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-size:14px;">
        </div>
        <div class="settings-group">
          <label>Français</label>
          <input type="text" id="vocab-fr" placeholder="bonjour" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-size:14px;">
        </div>
        <div class="settings-group">
          <label>Anglais</label>
          <input type="text" id="vocab-en" placeholder="hello" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-size:14px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="settings-group">
          <label>Niveau</label>
          <select id="vocab-level" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-size:14px;">
            ${levelOptions}
          </select>
        </div>
        <div class="settings-group">
          <label>Pour</label>
          <select id="vocab-for" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-size:14px;">
            <option value="">Tout le monde</option>
            ${userOptions}
          </select>
        </div>
      </div>
      <button class="btn-add" id="btn-add-vocab-word" style="width:100%;padding:10px;font-size:14px;margin-bottom:16px;">➕ Ajouter ce mot</button>
    </div>

    <div class="admin-card" style="margin-top:20px;">
      <h4>✍️ Ajout en masse</h4>
      <div class="settings-group">
        <label>Entrée rapide (page,français,anglais,niveau,utilisateur optionnel)</label>
        <textarea id="vocab-bulk-text" style="width:100%;height:120px;padding:10px;border-radius:8px;border:2px solid #e0e0ff;font-family:monospace;font-size:13px;" placeholder="1,bonjour,hello,6
2,maison,house,5,Tom"></textarea>
      </div>
      <button class="btn-outline" id="btn-add-vocab-bulk" style="width:100%;padding:10px;font-size:14px;">➕ Ajouter plusieurs mots</button>
    </div>

    <div class="admin-card" style="margin-top:20px;">
      <h4>📋 Mots ajoutés</h4>
      <div id="vocab-list-preview" style="font-size:13px;"></div>
    </div>
  `;

  wrapper.innerHTML = html;
  renderVocabList();
  updateVocabEligibleCount();

  // Listeners pour mise à jour du compteur
  ['vocab-quiz-type', 'vocab-filter-level', 'vocab-filter-for'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', updateVocabEligibleCount);
  });
  const pageRangesInput = $('vocab-page-ranges');
  if (pageRangesInput) pageRangesInput.addEventListener('input', updateVocabEligibleCount);

  // Ajouter un mot individuel
  $('btn-add-vocab-word').addEventListener('click', () => {
    const page = parseInt($('vocab-page').value, 10);
    const fr = $('vocab-fr').value.trim();
    const en = $('vocab-en').value.trim();
    const level = normalizeVocabLevel($('vocab-level').value);
    const forUser = $('vocab-for').value;

    if (!page || !fr || !en) {
      alert('⚠️ Tous les champs obligatoires doivent être remplis.');
      return;
    }

    let vocab = store.get('vocab') || [];
    vocab.push({ page, fr, en, level, for: forUser });
    store.set('vocab', vocab);

    // Réinitialiser le formulaire
    $('vocab-page').value = '';
    $('vocab-fr').value = '';
    $('vocab-en').value = '';
    $('vocab-level').value = '6';
    $('vocab-for').value = '';

    renderVocabList();
    updateVocabEligibleCount();
    safeFirebaseAction(() => FirestoreService.setDoc('vocab_words', `vocab_${Date.now()}`, { page, fr, en, level, for: forUser }), 'Erreur sauvegarde mot Firebase');
  });

  // Ajouter plusieurs mots en masse
  $('btn-add-vocab-bulk')?.addEventListener('click', () => {
    const bulkText = $('vocab-bulk-text').value.trim();
    if (!bulkText) {
      alert('⚠️ Colle au moins une ligne de vocabulaire.');
      return;
    }
    const lines = bulkText.split('\n').map(line => line.trim()).filter(line => line);
    const parsed = [];
    const invalid = [];
    lines.forEach((line, idx) => {
      const parts = line.split(',').map(part => part.trim());
      const page = parseInt(parts[0], 10);
      const fr = parts[1] || '';
      const en = parts[2] || '';
      const level = normalizeVocabLevel(parts[3]);
      const forUser = parts[4] || '';
      if (!page || !fr || !en || !parts[3]) {
        invalid.push(idx + 1);
        return;
      }
      parsed.push({ page, fr, en, level, for: forUser });
    });
    if (invalid.length) {
      alert(`⚠️ Lignes invalides : ${invalid.join(', ')}. Vérifie le format.`);
      return;
    }
    let vocab = store.get('vocab') || [];
    vocab = [...vocab, ...parsed];
    store.set('vocab', vocab);
    safeFirebaseAction(() => syncVocabWordsToFirebase(parsed), 'Erreur sauvegarde vocab Firebase');
    renderVocabList();
    updateVocabEligibleCount();
    alert(`✅ ${parsed.length} mot(s) ajoutés.`);
  });

  // Import CSV
  $('btn-import-vocab-csv').addEventListener('click', () => $('file-input-vocab').click());

  $('file-input-vocab')?.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      const pageRanges = parsePageRanges($('vocab-page-ranges').value);
      importVocabCSV(file, pageRanges, $('vocab-quiz-type').value, $('vocab-filter-level').value, $('vocab-filter-for').value);
    }
    event.target.value = '';
  });
  
  // Générer les quiz
  $('btn-generate-vocab-quizzes').addEventListener('click', () => {
    const quizType = $('vocab-quiz-type').value;
    const pageRanges = parsePageRanges($('vocab-page-ranges').value);
    const levelFilter = $('vocab-filter-level').value;
    const forFilter = $('vocab-filter-for').value;

    if (pageRanges.length === 0) {
      alert('⚠️ Format invalide. Utilise : 1-3, 4-6, etc.');
      return;
    }
    
    const vocab = store.get('vocab') || [];
    let createdCount = 0;
    
    for (const [minPage, maxPage] of pageRanges) {
      const quiz = generateVocabQuizzes(vocab, [minPage, maxPage], quizType, levelFilter, forFilter);
      if (quiz) {
        saveQuiz(quiz);
        createdCount++;
      }
    }
    
    if (createdCount === 0) {
      alert('⚠️ Aucun mot trouvé avec ces filtres.');
    } else {
      alert(`✅ ${createdCount} quiz de vocabulaire créé(s) !`);
      renderAdminAndHome();
    }
  });
}

/**
 * Rend la liste des mots de vocabulaire avec filtres et actions
 */
function renderVocabList() {
  const wrapper = $('vocab-list-preview');
  const vocab = store.get('vocab') || [];
  const currentLevel = $('vocab-table-filter-level')?.value || '';
  const currentFor = $('vocab-table-filter-for')?.value || '';
  
  const filtered = vocab.filter(item => {
    const itemLevel = normalizeVocabLevel(item.level);
    const itemFor = normalizeString(item.for || '');
    const matchesLevel = !currentLevel || itemLevel === currentLevel;
    const matchesFor = !currentFor || itemFor === normalizeString(currentFor);
    return matchesLevel && matchesFor;
  });

  const levelOptions = getVocabLevelOptions(currentLevel);
  const userOptions = getVocabUsersOptions(currentFor);

  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;"><div class="settings-group"><label>Filtrer par niveau</label><select id="vocab-table-filter-level" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">${levelOptions}</select></div><div class="settings-group"><label>Filtrer par utilisateur</label><select id="vocab-table-filter-for" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">${userOptions}</select></div></div>`;
  html += `<div style="margin-bottom:16px;font-size:13px;color:var(--muted);">${filtered.length}/${vocab.length} mot(s) affiché(s)</div>`;
  
  if (filtered.length === 0) {
    wrapper.innerHTML = html + '<div style="color:var(--muted);font-style:italic;">Aucun mot correspondant aux filtres.</div>';
    wrapper.querySelectorAll('#vocab-table-filter-level, #vocab-table-filter-for').forEach(el => el.addEventListener('change', renderVocabList));
    return;
  }
  
  html += '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f0f0f0;"><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Page</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Français</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Anglais</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Niveau</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Pour</th><th style="padding:8px;text-align:center;border-bottom:2px solid #ddd;">Actions</th></tr></thead><tbody>';
  
  const indexedFiltered = vocab.map((item, index) => ({ item, index })).filter(({ item }) => {
    const itemLevel = normalizeVocabLevel(item.level);
    const itemFor = normalizeString(item.for || '');
    const matchesLevel = !currentLevel || itemLevel === currentLevel;
    const matchesFor = !currentFor || itemFor === normalizeString(currentFor);
    return matchesLevel && matchesFor;
  });

  indexedFiltered.forEach(({ item: word, index }) => {
    html += `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${word.page}</td><td style="padding:8px;"><strong>${word.fr}</strong></td><td style="padding:8px;">${word.en}</td><td style="padding:8px;">${formatVocabLevel(word.level)}</td><td style="padding:8px;">${word.for ? word.for : 'Tout le monde'}</td><td style="padding:8px;text-align:center;display:flex;gap:4px;justify-content:center;"><button class="btn-outline" data-vocab-edit="${index}" style="padding:4px 8px;font-size:12px;background:#6ea8ff;color:white;border:none;border-radius:4px;cursor:pointer;">✏️ Édit.</button><button class="btn-danger" data-vocab-del="${index}" style="padding:4px 8px;font-size:12px;">Suppr.</button></td></tr>`;
  });
  html += '</tbody></table>';

  wrapper.innerHTML = html;
  wrapper.querySelectorAll('#vocab-table-filter-level, #vocab-table-filter-for').forEach(el => el.addEventListener('change', renderVocabList));
  
  // Listeners pour édition
  wrapper.querySelectorAll('button[data-vocab-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.vocabEdit, 10);
      editVocabWord(idx);
    });
  });
  
  // Listeners pour suppression
  wrapper.querySelectorAll('button[data-vocab-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.vocabDel, 10);
      const vocab = store.get('vocab') || [];
      vocab.splice(idx, 1);
      store.set('vocab', vocab);
      renderVocabList();
      updateVocabEligibleCount();
    });
  });
}
