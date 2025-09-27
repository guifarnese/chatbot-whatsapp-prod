require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('🚀 Iniciando teste de handler de mensagens...');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'chatbot-whatsapp' }),
  restartOnAuthFail: true,
  takeoverOnConflict: true,
  qrMaxRetries: 5,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-gpu'
    ]
  }
});

// Listener mais básico possível
client.on('message', (message) => {
  console.log('🎯 MENSAGEM RECEBIDA!');
  console.log('📱 De:', message.from);
  console.log('📝 Conteúdo:', message.body);
  console.log('🤖 É minha?', message.fromMe);
  console.log('📊 Dados completos:', JSON.stringify(message, null, 2));

  // Teste de resposta simples
  if (!message.fromMe) {
    console.log('💬 Tentando responder...');
    message.reply('Teste de resposta automática!')
      .then(() => console.log('✅ Resposta enviada!'))
      .catch(err => console.error('❌ Erro ao responder:', err));
  }
});

client.on('qr', (qr) => {
  console.log('📱 QR Code gerado, escaneie novamente');
});

client.on('ready', () => {
  console.log('✅ Cliente WhatsApp pronto para receber mensagens!');
  console.log('📞 Envie uma mensagem para testar...');
});

client.on('authenticated', () => {
  console.log('🔐 Autenticado no WhatsApp');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ Desconectado:', reason);
});

// Log de todos os eventos para debug
const originalEmit = client.emit;
client.emit = function(event, ...args) {
  if (event !== 'qr' && event !== 'loading_screen') {
    console.log(`🔔 Evento recebido: ${event}`);
  }
  return originalEmit.apply(this, [event, ...args]);
};

console.log('🔌 Inicializando cliente...');
client.initialize();