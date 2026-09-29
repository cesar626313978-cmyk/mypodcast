import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for our database
export interface CanalConfig {
  id?: number;
  prompt_maestro: string;
  palabras_clave_nicho: string;
  categoria_youtube: string;
  plantilla_descripcion: string;
  voz_locutor: string;
  formato: 'short' | 'horizontal';
  frecuencia: string;
  hora_publicacion: string;
  activo: boolean;
  limite_diario_manual?: number;
  updated_at?: string;
}

export interface Publicacion {
  id: number;
  titulo: string;
  descripcion: string;
  guion: string;
  tags: string[];
  youtube_id: string | null;
  youtube_url: string | null;
  estado: 'pendiente' | 'procesando' | 'completado' | 'error';
  error_log: string | null;
  created_at: string;
}

const STORAGE_KEY_CONFIG = 'autovideo_canal_config';
const STORAGE_KEY_PUBS = 'autovideo_publicaciones';
const STORAGE_KEY_CREDS = 'autovideo_supabase_creds';

// Default seed values matching the prompt's SQL script
export const DEFAULT_CONFIG: CanalConfig = {
  id: 1,
  prompt_maestro:
    'Explica un concepto científico o psicológico contraintuitivo de forma ágil, con un gancho inicial impactante en los primeros 3 segundos y una conclusión memorable. Duración estimada: 45 a 55 segundos.',
  palabras_clave_nicho: 'ciencia, psicologia, sesgos cognitivos, curiosidades',
  categoria_youtube: '27',
  plantilla_descripcion: '💡 Suscríbete para contenido nuevo a diario.\n\n#Shorts #Aprender #Tips #Ciencia',
  voz_locutor: 'es-ES-Studio-C',
  formato: 'short',
  frecuencia: 'diario',
  hora_publicacion: '07:00',
  activo: true,
  limite_diario_manual: 4,
};

export const SEED_PUBLICACIONES: Publicacion[] = [
  {
    id: 101,
    titulo: '¿Por qué tu cerebro recuerda canciones molestas? El Efecto Zeigarnik',
    descripcion:
      'Descubre por qué una melodía incompleta se queda atrapada en tu cabeza durante horas. La mente odia los ciclos abiertos.\n\n💡 Suscríbete para contenido nuevo a diario.\n#Shorts #Psicologia #Ciencia',
    guion:
      '¿Por qué esa canción insoportable no sale de tu cabeza? No es mala suerte, es un fallo deliberado de tu arquitectura mental. En 1927, la psicóloga Bluma Zeigarnik descubrió que el cerebro mantiene activas las tareas inacabadas con una intensidad descomunal. Cuando escuchas un estribillo y se corta, tu memoria de trabajo entra en bucle buscando el final. El truco infalible para apagarlo: canta mentalmente la última nota y cierra el bucle.',
    tags: ['psicologia', 'zeigarnik', 'cerebro', 'curiosidades', 'shorts', 'ciencia'],
    youtube_id: 'dQw4w9WgXcQ',
    youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    estado: 'completado',
    error_log: null,
    created_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
  },
  {
    id: 102,
    titulo: 'El sesgo del superviviente: El peligro de imitar a millonarios',
    descripcion:
      'Analizar solo a los que ganaron es la receta perfecta para fracasar. Aprende cómo los aviones blindados de la Segunda Guerra Mundial cambiaron la estadística moderna.\n\n#Shorts #Estrategia #Finanzas',
    guion:
      'Si quieres tener éxito, jamás copies las rutinas matutinas de los multimillonarios. En la Segunda Guerra Mundial, los ingenieros querían blindar los aviones en las zonas con más impactos de bala. El matemático Abraham Wald dijo lo opuesto: blinden donde no hay disparos, porque los aviones con impactos en el motor jamás regresaron para ser contados. Mirar únicamente a los que triunfan oculta el cementerio de quienes hicieron exactamente lo mismo y fracasaron.',
    tags: ['sesgo', 'superviviente', 'estadistica', 'finanzas', 'productividad'],
    youtube_id: 'sample_video_2',
    youtube_url: 'https://youtube.com/watch?v=sample_video_2',
    estado: 'completado',
    error_log: null,
    created_at: new Date(Date.now() - 3600 * 1000 * 42).toISOString(),
  },
  {
    id: 103,
    titulo: 'La paradoja de Simpson: Cómo los datos te engañan sin mentir',
    descripcion:
      'Dos medicamentos pueden parecer superiores por separado y ser peores al unirse. La paradoja de Simpson explicada en 50 segundos.\n\n#Shorts #Datos #Ciencia',
    guion:
      '¿Puede un tratamiento ser más efectivo en hombres y también más efectivo en mujeres, pero fracasar cuando se analiza a la población completa? Parece magia negra, pero es pura matemática. Se llama la Paradoja de Simpson. Ocurre cuando una variable oculta o desbalance en los grupos invierte la correlación global. Antes de creer ciegamente en un titular de salud, revisa siempre la distribución de la muestra.',
    tags: ['datos', 'matematicas', 'ciencia', 'paradoja', 'shorts'],
    youtube_id: 'sample_video_3',
    youtube_url: 'https://youtube.com/watch?v=sample_video_3',
    estado: 'completado',
    error_log: null,
    created_at: new Date(Date.now() - 3600 * 1000 * 68).toISOString(),
  },
];

// Helper to sanitize Supabase Project URL (strips trailing slashes, /rest/v1, /auth/v1)
export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Remove accidental /rest/v1 or /auth/v1 subpaths
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/auth\/v1\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
}

// Helper to get active credentials
export function getSavedCredentials() {
  const envUrl = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CREDS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.key) {
          const cleanUrl = sanitizeSupabaseUrl(parsed.url);
          const cleanKey = parsed.key.trim();
          if (cleanUrl !== parsed.url) {
            localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify({ url: cleanUrl, key: cleanKey }));
          }
          return { url: cleanUrl, key: cleanKey, source: 'local' };
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  if (envUrl && envUrl.startsWith('http') && envKey) {
    return { url: envUrl, key: envKey, source: 'env' };
  }

  return { url: '', key: '', source: 'none' };
}

// In-Memory/Local Storage Store for Seamless fallback
class LocalStorageDatabase {
  private listeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(STORAGE_KEY_CONFIG)) {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(DEFAULT_CONFIG));
      }
      if (!localStorage.getItem(STORAGE_KEY_PUBS)) {
        localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(SEED_PUBLICACIONES));
      }
    }
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
  }

  getConfig(): CanalConfig {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  saveConfig(data: Partial<CanalConfig>): CanalConfig {
    const current = this.getConfig();
    const updated = { ...current, ...data, updated_at: new Date().toISOString() };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    }
    this.notify();
    return updated;
  }

  getPublicaciones(): Publicacion[] {
    if (typeof window === 'undefined') return SEED_PUBLICACIONES;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PUBS);
      return raw ? JSON.parse(raw) : SEED_PUBLICACIONES;
    } catch {
      return SEED_PUBLICACIONES;
    }
  }

  insertPublicacion(payload: Omit<Publicacion, 'id' | 'created_at'>): Publicacion {
    const list = this.getPublicaciones();
    const newId = Date.now();
    const nueva: Publicacion = {
      ...payload,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const updated = [nueva, ...list];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(updated));
    }
    this.notify();
    return nueva;
  }

  updatePublicacion(id: number, patch: Partial<Publicacion>) {
    const list = this.getPublicaciones();
    const updated = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(updated));
    }
    this.notify();
  }
}

export const localDb = new LocalStorageDatabase();

// Create Real Supabase or Emulated Safe Client
function createSafeSupabaseClient() {
  const creds = getSavedCredentials();

  if (creds.url && creds.key && creds.url.startsWith('http')) {
    try {
      return {
        client: createClient(creds.url, creds.key),
        isReal: true,
      };
    } catch (e) {
      console.warn('Fallo al inicializar cliente Supabase real, usando almacenamiento reactivo local:', e);
    }
  }

  // Emulated fallback client with Supabase query syntax compatibility
  const emulated = {
    channel: (_channelName: string) => {
      return {
        on: (_type: string, _opts: any, callback: () => void) => {
          const unsubscribe = localDb.subscribe(callback);
          return {
            subscribe: () => ({ unsubscribe }),
          };
        },
      };
    },
    removeChannel: (_ch: any) => {
      // noop
    },
    from: (table: string) => {
      return {
        select: (_fields = '*') => {
          return {
            limit: (limitCount: number) => {
              return {
                maybeSingle: async () => {
                  if (table === 'canal_config') {
                    return { data: localDb.getConfig(), error: null };
                  }
                  const pubs = localDb.getPublicaciones();
                  return { data: pubs[0] || null, error: null };
                },
                execute: async () => {
                  if (table === 'canal_config') {
                    return { data: [localDb.getConfig()], error: null };
                  }
                  return { data: localDb.getPublicaciones().slice(0, limitCount), error: null };
                },
              };
            },
            order: (_field: string, _opts?: { ascending?: boolean }) => {
              return {
                limit: async (cnt: number) => {
                  if (table === 'canal_config') {
                    return { data: [localDb.getConfig()], error: null };
                  }
                  return { data: localDb.getPublicaciones().slice(0, cnt), error: null };
                },
              };
            },
          };
        },
        insert: async (records: any[]) => {
          if (table === 'canal_config') {
            const saved = localDb.saveConfig(records[0] || {});
            return { data: [saved], error: null };
          }
          if (table === 'publicaciones') {
            const nueva = localDb.insertPublicacion(records[0] || {});
            return { data: [nueva], error: null };
          }
          return { data: records, error: null };
        },
        update: (payload: any) => {
          return {
            eq: async (field: string, val: any) => {
              if (table === 'canal_config') {
                const saved = localDb.saveConfig(payload);
                return { data: [saved], error: null };
              }
              if (table === 'publicaciones' && field === 'id') {
                localDb.updatePublicacion(Number(val), payload);
                return { data: [payload], error: null };
              }
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };

  return {
    client: emulated as unknown as SupabaseClient,
    isReal: false,
  };
}

const current = createSafeSupabaseClient();
export const supabase = current.client;
export const isSupabaseLive = current.isReal;

export function updateCustomSupabaseKeys(rawUrl: string, rawKey: string) {
  if (typeof window !== 'undefined') {
    const url = sanitizeSupabaseUrl(rawUrl);
    const key = (rawKey || '').trim();
    if (url && key) {
      localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify({ url, key }));
    } else {
      localStorage.removeItem(STORAGE_KEY_CREDS);
    }
    window.location.reload();
  }
}
