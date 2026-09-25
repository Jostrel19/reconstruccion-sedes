/* app/js/usuarios.js — Usuarios (solo Administrador).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  // Antes eran 7 filas escritas a mano en el HTML y "+ Agregar usuario" no
  // hacía nada — activar a alguien real significaba editar el Sheet a mano.
  var ROL_TXT = { ADMINISTRADOR: 'Administrador', VERIFICADOR: 'Verificador', RESPONSABLE_SEDE: 'Responsable de sede', CONSULTA: 'Consulta' };

  async function cargarUsuarios(){
    const tbody = document.getElementById('usuarios-tbody');
    let r;
    try { r = await backend('listarUsuarios', { token: sesion.token }); }
    catch (err) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--err)">No se pudo contactar el servidor.</td></tr>'; return; }
    if (vista !== 'usuarios') return;
    if (!r.ok){
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--err)">${esc(r.error || 'No se pudo cargar Usuarios.')}</td></tr>`;
      return;
    }
    pintarUsuariosReal(r.usuarios || []);
  }

  function pintarUsuariosReal(usuarios){
    const tbody = document.getElementById('usuarios-tbody');
    if (usuarios.length === 0){
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--tx-sec)">Sin usuarios.</td></tr>';
      return;
    }
    tbody.innerHTML = usuarios.map(u => {
      const activo = u.activo === true || String(u.activo).toUpperCase() === 'TRUE';
      const ambito = u.rol === 'RESPONSABLE_SEDE'
        ? (u.tipo === 'alcalde' ? `Municipio: ${esc(u.alcance)}` : `${String(u.alcance || '').split('|').filter(Boolean).length} sede(s)`)
        : 'Todo Caldas';
      return `<tr>
        <td><strong>${esc(u.nombre)}</strong><br><span class="hace">${esc(u.correo)}</span></td>
        <td>${esc(ROL_TXT[u.rol] || u.rol)}</td>
        <td>${ambito}</td>
        <td><span class="est ${activo ? 'e-apr' : 'e-pend'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="b sec mini" type="button" onclick="toggleActivoUsuarioUI('${esc(u.correo)}', ${!activo}, this)">${activo ? 'Desactivar' : 'Activar'}</button></td>
      </tr>`;
    }).join('');
  }

  function mostrarFormularioUsuario(){
    document.getElementById('usuario-form').classList.remove('oculto');
    document.getElementById('uf-error').classList.add('oculto');
    actualizarCamposUsuarioForm();
  }

  function actualizarCamposUsuarioForm(){
    const rol = document.getElementById('uf-rol').value;
    const esResponsable = rol === 'RESPONSABLE_SEDE';
    document.getElementById('uf-campo-tipo').classList.toggle('oculto', !esResponsable);
    document.getElementById('uf-campo-alcance').classList.toggle('oculto', !esResponsable);
    if (esResponsable){
      const tipo = document.getElementById('uf-tipo').value;
      document.getElementById('uf-alcance-label').textContent = tipo === 'rector' ? 'DANE de sus sedes' : 'Municipio';
      document.getElementById('uf-alcance').placeholder = tipo === 'rector' ? 'Ej: 217013000602|217013000017' : 'Ej: AGUADAS';
    }
  }

  async function crearUsuarioUI(){
    const err = document.getElementById('uf-error');
    err.classList.add('oculto');
    const rol = document.getElementById('uf-rol').value;
    const cuerpo = {
      token: sesion.token,
      correo: document.getElementById('uf-correo').value.trim(),
      nombre: document.getElementById('uf-nombre').value.trim(),
      rol: rol,
      tipo: rol === 'RESPONSABLE_SEDE' ? document.getElementById('uf-tipo').value : 'interno',
      alcance: rol === 'RESPONSABLE_SEDE' ? document.getElementById('uf-alcance').value.trim() : ''
    };
    const soltar = ocupar(document.getElementById('uf-btn-crear'), 'Creando…');
    try {
      const r = await backend('crearUsuario', cuerpo);
      if (!r.ok){ err.textContent = r.error || 'No se pudo crear el usuario.'; err.classList.remove('oculto'); return; }
      avisar(`Usuario ${cuerpo.correo} creado. Ya puede entrar con su correo.`, 'ok');
      document.getElementById('usuario-form').classList.add('oculto');
      document.getElementById('uf-correo').value = '';
      document.getElementById('uf-nombre').value = '';
      document.getElementById('uf-alcance').value = '';
      cargarUsuarios();
    } catch (e) {
      err.textContent = 'No se pudo contactar el servidor.'; err.classList.remove('oculto');
    } finally {
      soltar();
    }
  }

  async function toggleActivoUsuarioUI(correo, nuevoActivo, btn){
    if (!nuevoActivo){
      const ok = await confirmar({
        titulo: 'Desactivar usuario',
        html: `<p class="nota-dlg"><b>${esc(correo)}</b> no podrá volver a entrar. Si tiene una sesión abierta, se cierra en máximo 5 minutos. Se puede activar de nuevo cuando se quiera.</p>`,
        aceptar: 'Desactivar', peligro: true,
      });
      if (!ok) return;
    }
    const soltar = ocupar(btn, nuevoActivo ? 'Activando…' : 'Desactivando…');
    try {
      const r = await backend('actualizarUsuario', { token: sesion.token, correo, activo: nuevoActivo });
      if (!r.ok){ avisar(r.error || 'No se pudo actualizar.', 'error'); soltar(); return; }
      avisar(nuevoActivo ? `${correo} quedó activo.` : `${correo} quedó inactivo.`, 'ok');
    } catch (e) { avisar('No se pudo contactar el servidor.', 'error'); soltar(); return; }
    cargarUsuarios();
  }

