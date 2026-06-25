# Loreweaver — Documento de traspaso

> Léeme entero antes de tocar nada. Este documento contiene TODO lo necesario para
> continuar el proyecto exactamente donde se dejó, sin perder ninguna feature ni
> tarea pendiente. Última actualización: 2026-06-25.

---

## 1. Qué es

**Loreweaver**: clon propio, **100% local, offline y gratis** de Cosmia Studio
(getcosmia.com) — un estudio de escritura para novelistas y worldbuilding.
**Sin IA, sin servidores, sin cuentas.** Todos los datos viven en IndexedDB del
navegador. Corre como app web (y como PWA instalable).

> **Nombre:** la app se llama **Loreweaver** (antes "Cosmia Local"; se renombró para
> no copiar la original). Pero por compatibilidad de datos se mantienen sin cambiar:
> el **nombre interno de la BD IndexedDB** = `'cosmia-local'` (en `db.ts`,
> `super('cosmia-local')` — cambiarlo borraría todos los datos), la **clave de
> localStorage** del store UI = `'cosmia-ui'`, y la **carpeta** del proyecto sigue
> siendo `cosmia-local`. El export/import marca los backups como `app: 'loreweaver'`
> pero el import acepta también los antiguos `'cosmia-local'`.

- **Ubicación:** `C:\Users\ryuga\Desktop\cosicas de claudia\cosmia-local`
  (la carpeta conserva el nombre viejo; es hermana de `BeatTheMonster`, OTRO proyecto
  sin relación — no tocar).
- **Idioma del usuario:** español. Responde en español. El usuario lee e interpreta
  código pero **no es programador profesional** — explica en claro y da pasos exactos.

## 2. Cómo arrancar

```powershell
cd "C:\Users\ryuga\Desktop\cosicas de claudia\cosmia-local"
npm install      # solo la primera vez
npm run dev      # -> http://localhost:5173
```

- `npm run build` = `tsc -b && vite build` (verifica tipos + compila). **Úsalo
  siempre para detectar errores: el TS es ESTRICTO y rompe el build.**
- `npm run portable` = build + `empaquetar.ps1`: genera **`Loreweaver-portable/`**
  (carpeta con lanzador + `dist/`) y **`Loreweaver-portable.zip`** (~514 KB) para
  pasarle a un betatester. Abre con doble clic en `Iniciar Loreweaver.bat`: un
  servidor estático en PowerShell (cero instalación, puerto FIJO 8787 → IndexedDB
  persiste) sirve la app en `http://localhost:8787` y abre el navegador. Verificado
  que sirve index/assets/manifest/sw con MIME correcto. Ver `portable/` y §6.
- PWA: al abrir en Chrome/Edge sale el icono "Instalar".

## 3. Stack

React 19 · Vite 8 · TypeScript (estricto) · Tailwind v4 (`@tailwindcss/vite`,
theming por CSS vars, modo noche con clase `.dark`) · Zustand (store UI persistido) ·
Dexie/IndexedDB · react-router (**HashRouter**) · Tiptap (editor + extensión
`mention`) · **@xyflow/react** (React Flow: grafo de relaciones + timeline visual) ·
**@dagrejs/dagre** (auto-layout) · **relatives-tree** (cálculo de posiciones del
árbol genealógico, MIT, ~3.2 kB, 0 deps) · **diff** (jsdiff, diffWords para el historial de versiones) ·
lucide-react (iconos) · vite-plugin-pwa
(+ @vite-pwa/assets-generator) · date-fns · clsx + tailwind-merge.

> **Code-splitting**: las 6 páginas internas (WritePage, WikiPage, GraphPage,
> TimelinePage, BoardPage, StatsPage) se cargan con `lazy()` en `App.tsx` (Suspense
> alrededor del `Outlet` en `ProjectLayout`). El bundle inicial bajó de ~1,2 MB a
> chunks (~252 kB index + React/CSS); Tiptap (~449 kB) y React Flow solo cargan en su
> página. Ya no salta el aviso de >500 kB.

Alias **`@/` → `src/`**.

## 4. Mapa de archivos

```
src/
  lib/
    db.ts          Dexie: TODAS las tablas + tipos. Versión actual: 7.
    repo.ts        CRUD y helpers (proyectos, capítulos, wiki, eventos, links,
                   lanes/tramas, imágenes, export/import COMPLETO con imágenes en
                   base64, migrateLegacyLanes, findBacklinks).
    utils.ts       cn, uid, now, countWords, formatDate, timeAgo, PALETTE.
    familyTree.ts  construye la estructura de relatives-tree desde los links
                   (family/spouse/sibling), padres placeholder para hermanos
                   sueltos, 2-coloreo de cónyuges (parejas mismo sexo), BFS de
                   generaciones. computeFamilyLayout / familyMemberIds.
    theme.ts       applyTheme, applyAccent, resolvesDark, useResolvedDark.
    audio.ts       sonidos ambiente generativos (Web Audio): rain/ocean/wind/space.
                   Ruido NORMALIZADO (sin clipping) + buffer 5 s + fundidos (sin
                   clicks) + síntesis por ambiente (oleaje que rompe, ráfagas de
                   viento, drone afinado). El sonido final hay que juzgarlo OYÉNDOLO.
    keyboard.ts    sonido de teclado mecánico (4 perfiles: blue/brown/red/thock).
    storage.ts     requestPersistentStorage, storageInfo.
    fileBackup.ts  guardar/abrir la copia como archivo REAL (File System Access API,
                   con fallback a descarga/input). saveBackup, openBackup.
    diskSync.ts    GUARDADO EN DISCO REAL automático: vincula un .json, lo mantiene
                   al día en cada cambio (hooks de Dexie + debounce 4s), persiste el
                   handle en `kv`, reconecta permiso tras recargar. Store reactivo
                   (subscribeDisk/getDiskStatus). Solo Chrome/Edge (FSA).
    export.ts      exportar manuscrito (PDF por impresión, Word .doc, HTML).
    constants.ts   CHAPTER_STATUS, REL_TYPES, statusMeta, relMeta.
  store/ui.ts      Zustand: theme, accentId, editorFont, pomodoro, keyboardSound,
                   keyboardProfile, keyboardVolume, musicVolume, dailyGoal, etc.
  components/
    ui/            Button, Modal, Field (Input/Textarea/Label/Select), ColorPicker,
                   EmptyState, ConfirmDialog.
    editor/        ChapterEditor, MentionTextEditor, mentionSuggestion,
                   ChapterHistory (panel de historial de versiones con diff).
    wiki/          WikiDetail, WikiAvatar, EntitySummary, FamilyTree.
    wiki/FamilyTree.tsx  overlay del árbol genealógico (divs absolutos +
                   conectores de relatives-tree, NO React Flow): zoom/pan,
                   selector "Centrar en" (spotlight re-root), límite de
                   generaciones, clic=centrar, doble clic/botón=abrir ficha.
    timeline/      TimelineVisual, LanesModal, TimelineChrono (vista cronología
                   lineal alterna, componente PROPIO con divs — sin react-chrono).
    wikiMeta.tsx   WIKI_TYPES (tipo, label, plural, color, icon) + wikiMeta().
    BlobImage.tsx  muestra un Blob (imágenes guardadas en IndexedDB).
    MentionViewer.tsx  escucha clics en cualquier @mención -> abre EntitySummary.
    SettingsModal.tsx  ajustes (tema, acento, fuente, pomodoro, export/import/wipe,
                   guardado en disco real).
    FocusDock.tsx  dock flotante: Pomodoro · Ambiente · Música · YouTube + teclado.
  pages/
    ProjectsPage   panel de proyectos (crear/borrar, portadas, stats).
    ProjectLayout  sidebar + Outlet (Escribir·Wiki·Relaciones·Tiempo·Tablero·
                   Progreso·Guía). Suspense alrededor del Outlet (code-splitting).
    WritePage      lista de capítulos + ChapterEditor.
    WikiPage       fichas tipadas, búsqueda, filtros, drawer de detalle.
    GraphPage      grafo de relaciones (React Flow). MUCHA lógica aquí (ver §6).
    TimelinePage   timeline: vista Lista (EventCard) + vista Visual (TimelineVisual).
    BoardPage      tablero de notas adhesivas arrastrables.
    StatsPage      progreso: stats, objetivo, racha, gráfico de hábito.
    GuidePage      "Guía": SECCIÓN del sidebar (ruta `guide`) que explica todas las
                   partes de la app. Es una página normal (no modal).
  App.tsx          router + ThemeManager + widgets globales (SettingsModal, FocusDock,
                   MentionViewer) + listener de teclado + persist() al arrancar.
public/            logo.svg, favicon.svg, pwa-*.png (iconos PWA generados).
portable/          lanzador de la versión portable: "Iniciar Loreweaver.bat",
                   servidor.ps1 (servidor estático en PowerShell, puerto 8787,
                   -NoBrowser para test), LEEME.txt.
empaquetar.ps1     arma Loreweaver-portable/ (lanzador + dist) y el .zip.
```

## 5. Modelo de datos (Dexie, versión 7)

Nombre de la BD: `cosmia-local`. Tablas (clave primaria `id` salvo `daily`):

- **projects**: `{ id, title, description, genre, coverColor, wordGoal?, createdAt, updatedAt }`
- **chapters**: `{ id, projectId, title, content(HTML), synopsis, order, wordCount, status('idea'|'draft'|'revision'|'done'), createdAt, updatedAt }`
- **wiki**: `{ id, projectId, type('character'|'location'|'faction'|'item'|'power'|'creature'|'other'), name, summary, notes, color, fields(WikiField[]), tags[], coverImageId?, gender?('male'|'female'), createdAt, updatedAt }`
  — `gender` es opcional, NO indexado (no necesitó subir versión de Dexie); solo
  lo usa el árbol genealógico para colorear. Editable en `WikiDetail` (personajes/criaturas).
- **events**: `{ id, projectId, title, description(HTML), dateLabel, era, lane?(=id de lane), sortIndex, color, createdAt, updatedAt }`
- **nodes**: `{ id, projectId, text, x, y, w, h, color, ... }` — notas del tablero.
- **tracks**: `{ id, name, blob, addedAt }` — música local.
- **yt**: `{ id, title, url, kind('video'|'playlist'), addedAt }`.
- **daily**: `{ date('YYYY-MM-DD'), words }` — clave primaria `date`.
- **images**: `{ id, entryId, projectId, blob, addedAt }` — imágenes de referencia de wiki.
- **links**: `{ id, projectId, fromId, toId, fromKind('wiki'|'event'), toKind, label, relType, strength?(-100..100), createdAt, updatedAt }`
  — **tabla genérica de aristas**. `strength` opcional, NO indexado (intensidad para
  la "diplomacy web"; 0/undef = neutro). `relType`:
  - relaciones de grafo wiki↔wiki: `family | spouse | sibling | ally | enemy | romance | mentor | other`
    (`family` es DIRIGIDO = de padre/madre → hijo/a; `spouse` y `sibling` son
    simétricos; los 3 alimentan el árbol genealógico — ver `FAMILY_RELS`)
  - evento→ficha: `involves`
  - evento→evento (causalidad "ocurre porque"): `cause`
- **layout**: `{ id(=id de la entidad O del evento), projectId, x, y }` — posiciones
  guardadas. **Compartida** por el grafo (ids de wiki) y la timeline visual (ids de
  evento); no colisionan porque los ids son únicos.
- **lanes**: `{ id, projectId, name, order }` — **tramas / líneas argumentales**
  (carriles de la timeline visual). `event.lane` guarda el **id** de la lane.
- **versions** (v7): `{ id, chapterId, projectId, content(HTML), title, wordCount, savedAt, label?, auto }`
  — **historial de versiones** de capítulos (tipo Google Docs). `auto`=instantánea
  automática (throttle 3 min) o manual con `label`. Se exporta en el backup; se borra
  con el capítulo y en "Borrar todo".
- **kv** (v7): `{ key, value }` — almacén clave-valor. Hoy guarda `backupHandle` (el
  FileSystemFileHandle del guardado en disco). **NO se exporta** (es propio de cada PC);
  sí se borra en "Borrar todo".

> Al cambiar el esquema: subir versión y **redeclarar todas las stores** en
> `db.ts` (`this.version(N).stores({...})`). Dexie migra solo.

## 6. Features implementadas (TODO verificado salvo donde se indica)

### Núcleo
- Panel de proyectos (crear/borrar con cascada, portadas de color, estadísticas).
- Layout de proyecto + navegación lateral.
- **Editor de capítulos** (Tiptap): barra de formato, autoguardado, contador de
  palabras en vivo, estado, **@menciones**.
- **Wiki**: fichas tipadas, atributos personalizados, etiquetas, notas,
  **imágenes de referencia** (suben a IndexedDB, portada), búsqueda, filtros, drawer.
- **Tablero**: notas adhesivas arrastrables, rejilla, color.
- **Pomodoro** (anillo de progreso) + **sonidos ambiente generativos** +
  **teclado mecánico** (4 switches) + **música local** + **YouTube**.
- Temas claro/oscuro/sistema + **color de acento** + tipografía del editor.
- **Ajustes**: export/import JSON (**copia COMPLETA**: projects, chapters, wiki, events,
  nodes, links, lanes, layout, daily, yt + imágenes en base64; la música `tracks` NO se
  incluye por tamaño), borrar todo (limpia TODAS las tablas, sin huérfanos).
- **PWA instalable**.
- **Exportar manuscrito**: PDF (por diálogo de impresión), Word (.doc), HTML. El
  generador (`export.ts`) **quita la "@" de las menciones** (`@Aldric` → `Aldric`,
  vía `cleanContent`) y formatea como libro: portada + **Índice** + **"Capítulo N"** +
  título por capítulo, en orden.
- **Historial de versiones de capítulos (tipo Google Docs)**: el editor guarda
  instantáneas automáticas mientras escribes (throttle 3 min, `maybeAutoVersion`) +
  una línea base al abrir + versiones manuales con nombre. Botón **"Historial"** en el
  editor → panel `ChapterHistory` con lista (auto/manual), **diff** verde(añadido)/
  rojo(quitado) de la versión vs el texto actual (`diff`/`diffWords`), **Restaurar**
  (revierte y guarda el estado previo) y borrar. Tabla `versions`.
- **Guardado en disco REAL automático** (`diskSync.ts`, Ajustes → "Guardado en disco
  real"): en Chrome/Edge vinculas un `.json` y la app lo reescribe en cada cambio
  (debounced). En Firefox/Safari → solo copias manuales. ⚠️ El diálogo nativo y el
  auto-guardado a archivo necesitan prueba MANUAL (no scriptables).
- **Progreso/Stats**: palabras totales, objetivo del proyecto, **racha diaria**,
  gráfico de hábito de 14 días, desglose por estado y por capítulo.
- **Persistencia**: `navigator.storage.persist()` al arrancar.
- **@menciones**: escribe `@` → busca en la wiki → inserta mención enlazada (id+label).
  **Clic en una mención** → modal de info (EntitySummary, vía `MentionViewer` global).
  Funciona en el editor de capítulos Y en las descripciones de eventos.
- **Backlinks de menciones**: la ficha (`WikiDetail`) muestra "Aparece en" con los
  capítulos y eventos que la @mencionan (clic → navega al capítulo). `findBacklinks`
  en `repo.ts` escanea `.mention[data-id]` del HTML con `DOMParser`. Reactivo (liveQuery).
- **ColorPicker con hex** en todos los selectores de color.
- **Resumen de ficha** al clicar entidades conectadas en la timeline.

### Grafo de relaciones (`GraphPage.tsx`) — 6/6 mejoras
1. **Resaltar vecindario**: clic en nodo = atenúa los no-vecinos; doble clic = abre
   ficha; clic en lienzo = limpia. (`focusId` + `neighborIds`).
2. **Filtros**: por categoría de entidad y por tipo de relación. Botón "Filtros".
   ⚠️ Las aristas se ocultan **FILTRÁNDOLAS del array** (no con `hidden`, que en
   React Flow no oculta aristas de forma fiable). Los nodos sí usan `hidden`.
3. **Búsqueda** de nodos: input que atenúa los que no coinciden.
4. **Auto-layout** "Ordenar" (@dagrejs/dagre, dirección TB) + guarda posiciones.
5. **Estilos por categoría**: franja de color + chip de tipo por categoría + leyenda.
6. **Árbol genealógico COMPLETO** (botón "Árbol" → overlay `FamilyTree`, refinamiento
   #2 TERMINADO). Usa **relatives-tree** para las posiciones; render con divs absolutos
   + conectores (NO React Flow, así que SÍ se puede testear por script). Funciona:
   - Padres→hijos (`family`), cónyuges (`spouse`, en pareja horizontal), hermanos
     (derivados de padres compartidos + links `sibling` explícitos).
   - **Hermanos sueltos** (sin padres): se les inventa un padre "placeholder"
     (`__ph__`, tarjeta «Ascendencia desconocida») para que siempre se dibujen.
   - **Parejas del mismo sexo (con o sin hijos)**: relatives-tree REVIENTA al
     ordenarlas; se resuelve 2-coloreando el grafo de parejas SOLO para el layout
     (género real se pinta en la tarjeta). Sin esto, una pareja del mismo sexo rompía
     todo el árbol. Los hijos NO tienen por qué ser biológicos (adopción, magia…).
   - **Co-padres NO cónyuges**: dos personajes pueden tener un hijo sin estar casados.
     relatives-tree empareja a los hijos con el *cónyuge* del padre, no con el otro
     padre; así que `coupleAdj` = cónyuges ∪ co-padres (mismo hijo) y se pasa como
     "spouses" del layout → los co-padres se dibujan juntos sobre el hijo (si no,
     soltaba a uno). Ese mismo grafo se 2-colorea (cubre el caso mismo-sexo).
   - **Spotlight = RESALTAR, no podar**: clic en una tarjeta (o selector "Centrar
     en") resalta a la persona (anillo) pero NO re-rootea ni esconde parientes.
     relatives-tree poda todo lo que no cuelga de su raíz, así que `calcTree` se
     rootea en el **ÁPICE** del conjunto visible (se prueban los "fundadores" y se
     elige el que dibuje MÁS nodos, incluido el enfocado) → NO se pierde ningún
     colateral (tíos, tías, primos, sobrinos…). Ver `computeFamilyLayout` +
     `FamilyLayout.spotlightId` vs `rootId`.
   - **Límite de generaciones** (Todas/5/4/3/2) con 0-1 BFS desde el enfocado.
   - Zoom (botones + Ctrl/⌘+rueda), **pan arrastrando desde CUALQUIER punto**
     (incluidas las tarjetas; umbral `moved>4px` distingue arrastre de clic — los
     listeners de pan están en `window`, NO se usa pointer-capture porque rompía el
     clic de las tarjetas), barra de género azul/rosa + ♂/♀, doble clic o botón 📖
     abre la ficha, Esc cierra (ficha primero).
   - Estados: sin relaciones familiares → mensaje guía; datos contradictorios
     (calcTree lanza) → mensaje de error (try/catch, no peta la app).
- Crear vínculos arrastrando entre nodos. **Dirección corregida** con `onConnectStart`
  (fuerza `from` = nodo donde empieza el arrastre).
- Minimapa, zoom, posiciones guardadas, editar/borrar vínculos.
- **Vista de vínculos** (control segmentado en la cabecera): **Todas / Sociales /
  Familia**. "Sociales" oculta los vínculos de parentesco (family/spouse/sibling) y
  deja solo los sociales (ally/enemy/romance/mentor/other); "Familia" al revés.
  Maneja `hiddenRels` (mismo mecanismo que el panel Filtros). `FAMILY_REL_IDS` /
  `SOCIAL_REL_IDS` en `GraphPage.tsx`.

### Timeline — toggle Lista / Visual / Cronología
- **Cronología** (`TimelineChrono.tsx`): timeline lineal alterno **con componentes
  propios (divs)**, sin librerías externas. Línea central + puntos por color de evento
  + tarjetas a izquierda/derecha; "fecha" = `dateLabel`, descripción en texto plano.
  Solo lectura. ⚠️ NO usar react-chrono: su CSS es global (`body{…}`, `html{…}`,
  `*{animation:none!important}` bajo reduced-motion) y CONTAMINABA el CSS de toda la
  app al entrar en la timeline (fondo/color/fuente del body). Por eso se hizo propio.

### Timeline visual (`TimelineVisual.tsx`)
- React Flow: eventos colocados por orden cronológico (X) y por **carril/trama** (Y).
- **Flechas causa→efecto** ("porque", animadas) entre eventos (links `cause`).
- Avatares de las entidades conectadas en cada nodo de evento.
- **Interactivo**: clic = modal de edición; arrastrar = mover (persiste en `layout`);
  unir dos eventos = crea causa→efecto. Botón "Ordenar por tramas".

### Tramas / carriles (entidades de primera clase) — rehecho completo
- Tabla `lanes`. Botón **"Tramas"** → `LanesModal` (crear, renombrar inline, borrar).
- **Selector desplegable** para asignar trama: en EventCard (lista), modal de crear
  evento, y modal de edición visual.
- **Migración** de tramas antiguas (texto libre) a entidades + **deduplicado**
  (`migrateLegacyLanes`, idempotente, con guardia anti-carrera por StrictMode).
- Visual: cada trama es un carril (fila), incluida "Sin trama" y las vacías.
  Arrastrar un evento a otra fila **reasigna su trama** (snap a la fila).

## 7. PENDIENTE (lo que falta por hacer / pulir)

### Refinamientos pedidos por el usuario — LOS 3 HECHOS ✅
- **#2 — Árbol genealógico COMPLETO** con `relatives-tree`: ✅ **HECHO Y VERIFICADO**
  (build + interacción real por script + lectura de IndexedDB). Ver §6, mejora 6 del
  grafo, y `src/lib/familyTree.ts` + `src/components/wiki/FamilyTree.tsx`. Incluye:
  no perder colaterales (tíos/primos), parejas del mismo sexo con hijos, co-padres no
  cónyuges, pan arrastrando, y la vista Todas/Sociales/Familia del grafo.
- **#3 — "Diplomacy web" de facciones**: ✅ **HECHO Y VERIFICADO**. Campo `strength`
  (−100..+100) en `Link`, slider "Intensidad de la relación" en el `LinkModal`, y
  aristas con **grosor** `2 + |strength|/100*5` px + **etiqueta** del valor con signo.
  Los nodos de facción ya muestran su escudo/bandera vía la imagen de portada
  (`WikiAvatar`). Posible pulido futuro: tinte por signo, forma de escudo, solo
  facción↔facción.

### Otros (de la investigación)
- ✅ **Backlinks de menciones**: HECHO (ver §6 núcleo, `findBacklinks` + "Aparece en"
  en `WikiDetail`).
- ✅ **Guardar a disco real**: HECHO con la File System Access API nativa (sin dep),
  fallback a descarga/input. Ver `lib/fileBackup.ts` + botones "Guardar/Abrir copia".
  ⚠️ El diálogo nativo necesita prueba MANUAL con ratón (no se puede automatizar el
  selector del SO); solo se verificó por script la rama de fallback.
- ✅ **react-chrono**: HECHO (vista "Cronología", ver §6 timeline).
- **Rendimiento del grafo** con cientos de nodos (edge bundling, clustering) — no abordado.

### Pulido / problemas conocidos
- ✅ **Bundle > 500 kB**: RESUELTO con code-splitting (`lazy()` por página + Suspense).
  Ver la nota en §3.
- **Fuentes offline**: Inter/Literata se cargan de Google Fonts; offline caen a
  fuentes del sistema. Para offline real, empaquetar las fuentes.
- **Datos demo sucios**: el proyecto de prueba **"La Sombra de Aurora"**
  (id `5ec4d03a-1ff8-44cc-940f-2ad90cfa887d`) tiene datos revueltos de tanta prueba
  (eventos, links, lanes, una imagen "A" inyectada en "Personaje sin nombre", notas de
  tablero). Se puede limpiar con las papeleras o desde Ajustes → Borrar todo.

## 8. Convenciones y TRAMPAS críticas (lee esto sí o sí)

- **TS estricto**: `verbatimModuleSyntax` (usa `import type`), `noUnusedLocals` /
  `noUnusedParameters` (quita imports/variables sin usar o el build ROMPE),
  `erasableSyntaxOnly`. **Corre `npm run build` tras cada cambio.**
- **lucide-react v1**: NO tiene iconos de marca (Youtube, Github…). Usa genéricos
  (Video, etc.). Si falta un icono, el build avisa.
- **Tailwind v4**: tokens en `@theme inline` + CSS vars en `:root`/`.dark`. Modo noche
  con clase `.dark` y `@custom-variant dark`.
- **React Flow — `edge.hidden` NO oculta de forma fiable**. Para ocultar aristas,
  **fíltralas fuera del array** que pasas a `setEdges`. Los nodos sí respetan `hidden`.
- **React Flow — dirección de conexión**: captura el nodo de inicio en `onConnectStart`
  y fuerza `from = inicio` en `onConnect` (si no, en modo Loose se invierte).
- **React Flow — NO se pueden disparar por script** los gestos de nodo (clic, arrastre,
  conectar): usa *pointer capture* propio y los eventos sintéticos no lo activan.
  Verifica esas interacciones con **ratón real**. Lo que SÍ se puede testear por script:
  inputs/botones normales (fuera del lienzo), y el estado de IndexedDB.
- **Dexie**: subir versión + redeclarar stores al cambiar esquema.
- **StrictMode** duplica los efectos en dev → protege efectos con side-effects de una
  sola vez (p. ej. `migrateLegacyLanes` usa un `Set` módulo + deduplica).
- **Preview MCP**: `.claude/launch.json` (en BeatTheMonster) define el server "cosmia"
  (`npm --prefix <ruta absoluta cosmia-local> run dev`, puerto 5173). Si cambias
  `vite.config.ts`, reinicia el preview. **Recargar la página DENTRO de un
  `preview_eval` desconecta el eval** → recarga y luego haz el eval en una llamada aparte.
- **Tests por IndexedDB**: BD `cosmia-local`; `crypto.randomUUID()` para ids. El raw IDB
  no dispara las `liveQuery` de Dexie (recarga la página para que se reflejen).

## 9. Investigación hecha (resumen accionable)

Se hicieron **3 deep searches** (con verificación adversarial). Conclusiones clave:

- **Grafo**: resaltado de vecindario con utilidades NATIVAS de React Flow
  (`getConnectedEdges` + `getIncomers`/`getOutgoers` + `useReactFlow`). Auto-layout:
  **@dagrejs/dagre** (drop-in, TB/LR) o **d3-dag** para DAGs; **NO** elkjs (complejo)
  ni d3-hierarchy (mismo tamaño a todos los nodos). Genealogía: **relatives-tree**
  (MIT, 3.23 kB). Modelos a emular: World Anvil family trees (auto-genera desde
  parentesco, spotlight, 5 generaciones) y **diplomacy webs** (nodos con escudo +
  score de relación). [reactflow.dev/learn/layouting] [github.com/SanichKotikov/relatives-tree]
- **Timeline**: ninguna librería sirve con **tiempo ficticio** (vis-timeline, SVAR
  React Gantt, react-calendar-timeline son todas de calendario gregoriano/Unix). La
  solución (ya implementada) es **timeline custom sobre React Flow**: X derivada de
  `sortIndex` (eje ordinal), Y = carriles, flechas causa→efecto, layout DAG con dagre.
  `react-chrono` (MIT, React 19) solo vale para lista lineal con texto libre.
- **General (search 1)**: @menciones (Tiptap), export client-side (jsPDF +
  @tiptap/static-renderer), stats multi-unidad (estilo TrackBear), durabilidad de
  IndexedDB (`persist()`), File System Access (`browser-fs-access`). Todo implementado
  salvo File System Access.

## 10. Cómo trabaja el usuario (importante)

- Quiere **trabajo COMPLETO y verificado de verdad**, no a medias. Se frustra cuando:
  algo queda a medias, cuando afirmo que algo funciona sin probarlo con interacción real,
  o cuando hago cosas grandes por mi cuenta sin preguntar.
- **Verifica de verdad** (build + prueba real + lectura de IndexedDB). Si una
  interacción de React Flow no se puede automatizar, **dilo** y pide que la pruebe con
  ratón — no afirmes que funciona sin matizar.
- **Termina una feature entera** antes de empezar otra.
- Responde en **español**. Estuvo activo el "modo caveman" (respuestas ultracompactas);
  pregúntale si lo quiere mantener.
- El proyecto debe seguir siendo **local, gratis y offline** (sin IA, sin servidores).

## 11. Estado de la última sesión

**Los 3 refinamientos pedidos están HECHOS Y VERIFICADOS** (build limpio + interacción
real por script en la preview + lectura de IndexedDB). En esta sesión:

- **#2 árbol genealógico completo** (`relatives-tree`): render real de 4 generaciones,
  cónyuges, hermanos (derivados + explícitos), placeholder de hermanos sueltos,
  resaltado del enfocado SIN perder colaterales (tíos/primos), límite de generaciones,
  abrir ficha, y `gender` de la ficha repintando el árbol en vivo (liveQuery).
- Bugs reales encontrados al probar y arreglados: parejas del **mismo sexo** rompían
  `calcTree` (2-coloreo de parejas); **hermanos sin padres** desaparecían (placeholder);
  spotlight **perdía colaterales** (root en el ápice, no en el enfocado); **co-padres
  no cónyuges** soltaban a un padre (coupleAdj como spouses del layout); **pan
  arrastrando** no iba sobre tarjetas (listeners en window + umbral).
- **Vista Todas/Sociales/Familia** en el grafo de relaciones.
- **#3 diplomacy web**: `strength` (−100..+100) en `Link`, slider en el `LinkModal`,
  aristas con grosor + etiqueta por intensidad.

> **Nota de sesión:** se creó `.claude/launch.json` (server "cosmia", `npm run dev`,
> puerto 5173) para la preview MCP. Los datos de prueba (proyectos "Casa de Aldric",
> "Sin familia", "Co-padres test") viven SOLO en el navegador aislado de la preview,
> NO en los datos reales del usuario (IndexedDB de su navegador habitual, intacto).

- **Copia de seguridad COMPLETA** (antes era un gap grave): `exportAll`/`importAll`/
  `wipeAll` en `repo.ts` ahora cubren TODAS las tablas (imágenes en base64 vía
  `blobToDataURL`/`dataURLToBlob`; música excluida por tamaño). Verificado el ciclo
  export→wipe→import sin pérdidas (links/lanes/layout/imagen-Blob restaurados).

- **Backlinks de menciones**: "Aparece en" en la ficha (`findBacklinks`).
- **Code-splitting**: `lazy()` por página → bundle inicial ~5× más pequeño.
- **Guardar a disco real**: File System Access (`lib/fileBackup.ts`), botones
  "Guardar/Abrir copia". ⚠️ El diálogo nativo está sin probar a mano (no scriptable).
- **Vista Cronología** lineal en la línea de tiempo (componente propio; se quitó
  react-chrono porque su CSS global rompía el body de toda la app).

Además, **versión para betatester + más features** (decididas con el usuario):
- **Distribución portable** (sin instalar nada): `npm run portable` → `Loreweaver-portable/`
  + `.zip`. Lanzador `.bat` → servidor PowerShell en `localhost:8787`. Verificado que
  sirve la app (index/assets/manifest/sw, MIME ok, bind sin admin).
- **Export sin "@"** en menciones + formato libro (Índice + "Capítulo N").
- **Historial de versiones** de capítulos (auto + manual, diff, restaurar). Tabla
  `versions`, BD v7.
- **Guardado en disco REAL automático** (`diskSync.ts`) para Chrome/Edge, con fallback.

Y en el último lote:
- **CSS global arreglado**: se quitó react-chrono (su CSS rompía el body de toda la
  app al entrar en la timeline); la Cronología es ahora un componente propio.
- **Sonidos de ambiente mejorados** (`audio.ts`): sin clipping, con fundidos y mejor
  síntesis. Falta CONFIRMAR a oído.
- **Guía in-app** = SECCIÓN del sidebar (`GuidePage`, ruta `guide`), como un nav más
  (Escribir/Wiki/…/Guía). Explica todas las partes de la app. (Antes era un modal con
  iconito poco visible; el usuario pidió que fuera una sección del menú.)
- **Audio**: el motor cambia entre ambientes sin errores; calidad = juicio del usuario.
- **Distribución en UN solo zip** confirmada: `Loreweaver-portable.zip` (~441 KB) lleva
  lanzador + LEEME + `dist/` (app con guía). El betatester NO instala nada (PowerShell
  ya viene en Windows).

**Auditoría de UI/UX (4 revisores en paralelo) + arreglos.** Lo CORREGIDO:
- 🛑 **Pérdida de datos**: (1) "Borrar todo" con disco vinculado ya NO sobreescribe el
  archivo (se desvincula antes; `unlinkBackupFile` cancela el timer/dirty). (2) Borrar
  ficha pide confirmación SIEMPRE (confirm dentro de `WikiDetail` → cubre grafo y
  @menciones). (3) El editor vacía lo pendiente al cerrar/ocultar pestaña
  (`pagehide`/`visibilitychange`) y antes de exportar (`editorFlush` + releer de BD).
  (4) Debounce de eventos (Lista y Visual) acumula campos (antes perdía uno si editabas
  dos en <350 ms). (5) Cancelar el modal de un vínculo recién creado al arrastrar lo
  borra (no deja basura).
- **Disco real honesto**: estados `paused`/`denied`/`error` separados; si funciona, NO
  habla de "reconectar"; si el navegador deniega, lo dice y no insiste.
- **Servidor portable**: libera el puerto al cerrar (handler de consola + try/finally).
- Otros: importar pide CONFIRMACIÓN (avisa que fusiona); mensajes de Ajustes con color
  de error + auto-descarte; ProjectsPage sin parpadeo de carga + sin doble-proyecto +
  formulario que se resetea; autofocus del editor; hint de dirección en vínculo
  "Familia"; `prefers-reduced-motion`.

**Backlog de pulido (de la auditoría) — COMPLETADO ✅ (build + interacción real por
script en la preview).** Hecho y verificado en esta sesión:
- **Color de acento elegible con color picker** (no solo presets): `ColorPicker` en
  Ajustes acepta hex libre; `accentColor(id)` admite `#rrggbb`. Verificado.
- **Accesibilidad**: focus-trap + `aria-label`/`role=dialog` en `Modal` (con `onCloseRef`
  para no robar el foco al teclear — bug que introduje y corregí); `aria-label` en TODOS
  los botones-icono (FocusDock play/pausa/reset/lanzador + `role=switch` del teclado +
  sliders; MusicPlayer prev/play/next; YouTube borrar; ColorPicker swatches `aria-pressed`
  + color personalizado; Timeline mover/insertar/borrar/trama; Board color/borrar;
  FamilyTree zoom/ajustar/cerrar; LanesModal borrar; ChapterHistory cerrar; WikiDetail;
  buscador del grafo).
- **Estados de carga** (spinner) en Wiki/Stats/ProjectsPage (evitan el parpadeo de ceros
  con `useLiveQuery === undefined`).
- **Pomodoro**: recuento de sesiones (🍅) + **notificación del sistema** al terminar cada
  fase (pide permiso al primer play); antes giraba en silencio para siempre.
- **MiniMap** ya no lo tapa el dock: subido 84px en grafo y timeline.
- **Buscar en el grafo CENTRA** la vista en las coincidencias (`rf.fitView({nodes})`,
  maxZoom 1.4). Verificado (zoom a "Kael").
- **`GripVertical` de atributos arrastra DE VERDAD** (drag-and-drop nativo por el asa;
  feedback de opacidad/anillo). Verificado el reordenamiento.
- **`EntitySummary` muestra relaciones** (consulta `links` de la entidad + nombres).
- **Subir imagen**: estado "Subiendo…" + `toast` de error.
- **`BlobImage`** ya no parpadea a "nada": hueco gris del mismo tamaño + `onError`
  (patrón seguro con StrictMode; verificado con un PNG real).
- **Timeline visual**: cambiar la trama en el desplegable MUEVE el evento a su carril al
  instante y lo persiste (`relane`; antes `prevPos` lo dejaba quieto). Verificado y=0→220.
- **PDF**: usa `onload` en vez de `setTimeout` fijo (hecho en lote anterior).
- Toasts: ya estaban (sistema `lib/toast.ts` + `Toaster`).

  **Saltados a propósito (NO son bugs):** confirmar antes de "Ordenar" en grafo/timeline
  (botón explícito y reversible arrastrando; un diálogo molestaría — y el bug real de que
  la vista "desaparecía" ya está arreglado con `fitView`); buscador en el `<select>`
  "Centrar en" del árbol (los `<select>` nativos ya buscan por teclado escribiendo);
  concurrencia "last-write-wins" del draft en `WikiDetail` (no se da en app local de una
  sola ventana).

**`Loreweaver-portable.zip` regenerado** (~448 KB) con TODO lo de arriba. El servidor
empaquetado se arrancó y verificó headless: sirve `index.html` (200, título), assets con
MIME correcto, fallback SPA, y **libera el puerto 8787 al cerrar** ✅. El `.bat` cita bien
las rutas con espacios (`"%~dp0servidor.ps1"`). **`portable/LEEME.txt` actualizado**: la
Guía es ahora una SECCIÓN del menú lateral (no un icono); el aviso de "puerto ocupado" ya
no manda reiniciar el PC (el puerto se libera solo); nota de Firefox (sin disco real → usa
"Guardar/Abrir copia").

**Siguiente / pendiente de PRUEBA MANUAL (no scriptable, hazlo tú con ratón/oído):**
0. **Escuchar** los 4 ambientes (Lluvia/Mar/Viento/Espacio) y decir si suenan bien.
1. Abrir `Loreweaver-portable\Iniciar Loreweaver.bat` en una PC real, comprobar que la app
   carga y los datos persisten entre cierres (mismo puerto 8787). (El arranque/serve/
   liberación de puerto YA está verificado headless; falta confirmar la persistencia entre
   cierres y el doble-clic real en una PC del betatester.)
2. En Chrome/Edge: Ajustes → "Guardado en disco real" → "Vincular archivo" → escribir
   algo → confirmar que el `.json` del disco se actualiza solo; recargar → "Reconectar".
3. Interacciones de React Flow (arrastrar nodos del grafo, conectar) — siempre con ratón.
4. **Notificación del Pomodoro**: al primer "play" el navegador pide permiso; acéptalo y
   confirma que avisa al terminar una fase (requiere dejar correr el temporizador).

Menor/opcional: rendimiento del grafo con cientos de nodos; fuentes offline.

**Formato de manuscrito en el editor (esta sesión) — HECHO ✅ (interacción real por
script).** Extensión Tiptap `src/components/editor/manuscriptFormat.ts` + 4 botones en la
barra del `ChapterEditor`:
- **Diálogo** (icono bocadillo): inserta la raya «—»; si el párrafo ya tiene texto,
  abre una línea nueva (`splitBlock` + `—`).
- **Sangría de 1ª línea** (icono ¶, toggle como la negrita): atributo `sangria` por
  párrafo con **estado triple** `null` (por defecto) / `'on'` / `'off'`, renderizado por
  CLASE (`sangria-on` / `no-sangria`), no por estilo en línea. Por defecto rige la
  CONVENCIÓN de libro vía CSS: 1er párrafo a ras, resto sangrado. El toggle "alterna lo
  que ves" (helper `paragraphIndented`, que mira el estado explícito o, si es null, si el
  párrafo es el primero) → permite **forzar sangría también en el primer párrafo**
  (`sangria-on`) o quitarla en cualquiera (`no-sangria`). Orden del CSS importa: la regla
  `.sangria-on` va DESPUÉS de `:first-of-type` (misma especificidad) para ganarle; en el
  export `.chapter p.sangria-on` para igualar especificidad con `.chapter > p:first-of-type`.
  **Clave: por CLASE, no estilo en línea** — el primer intento con `text-indent` en línea +
  `default:null` "horneaba" estilos en cada `<p>` al cargar (un `<p>` plano se guardaba como
  `<p style="text-indent:0px">`). Con clases + default que no renderiza nada, el contenido
  se mantiene limpio.
- **Aumentar / Disminuir sangría** (iconos indent ▸/◂, estilo Word): atributo `indent`
  0–8 en párrafo y título → `margin-left` en línea.
- **WYSIWYG**: el editor ahora muestra la sangría de 1ª línea como el libro exportado
  (`.tiptap p { text-indent: 1.4em }` + `:first-of-type` a ras + `.no-sangria` la quita).
  El export ya la tenía; se le añadió `p.no-sangria { text-indent: 0 }` para respetar el
  toggle. Todo va en el HTML del capítulo → se conserva al guardar y exportar.
- ⚠️ Gotcha de Vite: añadir `@tiptap/core` como import directo nuevo dejó el optimizador
  de deps en "504 Outdated Optimize Dep" (pantalla en blanco). Se arregló reiniciando el
  dev server tras borrar `node_modules/.vite`. El build (`tsc -b && vite build`) nunca
  falló; era solo el dev server.

**Editar proyectos + foto de portada (esta sesión) — HECHO ✅ (interacción real por
script).**
- `Project` gana `coverImageId?` (campo NO indexado → sin bump de esquema). La foto se
  guarda en la tabla `images` con **`entryId = id del proyecto`** (reusa la tabla de
  imágenes de la wiki sin colisión: los ids son uuids distintos). `deleteProject` ya borra
  imágenes por `projectId`, así que la portada se limpia sola; y entra en exportAll/importAll.
- `repo.ts`: `updateProject(id, patch)`, `setProjectCover(projectId, file)` (borra la
  anterior por entryId, añade la nueva, fija `coverImageId`), `removeProjectCover` (borra +
  limpia `coverImageId` con `update(..., { coverImageId: undefined })` — Dexie sí lo borra).
- UI: `src/components/ProjectFormModal.tsx` (modal compartido crear/editar: título, género,
  descripción, color y foto con vista previa local vía `URL.createObjectURL`; todo se aplica
  al pulsar Guardar). `src/components/ProjectCover.tsx` (fondo de tarjeta: foto o degradado,
  con velo inferior para legibilidad de la insignia, como `WikiAvatar`). `ProjectsPage`:
  botón lápiz (editar) por tarjeta + tarjetas con `ProjectCover`.
- `ProjectCover` admite `scrim={false}` (sin velo) para miniaturas. `ProjectLayout` muestra
  una miniatura de la portada (h-9 w-9) junto al título en la cabecera del menú lateral
  (solo con el menú expandido).

**Responsive para tablet/móvil (esta sesión) — HECHO ✅ (verificado en preview a 375 y
768px + escritorio).** Breakpoint clave: `lg` (1024px) para el menú; `md` (768px) para la
lista de capítulos.
- `ProjectLayout`: el menú lateral es **fijo en `lg+`** y **cajón deslizante** (off-canvas
  con backdrop) por debajo, abierto con una **hamburguesa** en una barra superior móvil
  (`lg:hidden`). El colapso (240↔64) sigue siendo solo de escritorio. Estado `mobileNav`;
  se cierra al navegar (`useLocation`) o pulsar un enlace.
- `WritePage`: la lista de capítulos (`w-72`) es **fija en `md+`** y **cajón** en móvil
  (botón "Capítulos" en una barra `md:hidden`). El toggle de enfoque: flotante en
  escritorio (entrar/salir); en móvil se entra desde la barra y se sale con un botón
  flotante que solo aparece en modo enfoque.
- Anti-desbordes: `FocusDock` `w-[min(380px,calc(100vw-2.5rem))]`; cabeceras de grafo y
  timeline con `flex-wrap`/apilado en móvil; fila de fecha/trama/botones de cada evento con
  `flex-wrap` + `ml-auto`. Wiki y Proyectos ya eran responsive (grids que apilan).
- **Scroll de modales (crítico en móvil):** el componente `Modal` ahora es `flex flex-col`
  con cabecera `shrink-0` y un **cuerpo `flex-1 min-h-0 overflow-y-auto`** (alto `max-h-[90dvh]`),
  así NINGÚN modal corta su contenido/botones en móvil (antes `overflow-hidden` recortaba).
  Se quitaron los `max-h-[Xvh] overflow-y-auto` internos redundantes (Settings, nuevo evento,
  editar evento). `WikiDetail` (panel) ya scrollea; `ChapterHistory` ahora apila las dos
  columnas en móvil (`flex-col md:flex-row`). Verificado a 375px: Ajustes/editar proyecto/
  nuevo evento/ficha llegan a sus botones del fondo.
- ⚠️ Pendiente real: el guardado en disco (File System Access) NO existe en Safari iOS →
  en iPad usar "Guardar/Abrir copia".

**Despliegue a GitHub Pages — DESPLEGADO ✅ → https://ryugarret.github.io/loreweaver/**
Repo: `github.com/ryugarret/loreweaver` (PÚBLICO). `.github/workflows/deploy.yml` (build +
`actions/configure-pages` → `base_path` automático + `upload-pages-artifact` +
`deploy-pages`), `vite.config.ts` lee `VITE_BASE` (normaliza barras; `/` en local).
HashRouter evita el 404 de SPA en Pages. Cada `push` a `main` redespliega solo (verificado:
index/JS/manifest/sw/iconos a 200 bajo `/loreweaver/`).
- ⚠️ **Gotchas que costaron 2 intentos fallidos:** (1) Pages en cuenta gratis SOLO publica
  desde repo **PÚBLICO** (privado → deploy falla / inaccesible). (2) `configure-pages` con
  `enablement: true` **falla** ("Configurar Pages" rojo) porque el GITHUB_TOKEN por defecto
  no puede CREAR el sitio Pages → hubo que **activar Pages a mano** (Settings → Pages →
  Source: **GitHub Actions**) y QUITAR `enablement` (ahora solo lo lee).
- Datos por ORIGEN: Pages (`ryugarret.github.io`) y portable (`localhost:8787`) NO comparten
  datos; mover con copia `.json`. iOS: sin disco real → usar "Guardar/Abrir copia".
