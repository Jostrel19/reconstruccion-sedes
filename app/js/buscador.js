/* app/js/buscador.js — Buscador de sedes y migas.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Buscador de sedes (barra superior): por nombre, institución,
     municipio o DANE, dentro del alcance de la sesión. ─── */
  let buscaActivo = -1;
  function resultadosBusqueda(q){
    const palabras = normalizar(q).split(/\s+/).filter(Boolean);
    if (!SEDES || !palabras.length || normalizar(q).length < 2) return [];
    return SEDES.filter(s => {
      const t = normalizar(`${s.dane_sede} ${s.institucion} ${s.sede} ${s.municipio}`);
      return palabras.every(w => t.includes(w));
    }).slice(0, 12);
  }
  function pintarBusqueda(){
    const input = document.getElementById('busca');
    const cont = document.getElementById('busca-res');
    const res = resultadosBusqueda(input.value);
    const abierto = normalizar(input.value).length >= 2;
    cont.classList.toggle('oculto', !abierto);
    input.setAttribute('aria-expanded', String(abierto));
    if (!abierto) return;
    buscaActivo = Math.min(buscaActivo, res.length - 1);
    cont.innerHTML = res.length ? res.map((s, i) => `
      <button type="button" class="busca-item${i === buscaActivo ? ' act' : ''}" role="option" data-dane="${esc(s.dane_sede)}">
        <b>${esc(nombreSedeCorto(s))}</b><span>${esc(s.municipio)} · ${esc(s.dane_sede)}</span></button>`).join('')
      : `<div class="busca-vacio">${SEDES ? 'Ninguna sede coincide.' : 'Cargando sedes…'}</div>`;
  }
  function elegirBusqueda(dane){
    const input = document.getElementById('busca');
    input.value = ''; buscaActivo = -1;
    pintarBusqueda();
    input.blur();
    irFicha(dane);
  }

  function migasSede(dane, final){
    const sf = SEDES && SEDES.find(x => String(x.dane_sede) === String(dane));
    const muniSede = sf ? sf.municipio : (muniActual || '');
    const nombreSede = sf ? nombreSedeCorto(sf) : dane;
    let html = `<a href="#" data-nav="sedes">Caldas</a><span class="sep">›</span>` +
      `<a href="#" data-nav="muni" data-muni="${esc(muniSede)}">${esc(muniSede)}</a><span class="sep">›</span>`;
    html += final
      ? `<a href="#" data-nav="ficha" data-dane="${esc(dane)}">${esc(nombreSede)}</a><span class="sep">›</span><span class="hoy">${esc(final)}</span>`
      : `<span class="hoy">${esc(nombreSede)}</span>`;
    return html;
  }

