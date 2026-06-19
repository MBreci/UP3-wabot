# 🤖 Uptres Legal — Guía de activación del WhatsApp Bot
## De cero a funcionando en ~30 minutos

---

## LO QUE NECESITAS (todo gratis para empezar)

- Una cuenta en **Twilio** (twilio.com) — gratis con número de prueba
- Una cuenta en **Railway** (railway.app) — gratis, despliega el servidor
- Tu **API Key de Anthropic** (console.anthropic.com)

---

## PASO 1 — Subir el código a Railway (servidor)

Railway es donde vive el bot 24/7. Es gratuito para empezar.

1. Ve a **railway.app** y crea una cuenta (puedes entrar con GitHub)
2. Clic en **"New Project" → "Deploy from GitHub repo"**
3. Sube esta carpeta `uptres-whatsapp` a un repositorio de GitHub
   - Ve a github.com → New repository → sube los archivos
4. En Railway selecciona ese repositorio
5. Railway detecta automáticamente que es Node.js y lo despliega

**Agregar las variables de entorno en Railway:**
- Ve a tu proyecto → pestaña **"Variables"**
- Agrega: `ANTHROPIC_API_KEY` = tu key de Anthropic
- Railway asigna el PORT automáticamente

6. Una vez desplegado, Railway te da una URL como:
   `https://uptres-bot-production.up.railway.app`
   **Copia esa URL — la necesitas en el Paso 2.**

---

## PASO 2 — Configurar Twilio con WhatsApp

Twilio es quien conecta tu número de WhatsApp con el servidor.

### Opción A: Sandbox de prueba (inmediato, gratis)
Perfecta para probar antes de activar con tu número real.

1. Ve a **twilio.com** → crea cuenta → verifica tu número
2. En el panel ve a **Messaging → Try it out → Send a WhatsApp message**
3. Sigue las instrucciones para activar el sandbox
   (envías un código desde tu WhatsApp al número de Twilio)
4. En **"Sandbox Settings"**, en el campo:
   **"When a message comes in"** pega:
   ```
   https://TU-URL-DE-RAILWAY.up.railway.app/webhook
   ```
   Método: **HTTP POST**
5. Guarda y ¡ya funciona! Escribe al número del sandbox desde WhatsApp.

### Opción B: Tu número real +57 318 1036508
Para producción real con tu número de Uptres Legal.

1. En Twilio ve a **Messaging → Senders → WhatsApp Senders**
2. Clic en **"Request a new WhatsApp sender"**
3. Ingresa el número +57 318 1036508 y sigue el proceso de verificación
   (Meta/Facebook aprueba en 1-3 días hábiles)
4. Una vez aprobado, configura el webhook igual que en la Opción A

---

## PASO 3 — Conectar con tu Google Calendar

El bot ya tiene el código para agendar en tu calendario. Solo necesitas:

1. Asegurarte de que la cuenta `mbreci@uptreslegal.com` tiene Google Calendar activo
2. El bot usa el mismo acceso que ya configuraste en este proyecto de Claude
   (las credenciales de Google Calendar MCP ya están listas)

---

## RESUMEN DE FLUJO

```
Cliente escribe en WhatsApp
        ↓
Twilio recibe el mensaje
        ↓
Twilio lo envía a Railway (tu servidor)
        ↓
El servidor lo procesa con Claude AI
        ↓
Responde al cliente en WhatsApp
        ↓
Si agenda cita → crea evento en Google Calendar de mbreci@uptreslegal.com
```

---

## COSTOS ESTIMADOS

| Servicio | Costo |
|----------|-------|
| Railway (servidor) | Gratis hasta 500h/mes, luego ~$5 USD/mes |
| Twilio (mensajes WA) | ~$0.005 USD por mensaje (~$2/400 mensajes) |
| Anthropic API (Claude) | ~$0.003 por conversación promedio |
| **Total estimado** | **< $10 USD/mes** para volumen normal |

---

## SOPORTE

Si tienes dudas durante la instalación, escríbele a tu asistente en el
proyecto "Uptres Legal Secretaría" en Claude.ai y te ayudamos paso a paso.
