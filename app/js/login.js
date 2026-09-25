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
      if (!r.ok) { errorLogin(r.error || 'No se pudo enviar el código. Intente de nuevo.'); return; }
      document.getElementById('login-sub').textContent =
        'Le enviamos un código a su correo — vence en 10 minutos, un solo uso.';
      document.getElementById('login-p1').classList.add('oculto');
      document.getElementById('login-p2').classList.remove('oculto');
      document.getElementById('cod').focus();
    } catch (err) {
      errorLogin('No se pudo contactar el servidor. Intente de nuevo.');
    } finally {
      soltar();
    }
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
      if (!r.ok) { errorLogin(r.error || 'Código inválido.'); return; }

      const datos = { token: r.token, rolBackend: r.rol, nombre: r.nombre, alcance: r.alcance };
      const clave = aplicarSesion(datos);
      if (!clave) { sesion = null; errorLogin('Rol desconocido: ' + r.rol); return; }
      guardarLocal(CLAVE_SESION, { sesion: datos, correo: correoActual });
      vista = ROLES[clave].ve[0];
      pintar();
      // Sedes reales: no bloquea la entrada, se repinta cuando llegue.
      cargarSedes().then(() => pintar());
    } catch (err) {
      errorLogin('No se pudo contactar el servidor. Intente de nuevo.');
    } finally {
      soltar();
    }
  }

