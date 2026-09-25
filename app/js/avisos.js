/* app/js/avisos.js — Avisos, diálogos propios y botones en espera.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Avisos (toasts) y diálogos propios, en vez de alert()/confirm() del
     navegador: no bloquean la página, se leen con el estilo del sistema y
     el lector de pantalla los anuncia (aria-live). ─── */
  function avisar(texto, tipo){
    const cont = document.getElementById('avisos');
    const el = document.createElement('div');
    el.className = 'aviso ' + (tipo || 'info');
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="aviso-tx"></span><button type="button" class="aviso-x" aria-label="Cerrar aviso">×</button>`;
    el.querySelector('.aviso-tx').textContent = texto;
    const cerrar = () => { el.classList.add('sale'); setTimeout(() => el.remove(), 220); };
    el.querySelector('.aviso-x').addEventListener('click', cerrar);
    cont.appendChild(el);
    // Los errores se quedan hasta que se cierran: se leen, no se escapan.
    if (tipo !== 'error') setTimeout(cerrar, 4500);
  }

  // Diálogo modal genérico. botones: [{texto, valor, clase}]. Devuelve una
  // promesa con el `valor` del botón elegido (Esc o clic afuera = null).
  function mostrarDialogo({ titulo, html, botones }){
    return new Promise(resolver => {
      const fondo = document.getElementById('dlg');
      const previo = document.activeElement;
      document.getElementById('dlg-tit').textContent = titulo;
      document.getElementById('dlg-cuerpo').innerHTML = html || '';
      const acc = document.getElementById('dlg-acc');
      acc.innerHTML = '';
      const terminar = valor => {
        fondo.classList.add('oculto');
        document.removeEventListener('keydown', teclas);
        fondo.onclick = null;
        if (previo && previo.focus) previo.focus();
        resolver(valor);
      };
      // Esc cierra; Tab y Mayús+Tab dan la vuelta dentro del diálogo, sin salir a la página de atrás.
      const teclas = e => {
        if (e.key === 'Escape') { terminar(null); return; }
        if (e.key !== 'Tab') return;
        const enfocables = [...fondo.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
          .filter(x => !x.disabled && x.offsetParent !== null);
        if (!enfocables.length) return;
        const primero = enfocables[0], ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && (document.activeElement === primero || !fondo.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && (document.activeElement === ultimo || !fondo.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
      };
      (botones || [{ texto: 'Entendido', valor: true }]).forEach(b => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'b ' + (b.clase || '');
        el.textContent = b.texto;
        el.addEventListener('click', () => terminar(b.valor));
        acc.appendChild(el);
      });
      fondo.onclick = e => { if (e.target === fondo) terminar(null); };
      document.addEventListener('keydown', teclas);
      fondo.classList.remove('oculto');
      const principal = acc.lastElementChild;
      if (principal) principal.focus();
    });
  }

  async function confirmar({ titulo, html, aceptar, peligro }){
    const v = await mostrarDialogo({ titulo, html, botones: [
      { texto: 'Cancelar', valor: false, clase: 'sec' },
      { texto: aceptar || 'Aceptar', valor: true, clase: peligro ? 'peligro' : '' },
    ] });
    return v === true;
  }

  // Deshabilita un botón mientras espera al servidor (evita dobles clics) y
  // devuelve la función que lo deja como estaba.
  function ocupar(btn, texto){
    if (!btn) return () => {};
    const antes = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('cargando');
    btn.textContent = texto;
    return () => { btn.disabled = false; btn.classList.remove('cargando'); btn.innerHTML = antes; };
  }

