import os
import sys
import glob
import json
import random
import subprocess
from datetime import datetime

from google.cloud import texttospeech
from faster_whisper import WhisperModel
import google.generativeai as genai
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from supabase_client import (
    obtener_configuracion_y_contexto,
    registrar_inicio_publicacion,
    actualizar_publicacion_exito,
    registrar_error_publicacion
)

# Configurar Gemini API
genai.configure(api_key=os.environ["GEMINI_API_KEY"])


# =====================================================================
# 1. GENERACIÓN DE GUIÓN + SEO SIN DUPLICADOS (Gemini 1.5 Pro)
# =====================================================================
def redactar_guion_anti_duplicados(prompt_maestro: str, keywords_nicho: str, titulos_previos: list) -> dict:
    print("[*] Contactando a Gemini 1.5 Pro para guión de alto CTR y paquete SEO...")
    model = genai.GenerativeModel("gemini-1.5-pro")
    
    lista_exclusion = "\n".join([f"- {t}" for t in titulos_previos]) if titulos_previos else "Ninguno previo."

    prompt_instruccion = f"""
    Eres un guionista viral y especialista en SEO para YouTube Shorts y Podcasts de alto rendimiento.
    Fecha actual: {datetime.now().strftime('%d/%m/%Y')}.

    DIRECTRIZ GENERAL DEL CANAL:
    {prompt_maestro}

    NICHO Y PALABRAS CLAVE BASE:
    {keywords_nicho}

    CRÍTICO - CONTROL ANTI-REPETICIÓN:
    Queda TERMINANTEMENTE PROHIBIDO hablar de los mismos conceptos o usar títulos parecidos a los últimos episodios:
    {lista_exclusion}

    REGLAS DE RETENCIÓN DE VIDEO:
    - La primera frase (0 a 3 segundos) DEBE ser una pregunta impactante o gancho visual sin saludos tipo "Hola a todos".
    - El texto del guión debe ser 100% locutable (sin acotaciones teatrales, notas ni corchetes).
    - Duración leída aproximada: 45 a 55 segundos (125-155 palabras a ritmo dinámico).

    FORMATO DE RESPUESTA REQUERIDO (JSON ESTRICTO):
    {{
      "titulo": "Título de alto impacto con gancho y keyword (máx 60 caracteres)",
      "descripcion": "Descripción optimizada de 2 párrafos incluyendo call-to-action y hashtags",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
      "guion": "Texto completo y continuo listo para locución."
    }}
    """

    res = model.generate_content(
        prompt_instruccion,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(res.text)


# =====================================================================
# 2. LOCUCIÓN NEURONAL (Google Cloud Text-to-Speech Studio & Neural2)
# =====================================================================
def sintetizar_voz_google_cloud(texto: str, ruta_salida: str, voz_nombre: str = "es-ES-Studio-C"):
    print(f"[*] Sintetizando locución con Google Cloud TTS ({voz_nombre})...")
    client = texttospeech.TextToSpeechClient()

    input_text = texttospeech.SynthesisInput(text=texto)

    # Determinar código de idioma a partir del nombre de voz (ej. es-ES o es-US)
    partes = voz_nombre.split("-")
    codigo_idioma = f"{partes[0]}-{partes[1]}" if len(partes) >= 2 else "es-ES"

    voice = texttospeech.VoiceSelectionParams(
        language_code=codigo_idioma,
        name=voz_nombre
    )

    # Configuración de audio con speaking_rate optimizado a 1.05 para YouTube Shorts
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=1.05,
        pitch=0.0
    )

    response = client.synthesize_speech(
        input=input_text,
        voice=voice,
        audio_config=audio_config
    )

    with open(ruta_salida, "wb") as out:
        out.write(response.audio_content)
    print(f"[+] Audio sintetizado con éxito: {ruta_salida}")


# =====================================================================
# 3. SUBTÍTULOS SINCRONIZADOS DE LECTURA RÁPIDA (Faster-Whisper)
# =====================================================================
def formatear_tiempo_srt(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    seg = int(s % 60)
    ms = int(round((s - int(s)) * 1000))
    return f"{h:02d}:{m:02d}:{seg:02d},{ms:03d}"

def generar_srt_bloques_cortos(ruta_audio: str, ruta_srt: str):
    print("[*] Transcribiendo con faster-whisper (bloques para retención alta)...")
    modelo = WhisperModel("base", device="cpu", compute_type="int8")
    segmentos, _ = modelo.transcribe(ruta_audio, language="es", word_timestamps=True)

    with open(ruta_srt, "w", encoding="utf-8") as f:
        idx = 1
        for seg in segmentos:
            # Dividir en bloques de máximo 4 palabras para lectura instantánea
            palabras = seg.words
            if not palabras:
                continue

            chunk_size = 4
            for i in range(0, len(palabras), chunk_size):
                grupo = palabras[i:i + chunk_size]
                start_str = formatear_tiempo_srt(grupo[0].start)
                end_str = formatear_tiempo_srt(grupo[-1].end)
                texto = " ".join([w.word.strip() for w in grupo])

                f.write(f"{idx}\n{start_str} --> {end_str}\n{texto.upper()}\n\n")
                idx += 1


# =====================================================================
# 4. RENDERIZADO CON DUCKING DE AUDIO Y FONDOS DINÁMICOS (FFmpeg)
# =====================================================================
def seleccionar_recurso_aleatorio(directorio: str, patron: str) -> str:
    archivos = glob.glob(os.path.join(directorio, patron))
    if not archivos:
        raise FileNotFoundError(f"No se encontraron recursos en: {directorio}/{patron}")
    return random.choice(archivos)

def renderizar_video_avanzado(ruta_voz: str, ruta_srt: str, ruta_salida: str, formato: str = "short"):
    print("[*] Ensamblando video con FFmpeg: fondo dinámico + música ducking + subtítulos...")
    
    # 1. Selección aleatoria de fondo y pista musical
    carpeta_fondo = "backgrounds/vertical" if formato == "short" else "backgrounds/horizontal"
    ruta_fondo = seleccionar_recurso_aleatorio(carpeta_fondo, "*.mp4")
    ruta_musica = seleccionar_recurso_aleatorio("audio_tracks", "*.mp3")
    
    print(f"    - Fondo seleccionado: {ruta_fondo}")
    print(f"    - Música de fondo: {ruta_musica}")

    # Escapar ruta SRT para FFmpeg
    srt_escapado = os.path.abspath(ruta_srt).replace("\\", "/").replace(":", "\\:")
    
    # Estilo ASS: Fuente gruesa, centrado y contraste perfecto desde 0.0s
    estilo_sub = (
        f"subtitles='{srt_escapado}':"
        "force_style='FontName=Arial Black,FontSize=20,PrimaryColour=&H0000FFFF&,"
        "OutlineColour=&H00000000&,BorderStyle=3,Outline=2,Alignment=2,MarginV=160'"
    )

    # Audio ducking: la música se atenúa automáticamente a -22dB cuando habla la voz
    filtro_ducking = (
        "[2:a]volume=0.12[musica];"
        "[1:a]volume=1.0[voz];"
        "[voz][musica]amix=inputs=2:duration=first:dropout_transition=2[audio_out]"
    )

    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", ruta_fondo,      # [0] Video
        "-i", ruta_voz,                             # [1] Voz Google Cloud TTS
        "-stream_loop", "-1", "-i", ruta_musica,     # [2] Música fondo
        "-filter_complex", filtro_ducking,
        "-vf", estilo_sub,
        "-map", "0:v:0",
        "-map", "[audio_out]",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        ruta_salida
    ]

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print("[!] Error en FFmpeg:\n", proc.stderr)
        raise RuntimeError("Fallo crítico en FFmpeg durante el renderizado.")
    print(f"[+] Video renderizado correctamente: {ruta_salida}")


# =====================================================================
# 5. SUBIDA CON YOUTUBE DATA API V3 (OAuth 2.0 Permanente)
# =====================================================================
def publicar_en_youtube(ruta_video: str, titulo: str, descripcion: str, tags: list, categoria_id: str, es_short: bool) -> str:
    print("[*] Autenticando con YouTube API v3...")
    client_info = json.loads(os.environ["YOUTUBE_CLIENT_SECRET_JSON"])
    installed = client_info.get("installed", client_info.get("web", {}))

    creds = Credentials(
        None,
        refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=installed["client_id"],
        client_secret=installed["client_secret"],
        scopes=["https://www.googleapis.com/auth/youtube.upload"]
    )
    creds.refresh(Request())
    yt = build("youtube", "v3", credentials=creds)

    titulo_final = f"{titulo} #Shorts" if es_short and "#Shorts" not in titulo else titulo

    body = {
        "snippet": {
            "title": titulo_final[:100],
            "description": descripcion,
            "tags": tags,
            "categoryId": categoria_id,
            "defaultLanguage": "es",
            "defaultAudioLanguage": "es"
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False
        }
    }

    media = MediaFileUpload(ruta_video, mimetype="video/mp4", resumable=True)
    request = yt.videos().insert(part="snippet,status", body=body, media_body=media)

    print("[*] Subiendo video por bloques a YouTube...")
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"    Subiendo: {int(status.progress() * 100)}%")

    yt_id = response.get("id")
    print(f"[+] Video publicado con éxito: https://youtube.com/watch?v={yt_id}")
    return yt_id


# =====================================================================
# PIPELINE ORQUESTADOR
# =====================================================================
def main():
    config, titulos_previos = obtener_configuracion_y_contexto()

    # 1. Generar contenido y SEO con Gemini 1.5 Pro
    data_ia = redactar_guion_anti_duplicados(
        prompt_maestro=config["prompt_maestro"],
        keywords_nicho=config.get("palabras_clave_nicho", ""),
        titulos_previos=titulos_previos
    )

    titulo = data_ia["titulo"]
    guion = data_ia["guion"]
    descripcion_completa = f"{data_ia['descripcion']}\n\n{config.get('plantilla_descripcion', '')}"
    tags = data_ia.get("tags", ["shorts", "educacion"])
    formato = config.get("formato", "short")
    voz = config.get("voz_locutor", "es-ES-Studio-C")
    categoria = config.get("categoria_youtube", "27")

    # 2. Registrar en base de datos
    pub_id = registrar_inicio_publicacion(titulo, descripcion_completa, guion, tags)

    try:
        # 3. Audio con Google Cloud TTS & Subtítulos
        sintetizar_voz_google_cloud(guion, "audio.mp3", voz_nombre=voz)
        generar_srt_bloques_cortos("audio.mp3", "subtitulos.srt")

        # 4. Renderizado con Ducking y Fondo dinámico
        renderizar_video_avanzado("audio.mp3", "subtitulos.srt", "video_final.mp4", formato=formato)

        # 5. Subida a YouTube
        yt_id = publicar_en_youtube(
            ruta_video="video_final.mp4",
            titulo=titulo,
            descripcion=descripcion_completa,
            tags=tags,
            categoria_id=categoria,
            es_short=(formato == "short")
        )

        # 6. Actualizar registro
        actualizar_publicacion_exito(pub_id, yt_id)

    except Exception as e:
        print(f"[!] Excepción en ejecución: {e}")
        registrar_error_publicacion(pub_id, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
