# Hope Sobremesas

Site institucional e catálogo digital da Hope Sobremesas, com frontend em HTML/CSS/JavaScript e backend em Express + Prisma + PostgreSQL para autenticação e sessão do usuário.

## Estrutura do projeto

O projeto foi reorganizado em duas pastas principais:

- `backend/`: API, autenticação, banco de dados e arquivos de configuração.
- `frontend/`: interface do catálogo, layout, assets e scripts do site.

### Backend

- `backend/package.json`: dependências e scripts do servidor.
- `backend/server.js`: inicializa o Express e serve o frontend.
- `backend/src/config`: leitura do `.env` e conexão com Prisma.
- `backend/src/routes`, `backend/src/controllers`, `backend/src/services`, `backend/src/repositories`: fluxo da autenticação.
- `backend/prisma/schema.prisma`: schema do PostgreSQL.
- `backend/prisma/migrations`: migrações aplicadas.

### Frontend

- `frontend/index.html`: página principal do catálogo.
- `frontend/style.css`: estilos, responsividade e apresentação visual.
- `frontend/script.js`: categorias, produtos, carrinho, checkout por WhatsApp e autenticação no cliente.
- `frontend/assets`: imagens dos produtos.
- `frontend/pdfs`: arquivos auxiliares de produtos e imagens.

## Como o sistema funciona

1. O navegador acessa o backend em `http://localhost:3001`.
2. O Express serve os arquivos estáticos do frontend e também expõe a API em `/api/*`.
3. O frontend envia cadastro e login para `/api/auth/register` e `/api/auth/login`.
4. O backend valida os dados, gera o hash da senha com `bcrypt` e grava somente o hash na tabela `users`.
5. Em caso de sucesso, o servidor cria um JWT com validade de 7 dias e o envia no cookie `HttpOnly` chamado `hope_token`.
6. `/api/auth/me` valida esse cookie e retorna os dados públicos do usuário. A senha nunca é retornada.
7. O carrinho existe no navegador durante a sessão. O checkout valida o estoque, grava o pedido em `pedidos` e `pedido_itens` e abre o WhatsApp com o resumo.

## Requisitos

- Node.js 20 ou superior.
- Docker Desktop, caso o PostgreSQL seja executado em container.
- npm instalado junto com o Node.js.

## Configuração do ambiente

Crie o arquivo `.env` dentro da pasta `backend` a partir de `.env.example` (ou conforme a configuração local do projeto). Um exemplo típico é:

```env
DATABASE_URL="postgresql://postgres:senha123@localhost:5432/postgres?schema=public"
JWT_SECRET="um-segredo-aleatorio-com-pelo-menos-32-caracteres"
PORT=3001
NODE_ENV=development
```

- `DATABASE_URL` aponta para o PostgreSQL.
- `PORT` é a porta do backend e da aplicação em produção local.
- `JWT_SECRET` deve ter pelo menos 32 caracteres.
- `GOOGLE_MAPS_API_KEY`, `STORE_LATITUDE` e `STORE_LONGITUDE` habilitam o cálculo de frete. A chave precisa ter as APIs Google Maps Geocoding e Distance Matrix habilitadas e restritas aos serviços necessários. Sem essas configurações, o restante do backend inicia normalmente, mas o endpoint de frete responde como indisponível.

Gere um segredo aleatório com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Nunca publique o `.env`. Ele deve ficar apenas no ambiente local.

## Supabase no cPanel

O Supabase pode ser usado como o PostgreSQL da aplicação enquanto o Node.js continua rodando no cPanel. No Supabase, abra **Connect** e copie a conexão para **Prisma**. Para hospedagens cPanel que usam IPv4, prefira o **Session pooler** (porta `5432`); a conexão direta pode exigir IPv6. Substitua a senha e mantenha a string somente no `.env` do backend.

O projeto já possui Prisma instalado e configurado. Não é necessário executar `npx prisma init` novamente.

Exemplo:

```env
DATABASE_URL="postgresql://postgres.lcxdlpclbtgnnakhkjvj:SENHA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&sslmode=require"
DIRECT_URL="postgresql://postgres.lcxdlpclbtgnnakhkjvj:SENHA@aws-0-us-east-1.pooler.supabase.com:5432/postgres?schema=public&sslmode=require"
JWT_SECRET="um-segredo-aleatorio-com-pelo-menos-32-caracteres"
PORT=3000
NODE_ENV=production
```

`DATABASE_URL` usa o pooler de transação para a aplicação. `DIRECT_URL` usa o pooler de sessão para o Prisma executar migrações.

Se a senha tiver caracteres especiais, faça percent-encoding nela. Não use a string com `[YOUR-PASSWORD]` literalmente: é necessário definir a senha do projeto no Supabase.

### Imagens dos produtos no Supabase Storage

Crie o bucket público `Hope produtos` e use a pasta `Produtos`. O admin converte as imagens selecionadas para JPEG e envia cada arquivo como `Produtos/id<ID>.jpeg` (por exemplo, `Produtos/id2.jpeg`). O campo `produtos.imagem` armazena a posição vertical da imagem como percentual positivo (máximo de `100`), não mais a URL; a API monta a URL pública da imagem usando o ID do produto.

O cadastro e a edição permitem enviar uma nova imagem ou removê-la. O upload usa a chave anon já configurada no admin. Execute [`supabase/storage-policies.sql`](../supabase/storage-policies.sql) no SQL Editor do projeto Supabase para permitir leitura, upload, substituição e remoção somente de objetos no formato `Produtos/id<ID>.jpeg` desse bucket. Isso não autentica o admin: qualquer visitante com acesso ao site pode substituir ou remover essas imagens se conhecer o ID do produto. Produtos já existentes precisam ter suas imagens copiadas para o bucket com o nome correspondente e o campo `imagem` atualizado para um valor de zoom. Antes de publicar mudanças do admin, execute `npm run build` na pasta `admin`; o backend serve os arquivos de `admin/dist`.

### Banco vazio

Depois de criar o `.env` no cPanel, execute na pasta `backend`:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

Isso cria a tabela `users` e a tabela de controle do Prisma no Supabase.

### Migrar dados existentes

Para levar também usuários e demais dados do PostgreSQL antigo, faça um backup com `pg_dump` e restaure no Supabase. Execute no computador onde o banco antigo está acessível:

```bash
pg_dump --no-owner --no-privileges --format=custom --file=hopesobremesas.dump "POSTGRESQL_URL_ANTIGA"
pg_restore --no-owner --no-privileges --clean --if-exists --dbname="DATABASE_URL_DO_SUPABASE" hopesobremesas.dump
```

Depois, confirme a estrutura e os dados:

```bash
npx prisma migrate deploy
npx prisma studio
```

Faça um backup antes da restauração. A senha dos usuários não precisa ser convertida: o projeto já armazena somente hashes `bcrypt`, que continuam válidos no Supabase.

## PostgreSQL no Docker Desktop

O container usado pelo projeto deve ter nome `postgres`, usuário `postgres`, senha definida no ambiente, banco `postgres` e a porta `5432` publicada no Windows.

Verifique o container:

```powershell
docker ps --filter "name=^/postgres$"
docker port postgres
```

O resultado esperado da porta é algo como:

```powershell
0.0.0.0:5432->5432/tcp
```

Se for criar um novo container:

```powershell
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=senha123 -e POSTGRES_DB=postgres -v hopesobremesas-postgres:/var/lib/postgresql postgres
```

Se o container já existir, inicie-o com:

```powershell
docker start postgres
```

Teste o banco:

```powershell
docker exec postgres pg_isready -U postgres -d postgres
docker exec postgres psql -U postgres -d postgres -c '\dt'
docker exec postgres psql -U postgres -d postgres -c 'SELECT id, email, name FROM users;'
```

## Instalar e iniciar

Execute os comandos a partir da pasta `backend`:

```powershell
cd "C:\Users\Otavio Luiz\OneDrive\Desktop\Html\hopesobremesas\backend"
npm install
npm run prisma:generate
npm run prisma:migrate
npm start
```

Abra `http://localhost:3001` no navegador.

Durante o desenvolvimento, o comando abaixo reinicia automaticamente o servidor quando há alterações:

```powershell
npm run dev
```

Para parar o servidor, use `Ctrl+C`. Para parar o banco, use `docker stop postgres`.

## Prisma e banco de dados

```powershell
npm run prisma:generate
npm run prisma:migrate
npx prisma studio
```

- `prisma:generate` atualiza o cliente Prisma.
- `prisma:migrate` aplica as migrações existentes.
- `prisma studio` abre a interface visual, normalmente em `http://localhost:5555`.

O schema possui a tabela `users` com `id`, `email`, `phone`, `name`, `passwordHash`, `address`, `createdAt` e `updatedAt`. A tabela `_prisma_migrations` é criada e mantida pelo Prisma.

## API de autenticação

- `POST /api/auth/register`: cria uma conta. Recebe `email`, `password`, `name`, `phone` e `address`.
- `POST /api/auth/login`: autentica com `email` e `password`.
- `GET /api/auth/me`: retorna o usuário autenticado pelo cookie JWT.
- `POST /api/auth/logout`: remove o cookie de autenticação.

O cookie é `HttpOnly`, portanto o JavaScript do navegador não lê o token diretamente. O middleware `requireAuth` valida o JWT e procura o usuário no PostgreSQL.

## Cálculo de frete

Configure no `.env` do backend as coordenadas fixas da loja e uma chave da Google Maps Distance Matrix API:

```env
GOOGLE_MAPS_API_KEY="sua-chave-restrita-do-google-maps"
STORE_LATITUDE="-23.550520"
STORE_LONGITUDE="-46.633308"
```

O endpoint `POST /api/frete` recebe as coordenadas do cliente ou um endereço textual. Para endereços, o backend usa a Geocoding API para obter as coordenadas e passa essas coordenadas ao serviço de cálculo de rota existente. Entregas acima de 12 km são bloqueadas. O frete custa R$ 10,00 até 3 km e acrescenta R$ 2,50 por quilômetro excedente. Percursos previstos acima de 50 minutos retornam um alerta de trânsito e integridade do produto.

O endpoint `POST /api/pedidos` recebe o nome e telefone do cliente, os IDs/quantidades dos produtos e a modalidade de entrega. O servidor consulta novamente o estoque e os preços na tabela `produtos`, recalcula o frete para entregas e grava os dados do pedido e seus itens antes de responder com sucesso.

Exemplo de payload:

```json
{
  "latitude": -23.561414,
  "longitude": -46.655881
}
```

Também é possível calcular o frete enviando um endereço:

```json
{
  "endereco": "Rua das Palmeiras, 2450 - Vila Nova"
}
```

Exemplo de resposta:

```json
{
  "status": "sucesso",
  "distanciaKm": "4.20",
  "tempoMin": 18,
  "valorFrete": "13.00",
  "mensagem": "Entrega disponível para este endereço."
}
```

## Diagnóstico rápido

### P1001: Can't reach database server

```powershell
docker start postgres
docker port postgres
Test-NetConnection localhost -Port 5432
```

Se `TcpTestSucceeded` for `False`, a porta não está publicada ou está ocupada. O valor correto do banco continua sendo `localhost:5432`; não use `3001` na `DATABASE_URL`.

### Site não abre

Confirme que o backend está em execução e use `http://localhost:3001`. A porta `3001` é a porta da aplicação, não a do PostgreSQL.

### Erro de JWT_SECRET

Confira se `JWT_SECRET` existe no `.env` e possui pelo menos 32 caracteres.

### Conferir processos e portas

```powershell
Get-NetTCPConnection -LocalPort 5432,3001 -State Listen
```

## Scripts npm

- `npm start`: inicia `server.js`.
- `npm run dev`: inicia em modo de desenvolvimento com watch.
- `npm run check`: verifica a sintaxe de `server.js` e `script.js`.
- `npm run prisma:generate`: gera o cliente Prisma.
- `npm run prisma:migrate`: aplica migrações.

## Segurança e versionamento

O `.gitignore` deve excluir `.env`, `node_modules` e arquivos locais de logs. Credenciais, tokens e senhas não devem ser adicionados ao Git. Em produção, use HTTPS, um `JWT_SECRET` exclusivo e um PostgreSQL gerenciado.

## Observação final

O frontend não precisa ser executado como app separado em desenvolvimento, já que o backend serve os arquivos estáticos e expõe a API. Em outras palavras, a aplicação principal roda a partir da pasta `backend`.



Last login: Fri Sep  4 17:47:41 2026
Attempting to create directory /home2/otavi167/perl5
otavi167@hopesobremesas.com.br [~]#