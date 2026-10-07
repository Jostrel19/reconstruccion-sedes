/* app/js/mapa3d.js — Mapa 3D de Caldas: relieve y límites municipales dibujados con WebGL, sin librerías.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md.

   Lo usa el Inicio de la campaña (inicioCampana.js). No sabe nada de la campaña: recibe los datos del terreno
   (app/data/caldas3d.json: límites del DANE y relieve SRTM promediado a ~1 km) y, por funciones, qué color lleva
   cada municipio, qué círculo (marcador) lleva, qué dice su tooltip y qué hacer al elegirlo.
   Si el navegador no tiene WebGL, pinta el mapa plano en un canvas 2D con los mismos colores.
   Con «reducir movimiento» la cámara salta en vez de deslizarse. */

  function crearMapa3D(cfg){
    const D = cfg.datos, cv = cfg.canvas, stage = cfg.lienzo, etq = cfg.etiquetas, marc = cfg.marcadores, tip = cfg.tooltip;
    const ncx = D.ncx, ncy = D.ncy, vw = ncx + 1, H = D.h;
    const MUNIS = D.munis.map((m, k) => Object.assign({}, m, { k }));
    const N = MUNIS.length;

    // Celdas: id del municipio por celda (255 = fuera de Caldas), comprimidas por tramos.
    const cells = new Uint8Array(ncx * ncy).fill(255);
    { let p = 0; for (let i = 0; i < D.runs.length; i += 2){ cells.fill(D.runs[i], p, p + D.runs[i + 1]); p += D.runs[i + 1]; } }
    // Alturas (metros) de cada vértice con tierra, en base64 de Int16.
    const zArr = (() => { const b = atob(D.z), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); })();
    const vid = new Int32Array(vw * (ncy + 1)).fill(-1);
    for (let r = 0; r < ncy; r++) for (let c = 0; c < ncx; c++) if (cells[r * ncx + c] !== 255){ const a = r * vw + c; vid[a] = vid[a + 1] = vid[a + vw] = vid[a + vw + 1] = 0; }
    { let n = 0; for (let i = 0; i < vid.length; i++) if (vid[i] === 0) vid[i] = n++; }
    // Coordenadas en km alrededor del centro del recuadro; z en km.
    const KX = 111.32 * Math.cos(5.3 * Math.PI / 180), KY = 110.57, LONC = D.lon0 + ncx * H / 2, LATC = D.lat0 + ncy * H / 2;
    const wx = lon => (lon - LONC) * KX, wy = lat => (lat - LATC) * KY;
    // Sombreado del relieve, luz del noroeste a 42°.
    const SHADE = (() => {
      const out = new Float32Array(zArr.length), dxm = H * 111320 * Math.cos(5.3 * Math.PI / 180), dym = H * 110570, ex = 2.6;
      const az = 315 * Math.PI / 180, al = 42 * Math.PI / 180, L = [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)];
      for (let r = 0; r <= ncy; r++) for (let c = 0; c <= ncx; c++){
        const g = r * vw + c, v = vid[g]; if (v < 0) continue;
        const z0 = zArr[v], zs = q => q >= 0 ? zArr[q] : z0;
        const e = c < ncx ? vid[g + 1] : -1, w = c > 0 ? vid[g - 1] : -1, n = r < ncy ? vid[g + vw] : -1, s = r > 0 ? vid[g - vw] : -1;
        const dzx = (zs(e) - zs(w)) / ((e >= 0 && w >= 0 ? 2 : 1) * dxm) * ex, dzy = (zs(n) - zs(s)) / ((n >= 0 && s >= 0 ? 2 : 1) * dym) * ex;
        const sh = (-dzx * L[0] - dzy * L[1] + L[2]) / Math.hypot(dzx, dzy, 1);
        out[v] = Math.max(0, Math.min(1, 0.5 + (sh - Math.sin(al)) * 1.5));
      }
      return out;
    })();

    const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const corr = cfg.corrimiento || { tx: 0, ty: 0 };
    const VISTAS = { obl:{ az:-0.4, el:0.62, dist:198, exag:4 }, sur:{ az:0, el:0.34, dist:212, exag:4 }, top:{ az:0, el:1.55, dist:222, exag:0.12 } };
    const cam = Object.assign({ tx: corr.tx, ty: corr.ty, tz: 3 }, VISTAS.obl);
    const goal = { ...cam };
    let gl = null, prog, progL, buf, nVert = 0, bufOut, bufMun, nOut = 0, nMun = 0, bufSel = null, nSel = 0;
    let sel = -1, hov = -1, anim = false, arrastrando = false, W = 1, Hh = 1, fbo = null, fbTex = null, fbDepth = null, vistaActual = 'obl';
    let COL = new Float32Array(32 * 3);

    /* álgebra mínima */
    const sub3 = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }, dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    function persp(f, a, n, fa){ const t = 1 / Math.tan(f / 2), q = 1 / (n - fa); return [t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)*q,-1, 0,0,2*fa*n*q,0]; }
    function lookAt(e, c, u){ const z = nrm(sub3(e, c)), x = nrm(cross(u, z)), y = cross(z, x); return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]; }
    function mul(a, b){ const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; }
    function matrizDe(c){
      const t = [c.tx, c.ty, c.tz * Math.max(c.exag, .1) / 4];
      const eye = [t[0] + c.dist * Math.sin(c.az) * Math.cos(c.el), t[1] - c.dist * Math.cos(c.az) * Math.cos(c.el), t[2] + c.dist * Math.sin(c.el)];
      return mul(persp(32 * Math.PI / 180, W / Hh, 4, 1600), lookAt(eye, t, [0, 0, 1]));
    }
    const matriz = () => matrizDe(cam);
    function proy(m, x, y, z){ const cx = m[0]*x+m[4]*y+m[8]*z+m[12], cy = m[1]*x+m[5]*y+m[9]*z+m[13], cw = m[3]*x+m[7]*y+m[11]*z+m[15]; return [(cx/cw*.5+.5)*W, (1-(cy/cw*.5+.5))*Hh, cw]; }

    /* Encuadre automático: la distancia y el centro con que todo Caldas cabe en el área libre de la tarjeta (sin los
       controles que flotan encima, que el Inicio declara como márgenes). Sirve para cualquier ancho de pantalla. */
    const BORDE = [];
    D.lines.filter(l => l.t === 'out').forEach(l => l.p.forEach((p, i) => { if (i % 3 === 0) BORDE.push([wx(p[0]), wy(p[1]), p[2] / 1000]); }));
    function caja(c){
      const m = matrizDe(c); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of BORDE){ const p = proy(m, q[0], q[1], q[2] * c.exag); if (p[2] <= 0) return null;
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
    function encuadre(v){
      const mg = cfg.margenes ? cfg.margenes(W, Hh) : { l: 16, r: 16, t: 16, b: 16 };
      const aw = Math.max(80, W - mg.l - mg.r), ah = Math.max(80, Hh - mg.t - mg.b), cxT = mg.l + aw / 2, cyT = mg.t + ah / 2;
      const c = Object.assign({ tx: 0, ty: 0, tz: 3 }, VISTAS[v] || VISTAS.obl);
      const rx = Math.cos(c.az), ry = Math.sin(c.az), fx = -Math.sin(c.az), fy = Math.cos(c.az); // derecha y adelante en pantalla
      for (let it = 0; it < 3; it++){
        let lo = 30, hi = 1200;
        for (let k = 0; k < 24; k++){ const mid = (lo + hi) / 2; c.dist = mid; const b = caja(c); if (b && b.x1 - b.x0 <= aw && b.y1 - b.y0 <= ah) hi = mid; else lo = mid; }
        c.dist = hi;
        const b = caja(c); if (!b) break;
        const bR = caja(Object.assign({}, c, { tx: c.tx + rx, ty: c.ty + ry })), bF = caja(Object.assign({}, c, { tx: c.tx + fx, ty: c.ty + fy }));
        if (!bR || !bF) break;
        const dxR = bR.cx - b.cx, dyF = bF.cy - b.cy; // píxeles que se corre el mapa por cada km que se corre el centro
        if (Math.abs(dxR) > 1e-6){ const k = (cxT - b.cx) / dxR; c.tx += rx * k; c.ty += ry * k; }
        const b2 = caja(c);
        if (b2 && Math.abs(dyF) > 1e-6){ const k = (cyT - b2.cy) / dyF; c.tx += fx * k; c.ty += fy * k; }
      }
      return { dist: c.dist, tx: c.tx, ty: c.ty };
    }
    function reencuadrar(){
      if (W < 2 || sel >= 0) return;
      const e = encuadre(vistaActual || 'obl'); corr.tx = e.tx; corr.ty = e.ty; VISTAS[vistaActual || 'obl'].dist = e.dist;
      Object.assign(goal, e, { tz: 3 });
    }

    const VS = `attribute vec3 a_pos; attribute float a_sh; attribute float a_id;
uniform mat4 u_mvp; uniform float u_exag; uniform vec3 u_col[32]; uniform float u_sel; uniform float u_hov; uniform float u_pick; uniform float u_k;
varying vec3 v_col;
void main(){
  gl_Position = u_mvp * vec4(a_pos.xy, a_pos.z * u_exag, 1.0);
  if (u_pick > 0.5){ v_col = vec3(a_id / 255.0, 0.0, 0.0); return; }
  vec3 base = u_col[int(a_id + 0.5)];
  float s = mix(1.0, 0.74 + 0.52 * a_sh, u_k);
  float isSel = step(abs(a_id - u_sel), 0.4), isHov = step(abs(a_id - u_hov), 0.4);
  float hay = step(-0.5, u_sel);
  base = mix(base, vec3(0.80), (1.0 - isSel) * hay * 0.55);
  base = mix(base, vec3(1.0), isHov * 0.22 + isSel * 0.10);
  v_col = base * s;
}`;
    const FS = `precision mediump float; varying vec3 v_col; void main(){ gl_FragColor = vec4(v_col, 1.0); }`;
    const VSL = `attribute vec3 a_pos; uniform mat4 u_mvp; uniform float u_exag; uniform float u_lift; void main(){ gl_Position = u_mvp * vec4(a_pos.xy, a_pos.z * u_exag + u_lift, 1.0); }`;
    const FSL = `precision mediump float; uniform vec4 u_c; void main(){ gl_FragColor = u_c; }`;
    function shader(t, s){ const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    function programa(v, f){ const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, v)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
    function segmentos(lines){
      const a = []; lines.forEach(l => { for (let i = 0; i + 1 < l.p.length; i++){ const p = l.p[i], q = l.p[i+1]; a.push(wx(p[0]), wy(p[1]), (p[2] + 40) / 1000, wx(q[0]), wy(q[1]), (q[2] + 40) / 1000); } });
      return new Float32Array(a);
    }
    function subir(arr){ const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; }
    function iniciarGL(){
      gl = cv.getContext('webgl', { antialias:true, alpha:false });
      if (!gl) return false;
      prog = programa(VS, FS); progL = programa(VSL, FSL);
      let nLand = 0; for (let i = 0; i < cells.length; i++) if (cells[i] !== 255) nLand++;
      const A = new Float32Array(nLand * 6 * 5); let o = 0;
      const put = (r, c, id) => { const v = vid[r * vw + c]; A[o++] = wx(D.lon0 + c * H); A[o++] = wy(D.lat0 + r * H); A[o++] = zArr[v] / 1000; A[o++] = SHADE[v]; A[o++] = id; };
      for (let r = 0; r < ncy; r++) for (let c = 0; c < ncx; c++){ const id = cells[r * ncx + c]; if (id === 255) continue;
        put(r,c,id); put(r,c+1,id); put(r+1,c+1,id); put(r,c,id); put(r+1,c+1,id); put(r+1,c,id); }
      nVert = nLand * 6; buf = subir(A);
      const s1 = segmentos(D.lines.filter(l => l.t === 'out')), s2 = segmentos(D.lines.filter(l => l.t !== 'out'));
      bufOut = subir(s1); nOut = s1.length / 3; bufMun = subir(s2); nMun = s2.length / 3;
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    }
    function resize(){
      const d = Math.min(2, devicePixelRatio || 1), w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      W = w; Hh = h; cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      if (!gl) return;
      if (fbTex){ gl.deleteTexture(fbTex); gl.deleteRenderbuffer(fbDepth); gl.deleteFramebuffer(fbo); }
      fbTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fbTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      fbDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, fbDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, cv.width, cv.height);
      fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fbDepth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function dibujar(pick){
      const m = matriz();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pick ? fbo : null);
      gl.viewport(0, 0, cv.width, cv.height);
      if (pick) gl.clearColor(1, 0, 0, 1); else gl.clearColor(0.93, 0.95, 0.97, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      const L = n => gl.getUniformLocation(prog, n), loc = n => gl.getAttribLocation(prog, n);
      gl.uniformMatrix4fv(L('u_mvp'), false, new Float32Array(m)); gl.uniform1f(L('u_exag'), cam.exag);
      gl.uniform3fv(L('u_col'), COL); gl.uniform1f(L('u_sel'), sel); gl.uniform1f(L('u_hov'), hov); gl.uniform1f(L('u_pick'), pick ? 1 : 0); gl.uniform1f(L('u_k'), Math.min(1, cam.exag / 2));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const p = loc('a_pos'), s = loc('a_sh'), id = loc('a_id');
      gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(s); gl.vertexAttribPointer(s, 1, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(id); gl.vertexAttribPointer(id, 1, gl.FLOAT, false, 20, 16);
      gl.drawArrays(gl.TRIANGLES, 0, nVert);
      if (pick) return;
      gl.disableVertexAttribArray(s); gl.disableVertexAttribArray(id);
      gl.useProgram(progL);
      const LL = n => gl.getUniformLocation(progL, n), pl = gl.getAttribLocation(progL, 'a_pos');
      gl.uniformMatrix4fv(LL('u_mvp'), false, new Float32Array(m)); gl.uniform1f(LL('u_exag'), cam.exag);
      const linea = (b, n, c, lift) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 3, gl.FLOAT, false, 12, 0); gl.uniform4fv(LL('u_c'), c); gl.uniform1f(LL('u_lift'), lift); gl.drawArrays(gl.LINES, 0, n); };
      linea(bufMun, nMun, [0.15,0.2,0.28,0.42], 0.02); linea(bufOut, nOut, [0.06,0.09,0.15,0.95], 0.04);
      if (nSel) linea(bufSel, nSel, [0.04,0.06,0.1,1], 0.08);
    }
    function invalidar(){ if (!anim){ anim = true; requestAnimationFrame(cuadro); } }
    const ease = (a, b, t) => a + (b - a) * t;
    function cuadro(){
      let mueve = false;
      if (reduce) Object.assign(cam, goal);
      else for (const k of ['az','el','dist','exag','tx','ty','tz']){ const d = goal[k] - cam[k]; if (Math.abs(d) > 1e-3 * (k === 'dist' ? 40 : 1)){ cam[k] = ease(cam[k], goal[k], 0.12); mueve = true; } else cam[k] = goal[k]; }
      if (gl && W > 1){ dibujar(false); etiquetas(); marcadores(); }
      anim = mueve || arrastrando; if (anim) requestAnimationFrame(cuadro);
    }

    /* Etiquetas con nombre, sin que se choquen (gana el elegido, luego el que tiene el mouse, luego el más pesado). */
    MUNIS.forEach(m => {
      const s = document.createElement('span'); s.textContent = m.name; etq.appendChild(s);
      const c = Math.round((m.lon - D.lon0) / H), r = Math.round((m.lat - D.lat0) / H);
      let zz = m.zc; const v = vid[Math.max(0, Math.min(ncy, r)) * vw + Math.max(0, Math.min(ncx, c))]; if (v >= 0) zz = zArr[v];
      m.ancla = [wx(m.lon), wy(m.lat), zz / 1000];
      marc.appendChild(document.createElement('i'));
    });
    function etiquetas(){
      const m = matriz(), puestas = [], peso = cfg.peso || (() => 0);
      const orden = MUNIS.slice().sort((a, b) => (b.k === sel) - (a.k === sel) || (b.k === hov) - (a.k === hov) || peso(b) - peso(a));
      orden.forEach(mu => {
        const span = etq.children[mu.k], p = proy(m, mu.ancla[0], mu.ancla[1], mu.ancla[2] * cam.exag);
        const w = mu.name.length * 6.6 + 8, rect = [p[0] - w / 2, p[1] - 8, p[0] + w / 2, p[1] + 18];
        const fuera = p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > Hh || p[2] < 0;
        const choca = puestas.some(q => rect[0] < q[2] && rect[2] > q[0] && rect[1] < q[3] && rect[3] > q[1]);
        const ver = !fuera && (!choca || mu.k === sel);
        span.style.display = ver ? '' : 'none';
        if (ver){ puestas.push(rect); span.style.left = p[0] + 'px'; span.style.top = p[1] + 'px'; span.className = mu.k === sel ? 'sel' : ''; }
      });
    }
    /* Círculos: crecen con la raíz del valor desde un tamaño mínimo en el que cabe el número, así todos lo muestran
       (2026-10-07: antes los menores de 22 px iban sin número). El orden de tamaños se conserva; en los pequeños el
       área ya no es exactamente proporcional, y la cifra la da el número. Van encima del punto del municipio, como un
       alfiler. Se corren con transform y solo se toca lo que cambió: se reubican en cada cuadro mientras el mapa gira. */
    function marcadores(){
      const m = matriz(), vals = MUNIS.map(mu => cfg.marcador ? cfg.marcador(mu) : null);
      const mx = Math.max(1, ...vals.map(x => x ? x.v : 0)), rMin = W < 500 ? 9 : 11, rMax = W < 500 ? 17 : 27;
      MUNIS.forEach((mu, k) => {
        const el = marc.children[k], x = vals[k];
        const p = x && x.v ? proy(m, mu.ancla[0], mu.ancla[1], mu.ancla[2] * cam.exag) : null;
        const ver = !!p && p[2] >= 0 && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= Hh;
        if (el._ver !== ver){ el.style.display = ver ? '' : 'none'; el._ver = ver; }
        if (!ver) return;
        const r = Math.round(rMin + (rMax - rMin) * Math.sqrt(x.v / mx)), cls = (x.cls || '') + (mu.k === sel ? ' sel' : '') + (x.apagado ? ' apag' : '');
        if (el._r !== r){ el.style.width = el.style.height = (2 * r) + 'px'; el._r = r; }
        if (el._v !== x.v){ el.textContent = x.v; el._v = x.v; }
        if (el.className !== cls) el.className = cls;
        el.style.transform = `translate(${(p[0] - r).toFixed(1)}px,${(p[1] - 2 * r - 6).toFixed(1)}px)`;
      });
    }

    /* Elegir: resalta el borde, acerca la cámara y avisa afuera. */
    function elegir(k, avisar){
      sel = k;
      if (gl){
        const ls = D.lines.filter(l => k >= 0 && (l.a === k || l.b === k)); const a = segmentos(ls);
        if (bufSel) gl.deleteBuffer(bufSel); bufSel = subir(a); nSel = a.length / 3;
      }
      if (k >= 0){ const m = MUNIS[k]; Object.assign(goal, { tx: m.ancla[0] * .85 + (corr.txSel || 0), ty: m.ancla[1] * .85, tz: m.ancla[2] * 4 * .6, dist: 120, el: Math.max(goal.el, 0.7) }); }
      else { if (!vistaActual){ vistaActual = 'obl'; Object.assign(goal, { az: VISTAS.obl.az, el: VISTAS.obl.el, exag: VISTAS.obl.exag }); } reencuadrar(); }
      if (avisar !== false && cfg.alElegir) cfg.alElegir(k);
      invalidar();
    }
    function vista(v){
      vistaActual = v; Object.assign(goal, VISTAS[v]);
      if (sel >= 0) goal.dist = Math.min(goal.dist, 130); else reencuadrar();
      invalidar();
    }

    /* Mouse, rueda y toque */
    let ult = [0, 0], movido = 0, pendHover = false;
    function pickAt(e){
      if (!gl) return -1; const r = cv.getBoundingClientRect(), d = cv.width / r.width;
      const x = Math.floor((e.clientX - r.left) * d), y = Math.floor((r.bottom - e.clientY) * d);
      dibujar(true); const px = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px[0] === 255 || px[0] >= N ? -1 : px[0];
    }
    function hoverPick(e){
      if (pendHover) return; pendHover = true;
      requestAnimationFrame(() => {
        pendHover = false; const k = pickAt(e), r = stage.getBoundingClientRect();
        if (k !== hov){ hov = k; invalidar(); }
        if (k >= 0 && cfg.tooltip){
          tip.innerHTML = cfg.textoTooltip(MUNIS[k]);
          const x = e.clientX - r.left, y = e.clientY - r.top;
          tip.style.left = x + 'px'; tip.style.top = y + 'px';
          tip.classList.toggle('izq', x > r.width - 260); tip.classList.toggle('arr', y > r.height - 150);
          tip.style.opacity = 1;
        } else tip.style.opacity = 0;
      });
    }
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); arrastrando = true; cv.classList.add('arrastra'); ult = [e.clientX, e.clientY]; movido = 0; invalidar(); });
    cv.addEventListener('pointermove', e => {
      if (arrastrando){
        const dx = e.clientX - ult[0], dy = e.clientY - ult[1]; movido += Math.abs(dx) + Math.abs(dy); ult = [e.clientX, e.clientY];
        goal.az -= dx * 0.006; goal.el = Math.max(0.12, Math.min(1.55, goal.el + dy * 0.006)); Object.assign(cam, { az: goal.az, el: goal.el });
        vistaActual = ''; if (cfg.alGirar) cfg.alGirar(); invalidar(); return;
      }
      hoverPick(e);
    });
    cv.addEventListener('pointerup', e => { arrastrando = false; cv.classList.remove('arrastra'); if (movido < 5){ const k = pickAt(e); elegir(k >= 0 ? (k === sel ? -1 : k) : -1); } invalidar(); });
    cv.addEventListener('pointerleave', () => { if (hov !== -1){ hov = -1; invalidar(); } tip.style.opacity = 0; });
    cv.addEventListener('wheel', e => { e.preventDefault(); goal.dist = Math.max(45, Math.min(520, goal.dist * Math.exp(e.deltaY * 0.0012))); invalidar(); }, { passive:false });
    cv.addEventListener('dblclick', () => { elegir(-1); vista('obl'); });

    // Sin WebGL: el mapa plano en 2D, con los mismos colores.
    function planoCanvas(){
      const c = cv.getContext('2d'); if (!c) return; cv.width = ncx; cv.height = ncy; const im = c.createImageData(ncx, ncy);
      for (let r = 0; r < ncy; r++) for (let q = 0; q < ncx; q++){ const id = cells[r * ncx + q], o = ((ncy - 1 - r) * ncx + q) * 4; if (id === 255){ im.data[o+3] = 0; continue; } im.data[o] = COL[id*3]*255; im.data[o+1] = COL[id*3+1]*255; im.data[o+2] = COL[id*3+2]*255; im.data[o+3] = 255; }
      c.putImageData(im, 0, 0);
    }
    function colorear(){
      COL = new Float32Array(32 * 3);
      MUNIS.forEach(m => COL.set(cfg.color(m), m.k * 3));
      if (gl) invalidar(); else planoCanvas();
    }

    let ok = false; try { ok = iniciarGL(); } catch (err){ console.error(err); gl = null; }
    resize(); colorear();
    if (ok){
      reencuadrar();
      if (!reduce) Object.assign(cam, goal, { el: 1.5, exag: .12, az: 0, dist: goal.dist * 1.1 }); // entra desde el plano y se inclina
      else Object.assign(cam, goal);
      invalidar();
      new ResizeObserver(() => { if (stage.clientWidth){ resize(); reencuadrar(); invalidar(); } }).observe(stage);
    }
    return {
      webgl: ok, munis: MUNIS,
      repintar(){ colorear(); invalidar(); },
      elegir: k => elegir(k, false), vista, invalidar,
      acercar: f => { goal.dist = Math.max(45, Math.min(520, goal.dist * f)); invalidar(); },
      reencuadrar: () => { reencuadrar(); invalidar(); },
      elegido: () => sel,
    };
  }
