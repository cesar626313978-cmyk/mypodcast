import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini SDK if API key exists
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// =====================================================================
// API 1: Generate Script with Anti-Repetition Guard (Gemini)
// =====================================================================
app.post('/api/generate-script', async (req, res) => {
  try {
    const { promptMaestro, palabrasClave, titulosPrevios = [] } = req.body;

    if (!promptMaestro) {
      return res.status(400).json({ error: 'Falta el prompt maestro.' });
    }

    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no está configurada en las variables de entorno de AI Studio.',
      });
    }

    const listaExclusion =
      titulosPrevios.length > 0
        ? titulosPrevios.map((t: string) => `- ${t}`).join('\n')
        : 'Ninguno previo.';

    const systemPrompt = `
Eres un guionista viral y especialista en SEO para YouTube Shorts y Podcasts de alto rendimiento.
Fecha actual: ${new Date().toLocaleDateString('es-ES')}.

DIRECTRIZ GENERAL DEL CANAL:
${promptMaestro}

NICHO Y PALABRAS CLAVE BASE:
${palabrasClave || 'ciencia, curiosidades, psicología, tecnología'}

CRÍTICO - CONTROL ANTI-REPETICIÓN:
Queda TERMINANTEMENTE PROHIBIDO hablar de los mismos conceptos o usar títulos parecidos a los últimos episodios:
${listaExclusion}

REGLAS DE RETENCIÓN DE VIDEO:
- La primera frase (0 a 3 segundos) DEBE ser una pregunta impactante, afirmación contraintuitiva o gancho visual sin saludos tipo "Hola a todos" ni introducciones lentas.
- El texto del guión debe ser 100% locutable (sin acotaciones teatrales, notas ni corchetes).
- Duración leída aproximada: 45 a 55 segundos (entre 120 y 155 palabras).

FORMATO DE RESPUESTA REQUERIDO (JSON ESTRICTO):
{
  "titulo": "Título de alto impacto con gancho y keyword (máx 60 caracteres)",
  "descripcion": "Descripción optimizada de 2 párrafos incluyendo call-to-action y hashtags",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "guion": "Texto completo y continuo listo para locución.",
  "gancho_inicial": "La frase de los primeros 3 segundos",
  "categoria_sugerida": "27"
}
`;

    let textOutput = '{}';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      });
      textOutput = response.text || '{}';
    } catch (modelErr) {
      console.warn('Fallo con gemini-1.5-pro, intentando con modelo alternativo:', modelErr);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      });
      textOutput = response.text || '{}';
    }
    const parsedData = JSON.parse(textOutput);

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error generating script:', error);
    return res.status(500).json({
      error: error?.message || 'Error al invocar la API de Gemini.',
    });
  }
});

// =====================================================================
// API 2: Trigger GitHub Workflow or Local Worker
// =====================================================================
app.post('/api/trigger-workflow', async (req, res) => {
  const GITHUB_TOKEN = process.env.GH_PAT_TOKEN;
  const REPO_OWNER = process.env.GH_REPO_OWNER;
  const REPO_NAME = process.env.GH_REPO_NAME;

  // If GitHub Actions token is configured, trigger repository_dispatch
  if (GITHUB_TOKEN && REPO_OWNER && REPO_NAME) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'AutoVideoStudio',
          },
          body: JSON.stringify({
            event_type: 'generar_video_manual',
            client_payload: {
              timestamp: new Date().toISOString(),
              source: 'AutoVideo-Studio-UI',
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `Error de GitHub Actions: ${errText}`,
        });
      }

      return res.json({
        success: true,
        mode: 'github_actions',
        message: 'Evento "generar_video_manual" despachado a GitHub Actions.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // If GitHub Actions secrets are not yet filled, trigger simulated generation mode
  return res.json({
    success: true,
    mode: 'simulation',
    message:
      'Modo de previsualización activa. Para producción 100% autónoma, configura GH_PAT_TOKEN en Settings.',
  });
});

// =====================================================================
// API 3: System Health & Configuration Status
// =====================================================================
app.get('/api/system-status', (_req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasGithub = Boolean(
    process.env.GH_PAT_TOKEN &&
      process.env.GH_REPO_OWNER &&
      process.env.GH_REPO_NAME
  );
  const hasSupabase = Boolean(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  );
  const hasYoutube = Boolean(
    process.env.YOUTUBE_CLIENT_SECRET_JSON && process.env.YOUTUBE_REFRESH_TOKEN
  );

  return res.json({
    gemini_ready: hasGemini,
    github_ready: hasGithub,
    supabase_ready: hasSupabase,
    youtube_ready: hasYoutube,
    quota_daily_limit: 10000,
    quota_cost_per_video: 1600,
    cost_usd: '0.00',
  });
});

// =====================================================================
// Vite middleware mounting (SPA)
// =====================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`AutoVideo Studio server listening on port ${PORT}`);
  });
}

startServer();
