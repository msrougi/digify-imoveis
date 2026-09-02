# Ativação do Digify MontaSite

O código não contém senha, token ou chave privada. Faça a configuração abaixo no projeto **Cloudflare Pages** que publica `imoveis.digify.live`.

## 1. Gere a senha nova e os segredos

Na raiz do repositório, execute:

```bash
npm run montasite:secrets
```

O comando mostra:

- `NOVA_SENHA_MONTASITE`: guarde no gerenciador de senhas; não a cadastre como variável.
- `MONTASITE_PASSWORD_HASH`: cadastre como secret.
- `MONTASITE_SESSION_SECRET`: cadastre como secret.
- `MONTASITE_OTP_SECRET`: cadastre como secret.

Nunca use novamente uma senha que tenha sido enviada em chat, e-mail ou documento.

## 2. Crie os bindings no Cloudflare

No projeto Pages, abra **Settings > Bindings**.

1. Crie um namespace KV e vincule-o com o nome de variável `MONTASITE_AUTH`.
2. Crie um bucket R2 privado e vincule-o com o nome de variável `MONTASITE_UPLOADS`.

O KV guarda desafios de login, sessões operacionais e jobs por tempo limitado. O R2 guarda os PDFs e as três fotos entregues pelo administrador. Nenhum bucket deve ser público.

## 3. Configure variáveis e secrets

Em **Settings > Variables and Secrets**, configure em Production e Preview:

| Nome | Tipo | Valor |
|---|---|---|
| `MONTASITE_ADMIN_EMAIL` | variável | `marcelo@digify.live` |
| `MONTASITE_PASSWORD_HASH` | secret | saída do gerador |
| `MONTASITE_SESSION_SECRET` | secret | saída do gerador |
| `MONTASITE_OTP_SECRET` | secret | saída do gerador |
| `RESEND_API_KEY` | secret | chave com permissão apenas de envio |
| `MONTASITE_EMAIL_FROM` | variável | `Digify MontaSite <montasite@notify.digify.live>` |

O domínio ou subdomínio usado em `MONTASITE_EMAIL_FROM` precisa estar verificado no Resend.

## 4. Busca de PDFs e dados do Google

Para busca externa de PDFs, configure `SERPER_API_KEY` como secret. O catálogo local continua funcionando quando a busca externa estiver indisponível.

O código aceita `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` somente como compatibilidade para contas antigas do Custom Search JSON API. O Google fechou essa API para novos clientes e anunciou seu encerramento para janeiro de 2027; não a use em uma implantação nova.

Para Google Ads e Search Console:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (secret)
- `GOOGLE_REFRESH_TOKEN` (secret)
- `GOOGLE_ADS_DEVELOPER_TOKEN` (secret)
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (somente se usar conta administradora)
- `SEARCH_CONSOLE_SITE_URL=sc-domain:digify.live`

## 5. Executor automático — o prompt é usado pelo próprio MontaSite

O painel recebe e guarda o projeto, calcula o agendamento e envia o prompt interno automaticamente para o Worker digify-montasite-pipeline. O usuário não precisa copiar nem colar o briefing.

- O Pages já declara o service binding MONTASITE_PIPELINE para esse Worker.

O executor recebe o jobId, referências dos arquivos, payload, data editorial e callbackUrl e envia cada evento real para o callback usando Authorization: Bearer MONTASITE_PIPELINE_SECRET.

Na raiz do repositório, publique o Worker:

    npx wrangler@latest deploy -c workers/montasite-pipeline/wrangler.jsonc

Cadastre o mesmo segredo forte no Worker e no Pages:

    PIPELINE_SECRET_VALUE="$(openssl rand -base64 36)"
    printf '%s' "$PIPELINE_SECRET_VALUE" | npx wrangler@latest secret put MONTASITE_PIPELINE_SECRET -c workers/montasite-pipeline/wrangler.jsonc
    printf '%s' "$PIPELINE_SECRET_VALUE" | npx wrangler@latest pages secret put MONTASITE_PIPELINE_SECRET --project-name digify-imoveis
    unset PIPELINE_SECRET_VALUE

Depois, faça um novo deploy do Pages para aplicar o binding e o roteamento dinâmico:

    npx wrangler@latest pages deploy dist --project-name digify-imoveis

O Worker usa o binding Workers AI (AI) para transformar a instrução e o material em conteúdo estruturado. Se a IA estiver indisponível, aplica uma saída de contingência segura, sem inventar dados, e continua o fluxo — o job não para na tela do prompt.

O executor lê o PDF enviado no R2 (ou o link HTTPS selecionado), cria a página, publica a rota, atualiza o card da Home, deixa a matéria escolhida agendada entre 1 e 4 dias e publica a matéria quando o cron chegar.

Quando o callback recebe article_published, valida a URL HTTPS em imoveis.digify.live e envia a notificação para MONTASITE_ADMIN_EMAIL pelo binding de e-mail já configurado (Resend continua como fallback).

## 6. Teste

Depois de salvar as configurações, faça um novo deploy e acesse:

```text
https://imoveis.digify.live/montasite/login/
```

Checklist:

1. senha correta envia o código;
2. código incorreto mostra tentativas restantes;
3. código correto abre `/montasite/`;
4. bairro + tipologia mostram materiais compatíveis;
5. o botão de criação só libera com uma pauta e três depoimentos completos;
6. as três fotos quadradas são armazenadas no R2;
7. a data da matéria aparece imediatamente;
8. a barra avança apenas ao receber eventos persistidos;
9. o prompt é enviado ao executor sem copiar e colar;
10. a página e o card da Home aparecem quando o job chega à etapa de publicação;
11. sair encerra a sessão.
