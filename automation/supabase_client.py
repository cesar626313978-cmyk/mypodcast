import os
from supabase import create_client, Client

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Variables SUPABASE_URL o SUPABASE_KEY ausentes.")
    return create_client(url, key)

def obtener_configuracion_y_contexto():
    """Lee la configuración activa y los últimos 10 títulos para anti-repetición."""
    client = get_supabase()
    
    # 1. Configuración activa
    res_cfg = client.table("canal_config").select("*").eq("activo", True).order("id", desc=True).limit(1).execute()
    if not res_cfg.data:
        raise RuntimeError("No hay configuraciones activas en canal_config.")
    config = res_cfg.data[0]

    # 2. Últimos 10 títulos publicados para evitar redundancia
    res_pub = client.table("publicaciones").select("titulo").eq("estado", "completado").order("created_at", desc=True).limit(10).execute()
    titulos_previos = [p["titulo"] for p in res_pub.data if p.get("titulo")]

    return config, titulos_previos

def registrar_inicio_publicacion(titulo: str, descripcion: str, guion: str, tags: list) -> int:
    client = get_supabase()
    payload = {
        "titulo": titulo,
        "descripcion": descripcion,
        "guion": guion,
        "tags": tags,
        "estado": "procesando"
    }
    res = client.table("publicaciones").insert(payload).execute()
    return res.data[0]["id"]

def actualizar_publicacion_exito(pub_id: int, youtube_id: str):
    client = get_supabase()
    client.table("publicaciones").update({
        "youtube_id": youtube_id,
        "youtube_url": f"https://youtube.com/watch?v={youtube_id}",
        "estado": "completado"
    }).eq("id", pub_id).execute()

def registrar_error_publicacion(pub_id: int, error_msg: str):
    client = get_supabase()
    client.table("publicaciones").update({
        "estado": "error",
        "error_log": str(error_msg)[:1500]
    }).eq("id", pub_id).execute()
