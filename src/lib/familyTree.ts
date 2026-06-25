import calcTree from 'relatives-tree'
import type {
  ExtNode,
  Connector,
  Size,
  Node as RTNode,
  RelData,
} from 'relatives-tree/lib/types'
import type { WikiEntry, Link } from './db'

/**
 * Tipos de relación (relType de Link) que alimentan el árbol genealógico.
 * - family  : DIRIGIDO, de padre/madre (from) → hijo/a (to)
 * - spouse  : simétrico, cónyuge
 * - sibling : simétrico, hermano/a (además se derivan de padres compartidos)
 */
export const FAMILY_RELS = ['family', 'spouse', 'sibling'] as const

/** Prefijo de los nodos "ascendencia desconocida" que inventamos para poder
 *  dibujar grupos de hermanos que no tienen ningún padre registrado. */
const PH = '__ph__'

export function isPlaceholder(id: string): boolean {
  return id.startsWith(PH)
}

type IdSet = Set<string>
type Adj = Map<string, IdSet>

function add(m: Adj, a: string, b: string) {
  let s = m.get(a)
  if (!s) m.set(a, (s = new Set()))
  s.add(b)
}

interface Graph {
  parentsOf: Adj // hijo  -> padres
  childrenOf: Adj // padre -> hijos
  spousesOf: Adj
  siblingsOf: Adj
  memberIds: IdSet // solo entidades reales (sin placeholders)
}

function buildGraph(entries: WikiEntry[], links: Link[]): Graph {
  const valid = new Set(entries.map((e) => e.id))
  const parentsOf: Adj = new Map()
  const childrenOf: Adj = new Map()
  const spousesOf: Adj = new Map()
  const siblingsOf: Adj = new Map()
  const sibEdges: Adj = new Map() // hermanos declarados explícitamente

  const usable = links.filter(
    (l) =>
      l.fromKind === 'wiki' &&
      l.toKind === 'wiki' &&
      l.fromId !== l.toId &&
      valid.has(l.fromId) &&
      valid.has(l.toId),
  )

  for (const l of usable) {
    if (l.relType === 'family') {
      add(childrenOf, l.fromId, l.toId) // from = padre, to = hijo
      add(parentsOf, l.toId, l.fromId)
    } else if (l.relType === 'spouse') {
      add(spousesOf, l.fromId, l.toId)
      add(spousesOf, l.toId, l.fromId)
    } else if (l.relType === 'sibling') {
      add(sibEdges, l.fromId, l.toId)
      add(sibEdges, l.toId, l.fromId)
    }
  }

  // Hermanos explícitos: cada grupo conexo debe compartir padres para que
  // relatives-tree los dibuje juntos. Si el grupo no tiene ningún padre
  // registrado, le inventamos un padre "placeholder".
  const visitedSib = new Set<string>()
  let phIndex = 0
  for (const start of sibEdges.keys()) {
    if (visitedSib.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    visitedSib.add(start)
    while (stack.length) {
      const u = stack.pop()!
      comp.push(u)
      for (const v of sibEdges.get(u) ?? [])
        if (!visitedSib.has(v)) {
          visitedSib.add(v)
          stack.push(v)
        }
    }
    const realParents = new Set<string>()
    for (const m of comp)
      for (const p of parentsOf.get(m) ?? []) realParents.add(p)
    const parents = realParents.size ? [...realParents] : [`${PH}${phIndex++}`]
    for (const m of comp)
      for (const p of parents) {
        add(parentsOf, m, p)
        add(childrenOf, p, m)
      }
  }

  // Hermanos derivados: dos hijos del mismo padre son hermanos entre sí.
  for (const kids of childrenOf.values()) {
    const arr = [...kids]
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        add(siblingsOf, arr[i], arr[j])
        add(siblingsOf, arr[j], arr[i])
      }
  }

  // Solo cuentan como "miembros" las entidades reales (los placeholders no).
  const memberIds: IdSet = new Set()
  for (const m of [parentsOf, childrenOf, spousesOf, siblingsOf])
    for (const [k, vs] of m) {
      if (valid.has(k)) memberIds.add(k)
      for (const v of vs) if (valid.has(v)) memberIds.add(v)
    }

  return { parentsOf, childrenOf, spousesOf, siblingsOf, memberIds }
}

/** Ids de las entidades que participan en alguna relación familiar. */
export function familyMemberIds(entries: WikiEntry[], links: Link[]): Set<string> {
  return buildGraph(entries, links).memberIds
}

/**
 * Conjunto visible a partir de un nodo raíz, limitado por generaciones.
 * Distancia "vertical" = nº de saltos padre/hijo; cónyuges y hermanos están
 * en la misma generación (no consumen presupuesto). 0-1 BFS.
 */
function visibleSet(g: Graph, rootId: string, maxGen: number): IdSet {
  const dist = new Map<string, number>([[rootId, 0]])
  const queue: string[] = [rootId]
  const horiz = (id: string) => [
    ...(g.spousesOf.get(id) ?? []),
    ...(g.siblingsOf.get(id) ?? []),
  ]
  const vert = (id: string) => [
    ...(g.parentsOf.get(id) ?? []),
    ...(g.childrenOf.get(id) ?? []),
  ]
  while (queue.length) {
    const u = queue.shift()!
    const du = dist.get(u)!
    for (const v of horiz(u)) {
      if (du < (dist.get(v) ?? Infinity)) {
        dist.set(v, du)
        queue.unshift(v) // peso 0
      }
    }
    for (const v of vert(u)) {
      const nd = du + 1
      if (nd <= maxGen && nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd)
        queue.push(v) // peso 1
      }
    }
  }
  return new Set(dist.keys())
}

function rels(m: Adj, id: string, visible: IdSet, type: string) {
  return [...(m.get(id) ?? [])]
    .filter((v) => visible.has(v))
    .map((v) => ({ id: v, type }))
}

export interface FamilyLayout {
  nodes: readonly ExtNode[]
  connectors: readonly Connector[]
  canvas: Size
  /** Raíz interna que usó relatives-tree (un ápice, para no podar parientes). */
  rootId: string
  /** Persona enfocada (la que se resalta), elegida por el usuario. */
  spotlightId: string
}

/**
 * Calcula posiciones del árbol genealógico con relatives-tree.
 *
 * `spotlightId` es la persona enfocada. OJO: relatives-tree poda todo lo que no
 * cuelga de su raíz, así que NO rooteamos en el enfocado (perdería tíos, primos
 * y demás colaterales). Rooteamos en el ÁPICE del conjunto visible (probando los
 * "fundadores" y quedándonos con el que dibuje más nodos, incluido el enfocado),
 * y solo resaltamos al enfocado. Devuelve null si no tiene parientes o si los
 * datos son contradictorios (calcTree lanza). maxGen = Infinity → sin límite.
 */
export function computeFamilyLayout(
  entries: WikiEntry[],
  links: Link[],
  spotlightId: string,
  maxGen: number,
): FamilyLayout | null {
  const g = buildGraph(entries, links)
  if (!g.memberIds.has(spotlightId)) return null

  const visible = visibleSet(g, spotlightId, maxGen)
  const genderById = new Map(entries.map((e) => [e.id, e.gender]))
  const realGender = (id: string): 'male' | 'female' =>
    genderById.get(id) === 'female' ? 'female' : 'male'

  // relatives-tree ordena cada "pareja" por género (marido/mujer) y REVIENTA si
  // son del mismo sexo. Una "pareja" para él = cónyuges O co-padres del mismo
  // hijo (dos personajes pueden tener un hijo SIN ser cónyuges). 2-coloreamos ese
  // grafo de parejas para que cada una sea mixta SOLO en el layout; el género
  // REAL se pinta luego en la tarjeta, no este.
  const coupleAdj = new Map<string, Set<string>>()
  const couple = (a: string, b: string) => {
    if (a === b || !visible.has(a) || !visible.has(b)) return
    if (!coupleAdj.has(a)) coupleAdj.set(a, new Set())
    if (!coupleAdj.has(b)) coupleAdj.set(b, new Set())
    coupleAdj.get(a)!.add(b)
    coupleAdj.get(b)!.add(a)
  }
  for (const [id, sps] of g.spousesOf) for (const s of sps) couple(id, s)
  for (const kid of visible) {
    const ps = [...(g.parentsOf.get(kid) ?? [])].filter((p) => visible.has(p))
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) couple(ps[i], ps[j])
  }
  const layoutGender = new Map<string, 'male' | 'female'>()
  for (const start of visible) {
    if (layoutGender.has(start)) continue
    if (!coupleAdj.get(start)?.size) continue // sin pareja: se resuelve aparte
    layoutGender.set(start, realGender(start))
    const q = [start]
    while (q.length) {
      const u = q.shift()!
      const opp = layoutGender.get(u) === 'male' ? 'female' : 'male'
      for (const v of coupleAdj.get(u) ?? []) {
        if (!layoutGender.has(v)) {
          layoutGender.set(v, opp)
          q.push(v)
        }
      }
    }
  }
  const lg = (id: string) => layoutGender.get(id) ?? realGender(id)

  // OJO: relatives-tree empareja a los hijos con el CÓNYUGE del padre, no con el
  // otro padre del hijo. Para que los co-padres (sean o no cónyuges reales) se
  // dibujen juntos sobre su hijo, pasamos `coupleAdj` como "spouses" del layout
  // (= cónyuges ∪ co-padres). El conector resultante = "tuvieron un hijo juntos".
  const rtNodes = [...visible].map((id) => ({
    id,
    gender: lg(id),
    parents: rels(g.parentsOf, id, visible, 'blood'),
    children: rels(g.childrenOf, id, visible, 'blood'),
    siblings: rels(g.siblingsOf, id, visible, 'blood'),
    spouses: rels(coupleAdj, id, visible, 'married'),
  }))
  // relatives-tree usa const enum para gender/type; pasamos strings planos
  // (equivalentes en runtime) y casteamos en la frontera de tipos.
  const typed = rtNodes as unknown as readonly RTNode[]

  // Candidatos a raíz: el ápice del enfocado + los "fundadores" del conjunto
  // visible (los que no tienen padres dentro de visible). Elegimos el que
  // dibuje MÁS nodos y que contenga al enfocado → así no se pierde ningún
  // colateral (tíos, primos, sobrinos…).
  let apex = spotlightId
  for (let i = 0; i < 500; i++) {
    const ps = [...(g.parentsOf.get(apex) ?? [])]
      .filter((p) => visible.has(p))
      .sort()
    if (!ps.length) break
    apex = ps[0]
  }
  const founders = [...visible].filter(
    (id) => ![...(g.parentsOf.get(id) ?? [])].some((p) => visible.has(p)),
  )
  const candidates = [...new Set([apex, ...founders])].slice(0, 16)

  let best: RelData | null = null
  let bestRoot = spotlightId
  for (const cand of candidates) {
    let res: RelData
    try {
      res = calcTree(typed, { rootId: cand })
    } catch {
      continue
    }
    if (!res.nodes.some((n) => n.id === spotlightId)) continue
    if (!best || res.nodes.length > best.nodes.length) {
      best = res
      bestRoot = cand
    }
  }
  if (!best) {
    try {
      best = calcTree(typed, { rootId: spotlightId })
      bestRoot = spotlightId
    } catch {
      return null
    }
  }

  return {
    nodes: best.nodes,
    connectors: best.connectors,
    canvas: best.canvas,
    rootId: bestRoot,
    spotlightId,
  }
}
