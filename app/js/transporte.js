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
    'listarFotos', 'listarHallazgos', 'listarUsuarios', 'listarLotes', 'listarConfirmaciones', 'descargarCertificado',
    // No son lectura, pero son idempotentes: reintentar es seguro. volcarCarga no
    // duplica lo ya volcado; guardar lo mismo no crea filas; generar con las mismas
    // respuestas devuelve la misma certificación; el mismo PDF no se carga dos veces.
    'volcarCarga', 'guardarConfirmaciones', 'generarCertificado', 'subirCertificado']);
  const BACKEND_INTENTOS = 3;
  // Un pedido colgado dejaba la pantalla en "Cargando…" para siempre.
  const BACKEND_TIEMPO_MS = 60 * 1000;
  // Un PDF de 10 MB viaja como ~13 MB: en una conexión rural de 1 Mbps son casi
  // dos minutos solo de subida. Estas acciones esperan más.
  const TIEMPO_ACCION_MS = { subirCertificado: 5 * 60 * 1000, descargarCertificado: 3 * 60 * 1000 };
  async function backend(accion, datos){
    const cuerpo = JSON.stringify(Object.assign({ accion }, datos));
    const espera = TIEMPO_ACCION_MS[accion] || BACKEND_TIEMPO_MS;
    for (let intento = 1; ; intento++){
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), espera);
      let texto;
      try {
        const resp = await fetch(BACKEND_URL, { method: 'POST', body: cuerpo, signal: control.signal });
        texto = await resp.text();
      } catch (err) {
        if (err && err.name === 'AbortError') {
          const e = new Error(`El servidor tardó más de ${Math.round(espera / 60000)} minuto${espera > 60000 ? 's' : ''} en responder.`);
          e.sinConfirmar = true; // pudo haberse ejecutado: no se sabe
          throw e;
        }
        // Sin respuesta legible (TypeError): red caída, o una página de error de
        // Google sin permiso CORS — pasó el 2026-09-29 con Google lento, y Usuarios
        // quedaba en "No se pudo contactar el servidor". Una lectura se reintenta;
        // de una escritura no se sabe si corrió.
        if (ACCIONES_LECTURA.has(accion) && intento < BACKEND_INTENTOS){
          await new Promise(res => setTimeout(res, 800 * intento));
          continue;
        }
        if (err && !ACCIONES_LECTURA.has(accion)) err.sinConfirmar = true;
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
      // sinConfirmar: la acción pudo haberse ejecutado (llegó HTML, no JSON). El
      // ingreso lo usa para mostrar el campo del código aunque no haya respuesta.
      return { ok: false, sinConfirmar: !noEjecutada && !ACCIONES_LECTURA.has(accion), error: noEjecutada || ACCIONES_LECTURA.has(accion)
        ? 'El servidor no procesó la solicitud. Intente de nuevo en un momento.'
        : 'No se pudo confirmar la respuesta del servidor. Revise si el cambio quedó guardado antes de volver a intentarlo.' };
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

