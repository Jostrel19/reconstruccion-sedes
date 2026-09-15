/**
 * ALMACÉN DE IMÁGENES (IndexedDB)
 *
 * Las fotografías y las firmas no caben en localStorage: su tope ronda los 5 a
 * 10 MB y un municipio con 50 sedes fotografiadas lo desborda, perdiendo lo
 * digitado sin avisar. IndexedDB admite cientos de megabytes.
 *
 * Formato único de imagen en todo el sistema:  { nombre, tipo, datos }
 * donde `datos` es un data URI completo. El paquete .json que viaja al backend
 * usa `contenido_b64` (solo el base64, sin el prefijo) porque así lo necesita
 * SharePoint; `almacen.normalizar` traduce entre ambos.
 */

const almacen = {
  _bd: null,
  NOMBRE: 'sed_presupuesto',
  TIENDA: 'fotos',

  _abrir() {
    if (this._bd) return Promise.resolve(this._bd);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.NOMBRE, 1);
      req.onupgradeneeded = () => {
        const bd = req.result;
        if (!bd.objectStoreNames.contains(this.TIENDA)) {
          bd.createObjectStore(this.TIENDA, { keyPath: 'dane_sede' });
        }
      };
      req.onsuccess = () => { this._bd = req.result; resolve(this._bd); };
      req.onerror = () => reject(req.error);
    });
  },

  async _tx(modo, fn) {
    try {
      const bd = await this._abrir();
      return await new Promise((resolve, reject) => {
        const tx = bd.transaction(this.TIENDA, modo);
        const req = fn(tx.objectStore(this.TIENDA));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Almacén de imágenes no disponible:', e);
      return null;
    }
  },

  /** Guarda las fotos de una sede. Reemplaza las anteriores. */
  guardar(daneSede, fotos) {
    return this._tx('readwrite', t => t.put({
      dane_sede: daneSede,
      fotos: (fotos || []).map(f => ({ nombre: f.nombre, tipo: f.tipo, datos: f.datos })),
      fecha: new Date().toISOString()
    }));
  },

  async leer(daneSede) {
    const r = await this._tx('readonly', t => t.get(daneSede));
    return r ? r.fotos : [];
  },

  borrar(daneSede) {
    return this._tx('readwrite', t => t.delete(daneSede));
  },

  vaciar() {
    return this._tx('readwrite', t => t.clear());
  },

  /**
   * Traduce el formato del paquete al formato interno.
   * El paquete trae `contenido_b64` sin prefijo; la etiqueta <img> necesita el
   * data URI completo. Aquí estaba la causa de que la consola mostrara las
   * fotografías rotas.
   */
  normalizar(fotos) {
    return (fotos || []).map(f => {
      if (f.datos) return { nombre: f.nombre, tipo: f.tipo, datos: f.datos };
      if (f.contenido_b64) {
        return {
          nombre: f.nombre,
          tipo: f.tipo || 'image/jpeg',
          datos: `data:${f.tipo || 'image/jpeg'};base64,${f.contenido_b64}`
        };
      }
      return { nombre: f.nombre, tipo: f.tipo, datos: '' };
    }).filter(f => f.datos);
  },

  /* ------------------------------------------------------------- FIRMAS ---
   * La firma es de la PERSONA, no del registro: una sola por alcalde y una por
   * verificador, reutilizada en todas sus radicaciones. Por eso va en
   * localStorage —pesa unos pocos kilobytes— y no en IndexedDB.
   */
  CLAVE_FIRMA: 'sed_presup_firma',

  firma(rol) {
    try {
      const raw = localStorage.getItem(`${this.CLAVE_FIRMA}_${rol}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  guardarFirma(rol, firma) {
    try {
      localStorage.setItem(`${this.CLAVE_FIRMA}_${rol}`, JSON.stringify(firma));
      return true;
    } catch (e) {
      console.error('No se pudo guardar la firma:', e);
      return false;
    }
  },

  borrarFirma(rol) {
    localStorage.removeItem(`${this.CLAVE_FIRMA}_${rol}`);
  },

  /** Reduce una imagen manteniendo proporción y la devuelve como data URI. */
  reducir(file, ladoMax, calidad, conservarTransparencia) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > ladoMax || h > ladoMax) {
          const f = ladoMax / Math.max(w, h);
          w = Math.round(w * f); h = Math.round(h * f);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (!conservarTransparencia) {
          // Las firmas suelen venir en PNG con fondo transparente; sobre el PDF
          // blanco se ven bien, pero al pasarlas a JPEG el fondo sale negro.
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(conservarTransparencia
          ? cv.toDataURL('image/png')
          : cv.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen ilegible')); };
      img.src = url;
    });
  }
};
