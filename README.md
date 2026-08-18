# Livro de Desempenho — versão com login individual

Scaffold de migração do protótipo (artefato de chat) para uma aplicação real,
com login por vendedor e sigilo garantido pelo banco de dados (Row Level
Security), não só pela interface.

## Passo a passo

### 1. Criar o projeto no Supabase
1. Crie uma conta gratuita em https://supabase.com e um novo projeto.
2. Vá em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
   Isso cria as tabelas, as regras de acesso (RLS) e já popula os pesos das
   atividades da sua planilha.
3. Em **Project Settings → API**, copie a `Project URL` e a `anon public key`.

### 2. Criar os logins dos vendedores
Em **Authentication → Users → Add user**, crie um usuário por vendedor
(e-mail + senha temporária). O gatilho do banco já cria o `profile`
correspondente automaticamente com papel `vendedor`.

Para promover alguém a gestor, rode no SQL Editor:
```sql
update profiles set role = 'gestor' where full_name = 'Nome da pessoa';
```

### 3. Rodar o projeto localmente
```bash
npm install
cp .env.local.example .env.local   # cole a URL e a anon key do passo 1
npm run dev
```
Acesse http://localhost:3000/login.

### 4. Publicar
O caminho mais simples é a Vercel (gratuita para esse uso):
1. Suba esta pasta para um repositório no GitHub.
2. Em vercel.com, importe o repositório.
3. Configure as mesmas variáveis de `.env.local` nas *Environment Variables*
   do projeto na Vercel.
4. Deploy. Pronto — link único, com login individual.

## O que este scaffold já resolve

- **Login individual real** (`app/login`) — cada vendedor entra com o
  próprio e-mail/senha, criado por você no Supabase, sem cadastro público.
- **Sigilo garantido no banco** (`supabase/schema.sql`, seção RLS) — mesmo
  que alguém tente acessar a API diretamente, o Postgres só devolve os
  lançamentos daquele usuário, a menos que o papel seja `gestor`.
- **Middleware de proteção** (`middleware.ts`) — quem não estiver logado é
  redirecionado para `/login` antes de ver qualquer página.
- **Painel** (`app/(app)/dashboard`) — ranking da equipe, funil de
  conversão e canais de prospecção para o gestor; progresso pessoal e meta
  para o vendedor.
- **Lançamento diário** (`app/(app)/entry`) — gestor escolhe qualquer
  vendedor; vendedor só lança para si mesmo (campo travado).
- **Configurações** (`app/(app)/settings`, só gestor) — editar nome/peso de
  cada atividade, adicionar novas, remover, e definir a meta semanal de
  pontos por vendedor.

Todas as três telas já usam o mesmo visual (ledger/livro-caixa) do
protótipo original, agora consultando o Supabase em vez de armazenamento
local do navegador.

## Detalhes de implementação que valem atenção

- **Meta "padrão"**: a tabela `metas` guarda uma linha por vendedor com
  `week_start = null`, usada como meta contínua enquanto não houver uma
  meta específica por semana. Dá pra evoluir depois para metas por semana
  se precisar.
- **Atividade "removida"**: o botão *Remover* em Configurações não apaga a
  atividade do banco — marca `active = false`. Isso preserva o histórico de
  lançamentos antigos que referenciam aquele `activity_id`.
- **`onConflict` em `entries`**: o upsert do lançamento diário usa a
  constraint única `(user_id, entry_date, activity_id)` já criada no
  schema — não precisa mexer em nada pra isso funcionar.
