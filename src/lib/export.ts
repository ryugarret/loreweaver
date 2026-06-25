import { type Project, type Chapter } from './db'
import { toast } from './toast'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function safeName(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'manuscrito'
  )
}

/**
 * Limpia el HTML de un capítulo para exportarlo: convierte las @menciones en
 * texto normal SIN la "@" (el lector del manuscrito no debe ver `@Aldric`, solo
 * `Aldric`). Mantiene el resto del formato (párrafos, negritas, listas…).
 */
function cleanContent(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.mention').forEach((el) => {
    const label = el.getAttribute('data-label') ?? el.textContent ?? ''
    el.replaceWith(doc.createTextNode(label.replace(/^@/, '')))
  })
  return doc.body.innerHTML
}

/** Construye el manuscrito completo como HTML con estilo de libro. */
export function buildManuscriptHTML(
  project: Project,
  chapters: Chapter[],
): string {
  // Orden de lectura garantizado.
  const ordered = [...chapters].sort((a, b) => a.order - b.order)

  const toc = ordered
    .map(
      (c, i) =>
        `<li><span class="toc-num">${i + 1}</span> ${esc(
          c.title || 'Sin título',
        )}</li>`,
    )
    .join('\n')

  const body = ordered
    .map(
      (c, i) => `
    <section class="chapter">
      <p class="chapter-num">Capítulo ${i + 1}</p>
      <h2>${esc(c.title || 'Sin título')}</h2>
      ${cleanContent(c.content) || '<p></p>'}
    </section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(project.title)}</title>
<style>
  @page { margin: 2.5cm; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt; line-height: 1.7; color: #111;
    max-width: 42rem; margin: 2rem auto; padding: 0 1.5rem;
  }
  h1.book-title { text-align: center; font-size: 2.4em; margin: 4rem 0 0.4rem; }
  .book-genre { text-align: center; color: #666; margin-bottom: 1rem; font-style: italic; }
  .title-page { page-break-after: always; }
  .toc { page-break-after: always; }
  .toc h2 { text-align: left; margin: 0 0 1.2em; }
  .toc ol { list-style: none; padding: 0; }
  .toc li { display: flex; gap: 0.8em; margin: 0.4em 0; }
  .toc-num { display: inline-block; min-width: 1.6em; text-align: right; color: #888; font-variant-numeric: tabular-nums; }
  .chapter { page-break-before: always; }
  .chapter-num {
    text-align: center; text-transform: uppercase; letter-spacing: 0.18em;
    font-size: 0.8em; color: #999; margin: 0 0 0.3em; text-indent: 0;
  }
  h2 { font-size: 1.6em; margin: 0.2em 0 1.6em; text-align: center; font-weight: 600; }
  p { margin: 0 0 0.15rem; text-indent: 1.4em; }
  .chapter > p:first-of-type { text-indent: 0; }
  p.no-sangria { text-indent: 0; }
  .chapter p.sangria-on { text-indent: 1.4em; }
  blockquote { font-style: italic; border-left: 3px solid #ccc; padding-left: 1em; color: #555; margin: 1em 0; }
  h1, h2, h3 { font-family: Georgia, serif; }
  ul, ol { padding-left: 1.5em; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  @media print { body { max-width: none; margin: 0; } }
</style>
</head>
<body>
  <div class="title-page">
    <h1 class="book-title">${esc(project.title)}</h1>
    ${project.genre ? `<p class="book-genre">${esc(project.genre)}</p>` : ''}
  </div>
  ${
    ordered.length > 1
      ? `<nav class="toc"><h2>Índice</h2><ol>${toc}</ol></nav>`
      : ''
  }
  ${body}
</body>
</html>`
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportHTML(project: Project, chapters: Chapter[]) {
  download(
    `${safeName(project.title)}.html`,
    buildManuscriptHTML(project, chapters),
    'text/html;charset=utf-8',
  )
}

export function exportDoc(project: Project, chapters: Chapter[]) {
  // Un .doc no es más que HTML que Word sabe abrir (con BOM para acentos).
  download(
    `${safeName(project.title)}.doc`,
    '﻿' + buildManuscriptHTML(project, chapters),
    'application/msword',
  )
}

export function exportPDF(project: Project, chapters: Chapter[]) {
  // Abre una ventana con el manuscrito y lanza el diálogo de impresión,
  // donde el usuario elige "Guardar como PDF". Calidad tipográfica perfecta.
  const w = window.open('', '_blank')
  if (!w) {
    toast(
      'Permite las ventanas emergentes de este sitio para exportar a PDF.',
      'error',
    )
    return
  }
  w.document.open()
  w.document.write(buildManuscriptHTML(project, chapters))
  w.document.close()
  w.focus()
  // Imprimir cuando el documento haya terminado de renderizar (no un timeout
  // fijo, que en manuscritos largos imprimía páginas en blanco).
  const doPrint = () => {
    try {
      w.print()
    } catch {
      /* ventana cerrada */
    }
  }
  if (w.document.readyState === 'complete') window.setTimeout(doPrint, 120)
  else w.onload = doPrint
}
