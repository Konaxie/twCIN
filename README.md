# twCIN

![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline--First-5A0FC8)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-blue.svg)

Aplicação web progressiva (PWA) offline-first para gestão interna do setor de TI, controle de equipamentos sob custódia, movimentações, empréstimos e instalações.

## O que o projeto faz

O **twCIN** oferece à equipe de TI um ambiente único para controlar equipamentos sob responsabilidade do setor (**Equipamentos**), registrar saídas e empréstimos para outros setores (**Movimentações**), acompanhar métricas operacionais (**Gráficos**) e executar ações rápidas do dia a dia (**Início**) — sem depender de portal de chamados para usuários finais.

## Por que ele é útil

- **Visão rápida (`Início`):** Busca unificada, atalhos para ações frequentes, lista de equipamentos em manutenção/avaliação e empréstimos em aberto em um só lugar.
- **Gestão de equipamentos (`Equipamentos`):** Distingue itens próprios do TI, estoque e equipamentos recebidos de terceiros/outros setores (com origem, de quem foi recebido, motivo, situação atual e histórico vinculado).
- **Movimentações, histórico e PDFs (`Movimentações`):** Preenchimento automático ou manual de data e hora, seleção pesquisável de setores com opção manual, autocomplete e criação confirmada no catálogo, local de instalação obrigatório, configuração integrada de setores e locais, histórico completo com trilha de logs e exportação em PDF A4.
- **Indicadores visuais (`Gráficos`):** Gráficos para análise rápida da situação do acervo, origem dos equipamentos, linha do tempo dos últimos 14 dias, setores mais atendidos, locais frequentes, itens mais movimentados e atuação dos técnicos.
- **Edição completa e auditoria imutável:** Todos os registros de equipamentos, movimentações, setores, locais e usuários são editáveis e rastreados na tabela `audit_logs` com snapshots JSON antes/depois.
- **PWA offline-first com sincronização:** Instalável em computador e celular (via **Configurações → Aplicativo**, sem pop-ups automáticos), armazena dados em `IndexedDB` (Dexie), enfileira mutações offline com idempotência por `client_uuid` e detecta conflitos por `version`.
- **Segurança por padrão:** Senhas com `scrypt` + `timingSafeEqual`, sessões via cookie JWT `HttpOnly`, revogação imediata de sessões via `token_version`, troca obrigatória de senha no primeiro acesso (configurável por usuário), validação com Zod, `@fastify/helmet` e `@fastify/rate-limit`.
- **Identidade personalizável e temas (`Configurações`):** Gerencie conta pessoal (**Minha Conta**), personalize nome do sistema, nome da organização e logo PNG/JPEG/WebP (**Organização**), escolha entre **Padrão do sistema**, **Claro** ou **Escuro** (**Aparência**) e instale o PWA sob demanda (**Aplicativo**).

## Primeiros passos

### Pré-requisitos

- **Node.js `24.x`** ou superior (utiliza o módulo nativo `node:sqlite`, sem necessidade de compilação C++)
- **npm `10+`**

### Instalação

```bash
git clone https://github.com/WiltonGabriel/twCIN.git
cd twCIN

npm --prefix backend install
npm --prefix frontend install
```

### Configuração (opcional)

Por padrão, o backend armazena o banco SQLite em `backend/data/twcin.db` e gera uma chave local persistente em `backend/data/.jwt_secret`. Para personalizar variáveis de ambiente em implantação, copie o arquivo de exemplo:

```bash
cp backend/.env.example backend/.env
```

### Executando localmente

Inicie simultaneamente a API Fastify (`http://localhost:3333`) e o frontend Vite PWA (`http://localhost:5173`):

```bash
npm run dev
```

No Windows PowerShell (caso a política de execução bloqueie scripts `.ps1`), execute `npm.cmd run dev` ou `node scripts/dev.mjs`.

### Primeiro acesso (Setup inicial)

Ao iniciar com o banco de dados vazio (sem usuários cadastrados), abra `http://localhost:5173` no navegador para criar a primeira conta da equipe de TI e definir o nome da organização na própria tela inicial.

### Testes e build de produção

```bash
# Verificação de tipos do backend
npm --prefix backend run typecheck

# Suite automatizada de testes do backend
npm test

# Build de produção do backend e do frontend PWA
npm run build
```

> **Nota para uso em rede local / celular (PWA):** Navegadores móveis exigem `localhost` ou **HTTPS** para habilitar o Service Worker e a instalação do PWA. Para instalação em celulares da rede, publique o build `frontend/dist` com proxy reverso para `/api` atrás de HTTPS (por exemplo, Caddy ou Nginx). Nesse cenário, defina `TRUST_PROXY` no `backend/.env` (por exemplo, `TRUST_PROXY=127.0.0.1`, o IP do proxy) para que o backend enxergue o IP real de cada cliente; sem isso, o rate limit de login passa a ser compartilhado por todos os usuários. Não habilite `TRUST_PROXY` se o backend recebe conexões diretas, pois o cabeçalho `X-Forwarded-For` poderia ser forjado.

## Estrutura do projeto

```text
twCIN/
├── backend/              # API REST Fastify, schema SQLite, auth, sync e testes
├── frontend/             # React 19 + TypeScript + Tailwind + Vite PWA
├── docs/                 # Documentação complementar
├── scripts/dev.mjs       # Executor local multi-processo
├── CONTRIBUTING.md       # Guia de contribuição
└── LICENSE               # Licença MIT
```

## Onde obter ajuda

- **Referência da API:** [docs/API.md](docs/API.md)
- **Diretrizes de contribuição:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Relato de bugs e melhorias:** Abra uma issue na aba *Issues* do repositório no GitHub.

## Mantenedores e contribuição

Mantido por **Wilton Pereira** e **Thales**.

Contribuições são bem-vindas — consulte [CONTRIBUTING.md](CONTRIBUTING.md) antes de enviar um pull request. Distribuído sob a [Licença MIT](LICENSE).
