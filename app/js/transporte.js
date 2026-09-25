/* app/js/transporte.js — Único punto que habla con el backend de Apps Script (D-19).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* Sin cabeceras a propósito: un fetch con body de texto plano es una
     petición CORS "simple" y no dispara preflight OPTIONS, que Apps Script
     no responde. El backend igual lo parsea como JSON (Codigo.gs).

     Apps Script, con varios pedidos simultáneos, a veces no ejecuta la acción:
     responde lo de doGet ({ok, mensaje, hora}) o una página HTML. Medido el
     2026-09-24 en real: 2 de 9 pedidos simultáneos. Tomar ese {ok:true} como
     respuesta dejaba la Ficha "sin presupuesto" y, en una escritura, habría
     dado por guardado algo que no se guardó.
     - Respuesta de doGet: la acción no corrió, reintentar es seguro siempre.
     - HTML: no se sabe si corrió; se reintenta solo si la acción es de lectura. */
  const ACCIONES_LECTURA = new Set(['listarSedes', 'obtenerPresupuesto', 'obtenerBandejaVerificacion',
    'listarFotos', 'listarHallazgos', 'listarUsuarios', 'listarLotes',
    // No es lectura, pero es idempotente (no duplica lo ya volcado): reintentar es seguro.
    'volcarCarga']);
  const BACKEND_INTENTOS = 3;
  // Un pedido colgado dejaba la pantalla en "Cargando…" para siempre.
  const BACKEND_TIEMPO_MS = 60 * 1000;
  async function backend(accion, datos){
    const cuerpo = JSON.stringify(Object.assign({ accion }, datos));
    for (let intento = 1; ; intento++){
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), BACKEND_TIEMPO_MS);
      let texto;
      try {
        const resp = await fetch(BACKEND_URL, { method: 'POST', body: cuerpo, signal: control.signal });
        texto = await resp.text();
      } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('El servidor tardó más de un minuto en responder.');
        throw err;
      } finally {
        clearTimeout(reloj);
      }
      let r = null;
      try { r = JSON.parse(texto); } catch (err) {}
      // Desde el 2026-09-24 Codigo.gs devuelve `accion` en cada respuesta: si
      // no es la que se pidió, esa respuesta no es la de este pedido.
      const noEjecutada = !!r && (('mensaje' in r && 'hora' in r) || ('accion' in r && r.accion !== accion));
      if (r && !noEjecutada){
        revisarSesionVencida(accion, r);
        return r;
      }
      if (intento < BACKEND_INTENTOS && (noEjecutada || ACCIONES_LECTURA.has(accion))){
        await new Promise(res => setTimeout(res, 800 * intento));
        continue;
      }
      return { ok: false, error: noEjecutada || ACCIONES_LECTURA.has(accion)
        ? 'El servidor no procesó la solicitud. Intente de nuevo en un momento.'
        : 'No se pudo confirmar la respuesta del servidor. Revise la ficha de la sede antes de volver a intentarlo.' };
    }
  }

  // El backend rechaza un token vencido, o el de alguien a quien desactivaron
  // o le cambiaron rol/alcance (Auth.gs::verificarToken). En vez de dejar cada
  // pantalla mostrando su propio error, se cierra la sesión y se explica.
  function revisarSesionVencida(accion, r){
    if (!sesion || r.ok !== false || r.error !== 'Sesión inválida o vencida') return;
    if (accion === 'solicitarCodigo' || accion === 'validarCodigo') return;
    setTimeout(() => {
      if (!sesion) return;
      cerrarSesion();
      errorLogin('Su sesión venció o sus permisos cambiaron. Pida un código nuevo para volver a entrar.');
    }, 0);
  }

