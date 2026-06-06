// ════════════════════════════════════════════════════════
// AVENTURE — loader.js
// Gestion de la navigation et du chargement des vues
// ════════════════════════════════════════════════════════

const PAGES = {
  aventures: { url: 'aventure/aventures.html', onLoad: () => renderAventures() },
  donjons:   { url: 'aventure/donjons.html',   onLoad: () => showDonjons(S.avId) },
  donjon:    { url: 'aventure/donjon.html',    onLoad: () => showDonjon(S.avId, S.djNum) },
  des:       { url: 'aventure/des.html',        onLoad: () => initDes() },
  codex:     { url: 'aventure/codex.html',      onLoad: () => renderCodex() },
  regles:    { url: 'aventure/regles.html',     onLoad: () => renderRules() },
};

// Cache des pages déjà chargées (HTML brut)
const PAGE_CACHE = {};

// Conteneur principal
function getContainer() {
  return document.getElementById('page-content');
}

// ── Chargement d'une page ──
async function loadPage(name) {
  const page = PAGES[name];
  if (!page) return;

  // Mettre à jour la nav
  updateNav(name);
  S.view = name;

  try {
    // Charger depuis le cache ou fetch
    if (!PAGE_CACHE[name]) {
      const r = await fetch(page.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      PAGE_CACHE[name] = await r.text();
    }

    // Injecter le HTML
    getContainer().innerHTML = PAGE_CACHE[name];

    // Appeler le callback de rendu
    if (typeof page.onLoad === 'function') page.onLoad();

    // Mettre à jour le bouton mode
    if (typeof updateModeBtn === 'function') updateModeBtn();

  } catch(e) {
    console.error(`Erreur chargement page "${name}":`, e);
    getContainer().innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <p>Erreur de chargement de la page "${name}".</p>
    </div>`;
  }
}

// ── Mise à jour de la navigation ──
function updateNav(name) {
  document.querySelectorAll('.av-tab[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === name);
  });
}

// ── Navigation vers les sous-vues (sans rechargement HTML) ──
// Appelées depuis app.js quand on navigue en interne
// (ex: clic sur une aventure → donjons, clic sur un donjon → détail)

function navigateTo(name) {
  loadPage(name);
}

// Surcharger backToAventures et backToDj pour utiliser loadPage
// (définis dans app.js mais ont besoin du loader)
function backToAventures() {
  S.avId = null;
  S.djNum = null;
  loadPage('aventures');
}

function backToDj() {
  loadPage('donjons');
}

// showDonjons déclenche le chargement de la page donjons
const _showDonjons = typeof showDonjons === 'function' ? showDonjons : null;
function goToDonjons(avId) {
  S.avId = avId;
  loadPage('donjons');
}

// showDonjon déclenche le chargement de la page donjon
function goToDonjon(avId, num) {
  S.avId = avId;
  S.djNum = num;
  loadPage('donjon');
}

// ── Initialisation des dés ──
function initDes() {
  const lbl = document.getElementById('dice-lbl');
  if (lbl) lbl.textContent = `d${S.diceSides} — clique pour lancer`;
  // Restituer le cumul si des jets existent déjà
  if (typeof renderCumul === 'function') renderCumul();
}

// ── Print ──
function openPrint() {
  window.open('aventure/print.html', '_blank');
}

// ── Init au chargement ──
window.addEventListener('DOMContentLoaded', () => {
  loadPage('aventures');
});
