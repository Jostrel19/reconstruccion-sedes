/**
 * CLIENTE DEL BACKEND — desacoplado a propósito.
 *
 * El mismo payload sirve para los tres caminos posibles, así que el frontend se
 * construye y se prueba sin haber decidido el backend:
 *
 *   'local'   localStorage. Para construir, probar y demostrar.
 *   'http'    POST del JSON a ENDPOINT_URL. Sirve igual para Azure Logic Apps,
 *             Power Automate Premium o una función intermedia con Graph.
 *   'archivo' Descarga un paquete .json que el alcalde sube por un enlace de
 *             solicitud de archivos de OneDrive/SharePoint. Un flujo gratuito de
 *             Power Automate («cuando se crea un archivo») lo recoge, lo parsea
 *             y escribe en las listas. No requiere licencia premium.
 *
 * Cambiar de backend es cambiar BACKEND y ENDPOINT_URL en config.js.
 */

class ApiCliente {
  constructor() {
    this.modo = APP_CONFIG.BACKEND;
    this.endpoint = APP_CONFIG.ENDPOINT_URL;
  }

  configurar(modo, endpoint) {
    this.modo = modo;
    this.endpoint = endpoint || '';
  }

  /** Radica el presupuesto de una sede. Devuelve { ok, radicado, mensaje }. */
  async radicar(registro) {
    const payload = this._payload(registro);

    if (this.modo === 'http') {
      return this._post(payload);
    }

    if (this.modo === 'archivo') {
      // NO se descarga nada aquí. El alcalde trabaja sede por sede y al final
      // envía todo junto desde el tablero: descargar en cada radicación le
      // dejaría 58 archivos sueltos en Riosucio y 58 cargas separadas.
      db.guardarRegistro(registro);
      return {
        ok: true,
        radicado: registro.id_radicado,
        mensaje: registro.declara_afectacion
          ? 'Presupuesto guardado. Al terminar, use «Enviar a la Secretaría».'
          : 'Declaración registrada.'
      };
    }

    // local
    db.guardarRegistro(registro);
    return {
      ok: true,
      radicado: registro.id_radicado,
      mensaje: 'Radicado en este navegador (modo local, sin backend).'
    };
  }

  /** Confirmación de sede sin afectación: mismo camino, payload liviano. */
  async declararSinAfectacion(registro) {
    return this.radicar(registro);
  }

  /**
   * Estructura que consume el backend. Se separa en cabecera e ítems porque en
   * SharePoint son dos listas distintas (PresupuestosSedes e ItemsPresupuesto).
   */
  _payload(r) {
    const { items, fotos, historico, firma_municipio, ...cabecera } = r;
    return {
      accion: 'radicarPresupuesto',
      // Contrato con el flujo de Power Automate. Si cambia la forma del
      // paquete hay que subirlo, y el flujo debe rechazar lo que no reconoce
      // en vez de escribir datos incompletos en las listas.
      esquema: 1,
      version_app: APP_CONFIG.VERSION,
      enviado: new Date().toISOString(),
      cabecera,
      items: items || [],
      fotos: (fotos || []).map(f => ({
        nombre: f.nombre,
        tipo: f.tipo,
        contenido_b64: f.datos ? f.datos.split(',')[1] : ''
      })),
      firma_municipio: firma_municipio
        ? { nombre: firma_municipio.nombre, tipo: firma_municipio.tipo,
            contenido_b64: firma_municipio.datos.split(',')[1] }
        : null
    };
  }

  async _post(payload) {
    if (!this.endpoint) {
      return { ok: false, mensaje: 'No hay endpoint configurado. Revise config.js.' };
    }
    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        return { ok: false, mensaje: `El servidor respondió ${resp.status}.` };
      }
      const data = await resp.json().catch(() => ({}));
      // Se guarda también en local: si el backend falla después, no se pierde.
      db.guardarRegistro(payload.cabecera);
      return {
        ok: true,
        radicado: data.radicado || payload.cabecera.id_radicado,
        mensaje: data.mensaje || 'Radicado correctamente.'
      };
    } catch (e) {
      console.error('Error al enviar al backend:', e);
      // Se conserva en local para poder reintentar sin volver a digitar.
      db.guardarRegistro(payload.cabecera);
      return {
        ok: false,
        mensaje: 'No se pudo conectar. Lo digitado quedó guardado en este navegador; reintente más tarde.'
      };
    }
  }

  _descargar(payload) {
    const nombre = `presupuesto_${payload.cabecera.dane_sede}_v${payload.cabecera.version || 1}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Paquete con todo lo del municipio, para respaldo o envío en bloque. */
  descargarMunicipio(municipio) {
    const datos = db.exportarMunicipio(municipio);
    const blob = new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuestos_${municipio.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

const api = new ApiCliente();
