# =====================================================================
# SCRIPT DE UN SOLO USO: GENERADOR DE REFRESH TOKEN PERMANENTE (COSTE $0)
# Ejecuta este script en tu máquina local con client_secret.json descargado
# de Google Cloud Console (YouTube Data API v3).
# =====================================================================

from google_auth_oauthlib.flow import InstalledAppFlow

def generar_token():
    print("[*] Iniciando flujo OAuth 2.0 para YouTube Upload...")
    flow = InstalledAppFlow.from_client_secrets_file(
        "client_secret.json", 
        scopes=["https://www.googleapis.com/auth/youtube.upload"]
    )
    # Abre el navegador local en el puerto 8080 para conceder permisos a tu canal
    creds = flow.run_local_server(port=8080)
    
    print("\n=======================================================")
    print("✅ REFRESH_TOKEN PERMANENTE OBTENIDO CON ÉXITO:")
    print(creds.refresh_token)
    print("=======================================================\n")
    print("Copia este token en los Secrets de tu repositorio GitHub:")
    print("Nombre del Secret: YOUTUBE_REFRESH_TOKEN")

if __name__ == "__main__":
    generar_token()
