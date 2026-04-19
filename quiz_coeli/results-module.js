/**
 * RÉSULTATS MODULE
 * Gère l'affichage des résultats, les corrections manuelles et les statistiques
 */

// ============================================================================
// RENDU DU TABLEAU DES RÉSULTATS
// ============================================================================

/**
 * Rend le tableau complet des résultats avec filtre par utilisateur
 */
function renderResultsTable() {
  const results = store.get('results') || [];
  const wrapper = $('results-table-wrap');
  const currentFilterUser = $('results-filter-user')?.value || '';
  
  // Filtrer les résultats selon l'utilisateur sélectionné
  const filteredResults = currentFilterUser
    ? results.filter(result => result.user === currentFilterUser)
    : results;

  // Si aucun résultat, afficher un message
  if (!results.length) {
    wrapper.innerHTML = '<div class="alert alert-info">Aucun résultat pour l\'instant.</div>';
    return;
  }

  // Générer les options du sélecteur utilisateur
  const users = store.get('users') || [];
  const userOptions = `<option value="">Tous les utilisateurs</option>${users.map(u => `<option value="${u}"${u === currentFilterUser ? ' selected' : ''}>${u}</option>`).join('')}`;

  // Construire le HTML du filtre et du tableau
  let html = `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;align-items:center;"><div class="settings-group" style="min-width:220px;"><label>Filtrer par utilisateur</label><select id="results-filter-user" style="width:100%;padding:8px;border-radius:8px;border:2px solid #e0e0ff;font-family:'Nunito',sans-serif;font-size:14px;">${userOptions}</select></div><div style="font-size:13px;color:var(--muted);">${filteredResults.length}/${results.length} résultat(s) affiché(s)</div></div>`;
  
  html += `<table class="result-table"><thead><tr><th>Élève</th><th>Quiz</th><th>Date</th><th>Score</th><th>Statut</th><th>Actions</th></tr></thead><tbody>`;
  
  // Ajouter chaque résultat au tableau (ordre inverse = plus récent en premier)
  [...filteredResults].reverse().forEach(result => {
    const date = new Date(result.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const pct = result.maxScore > 0 ? Math.round(result.score / result.maxScore * 100) : null;
    const scoreClass = result.maxScore > 0 ? (pct >= 80 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low') : 'score-pending';
    const scoreText = result.maxScore > 0 ? `${result.score}/${result.maxScore} (${pct}%)` : 'N/A';
    const statusTag = result.hasPending ? '<span class="pending-badge">⏳ À corriger</span>' : '✅ Terminé';
    const badge = result.isTutorial ? ' <span style="font-size:11px;background:#fff3cd;color:#856404;border-radius:8px;padding:1px 6px;">tuto</span>' : result.isReplay ? ' <span style="font-size:11px;background:#d0f0fd;color:#0c5460;border-radius:8px;padding:1px 6px;">🔁 rejouable</span>' : '';

    html += `<tr><td><strong>${result.user}</strong></td><td>${result.quizTitle}${badge}</td><td style="font-size:12px;">${date}</td><td><span class="score-pill ${scoreClass}">${scoreText}</span></td><td>${statusTag}</td><td><button class="btn-success-sm" data-action="detail" data-id="${result.id}">Voir</button><button class="btn-danger" data-action="del-result" data-id="${result.id}" style="margin-left:4px;">Suppr.</button></td></tr>`;
  });
  html += '</tbody></table>';
  wrapper.innerHTML = html;
  
  // Ajouter les listeners
  wrapper.querySelectorAll('#results-filter-user').forEach(el => el.addEventListener('change', renderResultsTable));
  wrapper.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.action === 'detail') showDetail(button.dataset.id);
    if (button.dataset.action === 'del-result' && confirm('Supprimer ce résultat définitivement ?')) {
      const newResults = (store.get('results') || []).filter(item => item.id !== button.dataset.id);
      store.set('results', newResults);
      safeFirebaseAction(() => deleteResultFromFirebase(button.dataset.id), 'Erreur suppression résultat Firebase');
      renderResultsTable();
      renderCorrectionList();
    }
  }));
}

// ============================================================================
// DÉTAIL D'UN RÉSULTAT
// ============================================================================

/**
 * Affiche le détail complet d'un résultat spécifique avec options de correction
 * @param {string} id - ID du résultat
 */
function showDetail(id) {
  const result = (store.get('results') || []).find(item => item.id === id);
  if (!result) return;

  const date = new Date(result.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = `<p style="margin-bottom:16px;"><strong>${result.user}</strong> — ${result.quizTitle}<br><small style="color:var(--muted);">${date}</small></p>`;

  // Construire le détail de chaque question
  result.details.forEach((detail, index) => {
    const cls = { ok: 'ok', nok: 'nok', pending: 'pending' }[detail.status] || '';
    const icon = { ok: '✅', nok: '❌', pending: '⏳' }[detail.status] || '➖';
    const storedNote = result.textCorrections && result.textCorrections[index] !== undefined ? result.textCorrections[index] : '';
    let body = '';

    if (detail.type === 'text') {
      // Question ouverte : afficher le champ pour noter
      body = `<div class="rq-ans">Réponse : <em>${detail.text || '(vide)'}</em></div>${detail.explanation ? `<div class="rq-ans" style="color:var(--c8);">💡 Attendu : ${detail.explanation}</div>` : ''}<div style="margin-top:8px;"><label style="font-size:12px;font-weight:700;">Note (/10) :</label><input type="number" min="0" max="10" value="${storedNote}" class="corriger-note" data-result="${id}" data-qidx="${index}"></div>`;
    } else if (detail.type === 'word') {
      // Mot : afficher réponse donnée et réponses acceptées
      const accepted = (detail.correct || []).join(', ');
      body = `<div class="rq-ans">Réponse : <em>${detail.word || '(vide)'}</em></div>`;
      if (detail.status === 'nok') body += `<div class="rq-correct">✅ Réponse(s) acceptée(s) : ${accepted}</div>`;
      if (detail.explanation) body += `<div class="rq-ans" style="font-style:italic;margin-top:4px;">💡 ${detail.explanation}</div>`;
    } else {
      // QCM : afficher réponse donnée et bonne réponse
      const given = (detail.selected || []).map(i => detail.options[i]).join(', ') || '(aucune)';
      const correct = (detail.correct || []).map(i => detail.options[i]).join(', ');
      body = `<div class="rq-ans">Réponse : <em>${given}</em></div>`;
      if (detail.status === 'nok') body += `<div class="rq-correct">✅ Bonne(s) réponse(s) : ${correct}</div>`;
      if (detail.explanation) body += `<div class="rq-ans" style="font-style:italic;margin-top:4px;">💡 ${detail.explanation}</div>`;
    }

    html += `<div class="result-q ${cls}" style="margin-bottom:10px;"><div class="rq-text">${icon} Q${index + 1}. ${detail.q}</div>${body}</div>`;
  });

  $('modal-detail-content').innerHTML = html;
  
  // Listeners pour modification des notes
  document.querySelectorAll('.corriger-note').forEach(input => input.addEventListener('change', () => {
    const results = store.get('results') || [];
    const current = results.find(item => item.id === input.dataset.result);
    if (current) {
      current.textCorrections = current.textCorrections || {};
      current.textCorrections[parseInt(input.dataset.qidx, 10)] = parseFloat(input.value) || 0;
      store.set('results', results);
    }
  }));
  
  showModal('modal-detail');
}

// ============================================================================
// LISTE DES RÉPONSES À CORRIGER
// ============================================================================

/**
 * Rend la liste des réponses développées en attente de correction
 */
function renderCorrectionList() {
  const wrapper = $('correction-list');
  const results = store.get('results') || [];
  const pending = results.filter(result => result.hasPending);

  if (!pending.length) {
    wrapper.innerHTML = '<div class="alert alert-info">✅ Aucune réponse développée à corriger — tout est à jour !</div>';
    return;
  }

  let html = '';
  pending.forEach(result => {
    const date = new Date(result.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const textQuestions = result.details.map((detail, index) => ({ detail, index })).filter(item => item.detail.type === 'text');

    html += `<div class="admin-card" style="margin-bottom:16px;border-left:4px solid var(--c3);"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px;"><div><strong style="font-size:16px;">${result.user}</strong><div style="font-size:13px;color:var(--muted);">${result.quizTitle} · ${date}</div></div><span class="pending-badge">⏳ En attente</span></div>`;
    
    // Afficher les questions texte à corriger
    textQuestions.forEach(item => {
      const storedNote = result.textCorrections && result.textCorrections[item.index] !== undefined ? result.textCorrections[item.index] : '';
      html += `<div style="margin-bottom:12px;"><div style="font-weight:700;margin-bottom:6px;">Q${item.index + 1}. ${item.detail.q}</div><div style="font-size:13px;margin-bottom:6px;color:var(--muted);">Réponse : <em>${item.detail.text || '(vide)'}</em></div>${item.detail.explanation ? `<div style="font-size:13px;color:var(--c8);margin-bottom:6px;">💡 Attendu : ${item.detail.explanation}</div>` : ''}<div style="display:flex;gap:8px;"><input type="number" min="0" max="10" value="${storedNote}" class="corriger-note-inline" data-result="${result.id}" data-qidx="${item.index}" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:6px;font-size:13px;"><span style="font-size:13px;color:var(--muted);">/10</span></div></div>`;
    });
    
    html += `<button class="btn-add" data-validate="${result.id}" style="width:100%;padding:10px;margin-top:12px;">✅ Valider la correction</button></div>`;
  });

  wrapper.innerHTML = html;
  
  // Listeners pour validation
  wrapper.querySelectorAll('button[data-validate]').forEach(button => button.addEventListener('click', () => validateCorrection(button.dataset.validate)));
}

/**
 * Valide l'ensemble des corrections pour un résultat
 * Vérifie que toutes les questions texte ont une note
 * @param {string} resultId - ID du résultat à corriger
 */
function validateCorrection(resultId) {
  const results = store.get('results') || [];
  const result = results.find(item => item.id === resultId);
  if (!result) return;

  // Récupérer les notes saisies
  document.querySelectorAll(`.corriger-note[data-result="${resultId}"], .corriger-note-inline[data-result="${resultId}"]`).forEach(input => {
    result.textCorrections = result.textCorrections || {};
    result.textCorrections[parseInt(input.dataset.qidx, 10)] = parseFloat(input.value) || 0;
  });

  // Vérifier que toutes les questions texte ont une note
  const textQuestions = result.details.map((detail, idx) => ({ detail, idx })).filter(item => item.detail.type === 'text');
  const allNoted = textQuestions.every(item => result.textCorrections && result.textCorrections[item.idx] !== undefined);
  
  if (!allNoted) {
    alert('Merci de saisir une note pour toutes les questions texte avant de valider.');
    return;
  }

  // Marquer comme corrigé
  result.hasPending = false;
  result.correctedAt = new Date().toISOString();
  store.set('results', results);
  safeFirebaseAction(() => syncResultToFirebase(result), 'Erreur mise à jour résultat Firebase');
  
  // Rafraîchir les listes
  renderCorrectionList();
  renderResultsTable();
  alert('✅ Correction validée !');
}
