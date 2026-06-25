# Loreweaver

> A tiny writter helper, as every one i find is paid adn kinda limited

Estudio de escritura y *worldbuilding* **100% local y offline**. Sin cuentas, sin
servidores, sin IA: todos los datos viven en tu navegador (IndexedDB).

- **Escribir** — editor de capítulos con formato, sangrías y diálogos, historial
  de versiones (tipo Google Docs) y exportación a PDF/Word/HTML.
- **Wiki** — fichas de personajes, lugares, facciones, objetos… con imágenes.
- **Relaciones** — grafo de vínculos y *árbol genealógico* automático.
- **Línea de tiempo** — vistas de lista, carriles por trama y cronología.
- **Tablero** de notas, **Progreso** (rachas y objetivos) y modo enfoque
  (Pomodoro, sonidos de ambiente, música).

La interfaz es responsive (escritorio, tablet y móvil) e instalable como PWA.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # comprueba tipos + compila a dist/
```

## Versión portable (PC con Windows, sin instalar nada)

```bash
npm run portable
```

Genera `Loreweaver-portable.zip`: un lanzador `.bat` que sirve la app con un
servidor de PowerShell (incluido en Windows). El betatester no instala nada.

## Publicar en GitHub Pages

El repo incluye un flujo de GitHub Actions (`.github/workflows/deploy.yml`) que
compila y publica en cada `push` a `main`. La ruta base se ajusta sola al nombre
del repo. Activa **Settings → Pages → Source: GitHub Actions** (o se activa solo
en el primer despliegue). La app queda en `https://USUARIO.github.io/REPO/`.

> Los datos son por origen (dominio): cada versión (portable, GitHub Pages…)
> guarda por separado. Usa **Guardar copia / Abrir copia** (un `.json`) para
> moverlos entre dispositivos.
