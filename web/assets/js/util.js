/**
 * UTILIDADES COMPARTIDAS
 * Las usan tanto el aplicativo del alcalde (index.html) como la consola de la
 * Secretaría (consola.html), así que viven aparte para no duplicarlas.
 */

const app = {

  aviso(texto, tipo) {
    const d = document.createElement('div');
    d.className = 'aviso' + (tipo ? ' ' + tipo : '');
    d.textContent = texto;
    document.getElementById('avisos').appendChild(d);
    setTimeout(() => d.remove(), 5200);
  },

  pesos(n) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-CO');
  },

  numero(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  },

  fechaLarga(iso) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                   'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [a, m, d] = iso.split('-').map(Number);
    return `${d} de ${meses[m - 1]} de ${a}`;
  },

  fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  /** Escapa texto antes de inyectarlo en HTML. */
  esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  etiquetaTipo(tipo) {
    const t = (tipo || '').trim();
    if (!t) return '<span class="et t7">Sin dato</span>';
    const n = t.charAt(0);
    const corto = {
      '1': 'Tipo 1 · Colapso',
      '2': 'Tipo 2 · Riesgo de colapso',
      '3': 'Tipo 3 · Estructural parcial',
      '4': 'Tipo 4 · Menor',
      '5': 'Tipo 5 · Sin afectación',
      '6': 'Tipo 6 · No determinable',
      '7': 'Tipo 7 · Sin revisar'
    }[n] || t;
    return `<span class="et t${n}" title="${this.esc(t)}">${corto}</span>`;
  },

  etiquetaEstado(estado) {
    const e = APP_CONFIG.ESTADOS[estado] || APP_CONFIG.ESTADOS.PENDIENTE;
    return `<span class="et ${e.clase}">${e.label}</span>`;
  },

  /** Consecutivo de radicado: SED-PRE-<DANE>-v<N> */
  nuevoRadicado(daneSede, version) {
    return `SED-PRE-${daneSede}-v${version || 1}`;
  },

  cerrarModal() {
    document.getElementById('modal').innerHTML = '';
    document.body.style.overflow = '';
  }
};
