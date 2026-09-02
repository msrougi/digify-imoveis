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

Para busca externa de PDFs:

- `GOOGLE_SEARCH_API_KEY` (secret)
- `GOOGLE_SEARCH_ENGINE_ID` (variável)

Para Google Ads e Search Console:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (secret)
- `GOOGLE_REFRESH_TOKEN` (secret)
- `GOOGLE_ADS_DEVELOPER_TOKEN` (secret)
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (somente se usar conta administradora)
- `SEARCH_CONSOLE_SITE_URL=sc-domain:digify.live`

## 5. Executor da criação

O painel recebe e guarda o projeto, calcula o agendamento e acompanha eventos reais. Para executar leitura, criação e publicação, vincule o serviço executor:

- `MONTASITE_PIPELINE_WEBHOOK`: URL HTTPS privada do executor.
- `MONTASITE_PIPELINE_SECRET`: segredo compartilhado forte.

O executor recebe o `jobId`, referências dos arquivos, payload, data editorial e `callbackUrl`. Ele deve enviar cada evento real para o callback usando `Authorization: Bearer <MONTASITE_PIPELINE_SECRET>`.

Quando o callback recebe o evento `article_published`, valida que a URL é HTTPS em `imoveis.digify.live`, confirma que responde publicamente e só então envia o e-mail para `MONTASITE_ADMIN_EMAIL`.

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
9. sair encerra a sessão.
