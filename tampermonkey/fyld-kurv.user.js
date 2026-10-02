// ==UserScript==
// @name         Fyld kurv – Madklubben
// @namespace    madklubben-bestilling
// @version      0.1.2
// @description  Lægger optællingen fra kælderlisten i kurven hos leverandøren. Bestiller aldrig – det gør du selv.
// @homepageURL  https://github.com/LasseBlom/madklubben-fyld-kurv
// @updateURL    https://raw.githubusercontent.com/LasseBlom/madklubben-fyld-kurv/main/tampermonkey/fyld-kurv.user.js
// @downloadURL  https://raw.githubusercontent.com/LasseBlom/madklubben-fyld-kurv/main/tampermonkey/fyld-kurv.user.js
// @match        https://shop.carlsbergdanmark.dk/Favoritter/Favoritliste*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- Leverandører ----------
   * Hver leverandør beskriver: navn (som i Google-arket), hvordan rækkerne
   * på favoritlisten findes, og hvor kurven er. Sigurd Müller og Philipson
   * tilføjes her senere.
   */
  const LEVERANDORER = {
    'shop.carlsbergdanmark.dk': {
      navn: 'Carlsberg',
      kurvUrl: '/Checkout',
      // Én række pr. vare: antalsfelt + kurv-knap + "Varenr. 12345" i teksten.
      findRaekker() {
        const map = {};
        document.querySelectorAll('input[type="number"]').forEach(input => {
          let row = input;
          while (row.parentElement && !/Varenr\.\s*\d+/.test(row.textContent)) row = row.parentElement;
          while (row.parentElement && (row.parentElement.textContent.match(/Varenr\./g) || []).length === 1) row = row.parentElement;
          const m = row.textContent.match(/Varenr\.\s*(\d+)/);
          const knap = (input.closest('form') || row).querySelector('button[type="submit"]');
          if (m && knap && !map[m[1]]) map[m[1]] = { input, knap };
        });
        return map;
      },
      // Kurvens beløb står i et <span> øverst til højre ("0,00 kr.").
      kurvBeloeb() {
        const el = [...document.querySelectorAll('span')].find(e =>
          /^[\d.]+,\d{2}\s*kr\.$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < 80);
        return el ? el.textContent.trim().replace(/\s*kr\.$/, '') : null;
      },
    },
  };

  const lev = LEVERANDORER[location.hostname];
  if (!lev) return;

  /* ---------- Sikkerhed ----------
   * Scriptet læser kun varenumre og knapper på favoritlisten, og det eneste,
   * det henter udefra, er optællingen (varenavne og antal). Det sender aldrig
   * noget fra webshoppen videre, rører aldrig kassen og bestiller aldrig.
   * Data fra kælderlisten stoles ikke blindt på: varenumre skal være tal,
   * antal skal være 1-99, og store antal skal bekræftes.
   */
  const MAKS_ANTAL = 99;
  const STORT_ANTAL = 30;

  /* ---------- Hjælpere ---------- */
  const vent = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saetVaerdi = (input, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  };

  function hentOptaelling(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url + (url.includes('?') ? '&' : '?') + 'format=json',
        timeout: 20000,
        onload: r => {
          try { resolve(JSON.parse(r.responseText)); }
          catch (e) { reject(new Error('Svaret fra kælderlisten kunne ikke læses. Er adressen rigtig?')); }
        },
        onerror: () => reject(new Error('Kunne ikke kontakte kælderlisten. Tjek internetforbindelsen.')),
        ontimeout: () => reject(new Error('Kælderlisten svarede ikke i tide. Prøv igen.')),
      });
    });
  }

  /* ---------- Brugerflade (i shadow DOM, så webshoppens CSS ikke blander sig) ---------- */
  const vaert = document.createElement('div');
  vaert.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  document.body.appendChild(vaert);
  const rod = vaert.attachShadow({ mode: 'open' });
  rod.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .fab { background: #8b2f1e; color: #fff; border: 0; border-radius: 999px; padding: 14px 22px; font-size: 16px; font-weight: 700;
             letter-spacing: .02em; box-shadow: 0 6px 20px rgba(0,0,0,.25); cursor: pointer; }
      .fab:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #d86b52; outline-offset: 2px; }
      .panel { width: 360px; max-width: calc(100vw - 40px); max-height: 70vh; overflow: auto; background: #fff; color: #1a1d1c;
               border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.3); padding: 18px; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p { margin: 6px 0; font-size: 14px; line-height: 1.4; color: #3b423f; }
      .warn { background: #f7ecd3; color: #6b4600; padding: 8px 10px; border-radius: 8px; }
      .err { background: #f3e3df; color: #8b2f1e; padding: 8px 10px; border-radius: 8px; }
      ul { list-style: none; margin: 10px 0; padding: 0; border: 1px solid #e2e5e3; border-radius: 10px; }
      li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-top: 1px solid #e2e5e3; font-size: 14px; }
      li:first-child { border-top: 0; }
      li .s { flex: 0 0 auto; font-variant-numeric: tabular-nums; color: #5d6663; }
      li[data-s="ok"] .s { color: #2c6e45; font-weight: 700; }
      li[data-s="fejl"] .s { color: #8b2f1e; font-weight: 700; }
      .row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
      button.p { flex: 1; background: #8b2f1e; color: #fff; border: 0; border-radius: 10px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer; }
      button.g { background: none; border: 1px solid #d5d9d7; color: #3b423f; border-radius: 10px; padding: 12px 14px; font-size: 15px; cursor: pointer; }
      button:disabled { opacity: .5; cursor: default; }
      a.p { flex: 1; display: block; text-align: center; background: #2c6e45; color: #fff; text-decoration: none; border-radius: 10px; padding: 12px; font-weight: 700; font-size: 15px; }
      input { width: 100%; padding: 10px; border: 1px solid #d5d9d7; border-radius: 8px; font-size: 14px; margin-top: 6px; }
      .small { font-size: 12px; color: #5d6663; }
      .link { background: none; border: 0; color: #5d6663; text-decoration: underline; padding: 0; font-size: 12px; cursor: pointer; }
    </style>
    <button class="fab" id="fab" type="button">Fyld kurv</button>
    <div class="panel" id="panel" hidden></div>`;
  const fab = rod.getElementById('fab');
  const panel = rod.getElementById('panel');
  const vis = html => { panel.innerHTML = html; panel.hidden = false; fab.hidden = true; };
  const luk = () => { panel.hidden = true; fab.hidden = false; };

  fab.addEventListener('click', start);

  /* ---------- Trin 1: kend kælderlisten ---------- */
  function start() {
    const url = GM_getValue('kaelderlisteUrl', '');
    if (!url) return visOpsaetning();
    hent(url);
  }

  function visOpsaetning(fejl) {
    vis(`
      <h2>Forbind til kælderlisten</h2>
      <p>Indsæt adressen på jeres kælderliste (den der slutter på <b>/exec</b>). Det skal kun gøres én gang.</p>
      ${fejl ? `<p class="err">${esc(fejl)}</p>` : ''}
      <input id="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(GM_getValue('kaelderlisteUrl', ''))}">
      <div class="row"><button class="p" id="gem" type="button">Gem og fortsæt</button><button class="g" id="luk" type="button">Luk</button></div>`);
    rod.getElementById('luk').onclick = luk;
    rod.getElementById('gem').onclick = () => {
      const v = rod.getElementById('url').value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(v)) return visOpsaetning('Adressen skal starte med https://script.google.com/macros/s/ og slutte på /exec.');
      GM_setValue('kaelderlisteUrl', v);
      hent(v);
    };
  }

  /* ---------- Trin 2: hent optælling og vis hvad der sker ---------- */
  async function hent(url) {
    vis(`<h2>Henter optællingen …</h2>`);
    let data;
    try { data = await hentOptaelling(url); }
    catch (e) { return vis(`<h2>Noget gik galt</h2><p class="err">${esc(e.message)}</p><div class="row"><button class="p" id="igen" type="button">Prøv igen</button><button class="g" id="luk" type="button">Luk</button></div><p><button class="link" id="skift" type="button">Skift kælderliste-adresse</button></p>`), bind({ igen: () => hent(url), luk, skift: () => visOpsaetning() }); }

    const alle = (data.varer || []).filter(v => v && v.leverandor === lev.navn && Number(v.antal) > 0);
    const ugyldige = alle.filter(v => !/^\d{1,10}$/.test(String(v.varenr)) || !Number.isInteger(Number(v.antal)) || Number(v.antal) > MAKS_ANTAL);
    const varer = alle.filter(v => !ugyldige.includes(v)).map(v => Object.assign({}, v, { antal: Number(v.antal) }));
    const store = varer.filter(v => v.antal > STORT_ANTAL);
    const opd = data.opdateret ? new Date(data.opdateret).toLocaleString('da-DK', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'ukendt';
    if (!varer.length) {
      return vis(`<h2>Intet at bestille hos ${esc(lev.navn)}</h2><p>Der er ikke talt nogen ${esc(lev.navn)}-varer på kælderlisten.</p><p class="small">Sidst ændret: ${esc(opd)}</p><div class="row"><button class="g" id="luk" type="button">Luk</button></div>`), bind({ luk });
    }

    const raekker = lev.findRaekker();
    if (!Object.keys(raekker).length) {
      return vis(`<h2>Favoritlisten er ikke klar</h2><p>Siden er ikke færdig med at indlæse. Vent et øjeblik, og tryk igen.</p><div class="row"><button class="p" id="igen" type="button">Prøv igen</button><button class="g" id="luk" type="button">Luk</button></div>`), bind({ igen: () => hent(url), luk });
    }

    const beloeb = lev.kurvBeloeb();
    const harVarer = beloeb && beloeb !== '0,00';
    vis(`
      <h2>${varer.length} ${varer.length === 1 ? 'vare' : 'varer'} til ${esc(lev.navn)}</h2>
      <p class="small">${esc(data.restaurant || '')} · optælling sidst ændret ${esc(opd)}</p>
      ${harVarer ? `<p class="warn">Der ligger allerede varer for ${esc(beloeb)} kr. i kurven. De bliver liggende – de nye lægges oveni.</p>` : ''}
      ${store.length ? `<p class="warn">Usædvanligt stort antal: ${store.map(v => `${esc(v.antal)} × ${esc(v.navn)}`).join(', ')}. Tjek at det er rigtigt, før du fortsætter.</p>` : ''}
      ${ugyldige.length ? `<p class="err">${ugyldige.length} ${ugyldige.length === 1 ? 'vare' : 'varer'} på kælderlisten har ugyldige data og springes over: ${ugyldige.map(v => esc(v.navn)).join(', ')}.</p>` : ''}
      <ul>${varer.map(v => `<li data-id="${esc(v.id)}"><span>${esc(v.antal)} × ${esc(v.navn)} <span class="small">(${esc(v.enhed)})</span></span><span class="s">klar</span></li>`).join('')}</ul>
      <div class="row"><button class="p" id="go" type="button">Læg i kurven</button><button class="g" id="luk" type="button">Annuller</button></div>`);
    bind({ go: () => fyld(varer), luk });
  }

  function bind(handlers) {
    Object.entries(handlers).forEach(([id, fn]) => { const el = rod.getElementById(id); if (el) el.onclick = fn; });
  }

  /* ---------- Trin 3: læg i kurven, én vare ad gangen ---------- */
  async function fyld(varer) {
    rod.getElementById('go').disabled = true;
    rod.getElementById('luk').disabled = true;
    const raekker = lev.findRaekker();
    const fejl = [];
    for (const v of varer) {
      const li = panel.querySelector(`li[data-id="${CSS.escape(v.id)}"]`);
      const status = (s, t) => { li.dataset.s = s; li.querySelector('.s').textContent = t; };
      const r = raekker[String(v.varenr)];
      if (!r) { status('fejl', 'ikke på listen'); fejl.push(v); continue; }
      status('', 'lægger i …');
      r.input.scrollIntoView({ block: 'center' });
      saetVaerdi(r.input, v.antal);
      await vent(300);
      r.knap.click();
      await vent(2200);
      status('ok', '✓');
    }
    const ok = varer.length - fejl.length;
    const slut = panel.querySelector('.row');
    slut.outerHTML = `
      ${fejl.length ? `<p class="err">${fejl.length} ${fejl.length === 1 ? 'vare' : 'varer'} kunne ikke findes på favoritlisten: ${fejl.map(v => esc(v.navn)).join(', ')}. Læg dem i kurven selv.</p>` : ''}
      <p>${ok} ${ok === 1 ? 'vare er' : 'varer er'} lagt i kurven. Tjek kurven, og bestil som du plejer.</p>
      <div class="row"><a class="p" href="${esc(lev.kurvUrl)}">Gå til kurven</a><button class="g" id="luk" type="button">Luk</button></div>`;
    bind({ luk });
  }
})();
