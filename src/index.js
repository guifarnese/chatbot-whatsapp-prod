require('dotenv').config();
// Harden against Windows EBUSY unlink during Chrome Crashpad cleanup
process.on('uncaughtException', (err) => {
  const msg = String(err && err.message || err || '');
  if (msg.includes('EBUSY') && msg.includes('CrashpadMetrics-active.pma')) {
    console.warn('Ignorando EBUSY de Crashpad no Windows durante limpeza de sessão. Detalhe:', msg);
    return;
  }
  console.error('Exceção não tratada:', err);
});
process.on('unhandledRejection', (reason) => {
  const msg = String(reason && reason.message || reason || '');
  if (msg.includes('EBUSY') && msg.includes('CrashpadMetrics-active.pma')) {
    console.warn('Ignorando EBUSY de Crashpad no Windows (rejeição não tratada). Detalhe:', msg);
    return;
  }
  console.error('Rejeição não tratada:', reason);
});
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Environment configuration
const PORT = process.env.PORT || 3000;
const CHATWOOT_WEBHOOK_URL = process.env.CHATWOOT_WEBHOOK_URL || '';
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN || '';
const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS || 4000);
const FETCH_LIMIT = Number(process.env.FETCH_LIMIT || 50);

// Create temp directory for QR images
const tempDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Serve pasta tmp para facilitar acesso ao QR
app.use('/tmp', express.static(tempDir));

function resolveBrowserExecutablePath() {
  const fromEnv = process.env.BROWSER_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    // Chrome
    'C://Program Files//Google//Chrome//Application//chrome.exe',
    'C://Program Files (x86)//Google//Chrome//Application//chrome.exe',
    // Edge
    'C://Program Files//Microsoft//Edge//Application//msedge.exe',
    'C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe'
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return undefined;
}

const executablePath = resolveBrowserExecutablePath();
console.log('Inicializando WhatsApp client...', {
  node: process.versions.node,
  chromePath: executablePath || 'bundled-chromium'
});

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'chatbot-whatsapp' }),
  restartOnAuthFail: true,
  takeoverOnConflict: true,
  qrMaxRetries: 5,
  puppeteer: {
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-gpu',
      '--window-size=1280,720'
    ]
  }
});

// Utility: forward to Chatwoot webhook (optional)
async function forwardToChatwootWebhook(payload) {
  if (!CHATWOOT_WEBHOOK_URL) return;
  try {
    await axios.post(
      CHATWOOT_WEBHOOK_URL,
      payload,
      CHATWOOT_TOKEN
        ? { headers: { Authorization: `Bearer ${CHATWOOT_TOKEN}` } }
        : undefined
    );
  } catch (error) {
    console.error('Erro ao encaminhar para Chatwoot webhook:', error?.message);
  }
}

// WhatsApp events
client.on('qr', async (qr) => {
  // Print QR to terminal
  console.log('QR code recebido. Escaneie com o WhatsApp.');
  qrcodeTerminal.generate(qr, { small: true });

  // Save QR as PNG for convenience
  const outPath = path.join(tempDir, 'whatsapp-qr.png');
  try {
    await QRCode.toFile(outPath, qr, { width: 300 });
    console.log(`QR salvo em: ${outPath}`);
    // Save raw QR text for fallback
    fs.writeFileSync(path.join(tempDir, 'latest-qr.txt'), qr, 'utf8');
  } catch (error) {
    console.error('Falha ao salvar QR code:', error?.message);
  }
});

client.on('ready', () => {
  console.log('Cliente WhatsApp pronto.');
});

client.on('loading_screen', (percent, message) => {
  console.log('Carregando WhatsApp Web:', percent, message || '');
});

client.on('change_state', (state) => {
  console.log('Estado do cliente mudou para:', state);
});

client.on('authenticated', () => {
  console.log('Autenticado no WhatsApp.');
});

client.on('auth_failure', (msg) => {
  console.error('Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('Cliente WhatsApp desconectado:', reason);
  // Tenta re-inicializar após breve atraso para reemitir QR ou retomar sessão
  setTimeout(() => {
    try {
      console.log('Tentando reinicializar cliente após desconexão...');
      client.initialize();
    } catch (e) {
      console.error('Falha ao reinicializar cliente:', e?.message || e);
    }
  }, 3000);
});

// Buffer de mensagens por chat para evitar múltiplas respostas consecutivas
// chatId -> { hasMedia: boolean, lastReceivedAtMs: number, timer: Timeout|null }
const chatBuffers = new Map();

function scheduleReply(chatId) {
  const entry = chatBuffers.get(chatId);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(async () => {
    try {
      const buffer = chatBuffers.get(chatId);
      if (!buffer) return;

      const chat = await client.getChatById(chatId);
      if (!chat || chat.isGroup) return; // segurança extra

      // Buscar mensagens recentes para garantir que lemos tudo antes de responder
      const messages = await chat.fetchMessages({ limit: FETCH_LIMIT }).catch(() => []);
      let newestInboundTsMs = buffer.lastReceivedAtMs || 0;
      let inboundHasMedia = false;
      for (const m of messages) {
        if (m && m.fromMe === false) {
          const tsMs = (typeof m.timestamp === 'number' ? m.timestamp * 1000 : 0);
          if (tsMs > newestInboundTsMs) {
            newestInboundTsMs = tsMs;
          }
          if (m.hasMedia === true) inboundHasMedia = true;
        }
      }

      // Se identificamos mensagens mais novas do contato, atualizar buffer e aguardar mais
      if (newestInboundTsMs > (buffer.lastReceivedAtMs || 0)) {
        buffer.lastReceivedAtMs = newestInboundTsMs;
        buffer.hasMedia = buffer.hasMedia || inboundHasMedia;
        chatBuffers.set(chatId, buffer);
        // reagendar para garantir janela de silêncio após as novas mensagens
        return scheduleReply(chatId);
      }

      // Nenhuma mensagem nova pendente: marcar como lido e responder uma vez
      chatBuffers.delete(chatId);
      await chat.sendSeen().catch(() => {});
      if (buffer.hasMedia) {
        await chat.sendMessage(`Seu currículo foi recebido com sucesso! ✅\n\nCaso surjam vagas alinhadas ao seu perfil, nossa equipe entrará em contato.\n\nBoa sorte!  🚀`);
      } else {
        await chat.sendMessage(`Olá!\n\n*Envie seu currículo para participar do processo seletivo!* 📩\n\nAgradecemos o seu interesse! 🤗`);
      }
    } catch (err) {
      console.error('Erro ao enviar resposta agrupada:', err?.message || err);
    }
  }, DEBOUNCE_MS);
}

// Core bot logic com robustez
client.on('message', async (message) => {
  try {
    const from = message.from; // ex.: 5511999999999@c.us
    const isStatus = from?.includes('status@broadcast');
    if (isStatus) return;

    // Ignorar mensagens enviadas por nós mesmos (evita loop)
    if (message.fromMe) return;

    const chat = await message.getChat();
    // Não enviar mensagens em grupos
    if (chat?.isGroup) return;

    const hasMedia = message?.hasMedia === true;
    console.log(`Mensagem recebida de ${from}. hasMedia=${hasMedia}. isGroup=${chat?.isGroup ? 'true' : 'false'}`);

    // Encaminhar (opcional) para Chatwoot webhook
    forwardToChatwootWebhook({
      type: 'incoming_whatsapp_message',
      from,
      hasMedia,
      body: message.body,
      timestamp: Date.now()
    });

    // Atualiza buffer e agenda resposta única por janela de tempo
    const chatId = from;
    const existing = chatBuffers.get(chatId) || { hasMedia: false, lastReceivedAtMs: 0, timer: null };
    existing.hasMedia = existing.hasMedia || hasMedia;
    existing.lastReceivedAtMs = Date.now();
    chatBuffers.set(chatId, existing);
    scheduleReply(chatId);
  } catch (error) {
    console.error('Erro ao processar mensagem:', error?.message);
  }
});

// Minimal Express server for healthcheck and webhooks
// Rota principal - exibe página com QR code
app.get('/', (_req, res) => {
  const pngPath = path.join(tempDir, 'whatsapp-qr.png');
  if (fs.existsSync(pngPath)) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - QR Code</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; }
          .qr-code { margin: 20px 0; }
          .status { color: #28a745; font-weight: bold; }
          .instructions { color: #6c757d; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 WhatsApp Bot</h1>
          <div class="status">✅ Bot online e funcionando!</div>
          <div class="qr-code">
            <h3>Escaneie o QR Code com seu WhatsApp:</h3>
            <img src="/qr" alt="QR Code" style="max-width: 100%; border: 1px solid #ddd; padding: 10px;">
          </div>
          <div class="instructions">
            <p>1. Abra o WhatsApp no seu celular</p>
            <p>2. Vá em Configurações > Aparelhos conectados</p>
            <p>3. Toque em "Conectar um aparelho"</p>
            <p>4. Escaneie o código QR acima</p>
          </div>
          <p><small>A página será atualizada automaticamente a cada 60 segundos</small></p>
        </div>
        <script>
          setTimeout(() => window.location.reload(), 60000);
        </script>
      </body>
      </html>
    `;
    return res.send(html);
  } else {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - Carregando</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; }
          .loading { color: #ffc107; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 WhatsApp Bot</h1>
          <div class="loading">⏳ Carregando... Aguarde o QR Code aparecer</div>
          <p><small>A página será atualizada automaticamente a cada 30 segundos</small></p>
        </div>
        <script>
          setTimeout(() => window.location.reload(), 30000);
        </script>
      </body>
      </html>
    `;
    return res.send(html);
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint simples para expor o QR atual (se existir)
app.get('/qr', (_req, res) => {
  const pngPath = path.join(tempDir, 'whatsapp-qr.png');
  if (fs.existsSync(pngPath)) {
    return res.sendFile(pngPath);
  }
  return res.status(404).json({ error: 'QR ainda não disponível' });
});

app.get('/qr-text', (_req, res) => {
  const txtPath = path.join(tempDir, 'latest-qr.txt');
  if (fs.existsSync(txtPath)) {
    const content = fs.readFileSync(txtPath, 'utf8');
    return res.type('text/plain').send(content);
  }
  return res.status(404).json({ error: 'QR ainda não disponível' });
});

// Generic webhook endpoint to receive events (e.g., Chatwoot -> this app)
app.post('/webhook/chatwoot', async (req, res) => {
  try {
    console.log('Webhook Chatwoot recebido:', req.body?.event || 'payload');
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro no webhook Chatwoot:', error?.message);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor HTTP iniciado na porta ${PORT}`);
});

// Start WhatsApp client
client.initialize().catch((err) => {
  console.error('Falha ao iniciar cliente WhatsApp:', err?.message || err);
  if (err?.stack) console.error(err.stack);
});


