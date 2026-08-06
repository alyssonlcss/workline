# Changelog

Todos os recursos notáveis, correções e melhorias neste projeto serão documentados neste arquivo.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [1.3.0] - 2026-08-06

Esta é uma grande atualização ("Mega Release") que renomeia oficialmente o projeto para **WorkLine** e adiciona uma arquitetura robusta de Relatórios em PDF, novos Analisadores de KPI e várias melhorias de Qualidade de Vida (QoL) no Setup.

### Adicionado
- **Dashboard PDF Service:** Um novo e poderoso gerador de relatórios analíticos em PDF baseados em cronogramas (timeline), espelhando com perfeição a visualização da UI Web.
- **Analisadores Modulares de KPI:** Novos módulos de inteligência para relatórios operacionais (ex: *Recurrent Warnings Analyzer*), calculando segmentos de tempo, ociosidades e eficiências com alta precisão.
- **Tema "Semáforo":** Novas paletas de cores intuitivas (verde, amarelo, vermelho) aplicadas aos gráficos de cronograma (timeline) e relatórios de KPIs.
- **Sincronização UI vs PDF:** Cumprimento da regra de ouro do projeto (Paridade Web vs PDF) garantindo que todas as *Red Flags* (excesso de deslocamento, ociosidades, ineficiências) processadas na interface gráfica também constem perfeitamente espelhadas na rotina de exportação dos PDFs.
- **Auto-Run no Setup:** O script `setup.bat` agora pergunta se você deseja rodar a aplicação imediatamente após instalar/atualizar as dependências, e a "Opção 3" foi promovida a um *Hard Reset* (limpando todos os `node_modules` e `package-lock.json`).

### Alterado
- **Nome do Projeto:** Oficialização do nome da aplicação como **WorkLine** em todos os arquivos de UI, PDFs, `package.json` e documentações.
- **Limites Dinâmicos de KPIs:** Migração da configuração dos limites de "Red Flag" para o arquivo dinâmico `polos.json` (antigo `bases.json`), suportando configurações globais e limites customizados por polo específico. A base foi anonimizada por segurança.
- **Retenção de Arquivos (TTL):** O tempo de vida (TTL) do *Garbage Collector* de arquivos temporários de extração foi estendido para **24 horas**, evitando limpezas prematuras de sessões longas.
- **Abertura do Edge:** A incômoda abertura automática do navegador Edge em segundo plano ao rodar `npm run dev` foi removida, simplificando a inicialização do backend para desenvolvedores.
- **Menu do Setup:** Remoção da opção interativa de configuração do Spotfire do menu principal do `setup.bat`. O script agora gerencia as credenciais automaticamente, e chaves de URLs sensíveis (ex: `SPOTFIRE_LOGIN_URL`) foram permanentemente erradicadas do `.env.example`.

## [1.2.0] - 2026-07-29

Esta release introduz a nova **Arquitetura Multi-Usuário em Alta Concorrência (Sem Banco de Dados)** e o módulo de **Credenciais Dinâmicas Spotfire Per-User**.

### Adicionado
- **Credenciais Spotfire no Modal de Filtros (Frontend):** Painel lateral de filtros atualizado com campos compactos para Usuário e Senha do Spotfire em 2 colunas lado a lado, salvamento automático isolado no `localStorage` por usuário e botão com alternador de visibilidade de senha (olhinho 👁️).
- **Fila de Execução Concorrente (`ExtractionQueueManager`):** Orquestrador de requisições concorrentes com limitação configurável de trabalhadores Puppeteer via `p-limit` e feedback ao vivo da posição na fila em tempo real via Server-Sent Events (SSE).
- **Gerenciamento de Sessões em Memória (`SessionService`):** Sistema de sessões de usuário com UUIDs e TTL configurável de 8 horas, integrado com cookies HTTP-only e endpoints de autenticação `/api/auth/*`.
- **Isolamento de Arquivos & Garbage Collection (`TempStorageService` e `FileGarbageCollector`):** Estrutura de diretórios temporários isolados por sessão/job (`src/data/sessions/<sessionId>/<jobId>/`) com serviço automatizado de limpeza de arquivos com mais de 30 minutos.
- **Cache de Extração por Hash SHA-256 (`ExtractionCacheService`):** Mecanismo de cache em memória que identifica consultas idênticas e responde em menos de 100ms sem reabrir instâncias do navegador.

### Alterado
- **Segurança e Validação de Ambiente (`env.ts`):** As variáveis `SPOTFIRE_USERNAME` e `SPOTFIRE_PASSWORD` no `.env` do backend tornaram-se opcionais, permitindo a inicialização limpa do servidor e a autenticação com as credenciais dinâmicas do usuário enviadas pelo modal.
- **Automação do Puppeteer (`PuppeteerSpotfireAutomation`):** O fluxo de login agora prioriza as credenciais dinâmicas passadas na requisição do usuário (`req.userCredentials`), com fallback para `.env`.
- **Fim dos Cancelamentos Globais entre Usuários:** As requisições de extração de múltiplos usuários ocorrem de forma concorrente sem que uma nova extração cancele as automações em andamento de outros usuários.

## [1.1.0] - 2026-07-10

Esta release consolida o novo módulo analítico "Relatório de Despacho", agregando algoritmos de inteligência para detecção avançada de ociosidades operacionais.

### Adicionado
- **Relatório de Despacho (PDF):** Novo modelo de relatório em PDF gerado diretamente pela plataforma para análise avançada dos momentos ociosos e identificação dos top ofensores (Equipes e Horários).
- **Identificação Dinâmica da Ociosidade:** O analisador agora rastreia o real desencadeador da demora e exibe o rótulo preciso na tabela do PDF ("Início Cal.", "Log In", "Lib. Anterior" ou "Fim Intervalo"). O sistema penaliza atrasos na chegada da equipe e cruza o horário oficial do Log In versus o Início do Calendário.
- **Cabeçalhos e Metadados:** O cabeçalho dos relatórios de Despacho ganhou o detalhamento dos dias do filtro original ("Período de Referência"), total da amostra na faixa temporal analisada (Média Sem Ordem (X)), e inclusão do Autor da aplicação.

### Alterado
- **Agrupamento de Ociosidades em Faixas (Time-Bucketing):** Lógica refatorada para a categorização de horários de pico. Substituída a regra estática de tolerância de 30 minutos por uma regra robusta de intersecção/sobreposição (Overlap). Uma ociosidade longa agora cai no período que tiver absorvido no mínimo 51% de seu tempo, ou onde houver o maior tempo absoluto, impedindo casos de evasão de dados.
- **Exibição do Desconto de Intervalos:** A coluna de desconto foi aprimorada para "Int. Período" marcando "Sim" de forma assertiva e a coluna Duração passou a avisar visualmente quando o tempo for modificado ("c/ desc.").

### Corrigido
- **Filtro de Ruído:** Ocorrências "Sem Ordem" com 15 minutos ou menos agora são ignoradas pelas estatísticas para não puxarem a média para baixo com trâmites menores irrelevantes.
- Correção de injeção de dependências das Equipes "Próprias" resolvendo o mapeamento nativo dentro do escopo isolado do analisador.

## [1.0.0] - Lançamento / Atualização Anterior

Bem-vindo às atualizações do **WorkLine**. Focamos em corrigir pendências críticas, acelerar o tempo de extração e simplificar a interface para trazer uma experiência muito mais rápida e intuitiva!

### Corrigido (Bug Fixes)
- **Correção Crítica no Motor de Extração:** Foi corrigido um problema severo de sintaxe no arquivo central do robô (`puppeteer-spotfire-automation.ts`) que estava corrompendo as assinaturas dos métodos e causando falha total na compilação (`build`) do backend. O projeto agora compila perfeitamente.
- **Fim do erro de conexão remota (Porta 9222):** Removemos a necessidade de gerenciar o navegador remotamente. Como a variável `SPOTFIRE_BROWSER_URL` agora é ignorada, o erro clássico *"COULD NOT CONNECT TO THE EXISTING EDGE BROWSER"* não acontecerá mais. O sistema abre a sua própria janela limpa em background (ou visível), eliminando a necessidade de rodar `npm run edge:debug` manualmente.

### Alterado (Performance, Fluxo e Praticidade)
- **Zero Atrasos em Filtros:** O robô não utiliza mais tempos de espera engessados (ex: esperar 5 segundos "cegos" por garantia). Ele agora monitora em tempo real os elementos nativos de carregamento do HTML do Spotfire. Se o dado carrega em 10 milissegundos, o robô avança em 10 milissegundos.
- **Bypass Automático de Login:** Para não perder tempo, a automação sempre verifica ativamente a sessão. Se você já estiver logado, ele pula a tela de autenticação e vai direto para os filtros. Caso a sessão morra no meio da extração (Timeout), ele possui um sistema de *recovery* que reconecta sozinho e continua exatamente de onde parou.
- **Remoção do Filtro de Dia (Extração):** Toda a complexidade de selecionar sliders de dias precisos no momento da extração foi **completamente descartada**, tanto no visual quanto no robô.
- **Maior Agilidade Operacional:** Essa remoção traz uma **praticidade enorme** para o seu dia a dia. Ao invés de afunilar a base bruta na origem (Spotfire), você extrai meses consolidados com 1 clique e faz a seleção fina de datas **diretamente nos Filtros de Relatório** do próprio WorkLine! É mais inteligente analisar a base toda e filtrar localmente no frontend, sem precisar refazer extrações custosas só por causa de um dia a mais.

### Adicionado (Inteligência e UI)
- **Inteligência de Estimativas:** Adicionado um módulo que prevê o peso dos arquivos e o tempo de download antes da extração começar. Ele calcula frações dinâmicas de tempo (ex: entende que se estivermos no dia 7 de Julho, o volume esperado é apenas `~22%` do total de um mês fechado de ~6MB).
- **Upgrade Visual (UI):** O espaço deixado pelos antigos componentes de dia foi otimizado. Os seletores de **Ano** e **Mês** foram nivelados em Grid, recebendo um ajuste milimétrico em seu CSS para possuírem exatamente a **mesma altura e largura**, criando um painel lateral super simétrico, elegante e limpo.

### Como Atualizar e Executar o Projeto (Guia)
Caso você queira distribuir esta atualização para seus amigos ou rodar em outra máquina, o processo é muito simples:
1. **Via Git:** Se a pasta já foi clonada, basta abrir o terminal dentro da pasta raiz do projeto e digitar `git pull`.
2. **Via arquivo ZIP:** Acesse o link oficial do GitHub ([https://github.com/alyssonlcss/workline](https://github.com/alyssonlcss/workline)), clique no botão verde **"Code"** e depois em **"Download ZIP"**. Extraia o conteúdo e cole sobre a sua pasta antiga.
3. **Instalação e Execução Mágica:** Navegue até a pasta raiz do projeto e dê um clique duplo no arquivo **`setup.bat`**. Ele instalará as dependências do front e back, iniciando os dois servidores automaticamente sem complicações!
