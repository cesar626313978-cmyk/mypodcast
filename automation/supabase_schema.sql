-- =====================================================================
-- AUTOVIDEO STUDIO - ESQUEMA SUPABASE SQL & POLÍTICAS RLS (COSTE $0)
-- Ejecuta este script íntegro en el Editor SQL de Supabase (SQL Editor)
-- =====================================================================

-- 1. Tabla de Configuración Global del Canal
CREATE TABLE IF NOT EXISTS canal_config (
    id SERIAL PRIMARY KEY,
    prompt_maestro TEXT NOT NULL,
    palabras_clave_nicho TEXT DEFAULT 'finanzas, productividad, tecnologia, ciencia',
    categoria_youtube VARCHAR(10) DEFAULT '27', -- 27 = Educación, 28 = Ciencia y Tecnología
    plantilla_descripcion TEXT DEFAULT '💡 Suscríbete para contenido nuevo a diario.\n\n#Shorts #Aprender #Tips',
    voz_locutor VARCHAR(50) DEFAULT 'es-ES-Studio-C',
    formato VARCHAR(20) DEFAULT 'short', -- 'short' (9:16) o 'horizontal' (16:9)
    frecuencia VARCHAR(30) DEFAULT 'diario',
    hora_publicacion VARCHAR(10) DEFAULT '07:00',
    activo BOOLEAN DEFAULT true,
    limite_diario_manual INT DEFAULT 3,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Historial y Estado de Publicaciones
CREATE TABLE IF NOT EXISTS publicaciones (
    id BIGSERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    guion TEXT NOT NULL,
    tags TEXT[],
    youtube_id VARCHAR(50),
    youtube_url TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente', -- 'pendiente', 'procesando', 'completado', 'error'
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Desactivar RLS o conceder acceso total a la Anon Key (ideal para uso personal autónomo)
ALTER TABLE canal_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE publicaciones DISABLE ROW LEVEL SECURITY;

-- Concesión explícita de permisos sobre tablas y secuencias
GRANT ALL ON TABLE canal_config TO anon, authenticated, service_role;
GRANT ALL ON TABLE publicaciones TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Registro Semilla Inicial
INSERT INTO canal_config (
    prompt_maestro,
    palabras_clave_nicho,
    categoria_youtube,
    voz_locutor,
    formato,
    activo
) VALUES (
    'Explica un concepto científico o psicológico contraintuitivo de forma ágil, con un gancho inicial impactante en los primeros 3 segundos y una conclusión memorable. Duración estimada: 45 a 55 segundos.',
    'ciencia, psicologia, sesgos cognitivos, curiosidades',
    '27',
    'es-ES-Studio-C',
    'short',
    true
) ON CONFLICT DO NOTHING;
