import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  isSupabaseLive,
  getSavedCredentials,
  updateCustomSupabaseKeys,
  localDb,
  CanalConfig,
  Publicacion,
  DEFAULT_CONFIG,
  SEED_PUBLICACIONES,
} from './lib/supabaseClient';
import {
  Sparkles,
  Play,
  Save,
  Clock,
  Mic,
  Film,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  Bookmark,
  Hash,
  ShieldCheck,
  Gauge,
  Copy,
  Check,
  Settings,
  Code2,
  Terminal,
  Sliders,
  Volume2,
  VolumeX,
  Pause,
  RefreshCw,
  FileText,
  Database,
  Layers,
  Search,
  Eye,
  Video,
  ListMusic,
  Calendar,
} from 'lucide-react';

const VOCES_DISPONIBLES = [
  {
    id: 'es-ES-Studio-C',
    nombre: 'es-ES-Studio-C — España (Femenina, Studio Broadcast / Audiolibro)',
    categoria: 'Studio',
    lang: 'es-ES',
    gender: 'female',
  },
  {
    id: 'es-ES-Neural2-F',
    nombre: 'es-ES-Neural2-F — España (Femenina, moderna y dinámica)',
    categoria: 'Neural2',
    lang: 'es-ES',
    gender: 'female',
  },
  {
    id: 'es-ES-Neural2-B',
    nombre: 'es-ES-Neural2-B — España (Masculina, tono formal y divulgativo)',
    categoria: 'Neural2',
    lang: 'es-ES',
    gender: 'male',
  },
  {
    id: 'es-US-Neural2-A',
    nombre: 'es-US-Neural2-A — Neutro / LatAm (Femenina, fresca y clara)',
    categoria: 'Neural2',
    lang: 'es-US',
    gender: 'female',
  },
  {
    id: 'es-US-Neural2-B',
    nombre: 'es-US-Neural2-B — Neutro / LatAm (Masculina, locución comercial)',
    categoria: 'Neural2',
    lang: 'es-US',
    gender: 'male',
  },
];

const CATEGORIAS_YOUTUBE = [
  { id: '27', label: '27 - Educación' },
  { id: '28', label: '28 - Ciencia y Tecnología' },
  { id: '22', label: '22 - Gente y Blogs' },
  { id: '24', label: '24 - Entretenimiento' },
  { id: '26', label: '26 - Guías y Consejos' },
  { id: '25', label: '25 - Noticias y Política' },
];

type ActiveTab = 'dashboard' | 'preview' | 'engine' | 'pillars' | 'deployment';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [configId, setConfigId] = useState<number | null>(null);
  const [promptMaestro, setPromptMaestro] = useState(DEFAULT_CONFIG.prompt_maestro);
  const [palabrasClave, setPalabrasClave] = useState(DEFAULT_CONFIG.palabras_clave_nicho);
  const [categoriaYoutube, setCategoriaYoutube] = useState(DEFAULT_CONFIG.categoria_youtube);
  const [plantillaDescripcion, setPlantillaDescripcion] = useState(DEFAULT_CONFIG.plantilla_descripcion);
  const [voz, setVoz] = useState(DEFAULT_CONFIG.voz_locutor);
  const [formato, setFormato] = useState<'short' | 'horizontal'>(DEFAULT_CONFIG.formato);
  const [frecuencia, setFrecuencia] = useState(DEFAULT_CONFIG.frecuencia);
  const [hora, setHora] = useState(DEFAULT_CONFIG.hora_publicacion);
  const [activo, setActivo] = useState(DEFAULT_CONFIG.activo);

  // Status & Feedback
  const [guardando, setGuardando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(SEED_PUBLICACIONES);
  const [ejecucionesHoy, setEjecucionesHoy] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Modals & Panels
  const [modalGuion, setModalGuion] = useState<Publicacion | null>(null);
  const [modalSettings, setModalSettings] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Settings State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');

  // Audio / Speech simulator state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [duckingActive, setDuckingActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Video preview subtitle tracking
  const [previewSubIndex, setPreviewSubIndex] = useState(0);
  const [previewActivePub, setPreviewActivePub] = useState<Publicacion | null>(SEED_PUBLICACIONES[0] || null);

  useEffect(() => {
    cargarDatos();
    const creds = getSavedCredentials();
    setSupabaseUrlInput(creds.url);
    setSupabaseKeyInput(creds.key);

    // Subscribe to publications changes if supported
    try {
      const canal = supabase
        .channel('feed-publicaciones')
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'publicaciones' }, () => {
          cargarPublicaciones();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(canal);
        stopAudioPreview();
      };
    } catch {
      // ignore channel subscription failure on dummy host
      return () => {
        stopAudioPreview();
      };
    }
  }, []);

  const cargarDatos = async () => {
    try {
      const { data: cfg, error } = await supabase.from('canal_config').select('*').limit(1).maybeSingle();
      if (cfg && !error) {
        const item = cfg as CanalConfig;
        setConfigId(item.id || null);
        setPromptMaestro(item.prompt_maestro || '');
        setPalabrasClave(item.palabras_clave_nicho || '');
        setCategoriaYoutube(item.categoria_youtube || '27');
        setPlantillaDescripcion(item.plantilla_descripcion || '');
        setVoz(item.voz_locutor || 'es-ES-AlvaroNeural');
        setFormato(item.formato || 'short');
        setFrecuencia(item.frecuencia || 'diario');
        setHora(item.hora_publicacion || '07:00');
        setActivo(item.activo ?? true);
      } else {
        // Fallback to local default configuration for seamless design editing
        const localCfg = localDb.getConfig();
        setConfigId(localCfg.id || 1);
        setPromptMaestro(localCfg.prompt_maestro);
        setPalabrasClave(localCfg.palabras_clave_nicho);
        setCategoriaYoutube(localCfg.categoria_youtube);
        setPlantillaDescripcion(localCfg.plantilla_descripcion);
        setVoz(localCfg.voz_locutor);
        setFormato(localCfg.formato);
        setFrecuencia(localCfg.frecuencia);
        setHora(localCfg.hora_publicacion);
        setActivo(localCfg.activo);
      }
    } catch (e) {
      console.warn('Conexión con Supabase no disponible (cargando datos locales para edición de diseño):', e);
      const localCfg = localDb.getConfig();
      setConfigId(localCfg.id || 1);
      setPromptMaestro(localCfg.prompt_maestro);
      setPalabrasClave(localCfg.palabras_clave_nicho);
      setCategoriaYoutube(localCfg.categoria_youtube);
      setPlantillaDescripcion(localCfg.plantilla_descripcion);
      setVoz(localCfg.voz_locutor);
      setFormato(localCfg.formato);
      setFrecuencia(localCfg.frecuencia);
      setHora(localCfg.hora_publicacion);
      setActivo(localCfg.activo);
    }
    await cargarPublicaciones();
  };

  const cargarPublicaciones = async () => {
    try {
      const { data: pubs, error } = await supabase
        .from('publicaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (pubs && pubs.length > 0 && !error) {
        const list = pubs as Publicacion[];
        setPublicaciones(list);
        if (list.length > 0 && !previewActivePub) {
          setPreviewActivePub(list[0]);
        }
        const hoy = new Date().toISOString().split('T')[0];
        const countHoy = list.filter((p) => p.created_at?.startsWith(hoy) && p.estado !== 'error').length;
        setEjecucionesHoy(countHoy);
      } else {
        // Fallback to local publications for UI review & design editing
        const fallback = localDb.getPublicaciones();
        setPublicaciones(fallback);
        if (fallback.length > 0 && !previewActivePub) {
          setPreviewActivePub(fallback[0]);
        }
        const hoy = new Date().toISOString().split('T')[0];
        const countHoy = fallback.filter((p) => p.created_at?.startsWith(hoy) && p.estado !== 'error').length;
        setEjecucionesHoy(countHoy);
      }
    } catch (e) {
      console.warn('Error cargando publicaciones remotas (usando datos locales para diseño):', e);
      const fallback = localDb.getPublicaciones();
      setPublicaciones(fallback);
      if (fallback.length > 0 && !previewActivePub) {
        setPreviewActivePub(fallback[0]);
      }
    }
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensajeEstado(null);

    const creds = getSavedCredentials();
    const payload: Partial<CanalConfig> = {
      prompt_maestro: promptMaestro,
      palabras_clave_nicho: palabrasClave,
      categoria_youtube: categoriaYoutube,
      plantilla_descripcion: plantillaDescripcion,
      voz_locutor: voz,
      formato,
      frecuencia,
      hora_publicacion: hora,
      activo,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = configId
        ? await supabase.from('canal_config').update(payload).eq('id', configId)
        : await supabase.from('canal_config').insert([payload]);

      if (!error) {
        setMensajeEstado({
          tipo: 'exito',
          texto: 'Configuración y reglas de SEO actualizadas en la base de datos.',
        });
      } else {
        setMensajeEstado({
          tipo: 'error',
          texto: `Error de conexión con Supabase (${creds.url || 'servidor'}): ${error.message || 'Host ficticio o inalcanzable'}. (Error normal con credenciales dummy)`,
        });
      }
    } catch (err: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: `Error de conexión con Supabase (${creds.url || 'servidor'}): ${err?.message || 'Failed to fetch'}. (Error normal con credenciales dummy)`,
      });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensajeEstado(null), 5000);
    }
  };

  // Trigger manual pipeline (respecting YouTube 10,000 points quota limit)
  const handleDispararPipeline = async () => {
    const creds = getSavedCredentials();
    if (ejecucionesHoy >= 4) {
      setMensajeEstado({
        tipo: 'error',
        texto:
          'Límite de seguridad alcanzado: Máximo 4 generaciones manuales por día para proteger la cuota de YouTube API (10.000 pts/día).',
      });
      return;
    }

    setDisparando(true);
    setMensajeEstado({
      tipo: 'info',
      texto: 'Iniciando pipeline: conectando con Supabase y evaluando anti-duplicados...',
    });

    try {
      // 1. Fetch previous 10 titles for anti-duplication
      const titulosPrevios = publicaciones
        .filter((p) => p.estado === 'completado')
        .slice(0, 10)
        .map((p) => p.titulo);

      // 2. Generate content via Gemini
      const genRes = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptMaestro,
          palabrasClave,
          titulosPrevios,
        }),
      });

      let titulo = 'Episodio Autónomo ' + new Date().toLocaleTimeString();
      let guion = 'Guión generado automáticamente sin duplicación semántica.';
      let tags = ['shorts', 'educacion', 'viral'];
      let descripcion = `Contenido optimizado.\n\n${plantillaDescripcion}`;

      if (genRes.ok) {
        const json = await genRes.json();
        const ia = json.data;
        if (ia) {
          titulo = ia.titulo || titulo;
          guion = ia.guion || guion;
          tags = Array.isArray(ia.tags) ? ia.tags : tags;
          descripcion = `${ia.descripcion || ''}\n\n${plantillaDescripcion}`;
        }
      }

      // 3. Attempt insertion into Supabase (will fail normally if host is dummy)
      const insertRes = await supabase.from('publicaciones').insert([
        {
          titulo,
          descripcion,
          guion,
          tags,
          youtube_id: null,
          youtube_url: null,
          estado: 'procesando',
          error_log: null,
        },
      ]);

      if (insertRes.error) {
        throw new Error(`Fallo al registrar en Supabase (${creds.url}): ${insertRes.error.message || 'Host ficticio inalcanzable'}`);
      }

      // 4. Trigger GitHub Actions workflow
      const ghRes = await fetch('/api/trigger-workflow', { method: 'POST' });
      const ghJson = await ghRes.json();
      if (!ghRes.ok || ghJson.error) {
        throw new Error(ghJson.error || 'Error al despachar el workflow a GitHub Actions.');
      }

      await cargarPublicaciones();

      setMensajeEstado({
        tipo: 'exito',
        texto: 'Pipeline despachado correctamente.',
      });
    } catch (err: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: `Error de conexión: ${err?.message || 'Failed to fetch'}. (Error normal al usar variables dummy)`,
      });
    } finally {
      setDisparando(false);
      setTimeout(() => setMensajeEstado(null), 6000);
    }
  };

  // Direct Script Test with Gemini
  const handleTestGemini = async () => {
    setGenerandoIA(true);
    setMensajeEstado(null);

    const titulosPrevios = publicaciones
      .filter((p) => p.estado === 'completado')
      .slice(0, 10)
      .map((p) => p.titulo);

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptMaestro,
          palabrasClave,
          titulosPrevios,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const ia = json.data;
        const mockPub: Publicacion = {
          id: Date.now(),
          titulo: ia.titulo || 'Borrador Gemini Generado',
          descripcion: `${ia.descripcion || ''}\n\n${plantillaDescripcion}`,
          guion: ia.guion || '',
          tags: Array.isArray(ia.tags) ? ia.tags : ['shorts', 'educacion'],
          youtube_id: null,
          youtube_url: null,
          estado: 'pendiente',
          error_log: null,
          created_at: new Date().toISOString(),
        };
        setModalGuion(mockPub);
        setPreviewActivePub(mockPub);
        setMensajeEstado({
          tipo: 'exito',
          texto: 'Guión generado exitosamente con Gemini sin duplicados de los últimos episodios.',
        });
      } else {
        throw new Error(json.error || 'Error al contactar con Gemini');
      }
    } catch (err: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: 'Fallo al invocar Gemini: ' + (err?.message || 'Verifica la API Key en el servidor'),
      });
    } finally {
      setGenerandoIA(false);
      setTimeout(() => setMensajeEstado(null), 5000);
    }
  };

  // Audio Ducking Simulator (Web Audio API + SpeechSynthesis)
  const toggleAudioDuckingPreview = (text: string) => {
    if (isPlayingAudio) {
      stopAudioPreview();
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Tu navegador no soporta síntesis de voz.');
      return;
    }

    try {
      // Create Web Audio context for simulated background music
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      // Create gentle background ambient drone/music simulator
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime); // Standard music level

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();

      // Configure Speech
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.slice(0, 300));
      utter.rate = 1.05;
      utter.pitch = 1.0;

      // Select voice based on current setting
      const voices = window.speechSynthesis.getVoices();
      const selectedVoiceConfig = VOCES_DISPONIBLES.find((v) => v.id === voz);
      const match = voices.find((v) => v.lang.startsWith('es') || v.lang.includes('ES'));
      if (match) utter.voice = match;

      utter.onstart = () => {
        setIsPlayingAudio(true);
        setDuckingActive(true);
        // Duck the background music down to 12% (-22dB)
        if (gainNode) {
          gainNode.gain.setTargetAtTime(0.012, ctx.currentTime, 0.1);
        }
      };

      utter.onend = () => {
        setDuckingActive(false);
        // Restore music level
        if (gainNode && ctx) {
          gainNode.gain.setTargetAtTime(0.08, ctx.currentTime, 0.2);
        }
        setTimeout(() => stopAudioPreview(), 1200);
      };

      utter.onerror = () => {
        stopAudioPreview();
      };

      synthRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('Audio ducking simulation error:', e);
      setIsPlayingAudio(false);
    }
  };

  const stopAudioPreview = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setIsPlayingAudio(false);
    setDuckingActive(false);
  };

  const copiarTexto = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 2200);
  };

  const handleGuardarSettings = () => {
    updateCustomSupabaseKeys(supabaseUrlInput.trim(), supabaseKeyInput.trim());
    setModalSettings(false);
  };

  const handleRestablecerMocks = () => {
    localStorage.removeItem('autovideo_canal_config');
    localStorage.removeItem('autovideo_publicaciones');
    window.location.reload();
  };

  // Filtered publications
  const pubsFiltradas = publicaciones.filter((p) => {
    const matchesQuery =
      p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.guion.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(busqueda.toLowerCase()));
    const matchesEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
    return matchesQuery && matchesEstado;
  });

  // Calculate quota numbers
  const quotaUsed = ejecucionesHoy * 1600;
  const quotaRemaining = Math.max(0, 10000 - quotaUsed);

  // Subtitle chunks for active preview
  const previewScriptWords = (previewActivePub?.guion || promptMaestro).split(/\s+/);
  const chunkWords = 4;
  const totalSubChunks = Math.ceil(previewScriptWords.length / chunkWords);
  const currentChunkText = previewScriptWords
    .slice(previewSubIndex * chunkWords, (previewSubIndex + 1) * chunkWords)
    .join(' ');

  // Auto-advance preview subtitles every 1.5 seconds if audio is playing
  useEffect(() => {
    if (!isPlayingAudio) return;
    const interval = setInterval(() => {
      setPreviewSubIndex((prev) => (prev + 1) % Math.max(1, totalSubChunks));
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlayingAudio, totalSubChunks]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      {/* ===================================================================== */}
      {/* 1. TOP BAR CONTRACT: Brand — 4-5 Navigation Links — Primary Actions   */}
      {/* ===================================================================== */}
      <header className="border-b border-slate-800/90 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Zone 1: Single text wordmark in display face */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white font-sans">
              AutoVideo Studio
            </span>
            <span className="text-xs text-slate-500 font-mono tracking-tight hidden md:inline">
              · Coste $0 USD
            </span>
          </div>

          {/* Zone 2: Clean 4-5 navigation links / tabs with hover underlines */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`transition-colors pb-0.5 border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-indigo-400 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Panel de Control
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`transition-colors pb-0.5 border-b-2 ${
                activeTab === 'preview'
                  ? 'border-indigo-400 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Simulador de Video
            </button>
            <button
              onClick={() => setActiveTab('pillars')}
              className={`transition-colors pb-0.5 border-b-2 ${
                activeTab === 'pillars'
                  ? 'border-indigo-400 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              5 Pilares de Blindaje
            </button>
            <button
              onClick={() => setActiveTab('deployment')}
              className={`transition-colors pb-0.5 border-b-2 ${
                activeTab === 'deployment'
                  ? 'border-indigo-400 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Despliegue & Código
            </button>
          </nav>

          {/* Zone 3: 1-2 primary actions + Quota tabular indicator */}
          <div className="flex items-center gap-3">
            {/* YouTube Quota Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/80 text-xs text-slate-400 font-medium">
              <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Cuota Diaria:</span>
              <span className="font-mono tabular-nums text-slate-200 font-semibold">
                {quotaUsed.toLocaleString()} / 10.000 pts
              </span>
              <span className="text-slate-500 font-mono">({ejecucionesHoy}/4)</span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setModalSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
              title="Configuración de Base de Datos y APIs"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Primary Action Button */}
            <button
              onClick={handleDispararPipeline}
              disabled={disparando || ejecucionesHoy >= 4}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              {disparando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white" />
              )}
              <span>{disparando ? 'Despachando...' : 'Generar & Publicar'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-800 px-4 py-2 gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Panel
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'preview' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Simulador
          </button>
          <button
            onClick={() => setActiveTab('pillars')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'pillars' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
            }`}
          >
            5 Pilares
          </button>
          <button
            onClick={() => setActiveTab('deployment')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'deployment' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Despliegue
          </button>
        </div>
      </header>

      {/* Floating Alert Feedback */}
      {mensajeEstado && (
        <div className="max-w-7xl mx-auto px-4 mt-4 transition-all">
          <div
            className={`p-3.5 rounded-lg flex items-center gap-3 text-xs border ${
              mensajeEstado.tipo === 'exito'
                ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800/80'
                : mensajeEstado.tipo === 'error'
                ? 'bg-rose-950/60 text-rose-200 border-rose-800/80'
                : 'bg-indigo-950/60 text-indigo-200 border-indigo-800/80'
            }`}
          >
            {mensajeEstado.tipo === 'exito' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : mensajeEstado.tipo === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-indigo-400" />
            )}
            <span className="font-medium">{mensajeEstado.texto}</span>
          </div>
        </div>
      )}

      {/* Database Connection Notice */}
      {getSavedCredentials().url?.includes('dummy') ? (
        <div className="max-w-7xl mx-auto px-4 mt-3">
          <div className="px-3.5 py-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Modo Sandbox Activo</strong> ({getSavedCredentials().url}): La interfaz está cargada para que edites el diseño y pruebes la simulación. Al pulsar &quot;Guardar&quot; o &quot;Generar&quot;, se mostrará el error de conexión normal.
              </span>
            </div>
            <button
              onClick={() => setModalSettings(true)}
              className="text-amber-300 hover:text-amber-200 underline font-medium shrink-0 ml-3"
            >
              Ajustes de API
            </button>
          </div>
        </div>
      ) : !isSupabaseLive ? (
        <div className="max-w-7xl mx-auto px-4 mt-3">
          <div className="px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Almacenamiento reactivo local activo (Supabase listo para conectar sin reiniciar la app).
              </span>
            </div>
            <button
              onClick={() => setModalSettings(true)}
              className="text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Vincular proyecto Supabase
            </button>
          </div>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* 2. TAB 1: DASHBOARD PRINCIPAL                                         */}
      {/* ===================================================================== */}
      {activeTab === 'dashboard' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Canal Engine Configuration (7 cols) */}
          <section className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    Parámetros del Motor de Contenido
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configuración de síntesis con Gemini 1.5 Pro, locución Google Cloud Text-to-Speech (Studio & Neural2) y metadatos SEO.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={generandoIA}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/70 text-xs font-medium transition-colors"
                >
                  {generandoIA ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{generandoIA ? 'Generando...' : 'Probar Guión con Gemini Pro'}</span>
                </button>
              </div>

              <form onSubmit={handleGuardarConfig} className="space-y-5">
                {/* Prompt Maestro */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Prompt Maestro del Guión
                    </label>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-indigo-400 font-semibold">Gemini 1.5 Pro</span>
                      <span className="text-slate-500 hidden sm:inline">· Modo Pro / Razonamiento Profundo Activo</span>
                    </div>
                  </div>
                  <textarea
                    value={promptMaestro}
                    onChange={(e) => setPromptMaestro(e.target.value)}
                    rows={4}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cada ejecución inyecta los últimos 10 títulos completados en este prompt para prohibir
                    duplicidad conceptual.
                  </p>
                </div>

                {/* Voice & Format Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-indigo-400" />
                        Locutor Neuronal
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400 font-medium">
                        Google Cloud Neural2 / Studio
                      </span>
                    </div>
                    <select
                      value={voz}
                      onChange={(e) => setVoz(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {VOCES_DISPONIBLES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Film className="w-3.5 h-3.5 text-indigo-400" />
                      Relación de Aspecto
                    </label>
                    <select
                      value={formato}
                      onChange={(e) => setFormato(e.target.value as 'short' | 'horizontal')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="short">Vertical 9:16 (YouTube Shorts / Reels)</option>
                      <option value="horizontal">Horizontal 16:9 (Podcast Video Estándar)</option>
                    </select>
                  </div>
                </div>

                {/* SEO & YouTube Metadata */}
                <div className="pt-4 border-t border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      Metadatos y Clasificación Algorítmica (SEO)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">YouTube Data API v3</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1">
                        <Bookmark className="w-3 h-3 text-slate-400" />
                        Categoría YouTube
                      </label>
                      <select
                        value={categoriaYoutube}
                        onChange={(e) => setCategoriaYoutube(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {CATEGORIAS_YOUTUBE.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1">
                        <Hash className="w-3 h-3 text-slate-400" />
                        Palabras Clave Semilla
                      </label>
                      <input
                        type="text"
                        value={palabrasClave}
                        onChange={(e) => setPalabrasClave(e.target.value)}
                        placeholder="ciencia, curiosidades, psicologia"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">
                      Plantilla Fija de Descripción (Llamada a la Acción y Hashtags)
                    </label>
                    <textarea
                      value={plantillaDescripcion}
                      onChange={(e) => setPlantillaDescripcion(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                    />
                  </div>
                </div>

                {/* Scheduling & Save */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="time"
                        value={hora}
                        onChange={(e) => setHora(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200 font-mono"
                      />
                      <span className="text-[11px] text-slate-500 font-mono">UTC</span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) => setActivo(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Cron diario activo en GitHub Actions</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={guardando}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-sm transition-colors"
                  >
                    {guardando ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Configuración</span>
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Right Column: Real-Time Publications Feed (5 cols) */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Historial y Estado de Publicaciones</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Feed sincronizado con Supabase y monitor de cuotas.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {publicaciones.length} registros
              </span>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500 ml-1.5 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por título o tag..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="bg-transparent border-0 text-xs text-slate-200 focus:outline-none w-full"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setFiltroEstado('todos')}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    filtroEstado === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-500'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroEstado('completado')}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    filtroEstado === 'completado' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  Publicados
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {pubsFiltradas.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                  No hay publicaciones que coincidan con el filtro.
                </div>
              ) : (
                pubsFiltradas.map((pub) => (
                  <div
                    key={pub.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">
                        {pub.titulo}
                      </h3>
                      {/* Unboxed Status Label with WCAG AA compliance */}
                      <span
                        className={`text-[11px] font-mono font-medium shrink-0 ${
                          pub.estado === 'completado'
                            ? 'text-emerald-400'
                            : pub.estado === 'procesando'
                            ? 'text-amber-400 animate-pulse'
                            : 'text-rose-400'
                        }`}
                      >
                        {pub.estado === 'completado'
                          ? 'Publicado'
                          : pub.estado === 'procesando'
                          ? 'Renderizando...'
                          : 'Error'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {pub.guion}
                    </p>

                    {/* Unboxed Metadata Line with typographic separators */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{new Date(pub.created_at).toLocaleDateString('es-ES')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{pub.tags?.slice(0, 3).join(', ') || 'educación'}</span>
                      <span aria-hidden="true">·</span>
                      <span>48s</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setModalGuion(pub)}
                          className="text-slate-400 hover:text-indigo-400 font-medium"
                        >
                          Inspeccionar Guión
                        </button>
                        <button
                          onClick={() => {
                            setPreviewActivePub(pub);
                            setActiveTab('preview');
                          }}
                          className="text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Simular</span>
                        </button>
                      </div>

                      {pub.youtube_url ? (
                        <a
                          href={pub.youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          YouTube <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">En proceso</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 3. TAB 2: SIMULADOR DE VIDEO Y RETENCIÓN (FFMPEG & DUCKING AUDIO)     */}
      {/* ===================================================================== */}
      {activeTab === 'preview' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Simulador del Motor de Renderizado FFmpeg & Retención
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Previsualización en tiempo real del gancho inicial (0.0s), subtítulos dinámicos de alto
                contraste y ducking de audio a -22dB.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormato(formato === 'short' ? 'horizontal' : 'short')}
                className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-900 transition-colors"
              >
                Cambiar Formato ({formato === 'short' ? '9:16 Shorts' : '16:9 Landscape'})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Video Canvas Frame */}
            <div className="lg:col-span-6 flex justify-center">
              <div
                className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl transition-all ${
                  formato === 'short'
                    ? 'w-full max-w-[340px] aspect-[9/16]'
                    : 'w-full max-w-[620px] aspect-[16/9]'
                }`}
              >
                {/* Simulated Stock Background with subtle animation */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col justify-between p-6">
                  {/* Geometric backdrop elements for authentic video frame feel */}
                  <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                  <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

                  {/* Top Bar inside Video: Channel & 0.0s Hook indicator */}
                  <div className="relative z-10 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold tracking-tight bg-black/60 px-2 py-0.5 rounded backdrop-blur-md">
                      AutoVideo
                    </span>
                    <span className="font-mono text-[10px] text-amber-300 bg-amber-950/80 border border-amber-700/50 px-2 py-0.5 rounded font-semibold">
                      Gancho 0.0s Activo
                    </span>
                  </div>

                  {/* Center: Dynamic Subtitles with ASS style Arial Black + Yellow text */}
                  <div className="relative z-10 my-auto text-center px-4">
                    <div className="inline-block bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-lg border border-black/80 shadow-2xl">
                      <p className="font-black text-amber-300 text-lg tracking-wide uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {currentChunkText || '¿POR QUÉ TU CEREBRO'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Simulated Ducking Audio Waveform Indicator */}
                  <div className="relative z-10 space-y-2 bg-black/70 backdrop-blur-md p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-300 font-medium truncate max-w-[200px]">
                        {previewActivePub?.titulo || 'Episodio Seleccionado'}
                      </span>
                      <span className={duckingActive ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {duckingActive ? 'Ducking: -22dB' : 'Música: 100%'}
                      </span>
                    </div>

                    {/* Waveform Visualizer */}
                    <div className="flex items-center gap-1 h-5 justify-between">
                      {Array.from({ length: 28 }).map((_, i) => {
                        const height = isPlayingAudio
                          ? duckingActive
                            ? Math.sin(i * 0.8 + previewSubIndex) * 12 + 14
                            : Math.sin(i * 0.4) * 6 + 8
                          : 4;
                        return (
                          <div
                            key={i}
                            className={`w-1 rounded-full transition-all duration-150 ${
                              duckingActive ? 'bg-indigo-400' : 'bg-slate-700'
                            }`}
                            style={{ height: `${height}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Format watermark */}
                <div className="absolute top-2 left-2 z-20 pointer-events-none">
                  <span className="text-[10px] text-slate-400/80 font-mono uppercase bg-black/40 px-1.5 py-0.5 rounded">
                    {formato === 'short' ? '9:16 Shorts' : '16:9 Horizontal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Soundstage & Audio Ducking Controls */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Control del Simulador de Ducking y Locución
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Prueba en tu navegador la atenuación de la pista musical con el sintetizador.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      toggleAudioDuckingPreview(previewActivePub?.guion || promptMaestro)
                    }
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                      isPlayingAudio
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Detener Reproducción</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Reproducir con Audio Ducking</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Subtitle Progress Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Bloque de Subtítulo Activo:</span>
                    <span className="text-slate-300 font-mono tabular-nums">
                      {previewSubIndex + 1} de {Math.max(1, totalSubChunks)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalSubChunks - 1)}
                    value={previewSubIndex}
                    onChange={(e) => setPreviewSubIndex(Number(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Script details */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Guión Completo para Síntesis Neuronal:
                  </label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {previewActivePub?.guion || promptMaestro}
                  </div>
                </div>

                {/* Audio Parameters Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-1">
                    <span className="text-slate-500 text-[11px] block">Atenuación Ducking</span>
                    <span className="font-mono text-slate-200 font-semibold">-22 dB (0.12 vol)</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-1">
                    <span className="text-slate-500 text-[11px] block">Duración Transición</span>
                    <span className="font-mono text-slate-200 font-semibold">2.0 segundos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 4. TAB 3: LOS 5 PILARES DE BLINDAJE DE PRODUCCIÓN ($0.00 COSTE)       */}
      {/* ===================================================================== */}
      {activeTab === 'pillars' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">
              Los 5 Pilares de Blindaje de Producción ($0.00 USD)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Arquitectura que resuelve de forma autónoma las 5 fallas críticas de los generadores
              automatizados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Pilar 1 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">1. Fatiga Visual</span>
                <Film className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Selección aleatoria de clips stock en <code className="text-indigo-300 font-mono">backgrounds/*.mp4</code>.
                Evita que la audiencia asocie el canal a una sola plantilla aburrida.
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                FFmpeg loop stream + ultra-fast preset
              </div>
            </div>

            {/* Pilar 2 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">2. Vacío Auditivo & Ducking</span>
                <Volume2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Google Cloud Text-to-Speech (Studio & Neural2 a speaking_rate: 1.05) con filtro FFmpeg <code className="text-emerald-300 font-mono">amix + volume=0.12</code>. La música de fondo se atenúa a -22dB al entrar la locución.
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                Google Cloud TTS + Ducking dinámico
              </div>
            </div>

            {/* Pilar 3 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">3. Temáticas Redundantes</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Razonamiento profundo con Gemini 1.5 Pro. Inyección activa de los últimos 10 títulos completados en Supabase como lista de exclusión obligatoria para garantizar originalidad absoluta y alto CTR.
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                Gemini 1.5 Pro · Anti-duplicados semánticos
              </div>
            </div>

            {/* Pilar 4 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">4. Cuota YouTube API (10k pts)</span>
                <Gauge className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cada subida de video consume 1.600 unidades. El limitador bloquea la 5ª generación diaria
                para blindar el límite gratuito de Google Cloud sin coste.
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                Máximo 4 manuales + 1 cron
              </div>
            </div>

            {/* Pilar 5 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">5. Retención Inicial (0.0s)</span>
                <Video className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gancho visual asegurado desde el fotograma 0.0s sin pantallas en negro. Subtítulos gruesos en
                bloques de 4 palabras sincronizados con faster-whisper.
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                Fuente Arial Black + MargenV=160
              </div>
            </div>

            {/* Ecosistema Google Cloud */}
            <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-200">Pila Oficial Google Cloud</span>
                <span className="text-xs font-mono font-bold text-emerald-400">Pro Ready</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Gemini 1.5 Pro + Google Cloud TTS (Studio & Neural2) + Supabase + FFmpeg Ducking + YouTube Data API v3 en GitHub Actions.
              </p>
              <div className="pt-2 border-t border-indigo-800/40 text-[11px] text-indigo-300 font-mono">
                Google Cloud Platform nativo
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 5. TAB 4: DESPLIEGUE, WORKFLOWS Y CÓDIGO FUENTE                       */}
      {/* ===================================================================== */}
      {activeTab === 'deployment' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Centro de Despliegue & Código Fuente Autónomo
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Copia los scripts y esquemas listos para desplegar en Supabase, GitHub Actions y Google Cloud Platform.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Steps Guide (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Guía de Puesta en Marcha (Paso a Paso)
                </h2>

                <ol className="space-y-4 text-xs text-slate-300">
                  <li className="space-y-1">
                    <span className="font-semibold text-white">1. Crear Proyecto Supabase</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Copia el script SQL del panel derecho y pégalo en el SQL Editor de Supabase para instanciar
                      las tablas y políticas RLS.
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold text-white">2. Google Cloud Platform (APIs & OAuth)</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      En Google Cloud Console activa <strong>YouTube Data API v3</strong> y <strong>Cloud Text-to-Speech API</strong>. Crea una credencial OAuth (Desktop App), pásala a Producción y ejecuta el script <code className="font-mono text-indigo-300">auth_token.py</code> una vez.
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold text-white">3. Repositorio en GitHub</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Sube los archivos a un repo de GitHub con las carpetas <code className="font-mono text-slate-400">backgrounds/vertical</code> y <code className="font-mono text-slate-400">audio_tracks/</code>.
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold text-white">4. GitHub Secrets</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Agrega: <code className="font-mono text-slate-300">GEMINI_API_KEY</code>,{' '}
                      <code className="font-mono text-slate-300">SUPABASE_URL</code>,{' '}
                      <code className="font-mono text-slate-300">SUPABASE_KEY</code>,{' '}
                      <code className="font-mono text-slate-300">YOUTUBE_CLIENT_SECRET_JSON</code>, y{' '}
                      <code className="font-mono text-slate-300">YOUTUBE_REFRESH_TOKEN</code>.
                    </p>
                  </li>
                </ol>
              </div>
            </div>

            {/* Code Vault (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* File 1: Supabase SQL */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-white font-mono">
                      automation/supabase_schema.sql
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      copiarTexto(
                        `CREATE TABLE IF NOT EXISTS canal_config (\n    id SERIAL PRIMARY KEY,\n    prompt_maestro TEXT NOT NULL,\n    palabras_clave_nicho TEXT DEFAULT 'finanzas, productividad, tecnologia, ciencia',\n    categoria_youtube VARCHAR(10) DEFAULT '27',\n    plantilla_descripcion TEXT DEFAULT '💡 Suscríbete para contenido nuevo a diario.\\n\\n#Shorts #Aprender #Tips',\n    voz_locutor VARCHAR(50) DEFAULT 'es-ES-Studio-C',\n    formato VARCHAR(20) DEFAULT 'short',\n    frecuencia VARCHAR(30) DEFAULT 'diario',\n    hora_publicacion VARCHAR(10) DEFAULT '07:00',\n    activo BOOLEAN DEFAULT true,\n    limite_diario_manual INT DEFAULT 3,\n    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS publicaciones (\n    id BIGSERIAL PRIMARY KEY,\n    titulo TEXT NOT NULL,\n    descripcion TEXT,\n    guion TEXT NOT NULL,\n    tags TEXT[],\n    youtube_id VARCHAR(50),\n    youtube_url TEXT,\n    estado VARCHAR(30) DEFAULT 'pendiente',\n    error_log TEXT,\n    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL\n);`,
                        'sql'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    {copiado === 'sql' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiado === 'sql' ? 'Copiado' : 'Copiar DDL'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-400 max-h-24 overflow-y-auto">
                  -- Esquema listo para ejecutar en Supabase SQL Editor
                  <br />
                  CREATE TABLE IF NOT EXISTS canal_config (...);
                  <br />
                  CREATE TABLE IF NOT EXISTS publicaciones (...);
                </div>
              </div>

              {/* File 2: GitHub Actions daily.yml */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-white font-mono">
                      .github/workflows/daily.yml
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      copiarTexto(
                        `name: Video Automation Engine\non:\n  schedule:\n    - cron: '0 7 * * *'\n  workflow_dispatch:\n  repository_dispatch:\n    types: [generar_video_manual]\n\njobs:\n  build-and-publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: sudo apt-get update && sudo apt-get install -y ffmpeg\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.11'\n      - run: pip install -r requirements.txt\n      - run: python main.py`,
                        'actions'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    {copiado === 'actions' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiado === 'actions' ? 'Copiado' : 'Copiar YAML'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-400 max-h-24 overflow-y-auto">
                  cron: '0 7 * * *' # Ejecución diaria 07:00 UTC
                  <br />
                  repository_dispatch: [generar_video_manual]
                </div>
              </div>

              {/* File 3: requirements.txt */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-white font-mono">requirements.txt</span>
                  </div>
                  <button
                    onClick={() =>
                      copiarTexto(
                        `google-generativeai>=0.8.0\ngoogle-cloud-texttospeech>=2.16.0\nfaster-whisper>=1.0.0\ngoogle-api-python-client>=2.100.0\ngoogle-auth-oauthlib>=1.2.0\ngoogle-auth-httplib2>=0.2.0\nsupabase>=2.3.0`,
                        'reqs'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    {copiado === 'reqs' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiado === 'reqs' ? 'Copiado' : 'Copiar Reqs'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-400">
                  google-generativeai, google-cloud-texttospeech, faster-whisper, supabase...
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: INSPECCIONAR GUIÓN COMPLETO                                 */}
      {/* ===================================================================== */}
      {modalGuion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-xs text-white line-clamp-1">{modalGuion.titulo}</h3>
              <button
                onClick={() => setModalGuion(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cerrar (ESC)
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg max-h-72 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans border border-slate-800/80">
              {modalGuion.guion}
            </div>

            {/* Tags line */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono flex-wrap">
              <Tag className="w-3 h-3 text-slate-500" />
              {modalGuion.tags?.map((t, idx) => (
                <span key={idx} className="text-slate-400">
                  #{t}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-slate-500 font-mono">
                {modalGuion.guion.split(/\s+/).length} palabras · ~48 seg
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAudioDuckingPreview(modalGuion.guion)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-md text-slate-200"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Escuchar con Ducking</span>
                </button>
                <button
                  onClick={() => copiarTexto(modalGuion.guion, 'modal_guion')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs rounded-md text-white font-medium"
                >
                  {copiado === 'modal_guion' ? (
                    <Check className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiado === 'modal_guion' ? 'Copiado' : 'Copiar Guión'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. MODAL: AJUSTES & SUPABASE CREDENTIALS                              */}
      {/* ===================================================================== */}
      {modalSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-xs text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <span>Configuración de Base de Datos & API</span>
              </h3>
              <button
                onClick={() => setModalSettings(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Conecta tu proyecto de Supabase para sincronizar el dashboard con los workers de GitHub Actions
                en tiempo real. Con valores dummy podrás inspeccionar y editar todo el diseño; al pulsar Guardar o Generar se reportará el error de red habitual.
              </p>

              {/* Mode indicator */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
                <span className="text-slate-400">Estado actual:</span>
                <span className="font-mono font-medium text-amber-400">
                  {getSavedCredentials().url?.includes('dummy')
                    ? 'Sandbox Dummy (https://dummy.supabase.co)'
                    : isSupabaseLive
                    ? 'Supabase Conectado'
                    : 'Modo Local Reactivo (Offline)'}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseUrlInput('https://dummy.supabase.co');
                    setSupabaseKeyInput('dummy-key-12345');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Rellenar Valores Dummy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseUrlInput('');
                    setSupabaseKeyInput('');
                    updateCustomSupabaseKeys('', '');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Usar Modo Offline (Sin Red)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <button
                onClick={handleRestablecerMocks}
                className="text-slate-500 hover:text-rose-400 text-[11px]"
              >
                Restablecer datos de prueba
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalSettings(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarSettings}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Guardar & Conectar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
