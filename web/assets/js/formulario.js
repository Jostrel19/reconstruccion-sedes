/**
 * FORMULARIO PRESUPUESTAL — secciones 1 a 4 del formato oficial.
 *
 * Reglas que no se negocian:
 *  - El DANE nunca se digita, solo se hereda del catálogo.
 *  - Todo valor calculado lo calcula el sistema: valor total del ítem, costo
 *    directo, A, U, IVA y total. En el formato Word los tres se digitan y no
 *    cuadran; es la primera causa de devolución.
 *  - Unidad de medida y capítulo de daño son catálogos cerrados: en texto libre
 *    llegan «mt2», «M2» y «metro cuadrado».
 *  - El tipo de afectación del censo se muestra en solo lectura (D-6). Lo que
 *    declara el municipio se guarda aparte y, si difiere, se marca discrepancia.
 */

const formulario = {
  sede: null,
  d: null,

  /* ------------------------------------------------------------- apertura */

  async abrir(sede) {
    this.sede = sede;
    const reg = db.registro(sede.dane_sede);
    const bor = db.borrador(sede.dane_sede);
    const m = tablero.datosMunicipio();

    this.d = bor || (reg ? { ...reg } : null) || {
      declara_afectacion: clasificarSede(sede) === 'ABIERTA',
      justificacion_discrepancia: '',
      descripcion_afectacion: '',
      rector: sede.rector || '',
      correo: sede.correo_ie || '',
      celular: sede.celular_ie || '',
      alcalde: m.alcalde || '',
      items: [],
      pct_admin: '',
      pct_utilidad: '',
      plazo_dias: '',
      actividades: '',
      fotos: []
    };
    if (!this.d.items) this.d.items = [];
    if (!this.d.fotos) this.d.fotos = [];
    if (!this.d.items.length) this.d.items.push(this._itemVacio());

    // Las imágenes viven en IndexedDB, no en el registro: se recuperan aquí
    // para que al reabrir una sede el trabajo no se haya perdido.
    const guardadas = await almacen.leer(sede.dane_sede);
    if (guardadas && guardadas.length) this.d.fotos = guardadas;

    this.d.firma = almacen.firma('alcalde');
    this._pintar();
  },

  _itemVacio() {
    return { capitulo_dano: '', descripcion: '', unidad: '', cantidad: '', valor_unitario: '' };
  },

  /* -------------------------------------------------------------- cálculos */

  /**
   * Interpreta cifras como las escribe un funcionario colombiano.
   * Con <input type="number"> el navegador vaciaba el campo ante «1.500.000» y
   * el sistema calculaba 0 sin avisar; de ahí que los campos sean de texto y el
   * parseo se haga aquí.
   *
   *   1.500.000  -> 1500000     (punto = miles)
   *   1.500,50   -> 1500.5      (punto miles, coma decimales)
   *   1500,50    -> 1500.5
   *   1.5        -> 1.5         (un solo grupo de 1 dígito: es decimal)
   */
  _num(v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    let s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) return 0;
    s = s.replace(/[$\s ]/g, '');
    const coma = s.includes(',');
    const punto = s.includes('.');
    if (coma && punto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (coma) {
      s = s.replace(',', '.');
    } else if (punto) {
      const partes = s.split('.');
      const sonMiles = partes.length > 1 && partes.slice(1).every(x => x.length === 3);
      if (sonMiles) s = partes.join('');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  },

  /** Reescribe el campo con separadores, para que el usuario confirme
   *  que el sistema entendió lo mismo que quiso escribir. */
  _formatearCampo(el) {
    const n = this._num(el.value);
    el.value = el.value.trim() === '' ? '' : app.numero(n);
  },

  calcular() {
    const items = this.d.items.map(it => ({
      ...it,
      valor_total: this._num(it.cantidad) * this._num(it.valor_unitario)
    }));
    const costo_directo = items.reduce((a, it) => a + it.valor_total, 0);
    const pct_admin = this._num(this.d.pct_admin);
    const pct_utilidad = this._num(this.d.pct_utilidad);
    const valor_admin = costo_directo * pct_admin / 100;
    const valor_utilidad = costo_directo * pct_utilidad / 100;
    const valor_iva = valor_utilidad * APP_CONFIG.IVA_SOBRE_UTILIDAD_PCT / 100;
    return {
      items,
      costo_directo,
      pct_admin,
      pct_utilidad,
      valor_admin,
      valor_utilidad,
      valor_iva,
      total_presupuesto: costo_directo + valor_admin + valor_utilidad + valor_iva
    };
  },

  /* --------------------------------------------------------------- pintado */

  _pintar() {
    const s = this.sede;
    const c = this.calcular();
    const clase = clasificarSede(s);
    const afecta = !!this.d.declara_afectacion;

    // Discrepancia: el municipio dice lo contrario de lo que dice el censo.
    const censoDiceAfectada = clase === 'ABIERTA';
    const censoDiceSana = clase === 'PREMARCADA_SIN';
    const discrepa = (afecta && censoDiceSana) || (!afecta && censoDiceAfectada);

    document.getElementById('modal').innerHTML = `
    <div class="velo" id="velo">
      <div class="dialogo" role="dialog" aria-modal="true">
        <header>
          <strong>Informe técnico-presupuestal</strong>
          <span class="sep"></span>
          <span style="font-size:.82rem;opacity:.85">${app.esc(s.sede)}</span>
          <button type="button" id="btnCerrar" title="Cerrar">×</button>
        </header>
        <div class="cuerpo">

          <div class="tarjeta">
            <h2>1. Datos de identificación</h2>
            <div class="rejilla r3">
              <div class="campo"><label>Municipio</label>
                <input value="${app.esc(s.municipio)}" readonly></div>
              <div class="campo"><label>Código DANE de la sede</label>
                <input value="${s.dane_sede}" readonly title="Se hereda del catálogo, no se digita"></div>
              <div class="campo"><label>Zona / Matrícula</label>
                <input value="${s.zona} · ${s.matricula} estudiantes" readonly></div>
            </div>
            <div class="rejilla r2">
              <div class="campo"><label>Institución educativa</label>
                <input value="${app.esc(s.institucion)}" readonly></div>
              <div class="campo"><label>Sede educativa</label>
                <input value="${app.esc(s.sede)}" readonly></div>
            </div>
            <div class="campo">
              <label>Firma del alcalde o de quien diligencia</label>
              <div class="firma-caja">
                <div class="firma-lienzo" id="vistaFirma"></div>
                <div>
                  <input type="file" id="fFirma" accept="image/png,image/jpeg" hidden>
                  <button type="button" class="btn sec mini" id="btnFirma">
                    Subir imagen de la firma
                  </button>
                  <button type="button" class="btn sec mini" id="btnQuitarFirma" hidden>Quitar</button>
                  <p class="sub" style="margin:.3rem 0 0">
                    Foto o escaneo de la firma sobre papel blanco. Queda guardada y se usa en todas
                    las sedes de este municipio; no hay que subirla cada vez.
                  </p>
                </div>
              </div>
            </div>
            <div class="rejilla r4">
              <div class="campo"><label for="fAlcalde">Alcalde</label>
                <input id="fAlcalde" value="${app.esc(this.d.alcalde)}"></div>
              <div class="campo"><label for="fRector">Rector(a)</label>
                <input id="fRector" value="${app.esc(this.d.rector)}"></div>
              <div class="campo"><label for="fCorreo">Correo de contacto</label>
                <input id="fCorreo" type="email" value="${app.esc(this.d.correo)}"></div>
              <div class="campo"><label for="fCelular">Celular de contacto</label>
                <input id="fCelular" value="${app.esc(this.d.celular)}"></div>
            </div>
          </div>

          <div class="tarjeta">
            <h2>2. Necesidad y grado de afectación</h2>
            <div class="rejilla r2">
              <div class="campo">
                <label>Clasificación del censo del 27 de agosto de 2026</label>
                <div style="padding:.3rem 0">
                  ${app.etiquetaTipo(s.tipo_censo)}
                  ${s.nivel_censo ? `<span class="sub"> · Nivel: ${app.esc(s.nivel_censo)}</span>` : ''}
                </div>
                <p class="sub">Dato de la visita técnica. No se modifica desde aquí.</p>
              </div>
              <div class="campo">
                <label for="fDeclara">¿La sede presenta afectación que requiera inversión?</label>
                <select id="fDeclara">
                  <option value="si" ${afecta ? 'selected' : ''}>Sí — requiere presupuesto</option>
                  <option value="no" ${!afecta ? 'selected' : ''}>No — sin afectación</option>
                </select>
              </div>
            </div>

            ${discrepa ? `
              <div class="nota alerta">
                <strong>Su declaración difiere del censo.</strong>
                ${afecta
                  ? 'El censo clasificó esta sede como <em>tipo 5 · sin afectación</em> y usted declara que sí presenta afectación.'
                  : 'El censo clasificó esta sede con afectación tipo 1 a 4 y usted declara que no la presenta.'}
                Debe justificarlo. La Secretaría revisará el caso.
              </div>
              <div class="campo">
                <label for="fJustifica">Justificación de la diferencia con el censo *</label>
                <textarea id="fJustifica" placeholder="Explique en qué se basa su declaración."
                  >${app.esc(this.d.justificacion_discrepancia)}</textarea>
                <div class="error-txt" id="eJustifica" hidden></div>
              </div>` : ''}

            <div id="bloqueAfectacion" ${afecta ? '' : 'hidden'}>
              <div class="campo">
                <label for="fDescripcion">Descripción de la afectación y necesidad de inversión *</label>
                <textarea id="fDescripcion" maxlength="${APP_CONFIG.DESCRIPCION_MAX}"
                  placeholder="Describa los daños observados y qué intervención requiere la sede."
                  >${app.esc(this.d.descripcion_afectacion)}</textarea>
                <p class="sub"><span id="contDesc">0</span> / ${APP_CONFIG.DESCRIPCION_MAX} caracteres
                   (mínimo ${APP_CONFIG.DESCRIPCION_MIN}).</p>
                <div class="error-txt" id="eDescripcion" hidden></div>
              </div>
              <div class="campo">
                <label>Registro fotográfico * (mínimo ${APP_CONFIG.FOTOS_MIN}, máximo ${APP_CONFIG.FOTOS_MAX})</label>
                <input type="file" id="fFotos" accept="image/jpeg,image/png,image/webp" multiple>
                <p class="sub">Las imágenes se reducen automáticamente antes de enviarse.</p>
                <div class="fotos" id="listaFotos"></div>
                <div class="nota alerta" id="avisoFotos" hidden style="margin-top:.5rem"></div>
                <div class="error-txt" id="eFotos" hidden></div>
              </div>
            </div>
          </div>

          <div id="bloquePresupuesto" ${afecta ? '' : 'hidden'}>
            <div class="tarjeta">
              <h2>3. Presupuesto detallado y discriminado</h2>
              <div class="nota">
                <strong>Cada fila es un trabajo que se va a ejecutar</strong>, no el daño que se
                observa. El daño ya lo describió en el punto 2.
                <div class="ejemplos">
                  <div>
                    <b>Si puede medirlo</b> — indique la unidad, cuántas van y cuánto cuesta cada una.
                    <span class="ej">Reposición de cubierta en teja &middot; <b>m²</b> &middot;
                    <b>120</b> &middot; <b>$85.000</b> &rarr; $10.200.000</span>
                  </div>
                  <div>
                    <b>Si no puede desglosarlo</b> — use la unidad <b>gl (global)</b>, cantidad
                    <b>1</b>, y escriba el costo completo del trabajo en «valor unitario».
                    <span class="ej">Reconstrucción de cocina y restaurante &middot; <b>gl</b>
                    &middot; <b>1</b> &middot; <b>$80.000.000</b> &rarr; $80.000.000</span>
                  </div>
                </div>
                Use una fila por trabajo. El valor total de cada fila y el costo directo los calcula
                el sistema.
              </div>
              <div class="tabla-scroll">
                <table id="tablaItems">
                  <thead><tr>
                    <th style="width:2rem">#</th>
                    <th style="min-width:155px">Capítulo de daño</th>
                    <th style="min-width:195px">Trabajo a ejecutar</th>
                    <th style="min-width:112px">Unidad</th>
                    <th class="num" style="min-width:78px">Cantidad</th>
                    <th class="num" style="min-width:112px">Valor unitario</th>
                    <th class="num" style="min-width:105px">Valor total</th>
                    <th style="width:2rem"></th>
                  </tr></thead>
                  <tbody id="cuerpoItems"></tbody>
                </table>
              </div>
              <div class="acciones" style="margin-top:.7rem">
                <button type="button" class="btn sec mini" id="btnAgregar">+ Agregar actividad</button>
              </div>
              <div class="error-txt" id="eItems" hidden></div>
            </div>

            <div class="tarjeta">
              <h2>3.1 Resumen económico</h2>
              <div class="nota">
                Sobre el costo directo se agregan dos conceptos, que el municipio define:
                <div class="ejemplos">
                  <div>
                    <b>Administración</b> — lo que cuesta administrar la obra: personal, pólizas,
                    transporte, servicios públicos e impuestos.
                    <span class="ej">Referencia de mercado: <b>10 %</b></span>
                  </div>
                  <div>
                    <b>Utilidad</b> — la ganancia del contratista que ejecute la obra.
                    <span class="ej">Referencia de mercado: <b>5 %</b></span>
                  </div>
                </div>
                <b>No existe un tope legal de estos porcentajes en Colombia:</b> cada entidad los
                define y debe poder sustentarlos. Si supera ${APP_CONFIG.ALERTA_ADMIN_PCT} % o
                ${APP_CONFIG.ALERTA_UTILIDAD_PCT} % el sistema le avisa, pero puede radicar igual.
              </div>
              <div class="rejilla r2">
                <div>
                  <div class="rejilla r2">
                    <div class="campo">
                      <label for="fAdmin">Administración (%) *</label>
                      <input id="fAdmin" type="text" inputmode="decimal"
                             value="${app.esc(this.d.pct_admin)}">
                    </div>
                    <div class="campo">
                      <label for="fUtilidad">Utilidad (%) *</label>
                      <input id="fUtilidad" type="text" inputmode="decimal"
                             value="${app.esc(this.d.pct_utilidad)}">
                    </div>
                  </div>
                  <p class="sub">
                    No se incluyen imprevistos. El IVA del
                    ${APP_CONFIG.IVA_SOBRE_UTILIDAD_PCT} % se liquida sobre la utilidad
                    (Decreto 1372 de 1992, art. 3).
                  </p>
                  <div id="alertaAU"></div>
                  <div class="error-txt" id="eAU" hidden></div>
                </div>
                <div class="totales" id="totales"></div>
              </div>
            </div>

            <div class="tarjeta">
              <h2>4. Plazo de ejecución</h2>
              <div class="nota">
                Los días que toma <b>ejecutar la obra una vez esté contratada</b>. No incluya el
                tiempo del proceso de contratación, que no depende del municipio.
              </div>
              <div class="rejilla r2">
                <div class="campo">
                  <label for="fPlazo">Plazo total estimado (días calendario) *</label>
                  <input id="fPlazo" type="text" inputmode="numeric"
                         placeholder="Ej: 90"
                         value="${app.esc(this.d.plazo_dias)}">
                  <div class="error-txt" id="ePlazo" hidden></div>
                </div>
                <div class="campo">
                  <label for="fActividades">Actividades previstas y su duración</label>
                  <textarea id="fActividades" placeholder="Una actividad por línea, con su duración. Por ejemplo:&#10;Desmonte y retiro de escombros: 15 días&#10;Reposición de cubierta: 45 días&#10;Acabados y entrega: 15 días"
                    >${app.esc(this.d.actividades)}</textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="nota">
            La sección 5 del formato —observaciones de verificación— la diligencia la Secretaría de
            Educación, no el municipio.
          </div>
        </div>

        <footer>
          <button type="button" class="btn sec" id="btnBorrador">Guardar borrador</button>
          <span class="sep" style="flex:1"></span>
          <span class="sub" id="pieTotal"></span>
          <button type="button" class="btn ok" id="btnRadicar">Radicar</button>
        </footer>
      </div>
    </div>`;

    document.body.style.overflow = 'hidden';
    this._pintarItems();
    this._pintarTotales();
    this._pintarFotos();
    this._pintarFirma();
    this._contarDescripcion();
    this._conectar();
  },

  /* ---------------------------------------------------------------- ítems */

  _pintarItems() {
    const c = this.calcular();
    const opcCap = APP_CONFIG.CAPITULOS.map(x =>
      `<option value="${x.id}">${x.nombre}</option>`).join('');
    const opcUni = APP_CONFIG.UNIDADES.map(x =>
      `<option value="${x.id}">${x.label}</option>`).join('');

    document.getElementById('cuerpoItems').innerHTML = c.items.map((it, i) => `
      <tr data-i="${i}">
        <td>${i + 1}</td>
        <td><select data-campo="capitulo_dano">
              <option value="">Seleccione…</option>${opcCap}
            </select></td>
        <td><input data-campo="descripcion" value="${app.esc(it.descripcion)}"
                   placeholder="Ej: Reposición de cubierta en teja"></td>
        <td><select data-campo="unidad">
              <option value="">Seleccione…</option>${opcUni}
            </select></td>
        <td><input data-campo="cantidad" type="text" inputmode="decimal" class="num"
                   value="${app.esc(it.cantidad)}"></td>
        <td><input data-campo="valor_unitario" type="text" inputmode="decimal" class="num"
                   value="${app.esc(it.valor_unitario)}"></td>
        <td class="num"><strong>${app.pesos(it.valor_total)}</strong></td>
        <td><button type="button" class="btn mini sec" data-quitar="${i}"
                    title="Quitar esta fila">×</button></td>
      </tr>`).join('');

    // Los select se fijan por valor después de pintar, para no repetir 'selected'.
    c.items.forEach((it, i) => {
      const tr = document.querySelector(`#cuerpoItems tr[data-i="${i}"]`);
      tr.querySelector('[data-campo="capitulo_dano"]').value = it.capitulo_dano || '';
      tr.querySelector('[data-campo="unidad"]').value = it.unidad || '';
    });
  },

  _pintarTotales() {
    const c = this.calcular();
    document.getElementById('totales').innerHTML = `
      <div><span>Costo directo</span><span>${app.pesos(c.costo_directo)}</span></div>
      <div><span>Administración (${app.numero(c.pct_admin)} %)</span><span>${app.pesos(c.valor_admin)}</span></div>
      <div><span>Utilidad (${app.numero(c.pct_utilidad)} %)</span><span>${app.pesos(c.valor_utilidad)}</span></div>
      <div><span>IVA ${APP_CONFIG.IVA_SOBRE_UTILIDAD_PCT} % sobre la utilidad</span><span>${app.pesos(c.valor_iva)}</span></div>
      <div class="grande"><span>Valor total requerido para la obra</span><span>${app.pesos(c.total_presupuesto)}</span></div>`;

    document.getElementById('pieTotal').textContent =
      `Costo directo ${app.pesos(c.costo_directo)} · Total ${app.pesos(c.total_presupuesto)}`;

    // Alerta de mercado. No bloquea: no existe tope legal de AIU en Colombia.
    const avisos = [];
    if (c.pct_admin > APP_CONFIG.ALERTA_ADMIN_PCT) {
      avisos.push(`Administración del ${app.numero(c.pct_admin)} %, por encima de la referencia
                   de mercado (${APP_CONFIG.ALERTA_ADMIN_PCT} %).`);
    }
    if (c.pct_utilidad > APP_CONFIG.ALERTA_UTILIDAD_PCT) {
      avisos.push(`Utilidad del ${app.numero(c.pct_utilidad)} %, por encima de la referencia
                   de mercado (${APP_CONFIG.ALERTA_UTILIDAD_PCT} %).`);
    }
    document.getElementById('alertaAU').innerHTML = avisos.length
      ? `<div class="nota alerta">${avisos.join('<br>')}
           Puede radicar así; el caso quedará marcado para revisión de la Secretaría.</div>`
      : '';
  },

  /* ---------------------------------------------------------------- fotos */

  /** Fotos efectivamente adjuntas: las que traen contenido en esta sesión. */
  _fotosConContenido() {
    return (this.d.fotos || []).filter(f => f.datos);
  },

  _pintarFirma() {
    const cont = document.getElementById('vistaFirma');
    if (!cont) return;
    const f = this.d.firma;
    cont.innerHTML = f
      ? `<img src="${f.datos}" alt="Firma">`
      : '<span class="sub">Sin firma</span>';
    const quitar = document.getElementById('btnQuitarFirma');
    if (quitar) quitar.hidden = !f;
  },

  _pintarFotos() {
    const cont = document.getElementById('listaFotos');
    if (!cont) return;
    cont.innerHTML = this.d.fotos.map((f, i) => f.datos
      ? `<div class="foto">
           <img src="${f.datos}" alt="${app.esc(f.nombre)}">
           <button type="button" data-foto="${i}" title="Quitar">×</button>
         </div>`
      // Adjuntada en una sesión anterior: el contenido no se guarda en el
      // navegador, hay que volver a seleccionarla antes de radicar.
      : `<div class="foto" title="${app.esc(f.nombre)} — vuelva a adjuntarla">
           <div style="display:flex;align-items:center;justify-content:center;
                       height:100%;font-size:.68rem;color:#5b6874;text-align:center;padding:.2rem">
             Vuelva a<br>adjuntar
           </div>
           <button type="button" data-foto="${i}" title="Quitar">×</button>
         </div>`).join('');

    const pendientes = this.d.fotos.length - this._fotosConContenido().length;
    const aviso = document.getElementById('avisoFotos');
    if (aviso) {
      aviso.hidden = !pendientes;
      aviso.textContent = pendientes
        ? `${pendientes} fotografía(s) de una sesión anterior deben volver a adjuntarse: ` +
          `por seguridad el navegador no conserva las imágenes.`
        : '';
    }
  },

  async _agregarFotos(files) {
    for (const file of files) {
      if (this.d.fotos.length >= APP_CONFIG.FOTOS_MAX) {
        app.aviso(`Máximo ${APP_CONFIG.FOTOS_MAX} fotografías por sede.`, 'mal');
        break;
      }
      if (!APP_CONFIG.FOTO_TIPOS.includes(file.type)) {
        app.aviso(`${file.name}: formato no admitido.`, 'mal');
        continue;
      }
      if (file.size > APP_CONFIG.FOTO_MAX_MB * 1024 * 1024) {
        app.aviso(`${file.name}: supera ${APP_CONFIG.FOTO_MAX_MB} MB.`, 'mal');
        continue;
      }
      try {
        const datos = await this._reducir(file);
        this.d.fotos.push({ nombre: file.name, tipo: 'image/jpeg', datos });
      } catch (e) {
        app.aviso(`No se pudo procesar ${file.name}.`, 'mal');
      }
    }
    this._pintarFotos();
  },

  /** Reduce el lado mayor a FOTO_LADO_MAX_PX y recomprime a JPEG. */
  _reducir(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = APP_CONFIG.FOTO_LADO_MAX_PX;
        let { width: w, height: h } = img;
        if (w > max || h > max) {
          const f = max / Math.max(w, h);
          w = Math.round(w * f);
          h = Math.round(h * f);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen ilegible')); };
      img.src = url;
    });
  },

  _contarDescripcion() {
    const t = document.getElementById('fDescripcion');
    const c = document.getElementById('contDesc');
    if (t && c) c.textContent = t.value.trim().length;
  },

  /* ------------------------------------------------------------- conexión */

  _leerCabecera() {
    const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    this.d.alcalde = g('fAlcalde');
    this.d.rector = g('fRector');
    this.d.correo = g('fCorreo');
    this.d.celular = g('fCelular');
    this.d.descripcion_afectacion = g('fDescripcion');
    this.d.justificacion_discrepancia = g('fJustifica');
    this.d.pct_admin = g('fAdmin');
    this.d.pct_utilidad = g('fUtilidad');
    this.d.plazo_dias = g('fPlazo');
    this.d.actividades = g('fActividades');
  },

  _conectar() {
    const raiz = document.getElementById('modal');

    raiz.querySelector('#btnCerrar').addEventListener('click', () => {
      this._leerCabecera();
      db.guardarBorrador(this.sede.dane_sede, this.d);
      almacen.guardar(this.sede.dane_sede, this._fotosConContenido());
      app.cerrarModal();
      tablero.pintar();
    });

    raiz.querySelector('#fDeclara').addEventListener('change', e => {
      this._leerCabecera();
      this.d.declara_afectacion = e.target.value === 'si';
      this._pintar();
    });

    const desc = raiz.querySelector('#fDescripcion');
    if (desc) desc.addEventListener('input', () => this._contarDescripcion());

    // Tabla de ítems: un solo oyente para todo el cuerpo.
    const cuerpo = raiz.querySelector('#cuerpoItems');
    if (cuerpo) {
      cuerpo.addEventListener('input', e => {
        const campo = e.target.dataset.campo;
        if (!campo) return;
        const i = Number(e.target.closest('tr').dataset.i);
        this.d.items[i][campo] = e.target.value;
        if (campo === 'cantidad' || campo === 'valor_unitario') {
          const c = this.calcular();
          e.target.closest('tr').querySelector('td:nth-child(7) strong').textContent =
            app.pesos(c.items[i].valor_total);
          this._pintarTotales();
        }
      });
      cuerpo.addEventListener('blur', e => {
        const campo = e.target.dataset.campo;
        if (campo === 'cantidad' || campo === 'valor_unitario') {
          this._formatearCampo(e.target);
          const i = Number(e.target.closest('tr').dataset.i);
          this.d.items[i][campo] = e.target.value;
          this._pintarTotales();
        }
      }, true);
      cuerpo.addEventListener('change', e => {
        const campo = e.target.dataset.campo;
        if (campo === 'capitulo_dano' || campo === 'unidad') {
          const i = Number(e.target.closest('tr').dataset.i);
          this.d.items[i][campo] = e.target.value;
        }
      });
      cuerpo.addEventListener('click', e => {
        const b = e.target.closest('[data-quitar]');
        if (!b) return;
        if (this.d.items.length === 1) {
          this.d.items = [this._itemVacio()];
        } else {
          this.d.items.splice(Number(b.dataset.quitar), 1);
        }
        this._pintarItems();
        this._pintarTotales();
      });
    }

    const btnAgregar = raiz.querySelector('#btnAgregar');
    if (btnAgregar) btnAgregar.addEventListener('click', () => {
      this.d.items.push(this._itemVacio());
      this._pintarItems();
      this._pintarTotales();
    });

    ['fAdmin', 'fUtilidad'].forEach(id => {
      const el = raiz.querySelector('#' + id);
      if (!el) return;
      const sincronizar = () => {
        this.d.pct_admin = raiz.querySelector('#fAdmin').value;
        this.d.pct_utilidad = raiz.querySelector('#fUtilidad').value;
        this._pintarTotales();
      };
      el.addEventListener('input', sincronizar);
      el.addEventListener('blur', () => { this._formatearCampo(el); sincronizar(); });
    });

    const inpFotos = raiz.querySelector('#fFotos');
    if (inpFotos) inpFotos.addEventListener('change', async e => {
      await this._agregarFotos(Array.from(e.target.files));
      e.target.value = '';
    });

    const lista = raiz.querySelector('#listaFotos');
    if (lista) lista.addEventListener('click', e => {
      const b = e.target.closest('[data-foto]');
      if (!b) return;
      this.d.fotos.splice(Number(b.dataset.foto), 1);
      this._pintarFotos();
    });

    const btnFirma = raiz.querySelector('#btnFirma');
    const inpFirma = raiz.querySelector('#fFirma');
    if (btnFirma && inpFirma) {
      btnFirma.addEventListener('click', () => inpFirma.click());
      inpFirma.addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          const datos = await almacen.reducir(file, 600, 0.9, true);
          this.d.firma = { nombre: file.name, tipo: 'image/png', datos };
          almacen.guardarFirma('alcalde', this.d.firma);
          this._pintarFirma();
          app.aviso('Firma guardada. Se usará en todas las sedes de este municipio.', 'ok');
        } catch (err) {
          app.aviso('No se pudo leer la imagen de la firma.', 'mal');
        }
      });
    }
    const btnQuitarFirma = raiz.querySelector('#btnQuitarFirma');
    if (btnQuitarFirma) btnQuitarFirma.addEventListener('click', () => {
      this.d.firma = null;
      almacen.borrarFirma('alcalde');
      this._pintarFirma();
    });

    raiz.querySelector('#btnBorrador').addEventListener('click', () => {
      this._leerCabecera();
      db.guardarBorrador(this.sede.dane_sede, this.d);
      almacen.guardar(this.sede.dane_sede, this._fotosConContenido());
      app.aviso('Borrador guardado, con las fotografías.', 'ok');
      tablero.pintar();
    });

    raiz.querySelector('#btnRadicar').addEventListener('click', () => this.radicar());
  },

  /* ----------------------------------------------------------- validación */

  validar() {
    const errores = [];
    const poner = (id, msg) => {
      const e = document.getElementById(id);
      if (e) { e.textContent = msg; e.hidden = !msg; }
    };
    ['eJustifica', 'eDescripcion', 'eFotos', 'eItems', 'eAU', 'ePlazo']
      .forEach(id => poner(id, ''));

    const c = this.calcular();
    const clase = clasificarSede(this.sede);
    const afecta = this.d.declara_afectacion;
    const discrepa = (afecta && clase === 'PREMARCADA_SIN') || (!afecta && clase === 'ABIERTA');

    if (discrepa && this.d.justificacion_discrepancia.trim().length < APP_CONFIG.JUSTIFICACION_MIN) {
      poner('eJustifica', `Justifique la diferencia con el censo (mínimo ${APP_CONFIG.JUSTIFICACION_MIN} caracteres).`);
      errores.push('justificación');
    }

    if (!afecta) return errores;  // sin afectación no se exige presupuesto

    if (this.d.descripcion_afectacion.trim().length < APP_CONFIG.DESCRIPCION_MIN) {
      poner('eDescripcion', `Describa la afectación con al menos ${APP_CONFIG.DESCRIPCION_MIN} caracteres.`);
      errores.push('descripción');
    }
    if (this._fotosConContenido().length < APP_CONFIG.FOTOS_MIN) {
      poner('eFotos', this.d.fotos.length
        ? 'Vuelva a adjuntar las fotografías: el navegador no conserva las imágenes entre sesiones.'
        : `Adjunte al menos ${APP_CONFIG.FOTOS_MIN} fotografía.`);
      errores.push('fotografías');
    }

    const validos = c.items.filter(it =>
      it.capitulo_dano && it.descripcion.trim() && it.unidad &&
      this._num(it.cantidad) > 0 && this._num(it.valor_unitario) > 0);
    if (!validos.length) {
      poner('eItems', 'Registre al menos una actividad completa: capítulo, descripción, unidad, cantidad y valor unitario.');
      errores.push('presupuesto');
    } else if (validos.length < c.items.filter(it =>
        it.capitulo_dano || it.descripcion.trim() || it.unidad ||
        it.cantidad || it.valor_unitario).length) {
      poner('eItems', 'Hay filas incompletas. Complételas o quítelas antes de radicar.');
      errores.push('filas incompletas');
    }

    if (this.d.pct_admin === '' || this.d.pct_utilidad === '') {
      poner('eAU', 'Indique los porcentajes de administración y utilidad.');
      errores.push('A y U');
    }
    if (!(this._num(this.d.plazo_dias) > 0)) {
      poner('ePlazo', 'Indique el plazo en días calendario.');
      errores.push('plazo');
    }
    return errores;
  },

  /* ------------------------------------------------------------ radicación */

  async radicar() {
    this._leerCabecera();
    const errores = this.validar();
    if (errores.length) {
      app.aviso('Faltan datos: ' + errores.join(', ') + '.', 'mal');
      document.querySelector('.error-txt:not([hidden])')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const s = this.sede;
    const c = this.calcular();
    const clase = clasificarSede(s);
    const afecta = this.d.declara_afectacion;
    const previo = db.registro(s.dane_sede);
    const version = previo ? (previo.version || 1) + 1 : 1;

    const reg = {
      id_radicado: app.nuevoRadicado(s.dane_sede, version),
      version: version,          // el flujo descarta por versión: debe viajar
      dane_sede: s.dane_sede,
      municipio: s.municipio,
      dane_ie: s.dane_ie,
      institucion: s.institucion,
      sede: s.sede,
      zona: s.zona,
      matricula: s.matricula,
      tipo_censo: s.tipo_censo,
      nivel_censo: s.nivel_censo,
      declara_afectacion: afecta,
      hay_discrepancia: (afecta && clase === 'PREMARCADA_SIN') || (!afecta && clase === 'ABIERTA'),
      justificacion_discrepancia: this.d.justificacion_discrepancia.trim(),
      descripcion_afectacion: this.d.descripcion_afectacion.trim(),
      alcalde: this.d.alcalde.trim(),
      rector: this.d.rector.trim(),
      correo: this.d.correo.trim(),
      celular: this.d.celular.trim(),
      costo_directo: c.costo_directo,
      pct_admin: c.pct_admin,
      pct_utilidad: c.pct_utilidad,
      valor_admin: c.valor_admin,
      valor_utilidad: c.valor_utilidad,
      valor_iva: c.valor_iva,
      total_presupuesto: c.total_presupuesto,
      plazo_dias: this._num(this.d.plazo_dias),
      actividades: this.d.actividades.trim(),
      items: afecta ? c.items
        .filter(it => it.capitulo_dano && this._num(it.cantidad) > 0)
        .map((it, i) => ({
          n_item: i + 1,
          capitulo_dano: Number(it.capitulo_dano),
          capitulo_nombre: (APP_CONFIG.CAPITULOS.find(x => x.id === Number(it.capitulo_dano)) || {}).nombre || '',
          descripcion: it.descripcion.trim(),
          unidad: it.unidad,
          cantidad: this._num(it.cantidad),
          valor_unitario: this._num(it.valor_unitario),
          valor_total: it.valor_total
        })) : [],
      fotos: afecta ? this._fotosConContenido() : [],
      firma_municipio: this.d.firma || null,
      estado: afecta ? 'RADICADO' : 'SIN_AFECTACION',
      fecha_radicacion: new Date().toISOString()
    };

    await almacen.guardar(s.dane_sede, this._fotosConContenido());

    const res = await api.radicar(reg);
    if (res.ok) {
      db.borrarBorrador(s.dane_sede);
      app.cerrarModal();
      tablero.pintar();
      app.aviso(`${res.radicado} · ${res.mensaje}`, 'ok');
    } else {
      app.aviso(res.mensaje, 'mal');
    }
  }
};
