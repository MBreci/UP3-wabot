// ============================================================
//  UPTRES LEGAL — Chatbot WhatsApp (Twilio + Claude AI)
//  index.js — Servidor principal
// ============================================================

const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Historial en memoria (por número de teléfono) ──────────
const sessions = {};

// ── Prompt del sistema ─────────────────────────────────────
const SYSTEM_PROMPT = `Eres la recepcionista virtual de Uptres Legal S.A.S., firma de abogados en Bogotá con más de 15 años de experiencia en asesoría jurídica empresarial.

REGLAS ESTRICTAS — NUNCA las rompas:
- NUNCA reveles información interna de la firma, sus clientes, casos o procesos.
- NUNCA des asesoría jurídica específica ni opiniones legales.
- NUNCA menciones nombres de clientes ni casos activos.
- NO entres en detalles de cómo trabaja la firma internamente.

TU ROL: orientar, informar y conectar al cliente con un asesor.

SOBRE UPTRES LEGAL:
- Firma especializada en asesoría jurídica empresarial con 15+ años de experiencia.
- Equipo de profesionales expertos con apoyo interdisciplinario.
- Sede en Bogotá, D.C., Colombia.
- Contacto: +57 318 1036508 | www.uptreslegal.com

ÁREAS DE PRÁCTICA (puedes confirmar que sí manejamos cualquiera de estas):
Derecho Comercial, Derecho Civil, Derecho Corporativo, Derecho Laboral y Seguridad Social, Derecho Inmobiliario, Responsabilidad Civil, Derecho Marcario y Derechos de Autor, Derecho de Consumo, Derecho de Insolvencia, Cumplimiento SARLAFT/SAGRILAFT/PTEE/Habeas Data, Recuperación de Cartera, Derecho de Seguros, Energía/Medio Ambiente/Créditos de Carbono, Acciones Constitucionales y Protección de Derechos.

PRIMER CONTACTO:
- El Dr. Miguel Breci atiende consultas iniciales (especialista en Derecho Inmobiliario, Comercial y Laboral).
- También conecta al cliente con el especialista adecuado según su necesidad.

TARIFAS:
- Asesorías por hora: $300.000 COP + IVA.
- Casos, consultas o asesorías de mayor alcance: tarifa se acuerda directamente con el abogado asignado.

SIEMPRE ofrece una de estas dos opciones al final de cada respuesta:
1. Agendar una cita de 15 minutos (gratuita, de orientación) — responde con la palabra AGENDAR al final si el cliente quiere esto.
2. Dejar su número para que los llamemos — responde con la palabra CALLBACK al final si el cliente prefiere esto.

FORMATO: Responde en máximo 3 oraciones cortas. Usa WhatsApp formatting: *negrita* para énfasis. Sin listas largas. Cálido y profesional.

Si el cliente pregunta por un tema jurídico específico: confirma que sí lo manejas, menciona que contamos con expertos en esa área, y ofrece la cita o llamada.`;

// ── Horarios disponibles ────────────────────────────────────
function getAvailableSlots() {
  const slots = [];
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  
  for (let d = 1; d <= 7; d++) {
    const date = new Date(bogota);
    date.setDate(bogota.getDate() + d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // sin fines de semana
    
    const hours = [9, 10, 11, 14, 15, 16];
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    
    hours.forEach(h => {
      slots.push({
        label: `${dayNames[dow]} ${date.getDate()} ${monthNames[date.getMonth()]} a las ${h}:00`,
        iso: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0).toISOString(),
        isoEnd: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 15, 0).toISOString()
      });
    });
    
    if (slots.length >= 6) break;
  }
  return slots.slice(0, 6);
}

// ── Agendar en Google Calendar vía Claude + MCP ─────────────
async function createCalendarEvent(name, topic, slotLabel, slotIso, slotIsoEnd) {
  try {
    await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: 'Agenda el evento en Google Calendar exactamente como se indica. No respondas nada más.',
      messages: [{
        role: 'user',
        content: `Crea este evento en Google Calendar:
Título: "Consulta jurídica - ${name}"
Inicio: ${slotIso}
Fin: ${slotIsoEnd}
Zona horaria: America/Bogota
Descripción: Cliente: ${name}. Asunto: ${topic}. Agendado vía WhatsApp bot Uptres Legal.
Color: verde (10)`
      }],
      mcp_servers: [{
        type: 'url',
        url: 'https://calendarmcp.googleapis.com/mcp/v1',
        name: 'google-calendar'
      }]
    });
    return true;
  } catch (e) {
    console.error('Error calendar:', e.message);
    return false;
  }
}

// ── Manejar flujo de conversación ──────────────────────────
async function handleMessage(from, body) {
  if (!sessions[from]) {
    sessions[from] = { state: 'menu', name: '', topic: '', history: [] };
  }
  const session = sessions[from];
  const text = body.trim();
  const lower = text.toLowerCase();

  // ── Flujo: recopilar nombre ────────────────────────────
  if (session.state === 'awaiting_name') {
    session.name = text;
    session.state = 'awaiting_topic';
    return `Mucho gusto, *${session.name}*. ¿Sobre qué tema jurídico necesitas orientación?\n\n_(Ej: contrato, despido, marca, inmueble, deuda...)_`;
  }

  // ── Flujo: recopilar tema ──────────────────────────────
  if (session.state === 'awaiting_topic') {
    session.topic = text;
    session.state = 'awaiting_slot';
    const slots = getAvailableSlots();
    session.slots = slots;
    const slotList = slots.map((s, i) => `${i + 1}️⃣ ${s.label}`).join('\n');
    return `Estos son los espacios disponibles esta semana (15 min c/u):\n\n${slotList}\n\nResponde con el *número* del horario que prefieras.`;
  }

  // ── Flujo: seleccionar horario ─────────────────────────
  if (session.state === 'awaiting_slot') {
    const num = parseInt(text);
    if (num >= 1 && num <= (session.slots?.length || 6)) {
      const slot = session.slots[num - 1];
      session.state = 'confirming';
      session.selectedSlot = slot;
      return `¿Confirmo esta cita?\n\n📅 *${slot.label}*\n👤 Dr. Miguel Breci — Uptres Legal\n⏱ 15 minutos\n\nResponde *SI* para confirmar o *NO* para elegir otro horario.`;
    }
    return `Por favor responde con un número del 1 al ${session.slots?.length || 6} para seleccionar el horario.`;
  }

  // ── Flujo: confirmar cita ──────────────────────────────
  if (session.state === 'confirming') {
    if (/^si$|^sí$|^yes$|^confirmar$|^confirmo$/i.test(lower)) {
      const slot = session.selectedSlot;
      const booked = await createCalendarEvent(session.name, session.topic, slot.label, slot.iso, slot.isoEnd);
      session.state = 'menu';
      return `✅ *¡Cita confirmada, ${session.name}!*\n\n📅 ${slot.label}\n👤 Dr. Miguel Breci · Uptres Legal\n⏱ 15 minutos\n\nTe contactaremos antes de la reunión para confirmarte el enlace. ¡Hasta pronto! ⚖️`;
    }
    if (/^no$|^otro$/i.test(lower)) {
      session.state = 'awaiting_topic';
      return `Sin problema. ¿Cuál es el tema de tu consulta? _(así te asignamos el especialista correcto)_`;
    }
    return `Por favor responde *SI* para confirmar o *NO* para elegir otro horario.`;
  }

  // ── Flujo: dejar teléfono (callback) ──────────────────
  if (session.state === 'awaiting_phone') {
    session.phone = text;
    session.state = 'menu';
    return `Anotado. ✅ Un asesor de Uptres Legal se comunicará contigo al *${text}* a la brevedad.\n\n¿Hay algo más en que podamos ayudarte?`;
  }

  // ── Detectar intención de agendar o callback ───────────
  if (/agendar|cita|reunión|reunion|consulta|hablar|asesor/i.test(lower)) {
    session.state = 'awaiting_name';
    return `Con gusto te agendo una consulta de orientación de *15 minutos* con el Dr. Miguel Breci. Es sin costo y te conectamos con el especialista adecuado.\n\n¿Cuál es tu nombre completo?`;
  }

  if (/llamar|llamen|callback|teléfono|telefono|número|numero|contactar/i.test(lower)) {
    session.state = 'awaiting_phone';
    return `Claro, con gusto te contactamos. ¿A qué número de WhatsApp o celular te podemos llamar?`;
  }

  if (/tarifa|precio|costo|cobran|cuánto|cuanto|honorario/i.test(lower)) {
    return `Nuestras asesorías por hora tienen un valor de *$300.000 COP + IVA*.\n\nPara casos o asesorías de mayor alcance, la tarifa se define directamente con el abogado asignado.\n\n¿Te gustaría agendar una consulta inicial o prefieres que te llamemos?`;
  }

  // ── IA para preguntas libres ────────────────────────────
  session.history.push({ role: 'user', content: text });
  if (session.history.length > 10) session.history = session.history.slice(-10);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: session.history
  });

  const reply = response.content[0]?.text || 'Gracias por contactarnos. ¿Te gustaría agendar una cita o que te llamemos?';
  session.history.push({ role: 'assistant', content: reply });

  // Detectar si la IA sugiere agendar o callback
  if (reply.includes('AGENDAR')) {
    session.state = 'awaiting_name';
    return reply.replace('AGENDAR', '').trim() + '\n\n¿Cuál es tu nombre completo?';
  }
  if (reply.includes('CALLBACK')) {
    session.state = 'awaiting_phone';
    return reply.replace('CALLBACK', '').trim() + '\n\n¿A qué número te llamamos?';
  }

  return reply;
}

// ── Webhook principal de Twilio ────────────────────────────
app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;

  console.log(`[${new Date().toISOString()}] Mensaje de ${from}: ${body}`);

  try {
    const replyText = await handleMessage(from, body);
    const twiml = new MessagingResponse();
    twiml.message(replyText);
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('Error:', err);
    const twiml = new MessagingResponse();
    twiml.message('Disculpa, tuvimos un inconveniente. Por favor escríbenos al +57 318 1036508 o visita www.uptreslegal.com');
    res.type('text/xml').send(twiml.toString());
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/', (req, res) => res.send('Uptres Legal WhatsApp Bot — activo ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Uptres Legal corriendo en puerto ${PORT}`));
