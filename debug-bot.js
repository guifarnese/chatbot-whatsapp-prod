const path = require('path');
const fs = require('fs');

console.log('🔍 === DIAGNÓSTICO DO CHATBOT ===');
console.log('');

// 1. Verificar diretório atual
console.log('📁 Diretório atual:', __dirname);
console.log('');

// 2. Verificar arquivo de mensagem
const messagePath = path.join(__dirname, 'src', 'mensagem.md');
console.log('📄 Caminho da mensagem:', messagePath);
console.log('📄 Arquivo existe?', fs.existsSync(messagePath));

if (fs.existsSync(messagePath)) {
  try {
    const content = fs.readFileSync(messagePath, 'utf8');
    console.log('📏 Tamanho do arquivo:', content.length, 'caracteres');
    console.log('📄 Primeiros 100 caracteres:', content.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Erro ao ler arquivo:', error.message);
  }
} else {
  console.log('❌ Arquivo mensagem.md NÃO ENCONTRADO!');
}

console.log('');

// 3. Verificar dependências
console.log('📦 === VERIFICANDO DEPENDÊNCIAS ===');
try {
  require('whatsapp-web.js');
  console.log('✅ whatsapp-web.js: OK');
} catch (e) {
  console.log('❌ whatsapp-web.js: ERRO -', e.message);
}

try {
  require('express');
  console.log('✅ express: OK');
} catch (e) {
  console.log('❌ express: ERRO -', e.message);
}

try {
  require('qrcode');
  console.log('✅ qrcode: OK');
} catch (e) {
  console.log('❌ qrcode: ERRO -', e.message);
}

console.log('');

// 4. Verificar variáveis de ambiente
console.log('🌍 === VARIÁVEIS DE AMBIENTE ===');
console.log('PORT:', process.env.PORT || 'não definido (usará 3000)');
console.log('DEBOUNCE_MS:', process.env.DEBOUNCE_MS || 'não definido (usará 4000)');
console.log('FETCH_LIMIT:', process.env.FETCH_LIMIT || 'não definido (usará 50)');

console.log('');

// 5. Teste da função de carregamento de mensagem
console.log('🧪 === TESTE DE CARREGAMENTO DE MENSAGEM ===');

function loadDefaultMessage() {
  try {
    const messagePath = path.join(__dirname, 'src', 'mensagem.md');

    if (fs.existsSync(messagePath)) {
      const stats = fs.statSync(messagePath);
      if (!stats.isFile()) {
        throw new Error('mensagem.md não é um arquivo válido');
      }

      const content = fs.readFileSync(messagePath, 'utf8').trim();
      if (!content) {
        throw new Error('Arquivo mensagem.md está vazio');
      }

      console.log('✅ Mensagem carregada com sucesso!');
      console.log('📏 Tamanho:', content.length, 'caracteres');
      return content;
    }

    console.warn('⚠️ Arquivo não encontrado, usando fallback');
    return 'Mensagem de fallback';

  } catch (error) {
    console.error('❌ Erro ao carregar:', error.message);
    return 'Mensagem de erro';
  }
}

const message = loadDefaultMessage();
console.log('');
console.log('🎯 === RESULTADO FINAL ===');
console.log('Mensagem que será enviada:');
console.log('---');
console.log(message.substring(0, 200) + (message.length > 200 ? '...' : ''));
console.log('---');
console.log('');
console.log('🏁 Diagnóstico concluído!');