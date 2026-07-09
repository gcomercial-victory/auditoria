# Auditoria Diária — Victory Business, Victory Suites e Central de Reservas

App interno para verificação diária dos logbooks/auditoria enviados pela recepção das três
unidades (Victory Business, Victory Suites e Central de Reservas): recebimento, conferência de
checklist e valores, e trilha de auditoria (quem verificou, quando, e se ficou alguma divergência).

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Prisma** + SQLite em desenvolvimento (troque `DATABASE_URL` para Postgres em produção)
- **Auth.js (NextAuth v5)** com login por e-mail/senha e papéis `ADMIN` / `MANAGER`

## Como funciona

- **Painel** (`/`): status do dia (Pendente / Recebido / Verificado / Divergência) para cada uma
  das 3 unidades, com navegação por data.
- **Página da unidade/dia** (`/properties/[slug]/[data]`): checklist configurável (itens
  Sim/Não, número ou texto) que a recepção reporta e o auditor confere item a item, com
  comparação do valor do dia anterior para itens numéricos (ex.: caixa). Permite anexar o
  arquivo original do logbook (PDF/foto/planilha) e marcar o registro como Verificado ou
  Divergência, com notas.
- **Importar do Google Sheets**: cole o link de uma planilha compartilhada ("qualquer pessoa
  com o link pode visualizar"). Formato esperado: uma coluna `Data` e uma coluna por item do
  checklist (mesmo nome do item cadastrado). O app localiza a linha do dia e preenche os
  valores automaticamente.
- **Histórico** (`/history`): lista e filtra registros passados por unidade/status.
- **Checklists** (`/admin/checklists`, apenas ADMIN): adicionar/arquivar itens do checklist por
  unidade.

## Rodando localmente

```bash
npm install
npm run db:seed   # cria as 3 unidades, checklist padrão e o usuário admin
npm run dev
```

Acesse http://localhost:3000. Login inicial definido em `.env` (`ADMIN_EMAIL` /
`ADMIN_PASSWORD`) — **troque a senha após o primeiro acesso** (ainda não há tela de troca de
senha; edite via `npx prisma studio` ou rode o seed novamente com nova senha).

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão do banco (SQLite local por padrão) |
| `AUTH_SECRET` | Segredo do NextAuth (gere um novo em produção: `openssl rand -base64 32`) |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | Usadas apenas pelo `prisma/seed.ts` para criar o admin inicial |

## Deploy em produção

1. Provisione um Postgres (ex. Neon, Supabase, Railway) e aponte `DATABASE_URL` para ele.
2. Rode `npx prisma migrate deploy` no ambiente de produção.
3. Defina `AUTH_SECRET` com um valor novo e forte.
4. Os arquivos anexados (logbooks) são salvos em `./uploads` no servidor e servidos apenas para
   usuários autenticados via `/api/files/[nome]`. Em hospedagens serverless (Vercel) sem disco
   persistente, troque esse armazenamento por um bucket (S3, Supabase Storage etc.) antes de ir
   para produção — o código atual assume um disco local persistente (ex. um droplet, Fly.io,
   Railway).
5. `npm run build && npm start`.

## Limitações conhecidas / próximos passos

- **Importação automática de e-mail**: hoje a importação é manual/sob demanda (o usuário clica
  em "Importar do Google Sheets" ou envia o link do dia). Não há polling automático de caixa de
  entrada de e-mail. Para automatizar, dá para: (a) manter os logbooks numa planilha do Google
  Sheets atualizada pela recepção e criar uma rotina agendada (cron) que chama a mesma lógica de
  `src/lib/sheetImport.ts` todo dia; ou (b) integrar a Gmail API para ler anexos automaticamente
  — requer credenciais OAuth próprias do Google Cloud, não incluídas aqui.
- Cada unidade tem um checklist fixo por dia (um registro por `unidade + data`). Se a recepção
  precisar reportar mais de um turno por dia, o modelo de dados precisaria evoluir para
  suportar múltiplos registros por dia.
- Não há tela de cadastro/gestão de usuários ainda — crie usuários adicionais rodando um script
  ou via `npx prisma studio`.
