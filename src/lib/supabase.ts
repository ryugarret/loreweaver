import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase (auth + base de datos para la sincronización cifrada).
 *
 * Estos dos valores son PÚBLICOS por diseño: la clave "publishable" está pensada
 * para ir en el cliente, igual que la config de Firebase. Lo que protege los datos
 * es Row Level Security (RLS), activado en todas las tablas. Nunca poner aquí la
 * clave `secret`/`service_role` (esa salta el RLS y jamás debe salir del servidor).
 */
const SUPABASE_URL = 'https://rkdyxmqabfbsjqfudkew.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dwOKPs6yQYEi2gpIyczPyQ_h9_8C1U3'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
