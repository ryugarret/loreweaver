import type { ReactNode } from 'react'
import {
  FolderOpen,
  PenLine,
  History,
  BookMarked,
  Share2,
  TreePine,
  Clock,
  LayoutDashboard,
  BarChart3,
  Headphones,
  Download,
  Settings,
  HardDrive,
  Sparkles,
} from 'lucide-react'

const SECTIONS: { icon: ReactNode; title: string; body: ReactNode }[] = [
  {
    icon: <FolderOpen size={20} />,
    title: 'Proyectos',
    body: 'Tu estantería. Crea novelas y edítalas cuando quieras (pasa el ratón por una tarjeta y pulsa el lápiz): título, género, descripción, color y FOTO de portada (sube una imagen o deja el color). Cada proyecto guarda por separado sus capítulos, wiki, relaciones, línea de tiempo y tablero.',
  },
  {
    icon: <PenLine size={20} />,
    title: 'Escribir',
    body: 'El editor de capítulos: barra de formato (negrita, títulos, listas, citas), botón de diálogo (inserta la raya «—» en una línea nueva), sangría de primera línea estilo libro (actívala/quítala por párrafo) y botones de aumentar/disminuir sangría del párrafo entero. Autoguardado y contador de palabras en vivo. El corrector ortográfico del navegador subraya las faltas, y el botón «Estilo» detecta las palabras y frases que repites de más para diversificar el vocabulario. Marca el estado de cada capítulo (idea, borrador, revisión, terminado). Escribe «@» para mencionar personajes o lugares de tu wiki. Arriba a la derecha, el modo enfoque oculta todo lo demás.',
  },
  {
    icon: <History size={20} />,
    title: 'Historial de versiones',
    body: 'Como en Google Docs. El botón «Historial» del editor guarda instantáneas mientras escribes (y puedes marcar versiones con nombre). Verás qué has añadido (verde) y quitado (rojo) frente al texto actual, y puedes restaurar cualquier versión.',
  },
  {
    icon: <BookMarked size={20} />,
    title: 'Wiki',
    body: 'Tu enciclopedia. Fichas de personajes, lugares, facciones, objetos, poderes y criaturas, con atributos a medida, etiquetas e imágenes de referencia. En personajes/criaturas puedes poner el género (colorea el árbol). «Aparece en» te dice en qué capítulos se menciona la ficha.',
  },
  {
    icon: <Share2 size={20} />,
    title: 'Relaciones',
    body: 'El grafo de vínculos. Arrastra de una ficha a otra para conectarlas (familia, cónyuge, hermano, aliado, enemigo, romance, mentor…). El control «Todas / Sociales / Familia» filtra lo que ves. Da una intensidad (−100 a +100) y las aristas se hacen más gruesas: la «telaraña diplomática» de facciones.',
  },
  {
    icon: <TreePine size={20} />,
    title: 'Árbol genealógico',
    body: 'El botón «Árbol» (en Relaciones) lo dibuja solo desde los vínculos de Familia (de padre/madre a hijo/a), Cónyuge y Hermano. Un clic resalta a una persona sin esconder a sus parientes; doble clic abre su ficha. Soporta parejas del mismo sexo, hijos no biológicos y co-padres no casados, y nunca pierde tíos ni primos.',
  },
  {
    icon: <Clock size={20} />,
    title: 'Línea de tiempo',
    body: 'Ordena los hitos de tu historia con tres vistas: Lista (editar), Visual (carriles por trama y flechas causa→efecto) y Cronología (lineal). Conecta cada evento con los personajes y lugares que intervienen, y marca qué evento ocurre «porque» pasó otro.',
  },
  {
    icon: <LayoutDashboard size={20} />,
    title: 'Tablero',
    body: 'Un corcho para ideas sueltas: notas adhesivas que arrastras por el lienzo y coloreas. Perfecto para esquemas rápidos.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Progreso',
    body: 'Tus números de escritura: palabras totales, objetivo del proyecto, racha diaria y un gráfico de hábito. Con desglose por estado y por capítulo.',
  },
  {
    icon: <Headphones size={20} />,
    title: 'Enfoque (dock flotante)',
    body: 'Abajo del todo: Pomodoro (temporizador de concentración), sonidos de ambiente generativos (lluvia, mar, viento, espacio), tu música local y vídeos/listas de YouTube. También el sonido de tecleo mecánico al escribir. Todo se sintetiza o reproduce en local.',
  },
  {
    icon: <Download size={20} />,
    title: 'Exportar el manuscrito',
    body: 'Desde «Escribir», el icono de descarga exporta tu libro a PDF, Word (.doc) o HTML, con portada, índice y números de capítulo. Las @menciones salen como texto normal, sin la «@».',
  },
  {
    icon: <HardDrive size={20} />,
    title: 'Tus datos y copias',
    body: 'Todo vive en tu ordenador, sin internet ni cuentas. En Ajustes: «Guardar copia» crea un único archivo .json con TODO (capítulos, wiki, relaciones, árbol, imágenes…). Y con Chrome o Edge, «Guardado en disco real» mantiene un archivo al día automáticamente en cada cambio. Haz copias de vez en cuando.',
  },
  {
    icon: <Settings size={20} />,
    title: 'Ajustes',
    body: 'Tema claro/oscuro/sistema, color de acento, tipografía del editor y duración del Pomodoro. Aquí también están las copias de seguridad y «Borrar todo» (empezar de cero).',
  },
]

export function GuidePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3.5">
        <h1 className="font-serif text-xl font-semibold">Guía</h1>
        <p className="text-xs text-muted-foreground">
          Qué es cada parte de Loreweaver
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-7">
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-accent" />
            <p className="leading-relaxed text-foreground">
              Loreweaver es tu estudio de escritura: capítulos, enciclopedia,
              relaciones, línea de tiempo y más.{' '}
              <strong>100% en tu ordenador</strong>, sin internet, sin cuentas y
              sin instalar nada. Esto es lo que hay:
            </p>
          </div>

          <div className="space-y-2">
            {SECTIONS.map((s) => (
              <div
                key={s.title}
                className="flex gap-3.5 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-base font-semibold">
                    {s.title}
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Consejo:</strong> antes de mucho
            trabajo, ve a Ajustes y activa el guardado en disco real (Chrome/Edge)
            o haz una «Guardar copia». Así tu novela queda también como archivo en
            el disco, no solo en el navegador.
          </p>
        </div>
      </div>
    </div>
  )
}
