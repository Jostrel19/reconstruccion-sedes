/**
 * ALMACENAMIENTO LOCAL
 * Guarda borradores y registros mientras no haya backend, y sirve de respaldo
 * para que el alcalde no pierda lo digitado si se le cae la conexión.
 * La llave de todo registro es el DANE SEDE.
 */

const db = {
  _leer(key, porDefecto) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : porDefecto;
    } catch (e) {
      console.warn('No se pudo leer', key, e);
      return porDefecto;
    }
  },

  _escribir(key, valor) {
    try {
      localStorage.setItem(key, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.error('No se pudo guardar', key, e);
      app.aviso('No se pudo guardar en este navegador. Puede estar sin espacio.', 'mal');
      return false;
    }
  },

  /* --- REGISTROS (uno vigente por DANE SEDE, con versionado) --------------- */

  registros() {
    return this._leer(APP_CONFIG.KEYS.REGISTROS, {});
  },

  registro(daneSede) {
    return this.registros()[daneSede] || null;
  },

  /**
   * Guarda conservando el histórico: la versión anterior nunca se pisa.
   *
   * Las fotografías NO se persisten en base64: localStorage tope alrededor de
   * 5 MB y un municipio con 50 sedes fotografiadas lo reventaría, perdiendo
   * todo lo digitado. Se conserva solo el nombre y el conteo; el contenido
   * viaja en el paquete que se descarga al radicar.
   */
  guardarRegistro(reg) {
    const todos = this.registros();
    const previo = todos[reg.dane_sede];
    reg = {
      ...reg,
      fotos: (reg.fotos || []).map(f => ({ nombre: f.nombre, tipo: f.tipo }))
    };
    if (reg.version) {
      // Quien radica ya calculó la versión y la puso en el consecutivo
      // (SED-PRE-<dane>-v<N>). Volver a incrementarla aquí dejaría el número
      // del radicado y el campo `version` diciendo cosas distintas, y el flujo
      // de Power Automate descarta por versión.
      if (previo) {
        reg.historico = (previo.historico || []).concat([{
          version: previo.version || 1,
          estado: previo.estado,
          total_presupuesto: previo.total_presupuesto,
          fecha: previo.fecha_radicacion || previo.fecha_guardado
        }]);
      } else {
        reg.historico = [];
      }
    } else if (previo) {
      reg.version = (previo.version || 1) + 1;
      reg.historico = (previo.historico || []).concat([{
        version: previo.version || 1,
        estado: previo.estado,
        total_presupuesto: previo.total_presupuesto,
        fecha: previo.fecha_radicacion || previo.fecha_guardado
      }]);
    } else {
      reg.version = 1;
      reg.historico = [];
    }
    reg.fecha_guardado = new Date().toISOString();
    todos[reg.dane_sede] = reg;
    this._escribir(APP_CONFIG.KEYS.REGISTROS, todos);
    return reg;
  },

  registrosDeMunicipio(municipio) {
    const todos = this.registros();
    return Object.values(todos).filter(r => r.municipio === municipio);
  },

  /**
   * Ingesta de un registro que llega desde afuera (paquete .json subido por el
   * municipio). A diferencia de guardarRegistro NO incrementa la versión: se
   * respeta la que trae el paquete. Si ya existe una versión igual o mayor, se
   * conserva la existente para no retroceder.
   */
  importarRegistro(reg) {
    if (!reg || !reg.dane_sede) return { ok: false, motivo: 'sin DANE SEDE' };
    const todos = this.registros();
    const previo = todos[reg.dane_sede];
    if (previo && (previo.version || 1) >= (reg.version || 1)) {
      return { ok: false, motivo: `ya existe v${previo.version || 1}` };
    }
    todos[reg.dane_sede] = { ...reg, fecha_importacion: new Date().toISOString() };
    this._escribir(APP_CONFIG.KEYS.REGISTROS, todos);
    return { ok: true };
  },

  /** Actualiza únicamente el bloque de verificación de la Secretaría. */
  guardarVerificacion(daneSede, v) {
    const todos = this.registros();
    const reg = todos[daneSede];
    if (!reg) return null;
    Object.assign(reg, v);
    this._escribir(APP_CONFIG.KEYS.REGISTROS, todos);
    return reg;
  },

  /* --- BORRADOR EN CURSO --------------------------------------------------- */

  borrador(daneSede) {
    return this._leer(APP_CONFIG.KEYS.BORRADOR, {})[daneSede] || null;
  },

  /**
   * Guarda el borrador SIN el contenido de las fotografías.
   *
   * Medido en Riosucio: 58 sedes con 3 fotos cada una llegan a 49 MB y el
   * navegador empieza a rechazar escrituras hacia la sede 48. El fallo es
   * silencioso —la excepción se atrapa dentro— así que el alcalde creería que
   * guardó y habría perdido el trabajo.
   *
   * Se conserva el nombre para que al reabrir se vea cuáles había adjuntado.
   * El contenido solo vive en memoria y se exige al momento de radicar.
   */
  guardarBorrador(daneSede, datos) {
    const b = this._leer(APP_CONFIG.KEYS.BORRADOR, {});
    b[daneSede] = {
      ...datos,
      fotos: (datos.fotos || []).map(f => ({ nombre: f.nombre, tipo: f.tipo })),
      fecha_borrador: new Date().toISOString()
    };
    return this._escribir(APP_CONFIG.KEYS.BORRADOR, b);
  },

  borrarBorrador(daneSede) {
    const b = this._leer(APP_CONFIG.KEYS.BORRADOR, {});
    delete b[daneSede];
    this._escribir(APP_CONFIG.KEYS.BORRADOR, b);
  },

  /* --- SESIÓN -------------------------------------------------------------- */

  sesion() {
    return this._leer(APP_CONFIG.KEYS.SESION, null);
  },

  guardarSesion(s) {
    this._escribir(APP_CONFIG.KEYS.SESION, s);
  },

  /** Marca registros como entregados a la Secretaría. */
  marcarEnviados(danes) {
    const todos = this.registros();
    const ahora = new Date().toISOString();
    danes.forEach(d => { if (todos[d]) { todos[d].enviado = true; todos[d].fecha_envio = ahora; } });
    return this._escribir(APP_CONFIG.KEYS.REGISTROS, todos);
  },

  /** Lo radicado que todavía no se ha subido a la carpeta de la Secretaría. */
  pendientesDeEnvio(municipio) {
    return this.registrosDeMunicipio(municipio).filter(r => !r.enviado);
  },

  /** Exporta todo lo del municipio, para el modo 'archivo' y para respaldo. */
  exportarMunicipio(municipio) {
    return {
      municipio,
      generado: new Date().toISOString(),
      version_app: APP_CONFIG.VERSION,
      registros: this.registrosDeMunicipio(municipio)
    };
  }
};
