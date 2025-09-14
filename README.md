### Chatbot WhatsApp (Node.js)

Projeto simples de chatbot para WhatsApp usando `whatsapp-web.js` (integração via WhatsApp Web) e geração de QR code. Inclui webhook genérico para integração com Chatwoot.

### Requisitos
- Node.js 18+
- WhatsApp no celular (para escanear o QR code)

### Instalação
1. Instale dependências:
   ```bash
   npm install
   ```
2. Configure variáveis de ambiente criando um arquivo `.env` (opcional):
   ```env
   PORT=3000
   CHATWOOT_WEBHOOK_URL=
   CHATWOOT_TOKEN=
   ```

### Execução
- Desenvolvimento (auto-reload):
  ```bash
  npm run dev
  ```
- Produção:
  ```bash
  npm start
  ```

Ao iniciar, o QR code será exibido no console e salvo em `tmp/whatsapp-qr.png`. Escaneie com o WhatsApp no celular para autenticar.

### Lógica do Chatbot
- Ao receber uma mensagem:
  - Se houver arquivo/anexo (`hasMedia === true`): responde com
    "Obrigado por enviar seu currículo. Em breve entraremos em contato."
  - Caso contrário: responde com
    "Olá, pode enviar seu currículo que entraremos em contato em breve;"

### Integração com Chatwoot (opcional)
- Configure `CHATWOOT_WEBHOOK_URL` e `CHATWOOT_TOKEN` no `.env`.
- O bot encaminha os metadados de cada mensagem recebida para o webhook via POST.
- Endpoint para receber eventos do Chatwoot nesta aplicação: `POST /webhook/chatwoot`.

### Estrutura
```
src/
  index.js          # servidor Express, cliente WhatsApp, lógica do bot
tmp/
  whatsapp-qr.png   # QR gerado ao iniciar (criado em runtime)
.env                # variáveis de ambiente (opcional)
```

### Notas de Segurança e Operação
- O login é persistido localmente via `LocalAuth`. Não compartilhe a pasta de sessão.
- Evite rodar em ambientes com restrições de sandbox do Chromium sem os args já incluídos.
- Para atualizar dependências e corrigir vulnerabilidades, use:
  ```bash
  npm run audit:fix
  ```


