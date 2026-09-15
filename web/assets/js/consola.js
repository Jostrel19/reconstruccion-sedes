/**
 * CONSOLA DE VERIFICACIÓN — SECRETARÍA DE EDUCACIÓN
 *
 * Es la sección 5 del formato, que el municipio no diligencia, más el contraste
 * contra el modelo paramétrico.
 *
 * El contraste se hace SIEMPRE sobre el COSTO DIRECTO, nunca sobre el total con
 * AU: el modelo excluye AIU, interventoría, estudios y diseños e IVA, así que
 * comparar totales haría que toda sede pareciera inflada y la desviación no
 * diría nada.
 */

const consola = {
  filtro: { municipio: 'TODOS', estado: 'TODOS', verificacion: 'TODOS', soloDiscrepancias: false, texto: '' },
  verificador: '',
  cedula: '',

  /* Mapa provisional resultado de verificación -> estado del registro.
   * PENDIENTE de confirmación por la Dirección de Planeación. */
  ESTADO_SEGUN_RESULTADO: {
    CORRESPONDE: 'APROBADO',
    CORRESPONDE_PARCIAL: 'APROBADO',
    NO_CORRESPONDE: 'REQUIERE_AJUSTE',
    REQUIERE_ACLARACION: 'REQUIERE_AJUSTE'
  },

  RESULTADOS: [
    { id: 'CORRESPONDE', label: 'Corresponde' },
    { id: 'CORRESPONDE_PARCIAL', label: 'Corresponde parcialmente' },
    { id: 'NO_CORRESPONDE', label: 'No corresponde' },
    { id: 'REQUIERE_ACLARACION', label: 'Requiere aclaración / ajuste' }
  ],

  iniciar() {
    document.getElementById('pieVersion').textContent =
      `v${APP_CONFIG.VERSION} · catálogo ${SED_CATALOGO_GENERADO}`;
    const s = db.sesion();
    if (s && s.verificador) { this.verificador = s.verificador; this.cedula = s.cedula || ''; }
    this.pintar();
  },

  /* --------------------------------------------------------------- datos */

  todos() {
    return Object.values(db.registros());
  },

  valorModelo(dane) {
    return (SED_RESERVADO[dane] || {}).valor_modelo || 0;
  },

  /** Desviación del costo directo municipal frente al valor del modelo. */
  desviacion(reg) {
    const base = this.valorModelo(reg.dane_sede);
    if (!base) return null;
    return (reg.costo_directo - base) / base * 100;
  },

  resumen() {
    const t = this.todos();
    const conAfect = t.filter(r => r.declara_afectacion);

    // La desviación solo puede calcularse sobre las sedes que TIENEN valor del
    // modelo. Las 98 sedes tipo 1-4 sin detalle de daños quedaron en cero, y
    // las tipo 5-6-7 nunca se valoraron: sumarlas al denominador infla la
    // desviación y hace parecer sobrecosto lo que es ausencia de base.
    const comparables = conAfect.filter(r => this.valorModelo(r.dane_sede) > 0);
    const modelo = comparables.reduce((a, r) => a + this.valorModelo(r.dane_sede), 0);
    const directoComparable = comparables.reduce((a, r) => a + (r.costo_directo || 0), 0);

    return {
      radicados: t.length,
      conAfectacion: conAfect.length,
      sinAfectacion: t.filter(r => !r.declara_afectacion).length,
      discrepancias: t.filter(r => r.hay_discrepancia).length,
      porVerificar: t.filter(r => r.estado === 'RADICADO').length,
      totalPresupuestado: conAfect.reduce((a, r) => a + (r.total_presupuesto || 0), 0),
      costoDirecto: conAfect.reduce((a, r) => a + (r.costo_directo || 0), 0),
      comparables: comparables.length,
      sinBase: conAfect.length - comparables.length,
      costoDirectoComparable: directoComparable,
      valorModelo: modelo,
      desviacionGlobal: modelo ? (directoComparable - modelo) / modelo * 100 : null,
      municipiosActivos: new Set(t.map(r => r.municipio)).size
    };
  },

  filtrar() {
    const f = this.filtro;
    const q = f.texto.trim().toLowerCase();
    return this.todos().filter(r => {
      if (f.municipio !== 'TODOS' && r.municipio !== f.municipio) return false;
      if (f.estado !== 'TODOS' && r.estado !== f.estado) return false;
      if (f.verificacion !== 'TODOS' && (r.resultado_verificacion || 'SIN') !== f.verificacion) return false;
      if (f.soloDiscrepancias && !r.hay_discrepancia) return false;
      if (q && !(r.sede + ' ' + r.institucion + ' ' + r.dane_sede + ' ' + r.municipio)
                 .toLowerCase().includes(q)) return false;
      return true;
    });
  },

  /* -------------------------------------------------------------- pintado */

  pintar() {
    const r = this.resumen();
    const desv = r.desviacionGlobal;

    document.getElementById('vista').innerHTML = `
      <div class="tarjeta">
        <h2>Panorama general</h2>
        <div class="metricas">
          <div class="metrica"><b>${r.radicados}</b><span>Registros</span></div>
          <div class="metrica"><b>${r.conAfectacion}</b><span>Con presupuesto</span></div>
          <div class="metrica"><b>${r.sinAfectacion}</b><span>Sin afectación</span></div>
          <div class="metrica"><b>${r.porVerificar}</b><span>Por verificar</span></div>
          <div class="metrica"><b>${r.discrepancias}</b><span>Discrepancias</span></div>
          <div class="metrica"><b>${r.municipiosActivos}</b><span>Municipios</span></div>
        </div>
      </div>

      <div class="tarjeta">
        <h2>Contraste contra el modelo paramétrico</h2>
        <div class="metricas">
          <div class="metrica"><b>${app.pesos(r.costoDirectoComparable)}</b><span>Costo directo comparable</span></div>
          <div class="metrica"><b>${app.pesos(r.valorModelo)}</b><span>Valor del modelo</span></div>
          <div class="metrica">
            <b class="${desv === null ? 'desv-nula' : (desv > 0 ? 'desv-alta' : 'desv-baja')}">
              ${desv === null ? '—' : (desv > 0 ? '+' : '') + app.numero(desv) + ' %'}
            </b><span>Desviación</span>
          </div>
          <div class="metrica"><b>${app.pesos(r.totalPresupuestado)}</b><span>Total con AU e IVA</span></div>
        </div>
        <div class="nota" style="margin-top:.8rem">
          La desviación compara <strong>costo directo contra valor del modelo</strong>, y solo sobre
          las <strong>${r.comparables} sedes que tienen valor del modelo</strong>.
          ${r.sinBase ? `Otras <strong>${r.sinBase}</strong> radicaron presupuesto pero el modelo
            nunca las valoró —son las tipo 1-4 sin detalle de daños y las tipo 5, 6 y 7—, así que
            sumarlas al denominador haría parecer sobrecosto lo que es ausencia de base. Su costo
            directo, ${app.pesos(r.costoDirecto - r.costoDirectoComparable)}, se suma al total pero
            no a la desviación.` : ''}
          El modelo tampoco incluye AIU, interventoría, estudios y diseños ni IVA: por eso el total
          con AU siempre queda por encima, y esa diferencia es esperada.
        </div>
      </div>

      <div class="tarjeta">
        <h2>Registros</h2>
        <div class="filtros">
          <div class="campo crece">
            <label for="cTexto">Buscar</label>
            <input id="cTexto" type="search" placeholder="Sede, institución, DANE o municipio"
                   value="${app.esc(this.filtro.texto)}">
          </div>
          <div class="campo">
            <label for="cMunicipio">Municipio</label>
            <select id="cMunicipio">
              <option value="TODOS">Todos</option>
              ${SED_MUNICIPIOS.map(m =>
                `<option value="${m.municipio}">${m.municipio}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="cEstado">Estado</label>
            <select id="cEstado">
              <option value="TODOS">Todos</option>
              ${Object.keys(APP_CONFIG.ESTADOS).map(k =>
                `<option value="${k}">${APP_CONFIG.ESTADOS[k].label}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="cVerif">Verificación</label>
            <select id="cVerif">
              <option value="TODOS">Todas</option>
              <option value="SIN">Sin verificar</option>
              ${this.RESULTADOS.map(x => `<option value="${x.id}">${x.label}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label>&nbsp;</label>
            <label style="font-weight:400;text-transform:none">
              <input type="checkbox" id="cDiscrep" style="width:auto;margin-right:.3rem"
                     ${this.filtro.soloDiscrepancias ? 'checked' : ''}>
              Solo discrepancias
            </label>
          </div>
        </div>
        <div class="acciones" style="margin-bottom:.8rem">
          <label class="btn sec mini" style="margin:0;text-transform:none;font-weight:600">
            Cargar paquetes .json
            <input type="file" id="cImportar" accept="application/json,.json" multiple hidden>
          </label>
          <button class="btn sec mini" id="cExportar">Exportar a Excel (CSV)</button>
        </div>
        <div class="tabla-scroll" id="cTabla"></div>
      </div>`;

    document.getElementById('cMunicipio').value = this.filtro.municipio;
    document.getElementById('cEstado').value = this.filtro.estado;
    document.getElementById('cVerif').value = this.filtro.verificacion;
    this.pintarTabla();
    this.conectar();
  },

  pintarTabla() {
    const lista = this.filtrar().sort((a, b) =>
      a.municipio.localeCompare(b.municipio, 'es') || a.sede.localeCompare(b.sede, 'es'));

    if (!lista.length) {
      document.getElementById('cTabla').innerHTML = `
        <p class="sub" style="padding:1rem 0">
          No hay registros. Cargue los paquetes <code>.json</code> enviados por los municipios,
          o radique desde el aplicativo para probar.
        </p>`;
      return;
    }

    const filas = lista.map(r => {
      const base = this.valorModelo(r.dane_sede);
      const d = this.desviacion(r);
      const clase = d === null ? 'desv-nula' : (Math.abs(d) > 50 ? 'desv-alta' : 'desv-baja');
      return `<tr>
        <td>
          <strong>${app.esc(r.sede)}</strong><br>
          <span class="sub">${app.esc(r.municipio)} · ${app.esc(r.institucion)}</span><br>
          <span class="sub">DANE ${r.dane_sede} · ${app.esc(r.id_radicado)}</span>
        </td>
        <td>${app.etiquetaTipo(r.tipo_censo)}
            ${r.hay_discrepancia ? '<br><span class="et e-ajuste">Discrepancia</span>' : ''}</td>
        <td class="num">${r.declara_afectacion ? app.pesos(r.costo_directo) : '—'}</td>
        <td class="num">${base ? app.pesos(base) : '<span class="sub">sin base</span>'}</td>
        <td class="num ${clase}">${d === null ? '—' : (d > 0 ? '+' : '') + app.numero(d) + ' %'}</td>
        <td>${app.etiquetaEstado(r.estado)}
            ${r.resultado_verificacion
              ? `<br><span class="sub">${app.esc((this.RESULTADOS.find(x => x.id === r.resultado_verificacion) || {}).label || '')}</span>`
              : ''}</td>
        <td><div class="acciones">
          <button class="btn mini sec" data-ver="${r.dane_sede}">Verificar</button>
          <button class="btn mini sec" data-pdf="${r.dane_sede}">PDF</button>
        </div></td>
      </tr>`;
    }).join('');

    document.getElementById('cTabla').innerHTML = `
      <table>
        <thead><tr>
          <th>Sede / Radicado</th>
          <th>Censo</th>
          <th class="num">Costo directo</th>
          <th class="num">Valor modelo</th>
          <th class="num">Desviación</th>
          <th>Estado</th>
          <th></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="sub" style="margin-top:.5rem">${lista.length} registros listados.</p>`;
  },

  conectar() {
    const v = document.getElementById('vista');
    const bind = (id, ev, fn) => {
      const e = v.querySelector('#' + id);
      if (e) e.addEventListener(ev, fn);
    };

    bind('cTexto', 'input', e => { this.filtro.texto = e.target.value; this.pintarTabla(); });
    bind('cMunicipio', 'change', e => { this.filtro.municipio = e.target.value; this.pintarTabla(); });
    bind('cEstado', 'change', e => { this.filtro.estado = e.target.value; this.pintarTabla(); });
    bind('cVerif', 'change', e => { this.filtro.verificacion = e.target.value; this.pintarTabla(); });
    bind('cDiscrep', 'change', e => { this.filtro.soloDiscrepancias = e.target.checked; this.pintarTabla(); });
    bind('cImportar', 'change', e => this.importar(Array.from(e.target.files)).then(() => e.target.value = ''));
    bind('cExportar', 'click', () => this.exportarCsv());

    v.querySelector('#cTabla').addEventListener('click', e => {
      const bv = e.target.closest('[data-ver]');
      const bp = e.target.closest('[data-pdf]');
      if (bv) this.abrirVerificacion(db.registro(bv.dataset.ver));
      if (bp) pdf.generar(db.registro(bp.dataset.pdf));
    });
  },

  /* ------------------------------------------------------------ importación */

  async importar(files) {
    let ok = 0, omitidos = [], malos = 0;
    for (const f of files) {
      try {
        const texto = await f.text();
        const datos = JSON.parse(texto);
        // Admite el paquete de una sede o el respaldo de un municipio completo.
        // El paquete trae las imágenes como `contenido_b64`; adentro se usa el
        // data URI completo. Sin esta traducción las fotografías salían rotas.
        const fotosNorm = almacen.normalizar(datos.fotos);
        const firmaNorm = datos.firma_municipio
          ? almacen.normalizar([datos.firma_municipio])[0] : null;

        const regs = datos.cabecera
          ? [{ ...datos.cabecera, items: datos.items || [],
               fotos: fotosNorm, firma_municipio: firmaNorm }]
          : (Array.isArray(datos.registros) ? datos.registros : []);
        if (!regs.length) { malos++; continue; }
        for (const reg of regs) {
          const res = db.importarRegistro(reg);
          if (res.ok) {
            ok++;
            // Las imágenes van a IndexedDB: no caben en localStorage.
            if (reg.fotos && reg.fotos.length) {
              await almacen.guardar(reg.dane_sede, reg.fotos);
            }
          } else {
            omitidos.push(`${reg.sede || reg.dane_sede}: ${res.motivo}`);
          }
        }
      } catch (err) {
        console.error('Paquete ilegible:', f.name, err);
        malos++;
      }
    }
    let msg = `${ok} registros cargados.`;
    if (omitidos.length) msg += ` ${omitidos.length} omitidos por versión.`;
    if (malos) msg += ` ${malos} archivos ilegibles.`;
    app.aviso(msg, malos ? 'mal' : 'ok');
    this.pintar();
  },

  /* ----------------------------------------------------------- verificación */

  async abrirVerificacion(r) {
    if (!r) return;
    const fotos = await almacen.leer(r.dane_sede);
    const base = this.valorModelo(r.dane_sede);
    const d = this.desviacion(r);
    const items = (r.items || []).map(i => `
      <tr>
        <td class="c">${i.n_item}</td>
        <td>${app.esc(i.capitulo_nombre)}<br><span class="sub">${app.esc(i.descripcion)}</span></td>
        <td>${app.esc(i.unidad)}</td>
        <td class="num">${app.numero(i.cantidad)}</td>
        <td class="num">${app.pesos(i.valor_unitario)}</td>
        <td class="num">${app.pesos(i.valor_total)}</td>
      </tr>`).join('');

    document.getElementById('modal').innerHTML = `
    <div class="velo">
      <div class="dialogo" role="dialog" aria-modal="true">
        <header>
          <strong>Verificación</strong><span class="sep"></span>
          <span style="font-size:.82rem;opacity:.85">${app.esc(r.id_radicado)}</span>
          <button type="button" id="vCerrar">×</button>
        </header>
        <div class="cuerpo">

          <div class="tarjeta">
            <h2>${app.esc(r.sede)}</h2>
            <div class="rejilla r4">
              <div><label>Municipio</label>${app.esc(r.municipio)}</div>
              <div><label>DANE sede</label>${r.dane_sede}</div>
              <div><label>Matrícula</label>${r.matricula}</div>
              <div><label>Radicado</label>${app.fechaCorta(r.fecha_radicacion)} · v${r.version || 1}</div>
            </div>
            <div class="rejilla r3" style="margin-top:.6rem">
              <div><label>Censo</label>${app.etiquetaTipo(r.tipo_censo)}</div>
              <div><label>Alcalde</label>${app.esc(r.alcalde)}</div>
              <div><label>Contacto</label>${app.esc(r.correo)}</div>
            </div>
            ${r.hay_discrepancia ? `
              <div class="nota alerta" style="margin-top:.7rem">
                <strong>Discrepancia con el censo.</strong>
                ${r.declara_afectacion
                  ? 'El censo la clasificó tipo 5 y el municipio declara afectación.'
                  : 'El censo la clasificó tipo 1 a 4 y el municipio declara que no hay afectación.'}
                <br><em>${app.esc(r.justificacion_discrepancia)}</em>
              </div>` : ''}
          </div>

          ${r.declara_afectacion ? `
          <div class="tarjeta">
            <h2>Contraste</h2>
            <div class="metricas">
              <div class="metrica"><b>${app.pesos(r.costo_directo)}</b><span>Costo directo</span></div>
              <div class="metrica"><b>${base ? app.pesos(base) : '—'}</b><span>Valor modelo</span></div>
              <div class="metrica"><b class="${d === null ? 'desv-nula' : (d > 0 ? 'desv-alta' : 'desv-baja')}">
                ${d === null ? 'sin base' : (d > 0 ? '+' : '') + app.numero(d) + ' %'}</b><span>Desviación</span></div>
              <div class="metrica"><b>${app.pesos(r.total_presupuesto)}</b><span>Total con AU e IVA</span></div>
            </div>
            ${(r.pct_admin > APP_CONFIG.ALERTA_ADMIN_PCT || r.pct_utilidad > APP_CONFIG.ALERTA_UTILIDAD_PCT) ? `
              <div class="nota alerta" style="margin-top:.7rem">
                Porcentajes por encima de la referencia de mercado:
                A ${app.numero(r.pct_admin)} %, U ${app.numero(r.pct_utilidad)} %.
              </div>` : ''}
          </div>

          <div class="tarjeta">
            <h2>Afectación declarada</h2>
            <p style="text-align:justify">${app.esc(r.descripcion_afectacion)}</p>
            ${fotos.length ? `<div class="fotos">${
              fotos.map(f => `<a href="${f.datos}" target="_blank" rel="noopener"
                 class="foto" title="${app.esc(f.nombre)} — clic para ampliar">
                 <img src="${f.datos}" alt="${app.esc(f.nombre)}"></a>`).join('')
            }</div>` : '<p class="sub">Sin registro fotográfico.</p>'}
          </div>

          <div class="tarjeta">
            <h2>Presupuesto radicado</h2>
            <div class="tabla-scroll">
              <table>
                <thead><tr><th>#</th><th>Capítulo / actividad</th><th>Un.</th>
                  <th class="num">Cant.</th><th class="num">V. unitario</th><th class="num">V. total</th></tr></thead>
                <tbody>${items}</tbody>
              </table>
            </div>
            <div class="totales" style="margin-top:.7rem">
              <div><span>Costo directo</span><span>${app.pesos(r.costo_directo)}</span></div>
              <div><span>Administración (${app.numero(r.pct_admin)} %)</span><span>${app.pesos(r.valor_admin)}</span></div>
              <div><span>Utilidad (${app.numero(r.pct_utilidad)} %)</span><span>${app.pesos(r.valor_utilidad)}</span></div>
              <div><span>IVA ${APP_CONFIG.IVA_SOBRE_UTILIDAD_PCT} % sobre utilidad</span><span>${app.pesos(r.valor_iva)}</span></div>
              <div class="grande"><span>Total</span><span>${app.pesos(r.total_presupuesto)}</span></div>
            </div>
            <p class="sub" style="margin-top:.5rem">Plazo estimado: ${r.plazo_dias} días calendario.</p>
          </div>` : `
          <div class="tarjeta">
            <h2>Declaración</h2>
            <p>El municipio declara que la sede <strong>no presenta afectación</strong> que requiera inversión.</p>
          </div>`}

          <div class="tarjeta">
            <h2>5. Observaciones de verificación</h2>
            <div class="campo">
              <label for="vResultado">Resultado de la verificación *</label>
              <select id="vResultado">
                <option value="">Seleccione…</option>
                ${this.RESULTADOS.map(x =>
                  `<option value="${x.id}" ${r.resultado_verificacion === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label for="vObs">Observaciones / ajustes requeridos</label>
              <textarea id="vObs">${app.esc(r.observaciones_verificacion || '')}</textarea>
            </div>
            <div class="rejilla r2">
              <div class="campo">
                <label for="vNombre">Nombre de quien verifica *</label>
                <input id="vNombre" value="${app.esc(r.verificador || this.verificador)}">
              </div>
              <div class="campo">
                <label for="vCedula">Cédula *</label>
                <input id="vCedula" value="${app.esc(r.cedula_verificador || this.cedula)}">
              </div>
            </div>
            <div class="campo">
              <label>Firma de quien verifica</label>
              <div class="firma-caja">
                <div class="firma-lienzo" id="vistaFirmaSED"></div>
                <div>
                  <input type="file" id="vFirma" accept="image/png,image/jpeg" hidden>
                  <button type="button" class="btn sec mini" id="btnFirmaSED">
                    Subir imagen de la firma
                  </button>
                  <button type="button" class="btn sec mini" id="btnQuitarFirmaSED" hidden>Quitar</button>
                  <p class="sub" style="margin:.3rem 0 0">
                    Queda guardada en este equipo y se aplica a todas las verificaciones que usted
                    haga; no hay que subirla cada vez.
                  </p>
                </div>
              </div>
            </div>
            <p class="sub">
              Firma electrónica simple: además de la imagen, quedan registrados nombre, cédula,
              fecha y hora en el documento generado.
            </p>
            <div class="error-txt" id="vError" hidden></div>
          </div>
        </div>
        <footer>
          <button type="button" class="btn sec" id="vPdf">Generar PDF</button>
          <span style="flex:1"></span>
          <button type="button" class="btn ok" id="vGuardar">Guardar verificación</button>
        </footer>
      </div>
    </div>`;

    document.body.style.overflow = 'hidden';
    const raiz = document.getElementById('modal');
    this._pintarFirmaSED();
    raiz.querySelector('#vCerrar').addEventListener('click', () => app.cerrarModal());

    const btnF = raiz.querySelector('#btnFirmaSED');
    const inpF = raiz.querySelector('#vFirma');
    btnF.addEventListener('click', () => inpF.click());
    inpF.addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const datos = await almacen.reducir(file, 600, 0.9, true);
        almacen.guardarFirma('sed', { nombre: file.name, tipo: 'image/png', datos });
        this._pintarFirmaSED();
        app.aviso('Firma guardada. Se aplicará a sus verificaciones.', 'ok');
      } catch (err) {
        app.aviso('No se pudo leer la imagen de la firma.', 'mal');
      }
    });
    raiz.querySelector('#btnQuitarFirmaSED').addEventListener('click', () => {
      almacen.borrarFirma('sed');
      this._pintarFirmaSED();
    });
    raiz.querySelector('#vPdf').addEventListener('click', () => pdf.generar(db.registro(r.dane_sede)));
    raiz.querySelector('#vGuardar').addEventListener('click', () => this.guardarVerificacion(r));
  },

  _pintarFirmaSED() {
    const cont = document.getElementById('vistaFirmaSED');
    if (!cont) return;
    const f = almacen.firma('sed');
    cont.innerHTML = f ? `<img src="${f.datos}" alt="Firma">` : '<span class="sub">Sin firma</span>';
    const q = document.getElementById('btnQuitarFirmaSED');
    if (q) q.hidden = !f;
  },

  guardarVerificacion(r) {
    const g = id => document.getElementById(id).value.trim();
    const resultado = g('vResultado');
    const nombre = g('vNombre');
    const cedula = g('vCedula');
    const err = document.getElementById('vError');

    if (!resultado || !nombre || !cedula) {
      err.textContent = 'Indique el resultado, el nombre y la cédula de quien verifica.';
      err.hidden = false;
      return;
    }
    err.hidden = true;

    this.verificador = nombre;
    this.cedula = cedula;
    db.guardarSesion({ ...(db.sesion() || {}), verificador: nombre, cedula });

    db.guardarVerificacion(r.dane_sede, {
      resultado_verificacion: resultado,
      observaciones_verificacion: g('vObs'),
      verificador: nombre,
      cedula_verificador: cedula,
      fecha_verificacion: new Date().toISOString(),
      estado: this.ESTADO_SEGUN_RESULTADO[resultado] || 'EN_VERIFICACION'
    });

    app.cerrarModal();
    this.pintar();
    app.aviso(`Verificación registrada para ${r.sede}.`, 'ok');
  },

  /* ------------------------------------------------------------ exportación */

  exportarCsv() {
    const lista = this.filtrar();
    if (!lista.length) { app.aviso('No hay registros para exportar.', 'mal'); return; }

    const cols = ['id_radicado', 'municipio', 'dane_ie', 'institucion', 'dane_sede', 'sede',
      'zona', 'matricula', 'tipo_censo', 'nivel_censo', 'declara_afectacion', 'hay_discrepancia',
      'justificacion_discrepancia', 'descripcion_afectacion', 'alcalde', 'rector', 'correo',
      'celular', 'costo_directo', 'pct_admin', 'pct_utilidad', 'valor_admin', 'valor_utilidad',
      'valor_iva', 'total_presupuesto', 'plazo_dias', 'estado', 'version', 'fecha_radicacion',
      'resultado_verificacion', 'observaciones_verificacion', 'verificador', 'fecha_verificacion'];

    const extra = ['valor_modelo', 'desviacion_pct', 'n_items'];
    const q = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const filas = lista.map(r => {
      const base = this.valorModelo(r.dane_sede);
      const d = this.desviacion(r);
      return cols.map(c => q(r[c]))
        .concat([q(base), q(d === null ? '' : d.toFixed(2)), q((r.items || []).length)])
        .join(';');
    });

    // Separador ';' y BOM explícito: así Excel en regional español abre el
    // archivo en columnas y respeta las tildes.
    const csv = '﻿' + cols.concat(extra).join(';') + '\n' + filas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidado_presupuestos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    app.aviso(`${lista.length} registros exportados.`, 'ok');
  }
};

document.addEventListener('DOMContentLoaded', () => consola.iniciar());
