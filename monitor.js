const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configurações
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3000/health';
const CHECK_INTERVAL = 30000; // 30 segundos
const MAX_RETRIES = 3;
const LOG_FILE = path.join(__dirname, 'monitor.log');

// Função para log
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Função para verificar saúde da aplicação
async function checkHealth() {
  try {
    const response = await axios.get(HEALTH_CHECK_URL, { timeout: 10000 });
    if (response.status === 200 && response.data.status === 'ok') {
      log('✅ Health check OK');
      return true;
    } else {
      log('❌ Health check failed - Invalid response');
      return false;
    }
  } catch (error) {
    log(`❌ Health check failed - ${error.message}`);
    return false;
  }
}

// Função para reiniciar aplicação (se necessário)
async function restartApplication() {
  log('🔄 Attempting to restart application...');
  // Em ambiente de produção, o Railway/Render fará o restart automático
  // Este é apenas um placeholder para logs
  process.exit(1); // Força restart do container
}

// Monitor principal
let consecutiveFailures = 0;

async function monitor() {
  const isHealthy = await checkHealth();
  
  if (isHealthy) {
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
    log(`⚠️ Consecutive failures: ${consecutiveFailures}/${MAX_RETRIES}`);
    
    if (consecutiveFailures >= MAX_RETRIES) {
      log('🚨 Max retries reached, attempting restart...');
      await restartApplication();
    }
  }
}

// Iniciar monitoramento
log('🚀 Starting health monitor...');
setInterval(monitor, CHECK_INTERVAL);

// Verificação inicial
monitor();
