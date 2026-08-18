-- ============================================================
-- Livro de Desempenho — schema + Row Level Security
-- Rode isso no SQL Editor do seu projeto Supabase (supabase.com)
-- ============================================================

-- 1) Perfis: liga cada usuário autenticado (auth.users) a um papel
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('gestor','vendedor')),
  created_at timestamptz default now()
);

-- 2) Atividades e pesos (configurável pelo gestor)
create table activities (
  id text primary key,           -- ex: 'ligacoes'
  group_name text not null,      -- ex: 'Prospecção de canais'
  name text not null,
  weight numeric not null default 1,
  active boolean not null default true,
  sort_order int not null default 0
);

-- 3) Metas semanais por vendedor
create table metas (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  week_start date,               -- null = meta padrão, usada quando não há meta específica pra semana
  points_goal numeric not null default 0
);
-- no máximo uma meta padrão (week_start null) e uma meta por semana específica, por usuário
create unique index metas_user_default_idx on metas(user_id) where week_start is null;
create unique index metas_user_week_idx on metas(user_id, week_start) where week_start is not null;

-- 4) Lançamentos diários
create table entries (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  entry_date date not null,
  activity_id text references activities(id) not null,
  quantity numeric not null default 0,
  updated_at timestamptz default now(),
  unique (user_id, entry_date, activity_id)
);

-- ============================================================
-- Row Level Security — a parte que garante o sigilo entre vendedores
-- ============================================================
alter table profiles enable row level security;
alter table activities enable row level security;
alter table metas enable row level security;
alter table entries enable row level security;

-- Função auxiliar: descobre se o usuário logado é gestor
create or replace function is_gestor()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gestor');
$$;

-- profiles: cada um vê o próprio perfil; gestor vê todos
create policy "ver proprio perfil ou tudo se gestor"
  on profiles for select
  using (id = auth.uid() or is_gestor());

-- activities: todo mundo logado pode ler; só gestor pode alterar
create policy "ler atividades" on activities for select using (auth.uid() is not null);
create policy "gestor edita atividades" on activities for all using (is_gestor()) with check (is_gestor());

-- metas: vendedor só vê a própria meta; gestor vê/edita todas
create policy "ver propria meta ou tudo se gestor" on metas for select
  using (user_id = auth.uid() or is_gestor());
create policy "gestor edita metas" on metas for insert with check (is_gestor());
create policy "gestor atualiza metas" on metas for update using (is_gestor());
create policy "gestor apaga metas" on metas for delete using (is_gestor());

-- entries: cada vendedor só lê/escreve os PRÓPRIOS lançamentos; gestor lê/escreve todos
create policy "ver proprios lancamentos ou tudo se gestor" on entries for select
  using (user_id = auth.uid() or is_gestor());
create policy "inserir proprios lancamentos ou gestor" on entries for insert
  with check (user_id = auth.uid() or is_gestor());
create policy "atualizar proprios lancamentos ou gestor" on entries for update
  using (user_id = auth.uid() or is_gestor());
create policy "apagar proprios lancamentos ou gestor" on entries for delete
  using (user_id = auth.uid() or is_gestor());

-- ============================================================
-- Dados iniciais: atividades e pesos (mesmos da planilha)
-- ============================================================
insert into activities (id, group_name, name, weight, sort_order) values
('ligacoes','Prospecção de canais','Ligações',1,1),
('lista_fria','Prospecção de canais','Lista fria (bot / WhatsApp)',0.5,2),
('instagram','Prospecção de canais','Contatos via Instagram (social selling)',2,3),
('networking','Prospecção de canais','Grupo networking e eventos',5,4),
('remarketing','Prospecção de canais','Remarketing',2,5),
('indicacao_parceiros','Prospecção de canais','Indicação parceiros e clientes',15,6),
('leads_inbound','Prospecção de canais','Leads AVA e loja (inbound)',5,7),
('leads_conteudo','Prospecção de canais','Leads conteúdos redes (inbound org.)',12,8),
('outro','Prospecção de canais','Outro (tráfego, PAP...)',5,9),
('pedido_indicacao','Reuniões','Pedidos de indicação',5,10),
('r1','Reuniões','R1',10,11),
('r2','Reuniões','R2',20,12),
('proposta_enc','Reuniões','Proposta encaminhada',10,13),
('proposta_fechada','Reuniões','Proposta fechada / assinada',50,14),
('posicionamento','Desenvolvimento e posicionamento','Posicionamento / nicho',5,15),
('marketing','Desenvolvimento e posicionamento','Ações marketing off/online',5,16),
('treinamentos','Desenvolvimento e posicionamento','Treinamentos / capacitações',8,17),
('eventos','Desenvolvimento e posicionamento','Participações eventos / feiras',8,18),
('presenca_loja','Desenvolvimento e posicionamento','Presença loja',10,19),
('estudo_produto','Desenvolvimento e posicionamento','Estudar UCA / produtos',5,20);

-- ============================================================
-- Gatilho: cria automaticamente um "profile" quando alguém se cadastra
-- (o role/full_name reais você ajusta depois, manualmente ou via tela de admin)
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'vendedor');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
