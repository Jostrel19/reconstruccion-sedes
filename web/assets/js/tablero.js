/**
 * TABLERO MUNICIPAL
 * Pantalla de trabajo del alcalde: la lista de sus sedes con el tamizaje
 * pre-marcado según el censo (D-4). Sin esta pantalla, Riosucio serían 92
 * formularios completos y no se cumpliría.
 */

const tablero = {
  municipio: null,
  filtro: { texto: '', estado: 'TODOS', tipo: 'TODOS' },

  sedes() {
    return SED_SEDES.filter(s => s.municipio === this.municipio);
  },

  datosMunicipio() {
    return SED_MUNICIPIOS.find(m => m.municipio === this.municipio) || {};
  },

  /** Estado actual de una sede: registro guardado > borrador > pendiente. */
  estadoDe(sede) {
    const reg = db.registro(sede.dane_sede);
    if (reg) return reg.estado;
    if (db.borrador(sede.dane_sede)) return 'BORRADOR';
    return 'PENDIENTE';
  },

  resumen() {
    const s = this.sedes();
    const est = s.map(x => this.estadoDe(x));
    const radicadas = s.filter(x => {
      const r = db.registro(x.dane_sede);
      return r && r.estado === 'RADICADO' && r.declara_afectacion;
    });
    return {
      total: s.length,
      pendientes: est.filter(e => e === 'PENDIENTE').length,
      borrador: est.filter(e => e === 'BORRADOR').length,
      sinAfectacion: est.filter(e => e === 'SIN_AFECTACION').length,
      radicadas: radicadas.length,
      valor: radicadas.reduce((a, r) => a + (db.registro(r.dane_sede).total_presupuesto || 0), 0),
      resueltas: est.filter(e => e !== 'PENDIENTE' && e !== 'BORRADOR').length,
      pendientesEnvio: db.pendientesDeEnvio(this.municipio).length,
      enviadas: db.registrosDeMunicipio(this.municipio).filter(x => x.enviado).length
    };
  },

  pintar(municipio) {
    if (municipio) this.municipio = municipio;
    const m = this.datosMunicipio();
    const r = this.resumen();
    const pct = r.total ? Math.round(r.resueltas / r.total * 100) : 0;
    const premarcadasPendientes = this.sedes().filter(
      s => clasificarSede(s) === 'PREMARCADA_SIN' && this.estadoDe(s) === 'PENDIENTE'
    ).length;

    document.getElementById('vista').innerHTML = `
      <div class="tarjeta">
        <h2>${app.esc(this.municipio)}</h2>
        <div class="rejilla r3">
          <div><label>Alcalde</label>${app.esc(m.alcalde || '—')}</div>
          <div><label>Correo de la alcaldía</label>${app.esc(m.correo_alcaldia || '—')}</div>
          <div><label>Cierre de la recolección</label>${app.fechaLarga(APP_CONFIG.CIERRE_RECOLECCION)}</div>
        </div>
      </div>

      <div class="tarjeta">
        <h2>Avance del municipio</h2>
        <div class="metricas" style="margin-bottom:.9rem">
          <div class="metrica"><b>${r.total}</b><span>Sedes</span></div>
          <div class="metrica"><b>${r.pendientes}</b><span>Pendientes</span></div>
          <div class="metrica"><b>${r.sinAfectacion}</b><span>Sin afectación</span></div>
          <div class="metrica"><b>${r.radicadas}</b><span>Con presupuesto</span></div>
          <div class="metrica"><b>${app.pesos(r.valor)}</b><span>Valor radicado</span></div>
        </div>
        <div class="avance"><i style="width:${pct}%"></i></div>
        <p class="sub" style="margin-top:.4rem">
          ${r.resueltas} de ${r.total} sedes resueltas (${pct} %).
          ${r.borrador ? r.borrador + ' en diligenciamiento.' : ''}
        </p>
        ${premarcadasPendientes ? `
          <div class="nota">
            <strong>${premarcadasPendientes} sedes</strong> vienen clasificadas por el censo como
            <em>tipo 5 · sin afectación</em>. Puede confirmarlas todas de una vez y concentrarse en
            las que sí requieren presupuesto. Si alguna sí presenta afectación, ábrala y corríjala.
            <div class="acciones" style="margin-top:.5rem">
              <button class="btn ok mini" id="btnConfirmarTodas">
                Confirmar las ${premarcadasPendientes} sin afectación
              </button>
            </div>
          </div>` : ''}
        <div class="nota" id="notaEnvio" ${r.pendientesEnvio ? '' : 'hidden'}>
          <strong>${r.pendientesEnvio} sede(s) listas para enviar a la Secretaría.</strong>
          Al terminar de diligenciar, envíelas todas juntas: se descargan los archivos y se abre
          la carpeta donde debe soltarlos. No tiene que hacerlo sede por sede.
          <div class="acciones" style="margin-top:.5rem">
            <button class="btn ok mini" id="btnEnviar">
              Enviar a la Secretaría (${r.pendientesEnvio})
            </button>
          </div>
        </div>
        ${r.enviadas ? `<p class="sub">${r.enviadas} sede(s) ya entregadas.</p>` : ''}
        <div class="acciones">
          <button class="btn sec mini" id="btnExportar">Descargar respaldo del municipio</button>
        </div>
      </div>

      <div class="tarjeta">
        <h2>Sedes educativas</h2>
        <div class="filtros">
          <div class="campo crece">
            <label for="fTexto">Buscar sede, institución o DANE</label>
            <input id="fTexto" type="search" placeholder="Escriba para filtrar…"
                   value="${app.esc(this.filtro.texto)}">
          </div>
          <div class="campo">
            <label for="fEstado">Estado</label>
            <select id="fEstado">
              <option value="TODOS">Todos</option>
              ${Object.keys(APP_CONFIG.ESTADOS).map(k =>
                `<option value="${k}">${APP_CONFIG.ESTADOS[k].label}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="fTipo">Clasificación del censo</label>
            <select id="fTipo">
              <option value="TODOS">Todas</option>
              <option value="ABIERTA">Tipo 1 a 4 — requiere presupuesto</option>
              <option value="PREMARCADA_SIN">Tipo 5 — sin afectación</option>
              <option value="DECLARACION">Tipo 6 y 7 — requiere declaración</option>
            </select>
          </div>
        </div>
        <div class="tabla-scroll" id="tablaSedes"></div>
      </div>`;

    document.getElementById('fEstado').value = this.filtro.estado;
    document.getElementById('fTipo').value = this.filtro.tipo;
    this.pintarTabla();
    this.conectar();
  },

  conectar() {
    const v = document.getElementById('vista');

    v.querySelector('#fTexto').addEventListener('input', e => {
      this.filtro.texto = e.target.value;
      this.pintarTabla();
    });
    v.querySelector('#fEstado').addEventListener('change', e => {
      this.filtro.estado = e.target.value;
      this.pintarTabla();
    });
    v.querySelector('#fTipo').addEventListener('change', e => {
      this.filtro.tipo = e.target.value;
      this.pintarTabla();
    });

    const btnTodas = v.querySelector('#btnConfirmarTodas');
    if (btnTodas) btnTodas.addEventListener('click', () => this.confirmarTodasSinAfectacion());

    v.querySelector('#btnExportar').addEventListener('click', () => {
      api.descargarMunicipio(this.municipio);
      app.aviso('Respaldo descargado.', 'ok');
    });

    const btnEnviar = v.querySelector('#btnEnviar');
    if (btnEnviar) btnEnviar.addEventListener('click', () => this.enviarASecretaria());

    v.querySelector('#tablaSedes').addEventListener('click', e => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      const sede = SED_SEDES.find(s => s.dane_sede === b.dataset.dane);
      if (!sede) return;
      if (b.dataset.accion === 'abrir') formulario.abrir(sede);
      if (b.dataset.accion === 'confirmar') this.confirmarSinAfectacion(sede);
    });
  },

  filtrar() {
    const t = this.filtro.texto.trim().toLowerCase();
    return this.sedes().filter(s => {
      if (this.filtro.estado !== 'TODOS' && this.estadoDe(s) !== this.filtro.estado) return false;
      if (this.filtro.tipo !== 'TODOS' && clasificarSede(s) !== this.filtro.tipo) return false;
      if (!t) return true;
      return (s.sede + ' ' + s.institucion + ' ' + s.dane_sede).toLowerCase().includes(t);
    });
  },

  pintarTabla() {
    const lista = this.filtrar()
      .sort((a, b) => a.institucion.localeCompare(b.institucion, 'es') ||
                      a.sede.localeCompare(b.sede, 'es'));

    if (!lista.length) {
      document.getElementById('tablaSedes').innerHTML =
        '<p class="sub" style="padding:1rem 0">Ninguna sede coincide con el filtro.</p>';
      return;
    }

    const filas = lista.map(s => {
      const estado = this.estadoDe(s);
      const reg = db.registro(s.dane_sede);
      const clase = clasificarSede(s);
      const valor = reg && reg.declara_afectacion ? app.pesos(reg.total_presupuesto) : '—';

      let acciones = `<button class="btn mini sec" data-accion="abrir" data-dane="${s.dane_sede}">
                        ${estado === 'PENDIENTE' ? 'Diligenciar' : 'Ver / editar'}
                      </button>`;
      if (clase === 'PREMARCADA_SIN' && estado === 'PENDIENTE') {
        acciones = `<button class="btn mini ok" data-accion="confirmar" data-dane="${s.dane_sede}">
                      Confirmar sin afectación
                    </button>` + acciones;
      }

      return `<tr>
        <td>
          <strong>${app.esc(s.sede)}</strong><br>
          <span class="sub">${app.esc(s.institucion)}</span><br>
          <span class="sub">DANE ${s.dane_sede} · ${s.zona} · ${s.matricula} estudiantes</span>
        </td>
        <td>${app.etiquetaTipo(s.tipo_censo)}
            ${s.nivel_censo ? `<br><span class="sub">Nivel: ${app.esc(s.nivel_censo)}</span>` : ''}</td>
        <td>${app.etiquetaEstado(estado)}
            ${reg && reg.hay_discrepancia ? '<br><span class="sub">⚠ discrepancia</span>' : ''}</td>
        <td class="num">${valor}</td>
        <td><div class="acciones">${acciones}</div></td>
      </tr>`;
    }).join('');

    document.getElementById('tablaSedes').innerHTML = `
      <table>
        <thead><tr>
          <th>Sede / Institución</th>
          <th>Censo 27-08-2026</th>
          <th>Estado</th>
          <th class="num">Presupuesto</th>
          <th></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="sub" style="margin-top:.5rem">${lista.length} sedes listadas.</p>`;
  },

  /** Registro liviano para una sede declarada sin afectación. */
  _registroSinAfectacion(sede) {
    const m = this.datosMunicipio();
    return {
      id_radicado: app.nuevoRadicado(sede.dane_sede, 1),
      version: 1,
      dane_sede: sede.dane_sede,
      municipio: sede.municipio,
      dane_ie: sede.dane_ie,
      institucion: sede.institucion,
      sede: sede.sede,
      zona: sede.zona,
      matricula: sede.matricula,
      tipo_censo: sede.tipo_censo,
      nivel_censo: sede.nivel_censo,
      declara_afectacion: false,
      hay_discrepancia: clasificarSede(sede) === 'ABIERTA',
      justificacion_discrepancia: '',
      descripcion_afectacion: '',
      alcalde: m.alcalde || '',
      rector: sede.rector || '',
      correo: m.correo_alcaldia || '',
      celular: m.celular_alcaldia || '',
      costo_directo: 0,
      pct_admin: 0,
      pct_utilidad: 0,
      valor_admin: 0,
      valor_utilidad: 0,
      valor_iva: 0,
      total_presupuesto: 0,
      plazo_dias: 0,
      items: [],
      fotos: [],
      estado: 'SIN_AFECTACION',
      fecha_radicacion: new Date().toISOString()
    };
  },

  async confirmarSinAfectacion(sede) {
    const reg = this._registroSinAfectacion(sede);
    const res = await api.declararSinAfectacion(reg);
    app.aviso(res.ok ? `${sede.sede}: registrada sin afectación.` : res.mensaje,
              res.ok ? 'ok' : 'mal');
    this.pintar();
  },

  /**
   * Entrega a la Secretaría todo lo pendiente, de una sola vez.
   *
   * Descargar en cada radicación dejaría 58 archivos sueltos en Riosucio y 58
   * cargas separadas. Aquí se agrupa: un archivo con TODAS las declaraciones
   * sin afectación, y uno por cada sede con presupuesto —esas llevan fotos y
   * conviene que viajen separadas para que ninguna quede demasiado pesada—.
   * Luego se abre la carpeta de SharePoint para soltarlos todos juntos.
   */
  async enviarASecretaria() {
    const pendientes = db.pendientesDeEnvio(this.municipio);
    if (!pendientes.length) { app.aviso('No hay nada pendiente por enviar.', 'mal'); return; }

    const conPresupuesto = pendientes.filter(r => r.declara_afectacion);
    const sinAfectacion = pendientes.filter(r => !r.declara_afectacion);
    const archivos = conPresupuesto.length + (sinAfectacion.length ? 1 : 0);

    if (!confirm(
      `Se descargarán ${archivos} archivo(s) con ${pendientes.length} sede(s).

` +
      `El navegador puede pedirle permiso para descargar varios archivos: acepte.

` +
      `Enseguida se abrirá la carpeta de la Secretaría para que los suba.

¿Continuar?`)) return;

    // Las declaraciones sin afectación, todas en un archivo.
    if (sinAfectacion.length) {
      this._descargarJson(`sin_afectacion_${this.municipio.replace(/\s+/g, '_')}.json`, {
        accion: 'declararSinAfectacion',
        esquema: 1,
        version_app: APP_CONFIG.VERSION,
        municipio: this.municipio,
        enviado: new Date().toISOString(),
        registros: sinAfectacion
      });
    }

    // Cada sede con presupuesto, con sus fotos recuperadas del almacén.
    const firma = almacen.firma('alcalde');
    for (const reg of conPresupuesto) {
      const fotos = await almacen.leer(reg.dane_sede);
      const payload = api._payload({ ...reg, fotos, firma_municipio: firma });
      this._descargarJson(
        `presupuesto_${reg.dane_sede}_v${reg.version || 1}.json`, payload);
      await new Promise(r => setTimeout(r, 250));  // el navegador encola mejor
    }

    db.marcarEnviados(pendientes.map(r => r.dane_sede));
    this.pintar();
    app.aviso(`${archivos} archivo(s) descargados. Súbalos a la carpeta que se abrió.`, 'ok');

    const base = APP_CONFIG.URL_CARPETA_ENTREGA;
    if (base) {
      setTimeout(() => window.open(this._urlCarpeta(base), '_blank', 'noopener'), 600);
    } else {
      app.aviso('Suba los archivos a la carpeta que la Secretaría le compartió por correo.', 'ok');
    }
  },

  /**
   * Subcarpeta del municipio dentro de la carpeta de entrega.
   *
   * SharePoint tiene dos formas de nombrar una carpeta y hay que distinguirlas:
   * el vínculo de uso compartido lleva la ruta en el propio camino de la URL,
   * pero la dirección que ve el dueño en su OneDrive la lleva en el parámetro
   * `id`. Pegarle «/MARULANDA» al final a esta última produce una URL rota,
   * porque la ruta real está en la consulta, no en el camino.
   */
  _urlCarpeta(base) {
    const municipio = app.normalizar(this.municipio);
    let u;
    try {
      u = new URL(base);
    } catch (e) {
      return base;  // no es una URL absoluta; se abre tal cual
    }
    const id = u.searchParams.get('id');
    if (id) {
      u.searchParams.set('id', id.replace(/\/+$/, '') + '/' + municipio);
      // searchParams escribe los espacios como «+», que SharePoint no siempre
      // interpreta igual dentro de una ruta. Se fuerza %20.
      u.search = u.search.replace(/\+/g, '%20');
      return u.toString();
    }
    u.pathname = u.pathname.replace(/\/+$/, '') + '/' + encodeURIComponent(municipio);
    return u.toString();
  },

  _descargarJson(nombre, datos) {
    const blob = new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  async confirmarTodasSinAfectacion() {
    const pend = this.sedes().filter(
      s => clasificarSede(s) === 'PREMARCADA_SIN' && this.estadoDe(s) === 'PENDIENTE'
    );
    if (!pend.length) return;
    if (!confirm(
      `Se registrarán ${pend.length} sedes como SIN AFECTACIÓN, según la clasificación del censo ` +
      `del 27 de agosto de 2026.\n\nSi alguna de ellas sí presenta afectación, después puede ` +
      `abrirla y corregirla.\n\n¿Confirma?`)) return;

    for (const s of pend) {
      await api.declararSinAfectacion(this._registroSinAfectacion(s));
    }
    app.aviso(`${pend.length} sedes registradas sin afectación.`, 'ok');
    this.pintar();
  }
};
