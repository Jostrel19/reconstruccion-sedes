/* app/js/usuarios.js — Usuarios (solo Administrador).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  // Antes eran 7 filas escritas a mano en el HTML y "+ Agregar usuario" no
  // hacía nada — activar a alguien real significaba editar el Sheet a mano.
  var ROL_TXT = { ADMINISTRADOR: 'Administrador', VERIFICADOR: 'Verificador', RESPONSABLE_SEDE: 'Responsable de sede', CONSULTA: 'Consulta' };

  /* Rediseño claro (2026-10-01, muestra aprobada por el usuario). Todo es de pantalla: el servidor no cambia.
     Arriba, cuatro cifras; sobre la tabla, buscador y filtros por estado y tipo; en el formulario, el municipio del
     alcalde se elige de la lista del catálogo (así queda escrito igual, con tilde) y una ayuda recuerda que el nombre
     del alcalde va en mayúscula, porque es el que sale en la certificación. Si un index.html anterior quedó en caché
     y no trae esos elementos, la pantalla funciona como antes. */
  let USUARIOS_LISTA = [];
  let usuFiltroEstado = 'todos', usuFiltroTipo = 'todos', usuTexto = '';
  const usuActivo = u => u.activo === true || String(u.activo).toUpperCase() === 'TRUE';
  const usuGrupo = u => u.rol === 'RESPONSABLE_SEDE' ? (u.tipo === 'alcalde' ? 'alcalde' : 'rector') : 'interno';
  const USU_FILTROS_ESTADO = { todos: ['Todos', () => true], activos: ['Activos', usuActivo], inactivos: ['Inactivos', u => !usuActivo(u)] };
  const USU_FILTROS_TIPO = { todos: ['Todos los tipos', () => true], alcalde: ['Alcaldes', u => usuGrupo(u) === 'alcalde'],
    rector: ['Rectores', u => usuGrupo(u) === 'rector'], interno: ['Secretaría', u => usuGrupo(u) === 'interno'] };
  const usuNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Municipios del catálogo (los 26 de la campaña), escritos como en el catálogo, con tilde.
  function municipiosCatalogo(){
    const lista = SEDES ? SEDES.map(s => s.municipio) : (CONF ? CONF.municipios.map(m => m.municipio) : []);
    return [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

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
    USUARIOS_LISTA = usuarios;
    pintarCifrasUsuarios();
    pintarTablaUsuarios();
  }

  function pintarCifrasUsuarios(){
    const cont = document.getElementById('usuarios-cifras');
    if (!cont) return;
    const lista = USUARIOS_LISTA, act = lista.filter(usuActivo);
    const munis = municipiosCatalogo();
    const conAlcalde = new Set(act.filter(u => usuGrupo(u) === 'alcalde').map(u => u.alcance));
    const sinAlcalde = munis.filter(m => !conAlcalde.has(m));
    const rect = lista.filter(u => usuGrupo(u) === 'rector'), sed = lista.filter(u => usuGrupo(u) === 'interno');
    const correosAlcalde = act.filter(u => usuGrupo(u) === 'alcalde').length;
    // Municipios con alcalde activo: verde si todos tienen; en rosa, y con sus nombres, si a alguno le falta.
    const alcaldes = munis.length
      ? `<div class="uc ${sinAlcalde.length ? 'falta' : 'ok'}"><span>Municipios con alcalde activo</span><b>${munis.length - sinAlcalde.length}<small>de ${munis.length}</small></b>
          <p>${sinAlcalde.length ? `Sin alcalde activo: <strong>${sinAlcalde.map(esc).join(', ')}</strong>.` : `Todos tienen al menos un correo activo (${correosAlcalde} correo${correosAlcalde === 1 ? '' : 's'}).`}</p></div>`
      : `<div class="uc"><span>Alcaldes activos</span><b>${correosAlcalde}</b><p>Correos de alcalde que pueden entrar.</p></div>`;
    cont.innerHTML =
      `<div class="uc"><span>Usuarios activos</span><b>${formatNum(act.length, 0)}<small>de ${formatNum(lista.length, 0)}</small></b><p>Pueden entrar hoy con su correo.</p></div>` + alcaldes +
      `<div class="uc"><span>Rectores activos</span><b>${rect.filter(usuActivo).length}<small>de ${rect.length}</small></b><p>Responsables de sede con tipo rector.</p></div>` +
      `<div class="uc"><span>Personal de la Secretaría</span><b>${sed.filter(usuActivo).length}<small>activos</small></b><p>Administrador, Verificador y Consulta.</p></div>`;
  }

  function pintarTablaUsuarios(){
    const tbody = document.getElementById('usuarios-tbody');
    const usuarios = USUARIOS_LISTA;
    if (usuarios.length === 0){
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--tx-sec)">Sin usuarios.</td></tr>';
      return;
    }
    const coincide = u => !usuTexto || usuNorm(`${u.nombre} ${u.correo} ${u.alcance}`).includes(usuNorm(usuTexto));
    const base = usuarios.filter(coincide);
    const fE = USU_FILTROS_ESTADO[usuFiltroEstado][1], fT = USU_FILTROS_TIPO[usuFiltroTipo][1];
    const contE = document.getElementById('usuarios-f-estado'), contT = document.getElementById('usuarios-f-tipo');
    if (contE) contE.innerHTML = Object.entries(USU_FILTROS_ESTADO).map(([k, [tx, f]]) =>
      `<button type="button" class="chip" data-usu-estado="${k}" aria-pressed="${k === usuFiltroEstado}">${tx} <b>${base.filter(fT).filter(f).length}</b></button>`).join('');
    if (contT) contT.innerHTML = Object.entries(USU_FILTROS_TIPO).map(([k, [tx, f]]) =>
      `<button type="button" class="chip" data-usu-tipo="${k}" aria-pressed="${k === usuFiltroTipo}">${tx} <b>${base.filter(fE).filter(f).length}</b></button>`).join('');
    const filas = base.filter(fE).filter(fT);
    const n = document.getElementById('usuarios-n');
    if (n) n.textContent = filas.length === usuarios.length ? formatNum(usuarios.length, 0) : `${formatNum(filas.length, 0)} de ${formatNum(usuarios.length, 0)}`;
    if (!filas.length){ tbody.innerHTML = '<tr><td colspan="5" class="vacio-tx">Ningún usuario coincide con la búsqueda y los filtros.</td></tr>'; return; }
    tbody.innerHTML = filas.map(u => {
      const activo = usuActivo(u);
      const ambito = u.rol === 'RESPONSABLE_SEDE'
        ? (u.tipo === 'alcalde' ? `Municipio: ${esc(u.alcance)}` : `${String(u.alcance || '').split('|').filter(Boolean).length} sede(s)`)
        : 'Todo Caldas';
      return `<tr class="${activo ? '' : 'inactivo'}">
        <td><strong>${esc(u.nombre)}</strong><br><span class="hace">${esc(u.correo)}</span></td>
        <td><span class="usu-rol">${esc(ROL_TXT[u.rol] || u.rol)}</span></td>
        <td>${ambito}</td>
        <td><span class="est ${activo ? 'e-apr c-car' : 'e-pend'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="b ${activo ? 'sec ' : ''}mini" type="button" onclick="toggleActivoUsuarioUI('${esc(u.correo)}', ${!activo}, this)">${activo ? 'Desactivar' : 'Activar'}</button></td>
      </tr>`;
    }).join('');
  }

  function filtrarUsuarios(cambio){
    if (cambio.estado) usuFiltroEstado = cambio.estado;
    if (cambio.tipo) usuFiltroTipo = cambio.tipo;
    if (cambio.texto !== undefined) usuTexto = cambio.texto;
    pintarTablaUsuarios();
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
    const tipo = document.getElementById('uf-tipo').value;
    const esAlcalde = esResponsable && tipo === 'alcalde';
    const ayudaNombre = document.getElementById('uf-nombre-ayuda');
    if (ayudaNombre) ayudaNombre.classList.toggle('oculto', !esAlcalde);
    // El municipio del alcalde se elige de la lista del catálogo; si no hay lista (o es un index.html anterior), se escribe.
    const sel = document.getElementById('uf-municipio');
    const munis = municipiosCatalogo();
    const conLista = !!sel && esAlcalde && munis.length > 0;
    if (sel && conLista && sel.options.length !== munis.length + 1){
      sel.innerHTML = '<option value="">Elija el municipio…</option>' + munis.map(m => `<option>${esc(m)}</option>`).join('');
    }
    if (sel) sel.classList.toggle('oculto', !conLista);
    document.getElementById('uf-alcance').classList.toggle('oculto', conLista);
    if (esResponsable){
      document.getElementById('uf-alcance-label').textContent = tipo === 'rector' ? 'DANE de sus sedes' : 'Municipio';
      document.getElementById('uf-alcance-label').setAttribute('for', conLista ? 'uf-municipio' : 'uf-alcance');
      document.getElementById('uf-alcance').placeholder = tipo === 'rector' ? 'Ej: 217013000602|217013000017' : 'Ej: AGUADAS';
      const ayuda = document.getElementById('uf-alcance-ayuda');
      if (ayuda) ayuda.textContent = conLista ? 'Se elige de la lista: así queda escrito igual que en el catálogo, con tilde.'
        : (tipo === 'rector' ? 'Códigos DANE de 12 dígitos, separados por |.' : 'Escríbalo como en el catálogo, con tilde.');
    }
  }

  async function crearUsuarioUI(){
    const err = document.getElementById('uf-error');
    err.classList.add('oculto');
    const rol = document.getElementById('uf-rol').value;
    const sel = document.getElementById('uf-municipio');
    const conLista = !!sel && !sel.classList.contains('oculto');
    const cuerpo = {
      token: sesion.token,
      correo: document.getElementById('uf-correo').value.trim(),
      nombre: document.getElementById('uf-nombre').value.trim(),
      rol: rol,
      tipo: rol === 'RESPONSABLE_SEDE' ? document.getElementById('uf-tipo').value : 'interno',
      alcance: rol === 'RESPONSABLE_SEDE' ? (conLista ? sel.value : document.getElementById('uf-alcance').value.trim()) : ''
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
      if (sel) sel.value = '';
      cargarUsuarios();
    } catch (e) {
      // H1-1 (hito 1): la respuesta se puede perder aunque el usuario sí quede
      // creado. Una escritura no se reintenta sola: se pide revisar antes.
      err.textContent = 'No se pudo confirmar la respuesta del servidor. El usuario pudo haber quedado creado: pulse «Actualizar» y revise la lista antes de volver a intentarlo.';
      err.classList.remove('oculto');
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
    } catch (e) { avisar('No se pudo confirmar la respuesta del servidor. Pulse «Actualizar» y revise si el cambio quedó hecho antes de repetirlo.', 'error'); soltar(); return; }
    cargarUsuarios();
  }
