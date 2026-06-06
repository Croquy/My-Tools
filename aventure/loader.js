const FRAGMENTS={aventures:'aventure/aventures.html',donjon:'aventure/donjon.html',codex:'aventure/codex.html',regles:'aventure/regles.html',print:'aventure/print.html'};
function updateNav(name){document.querySelectorAll('.av-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===name));}
function loadPage(name){
  const url=FRAGMENTS[name];
  if(!url) return;
  fetch(url).then(r=>r.text()).then(html=>{
    document.getElementById('page-content').innerHTML=html;
    updateNav(name);
    if(typeof showView==='function'){
      showView(name==='donjon'?'donjons':name);
    }
  }).catch(()=>{
    document.getElementById('page-content').innerHTML='<p>Erreur de chargement.</p>';
  });
}
function openPrint(){window.open(FRAGMENTS.print,'_blank');}
window.addEventListener('DOMContentLoaded',()=>loadPage('aventures'));