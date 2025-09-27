#!/bin/bash

echo "🔧 === DIAGNÓSTICO E CORREÇÃO DO WHATSAPP BOT ==="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 Verificando diretório...${NC}"
pwd
echo ""

echo -e "${BLUE}🔍 Parando processos Node.js existentes...${NC}"
pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "node debug-handler.js" 2>/dev/null || true
pkill -f "node simple-test.js" 2>/dev/null || true
sleep 2

echo -e "${BLUE}🧹 Limpando sessões antigas...${NC}"
rm -rf .wwebjs_* 2>/dev/null || true
rm -rf wwebjs_auth* 2>/dev/null || true
rm -rf tmp/* 2>/dev/null || true
mkdir -p tmp

echo -e "${BLUE}📄 Verificando arquivo de mensagem...${NC}"
if [ -f "src/mensagem.md" ]; then
    echo -e "${GREEN}✅ mensagem.md encontrado${NC}"
    echo "📏 Tamanho: $(wc -c < src/mensagem.md) bytes"
else
    echo -e "${RED}❌ mensagem.md não encontrado!${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Verificando dependências...${NC}"
if npm list whatsapp-web.js >/dev/null 2>&1; then
    echo -e "${GREEN}✅ whatsapp-web.js instalado${NC}"
else
    echo -e "${RED}❌ whatsapp-web.js não encontrado${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🧪 === CRIANDO TESTE SIMPLES ===${NC}"

cat > test-minimal.js << 'EOF'
const { Client } = require('whatsapp-web.js');

console.log('🚀 Teste Minimalista - WhatsApp Bot');
console.log('');

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

let messageCount = 0;

client.on('message', async (message) => {
    messageCount++;
    console.log('');
    console.log('🎯 === MENSAGEM RECEBIDA #' + messageCount + ' ===');
    console.log('📱 De:', message.from);
    console.log('📝 Texto:', message.body || '[sem texto]');
    console.log('🤖 É minha mensagem?', message.fromMe ? 'SIM' : 'NÃO');
    console.log('📷 Tem mídia?', message.hasMedia ? 'SIM' : 'NÃO');

    if (!message.fromMe) {
        try {
            console.log('💬 Enviando resposta...');
            await message.reply('🎉 Bot funcionando! Mensagem #' + messageCount + ' processada!');
            console.log('✅ Resposta enviada com sucesso!');
        } catch (error) {
            console.log('❌ Erro ao responder:', error.message);
        }
    }
    console.log('');
});

client.on('qr', (qr) => {
    console.log('📱 QR Code gerado - escaneie com WhatsApp');
});

client.on('ready', () => {
    console.log('');
    console.log('🟢 === BOT PRONTO ===');
    console.log('✅ WhatsApp conectado e funcionando!');
    console.log('📱 Envie uma mensagem para testar...');
    console.log('');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado com sucesso');
});

client.on('auth_failure', (msg) => {
    console.log('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Desconectado:', reason);
});

console.log('🔌 Inicializando cliente WhatsApp...');
client.initialize();
EOF

echo -e "${GREEN}✅ Arquivo de teste criado: test-minimal.js${NC}"
echo ""

echo -e "${YELLOW}🚀 === EXECUTANDO TESTE ===${NC}"
echo -e "${BLUE}Pressione Ctrl+C para parar o teste${NC}"
echo ""

node test-minimal.js