/* app/js/login.js — Ingreso con código de un solo uso (D-20).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  function errorLogin(msg){
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.toggle('oculto', !msg);
  }

  /* Login D-20: correo + código de un solo uso, sin contraseña, contra el
     backend real. */
  async function loginEnviarCodigo(){
    errorLogin('');
    correoActual = document.getElementById('u').value.trim();
    if (!correoActual) { errorLogin('Escriba su correo institucional.'); return; }

    const soltar = ocupar(document.getElementById('btn-enviar'), 'Enviando…');
    try {
      const r = await backend('solicitarCodigo', { correo: correoActual });
      if (r.ok) pasoCodigo('Le enviamos un código a su correo — vence en 10 minutos, un solo uso.');
      else if (r.sinConfirmar) pasoCodigo(AVISO_SIN_CONFIRMAR);
      else errorLogin(r.error || 'No se pudo enviar el código. Intente de nuevo.');
    } catch (err) {
      if (err && err.sinConfirmar) pasoCodigo(AVISO_SIN_CONFIRMAR);
      else errorLogin('No se pudo contactar el servidor. Intente de nuevo.');
    } finally {
      soltar();
    }
  }

  /* Medido el 2026-09-29: con Google lento, el código llegó al correo pero la
     respuesta fue una página de error, y la pantalla no dejaba escribirlo. Se
     muestra el campo igual: el servidor valida el código, así que no abre nada.
     No se reintenta el envío solo, para no mandar correos repetidos (cupo diario). */
  const AVISO_SIN_CONFIRMAR = 'El servidor tardó y no confirmó el envío. Si le llegó el código, escríbalo aquí ' +
    '(vence en 10 minutos). Si no le llega en unos minutos, use «Cambiar correo» y pídalo de nuevo.';

  function pasoCodigo(texto){
    document.getElementById('login-sub').textContent = texto;
    document.getElementById('login-p1').classList.add('oculto');
    document.getElementById('login-p2').classList.remove('oculto');
    document.getElementById('cod').focus();
  }

  function loginVolver(){
    errorLogin('');
    document.getElementById('login-sub').textContent = 'Escriba su correo institucional.';
    document.getElementById('login-p2').classList.add('oculto');
    document.getElementById('login-p1').classList.remove('oculto');
  }

  async function loginEntrar(){
    errorLogin('');
    const codigo = document.getElementById('cod').value.trim();
    if (!codigo) { errorLogin('Escriba el código de 6 dígitos.'); return; }

    const soltar = ocupar(document.getElementById('btn-entrar'), 'Validando…');
    try {
      const r = await backend('validarCodigo', { correo: correoActual, codigo });
      if (!r.ok && r.sinConfirmar) {
        errorLogin('El servidor no respondió a tiempo. Intente «Entrar» otra vez con el mismo código; si le dice que no es válido, use «Cambiar correo» y pida uno nuevo.');
        return;
      }
      if (!r.ok) { errorLogin(r.error || 'Código inválido.'); return; }

      const datos = { token: r.token, rolBackend: r.rol, tipo: r.tipo || '', nombre: r.nombre, alcance: r.alcance };
      const clave = aplicarSesion(datos);
      if (!clave) { sesion = null; errorLogin('Rol desconocido: ' + r.rol); return; }
      guardarLocal(CLAVE_SESION, { sesion: datos, correo: correoActual });
      vista = ROLES[clave].ve[0];
      pintar();
      // Sedes reales: no bloquea la entrada, se repinta cuando llegue.
      cargarSedes().then(() => pintar());
    } catch (err) {
      errorLogin(err && err.sinConfirmar
        ? 'El servidor no respondió a tiempo. Intente «Entrar» otra vez con el mismo código; si le dice que no es válido, use «Cambiar correo» y pida uno nuevo.'
        : 'No se pudo contactar el servidor. Intente de nuevo.');
    } finally {
      soltar();
    }
  }

