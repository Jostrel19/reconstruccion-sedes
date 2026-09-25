/* app/js/sesion.js — Sesión guardada en la pestaña (sessionStorage).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Sesión en sessionStorage (decisión del 2026-09-24): sobrevive a F5 en
     esta pestaña y se borra al cerrarla o con «Salir». El token sigue
     venciendo a las 12 h y el backend lo revalida en cada petición. Si el
     navegador no deja guardar (modo privado, almacenamiento bloqueado), todo
     funciona igual, solo que F5 vuelve a pedir código. ─── */
  const CLAVE_SESION = 'rs_sesion_v1';
  const CLAVE_VISTA = 'rs_vista_v1';

  function leerLocal(clave){
    try { return JSON.parse(sessionStorage.getItem(clave) || 'null'); } catch (err) { return null; }
  }
  function guardarLocal(clave, valor){
    try { sessionStorage.setItem(clave, JSON.stringify(valor)); } catch (err) { /* sin almacenamiento: no se recuerda */ }
  }
  function borrarLocal(){
    try { sessionStorage.removeItem(CLAVE_SESION); sessionStorage.removeItem(CLAVE_VISTA); } catch (err) {}
  }

  // Vencimiento que viene firmado dentro del token (payload base64url).
  function venceToken(token){
    try {
      let b = String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      b += '='.repeat((4 - b.length % 4) % 4);
      const payload = JSON.parse(decodeURIComponent(escape(atob(b))));
      return Number(payload.exp) || 0;
    } catch (err) { return 0; }
  }

  // Deja lista la sesión (desde el ingreso o desde lo guardado): rol, nombre y
  // texto del rol en la barra superior.
  function aplicarSesion(datos){
    const clave = ROL_BACKEND_A_CLAVE[datos.rolBackend];
    if (!clave) return null;
    sesion = datos;
    rol = clave;
    ROLES[clave].nom = datos.nombre;
    ROLES[clave].ini = iniciales(datos.nombre);
    if (clave === 'resp'){
      // Alcalde: el alcance es el municipio. Rector: lista de DANE de sede.
      const lista = String(datos.alcance || '').split('|').map(x => x.trim()).filter(Boolean);
      ROLES.resp.rot = lista.length && lista.every(x => /^\d{12}$/.test(x))
        ? `Responsable de sede · ${lista.length} sede${lista.length === 1 ? '' : 's'}`
        : `Responsable de sede · ${datos.alcance}`;
    }
    return clave;
  }

  function restaurarSesion(){
    const g = leerLocal(CLAVE_SESION);
    if (!g || !g.sesion || !g.sesion.token) return false;
    if (Date.now() > venceToken(g.sesion.token)) { borrarLocal(); return false; }
    correoActual = g.correo || '';
    if (!aplicarSesion(g.sesion)) { borrarLocal(); return false; }
    const v = leerLocal(CLAVE_VISTA) || {};
    vista = RUTA[v.vista] && v.vista !== 'login' ? v.vista : ROLES[rol].ve[0];
    muniActual = v.muniActual || null;
    daneActual = v.daneActual || null;
    universoSel = v.universoSel || 'todas';
    if ((vista === 'ficha' || vista === 'registrar') && !daneActual) vista = ROLES[rol].ve[0];
    if (vista === 'muni' && !muniActual) vista = ROLES[rol].ve[0];
    return true;
  }

