# Runbook de continuidad — qué pasa si el practicante deja el sistema

**Por qué existe este documento:** todo el backend (D-19, precisada) corre sobre una cuenta de
**Gmail personal**, no institucional — no hay alternativa mientras el dominio `@sedcaldas.edu.co`
sea Microsoft 365 sin Google Workspace. Eso es una decisión aceptada, no un error, pero significa que
la continuidad del sistema depende de una persona, no de una cuenta de la Secretaría. Este documento
existe para que, si esa persona deja la práctica sin poder hacer un traspaso en vivo, quien llegue
después sepa exactamente qué hay y cómo recuperarlo — en vez de tener que reconstruirlo adivinando.

**Actualizar este documento** cada vez que cambie dónde vive algo (nueva cuenta, nuevo ID de Sheet,
etc.) — un runbook desactualizado es tan malo como no tener ninguno.

---

## 1. Inventario — qué existe y dónde vive

| Pieza | Vive en | Cuenta propietaria |
|---|---|---|
| Google Sheet (base de datos, 6 pestañas) | Google Drive | Gmail personal del practicante |
| Proyecto de Apps Script (`Setup.gs`, `Codigo.gs`, `Auth.gs`, `Sedes.gs`, `Backup.gs`) | Ligado al Sheet anterior | Misma cuenta |
| Despliegue Web App (URL `/exec` que usa el frontend) | Parte del proyecto de Apps Script | Misma cuenta |
| Secreto de firma de tokens (`TOKEN_SECRET`) | Propiedades del script (no visible en ningún archivo) | Misma cuenta |
| Código fuente de todo lo anterior, versionado | `backend/` en este repositorio de GitHub | Cuenta de GitHub del practicante (`Jostrel19`), repo público |
| Frontend (mockup / app real) | `docs/diseno/mockup_v6.html` en este mismo repositorio | Mismo repo |
| Respaldos diarios del Sheet | Carpeta de Drive `Respaldos - Reconstruccion de sedes` | Misma cuenta de Gmail |

**Lo único que NO depende de la cuenta personal:** el código fuente, porque está en GitHub. Si la
cuenta de Gmail desaparece, el código para reconstruir el backend no se pierde — lo que se pierde es
**el Sheet con los datos reales ya cargados** (presupuestos radicados, verificaciones, hallazgos) si
no hay un respaldo accesible desde otra cuenta.

---

## 2. Qué hacer HOY para reducir el riesgo, sin esperar a que se necesite

1. **Compartir el Sheet y el proyecto de Apps Script como Editor con una segunda cuenta de
   confianza** (un compañero, un correo personal del jefe directo, o una cuenta de respaldo del
   propio practicante). Drive → botón Compartir → agregar el correo → rol Editor. Esto no transfiere
   la propiedad, pero garantiza que alguien más pueda actuar si la cuenta original queda
   inaccesible de un día para otro.
2. **Confirmar que `configurarRespaldoAutomatico` está corrida** (`backend/Backup.gs`) — si no,
   correrla una vez desde el editor. Sin esto, el punto 1 solo protege el Sheet en vivo, no da una
   copia histórica ante una corrupción o borrado accidental.
3. **Verificar cada tanto** que la carpeta `Respaldos - Reconstruccion de sedes` en Drive sí está
   recibiendo copias nuevas (una vez al mes basta).

---

## 3. Procedimiento de traspaso — cuando la persona que se va SÍ puede coordinar

Es el camino simple: la cuenta saliente sigue activa un rato más.

1. Compartir Sheet y proyecto de Apps Script como Editor con la cuenta de quien recibe (si no se
   hizo ya en el paso anterior).
2. La persona que recibe usa `Archivo > Hacer una copia` sobre el Sheet, **desde su propia cuenta**,
   para quedar como dueña de una copia completa (incluye el proyecto de Apps Script ligado, si se
   copia desde la hoja).
3. Repetir el despliegue (`Implementar > Nueva implementación`) desde la copia — esto **sí genera
   una URL `/exec` nueva**, porque es un proyecto distinto, aunque el código sea idéntico.
4. Actualizar `BACKEND_URL` en `docs/diseno/mockup_v6.html` (y en cualquier frontend real que exista
   para entonces) con la URL nueva, y volver a publicar el frontend.
5. Confirmar que el secreto de firma de tokens se regeneró solo (`_secreto()` lo hace automáticamente
   la primera vez que se ejecuta en el proyecto nuevo) — es normal y esperado que sea distinto al de
   antes; solo invalida las sesiones activas en ese momento, nadie pierde datos por esto.
6. Avisar a los usuarios activos que sus sesiones se cerraron y deben volver a entrar.

## 4. Procedimiento de recuperación — cuando la cuenta saliente YA NO está disponible

Camino de emergencia, usando lo que se dejó preparado en la sección 2.

1. Con la cuenta que ya tenía acceso de Editor (punto 2.1), entrar al Sheet compartido.
2. Si el Sheet en sí sigue accesible: seguir el procedimiento de la sección 3 desde el paso 2.
3. Si el Sheet **no** es accesible (la cuenta original se eliminó y se llevó sus archivos, o revocó
   el acceso antes de irse): recuperar el respaldo más reciente de la carpeta de Drive del punto 2.2
   — **solo funciona si esa carpeta también se compartió** con la cuenta de respaldo, así que
   confirmar eso es tan importante como el respaldo mismo.
4. Reconstruir desde el respaldo: abrir la copia, `Extensiones > Apps Script`, y pegar el código
   fuente vigente desde `backend/` en GitHub (que nunca depende de la cuenta personal). Seguir con
   los pasos 3-6 de la sección anterior.
5. **Lo que se pierde en este escenario:** los datos escritos entre el último respaldo (máximo 24
   horas atrás, con el respaldo diario) y el momento en que la cuenta quedó inaccesible. Es la razón
   por la que el respaldo es diario y no semanal.

---

## 5. Qué NO resuelve este documento

- No evita que la Secretaría dependa de una cuenta personal — esa es una limitación estructural
  mientras el dominio institucional no tenga Google Workspace (ver D-19 en `CLAUDE.md`).
- No sustituye tener, apenas sea posible, una cuenta de Google **institucional** real (aunque sea de
  otro funcionario designado) como dueña definitiva, en vez de depender indefinidamente de cuentas
  personales encadenadas de practicante en practicante.
