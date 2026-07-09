(function(){
  var STORAGE_KEY = 'mytools_unlocked_v1';
  var PASSWORD_HASH = 'COLLE_TON_HASH_ICI';

  if (localStorage.getItem(STORAGE_KEY) === 'true') return;

  document.documentElement.style.visibility = 'hidden';

  function sha256(text){
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      .then(function(buf){
        return Array.from(new Uint8Array(buf)).map(function(b){
          return b.toString(16).padStart(2, '0');
        }).join('');
      });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var gate = document.createElement('div');
    gate.innerHTML =
      '<div style="position:fixed;inset:0;z-index:9999;background:#0d0a1a;' +
      'display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);' +
        'border-radius:16px;padding:32px 28px;text-align:center;max-width:300px;width:90%;' +
        'font-family:Quicksand,sans-serif;">' +
          '<div style="font-size:36px;margin-bottom:8px;">🔒</div>' +
          '<h2 style="color:#f0ecff;margin-bottom:16px;font-size:18px;">Accès protégé</h2>' +
          '<input id="pwd-input" type="password" placeholder="Mot de passe" autocomplete="off" ' +
          'style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);' +
          'background:rgba(255,255,255,0.05);color:#f0ecff;margin-bottom:12px;font-size:14px;box-sizing:border-box;">' +
          '<button id="pwd-submit" style="width:100%;padding:10px;border-radius:8px;border:none;' +
          'background:linear-gradient(135deg,#ff79c6,#bd93f9);color:#1a1428;font-weight:700;cursor:pointer;">Entrer</button>' +
          '<p id="pwd-error" style="color:#ff79c6;font-size:12px;margin-top:10px;min-height:14px;"></p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(gate);
    document.documentElement.style.visibility = 'visible';

    var input = document.getElementById('pwd-input');
    var error = document.getElementById('pwd-error');
    var submit = document.getElementById('pwd-submit');

    function tryUnlock(){
      sha256(input.value).then(function(hash){
        if (hash === PASSWORD_HASH) {
          localStorage.setItem(STORAGE_KEY, 'true');
          gate.remove();
        } else {
          error.textContent = 'Mot de passe incorrect.';
          input.value = '';
          input.focus();
        }
      });
    }

    submit.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') tryUnlock(); });
    input.focus();
  });
})();
