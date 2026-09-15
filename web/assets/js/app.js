/**
 * ARRANQUE Y ENRUTADO DEL APLICATIVO DEL ALCALDE
 * Acceso por enlace con token de municipio:  index.html?m=RIOSUCIO&t=<token>
 * Sin parámetros muestra un selector, que en producción se retira.
 *
 * Las utilidades comunes están en util.js; aquí solo va lo propio de esta pantalla.
 */

Object.assign(app, {
  municipio: null,

  /** Sin tildes y en mayúsculas: los enlaces viajan sin acentos por correo. */
  normalizar(s) {
    return String(s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .trim().toUpperCase();
  },

  /** Resuelve el parámetro de la URL al nombre canónico del catálogo. */
  resolverMunicipio(param) {
    const n = this.normalizar(param);
    if (!n) return null;
    const hit = SED_MUNICIPIOS.find(x => this.normalizar(x.municipio) === n);
    return hit ? hit.municipio : null;
  },

  async validarToken(municipio, token) {
    if (!APP_CONFIG.EXIGIR_TOKEN) return true;
    const esperado = (typeof SED_TOKENS !== 'undefined') ? SED_TOKENS[municipio] : null;
    if (!esperado) return false;
    if (!token) return false;
    if (!(window.crypto && crypto.subtle)) {
      // Sin contexto seguro no se puede calcular el hash. Se deja pasar antes
      // que dejar al alcalde bloqueado sin explicación.
      console.warn('Sin crypto.subtle: no se valida el token.');
      return true;
    }
    const datos = new TextEncoder().encode(`${municipio}|${token}`);
    const buf = await crypto.subtle.digest('SHA-256', datos);
    const hex = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    return hex === esperado;
  },

  async iniciar() {
    document.getElementById('pieVersion').textContent =
      `v${APP_CONFIG.VERSION} · catálogo ${SED_CATALOGO_GENERADO}`;
    document.getElementById('chipCierre').textContent =
      'Cierre: ' + this.fechaLarga(APP_CONFIG.CIERRE_RECOLECCION);
    if (APP_CONFIG.MODO_PRUEBA) {
      document.getElementById('avisoPrueba').hidden = false;
    }

    const params = new URLSearchParams(location.search);
    const municipio = this.resolverMunicipio(params.get('m'));
    const token = (params.get('t') || '').trim();

    if (municipio) {
      if (await this.validarToken(municipio, token)) {
        db.guardarSesion({ municipio, token, desde: new Date().toISOString() });
        this.abrirMunicipio(municipio);
      } else {
        this.pintarAccesoInvalido(municipio);
      }
      return;
    }

    // Sin municipio en la URL: se reabre la sesión previa del mismo navegador.
    const sesion = db.sesion();
    if (sesion && sesion.municipio && await this.validarToken(sesion.municipio, sesion.token)) {
      this.abrirMunicipio(sesion.municipio);
    } else if (APP_CONFIG.EXIGIR_TOKEN) {
      this.pintarAccesoInvalido(null);
    } else {
      this.pintarSelector();
    }
  },

  pintarAccesoInvalido(municipio) {
    document.getElementById('vista').innerHTML = `
      <div class="tarjeta">
        <h2>Enlace no válido</h2>
        <div class="nota error">
          ${municipio
            ? `El enlace para <strong>${this.esc(municipio)}</strong> no es correcto o está incompleto.`
            : 'Este enlace no identifica a ningún municipio.'}
        </div>
        <p>
          Cada alcaldía recibió un enlace propio por correo institucional. Ábralo completo, tal como
          llegó: si se copia partido en dos líneas, deja de funcionar.
        </p>
        <p class="sub">
          Si extravió el enlace, solicítelo a la Dirección de Planeación de la Secretaría de
          Educación de Caldas.
        </p>
      </div>`;
  },

  abrirMunicipio(municipio) {
    this.municipio = municipio;
    db.guardarSesion({ municipio, desde: new Date().toISOString() });
    const chip = document.getElementById('chipMunicipio');
    chip.textContent = municipio;
    chip.hidden = false;
    tablero.pintar(municipio);
  },

  pintarSelector() {
    const filas = SED_MUNICIPIOS
      .slice()
      .sort((a, b) => b.total_sedes - a.total_sedes)
      .map(m => `
        <tr>
          <td><strong>${m.municipio}</strong><br><span class="sub">${this.esc(m.alcalde || '—')}</span></td>
          <td class="num">${m.total_sedes}</td>
          <td class="num">${m.premarcadas_sin_afectacion}</td>
          <td><button class="btn mini" data-mun="${m.municipio}">Abrir tablero</button></td>
        </tr>`).join('');

    document.getElementById('vista').innerHTML = `
      <div class="tarjeta">
        <h2>Informe técnico-presupuestal por sede</h2>
        <p>
          Reparación de infraestructura educativa afectada por el sismo del 10 de agosto de 2026.
          Cada alcaldía radica el presupuesto de las sedes de su municipio que presenten afectación.
        </p>
        <div class="nota">
          En producción cada alcaldía entra por su propio enlace
          (<code>?m=MUNICIPIO&amp;t=token</code>) y ve únicamente sus sedes.
          Este selector existe solo para las pruebas.
        </div>
      </div>
      <div class="tarjeta">
        <h2>Municipios</h2>
        <div class="tabla-scroll">
          <table>
            <thead><tr>
              <th>Municipio / Alcalde</th>
              <th class="num">Sedes</th>
              <th class="num">Pre-marcadas sin afectación</th>
              <th></th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('vista').addEventListener('click', e => {
      const b = e.target.closest('[data-mun]');
      if (b) this.abrirMunicipio(b.dataset.mun);
    });
  }
});

document.addEventListener('DOMContentLoaded', () => app.iniciar());
