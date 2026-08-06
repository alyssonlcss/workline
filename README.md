# WorkLine

WorkLine é uma aplicação Full-Stack desenvolvida para extração automatizada, processamento analítico e geração de relatórios de produtividade.

O sistema utiliza automação de navegação (RPA) para baixar bases de dados operacionais de maneira autônoma via Puppeteer, processa esses dados em um backend robusto construído com Node.js + Fastify, e exibe as métricas de desempenho através de um dashboard interativo moderno desenvolvido em Angular. A partir do dashboard, é possível visualizar o desempenho operacional das equipes, verificar o status dos alertas e gerar/exportar relatórios analíticos em PDF de maneira dinâmica e segmentada.

## 🚀 Tecnologias

- **Frontend**: Angular (Standalone Components), RxJS, Signals, PDFMake (para renderização de PDFs nativa no lado do cliente).
- **Backend**: Node.js, Fastify, TypeScript, Zod, Puppeteer (para RPA web).
- **Arquitetura**: Hexagonal Architecture no backend (focada na separação de domínios), arquitetura limpa de componentes e separação por "features" no Frontend.

## 📁 Estrutura do Projeto

- `src/backend/`: API em Node.js e orquestrador de automação. Responsável por iniciar a raspagem de dados em fontes externas, filtrar arquivos baixados (CSV), tratar regras e cálculos complexos de negócio e devolver os dados agregados prontos para consumo.
- `src/frontend/`: SPA (Single Page Application) em Angular. Consome a API, renderiza o dashboard dinâmico (gráficos e alertas) e fornece a interface para a geração e compartilhamento automático de PDFs em lote para Windows.

## 📊 Métricas e Cálculos

O WorkLine não apenas exibe dados brutos, mas realiza uma série de cruzamentos analíticos (Deep Dive) para expor gargalos operacionais ocultos que geralmente passam despercebidos nas médias mensais.

### Principais KPIs e Fórmulas Analíticas:
- **Eficiência**: Mede a precisão da execução frente à expectativa. 
  - *Cálculo*: `Tempo Padrão Total / Tempo de Reparo (TR) Total`. 
  - *Análise*: O sistema caça discrepâncias investigando ordens onde o TR excedeu drasticamente a estimativa, revelando baixa eficiência "mascarada" em equipes que cumprem a meta apenas fazendo volume em ordens fáceis.
- **Utilização**: Mede o quão bem o tempo do eletricista está sendo aproveitado.
  - *Cálculo*: `Horas Trabalhadas (HT) / Horas Disponíveis (HD)`.
  - *Análise*: A engine cruza inícios e fins de ordem, calculando lacunas exatas de ociosidade (*"Tempo Sem OS"*) para diagnosticar se a culpa da baixa utilização é da equipe (paradas longas) ou do centro de despacho (falta de serviço na rota).
- **Produtividade (OS/Dia)**: Contagem bruta de OS executadas.
- **TME (Tempo Médio de Execução) Improdutivo**: Avalia o excesso de tempo gasto em deslocamento frente à execução. Picos de improdutividade geram alertas imediatos e são cruzados com o raio de atuação.
- **Eventos de Jornada (1º Login / 1º Deslocamento / Retorno à Base)**: Auditoria diária de rotina. Algoritmos identificam equipes que sistematicamente iniciam a jornada com atraso ou encerram a rota de forma prematura.

### 🚩 Alertas e Red Flags (Limites e Cenários)
O sistema emite alertas (*Red Flags*) baseados em regras rígidas de negócio ou médias globais. Os limites numéricos são configuráveis por polo via `polos.json`:

- **`tr_excede_hd`** (TR Excede Limite): Ocorre quando o Tempo de Reparo (TR) consome uma porcentagem desproporcional do dia da equipe (por padrão, > 20% das Horas Disponíveis) E também ultrapassa o Tempo Padrão estipulado para a OS.
- **`tl_excede_hd`** (Deslocamento Excede Limite): Ocorre quando o Tempo de Deslocamento (TL) é superior a 30% da jornada diária e acima da média global da operação.
- **`temp_prep_alto`** (Preparação Alta): Falha de agilidade na saída. Tempo entre a OS ser "Despachada" e a equipe entrar "A Caminho" excede a margem (padrão 10 min).
- **`triagem_alto`** (Triagem Alta): Falha do despacho. O tempo em que a equipe fica aguardando serviço (entre a última liberação e receber o novo despacho) excede o aceitável (padrão 10 min).
- **`sem_os_alto` / `entre_ordens`** (Ociosidade Entre Ordens): Lacuna ociosa severa entre finalizar um serviço (Liberada) e ser despachado para o próximo.
- **`primeiro_desloc_alto` / `inicio_jornada_alto`** (Início de Jornada Atrasado): Na primeira OS do dia, cruza-se o "Início Calendário" ou "Hora do 1º Despacho" com a real saída ("A Caminho" ou "Despachada"). Pune o atraso matinal.
- **`desloc_intervalo_alto`** (Deslocamento para Intervalo): Quando a equipe finaliza a OS da manhã e demora excessivamente viajando/ociosa antes de efetivamente bater o ponto de início de intervalo.
- **`Antes Log Off` / `Retorno a base`** (Fim de Jornada Prematuro): Ocorre no fim do dia, caso a lacuna entre a última OS e o Log Off exceda drasticamente a média do polo ou ultrapasse um corte estático (padrão 60 min).
- **`tr_muito_baixo` / `deslocamento_curto`** (Falsa Eficiência): Exclusivo para *Top Performers*. Detecta ordens onde o TR é inferior a 20% da média global e 20% do Tempo Padrão. Indica fraude de status (equipe "passando o rádio" no sistema sem executar o serviço real).
- **`tempo_padrao_vazio`** (Cadastro Incompleto): Alerta de dados inconsistentes quando a ordem tem duração (TR), mas falta o Tempo Padrão no sistema original, mascarando o cálculo geral.

## 📑 Tipos de Relatórios Gerados

Ao exportar os PDFs pelo painel, o relatório é inteligentemente dividido em duas frentes de diagnóstico:

### 1. Visão Operacional (Resumo Executivo)
Desenhado para o coordenador da base. É um *Scorecard* macro que responde à pergunta *"Onde está sangrando?"*.
- Consolida os alertas em formato de farol (KPIs críticos).
- Mostra um ranking simples das piores equipes.
- Ignora os bons números para focar exclusivamente nos desvios padrão (ausências injustificadas, excesso de recusas e falhas de comunicação).

### 2. Visão Analítica (Raio-X de Evidências)
Desenhado para o analista e para a reunião de feedback com a equipe. É um aprofundamento investigativo (*Deep Dive*).
- Separa os *Top Performers* (melhores) dos *Underperformers* (piores) em cada indicador.
- Substitui médias mensais por **Gráficos de Tendência Diária** (linhas de acompanhamento dia a dia).
- Fornece **Evidências Nível OS**: O relatório analítico não diz apenas que a equipe está ociosa; ele lista no PDF o **número da OS exata**, o horário e a duração dos tempos absurdos identificados (ex: *"OS 12345 despachada às 14h, mas a equipe ficou 2 horas ociosa antes de assumir"*).

## ⚙️ Pré-requisitos

- **Node.js** v18 ou superior
- **NPM** (Node Package Manager)
- Um navegador baseado em Chromium (Edge ou Google Chrome) para a execução do Puppeteer.

## 🛠️ Instalação e Execução

### Opção 1: Utilizando o script automatizado (Recomendado para Windows)
Na raiz do projeto, execute o script `setup.bat`:
```bat
setup.bat
```

#### O que o `setup.bat` faz automaticamente:
1. **Verificação do Ambiente (Node.js)**: Verifica no sistema (em todas as variáveis de ambiente `PATH`) se o Node.js está instalado. Caso não encontre o Node.js, realiza o download automático e a instalação portátil da versão `v24.16.0` em `Documents/NodeJS`, configurando o `PATH` do usuário e da sessão de forma autônoma.
2. **Instalação das Dependências**: Navega até as pastas `src/backend` e `src/frontend` e executa o `npm install` em cada uma, caso as dependências ainda não estejam instaladas.
3. **Inicialização dos Servidores**: Utiliza o Windows Terminal (`wt.exe`) para abrir automaticamente duas abas separadas e iniciar os serviços simultaneamente:
   - **Aba 1 (Backend)**: Executa `npm run dev` na porta `3000`.
   - **Aba 2 (Frontend)**: Executa `npm start` na porta `4200`.

---

### Opção 2: Execução Manual
Se preferir executar e inspecionar manualmente, siga os passos em dois terminais distintos:

#### Backend
```bash
cd src/backend
npm install
# Preencha as variáveis de ambiente necessárias no arquivo .env
npm run dev
```

#### Frontend
Em um novo terminal:
```bash
cd src/frontend
npm install
npm start
```
Após o build inicial, o aplicativo frontend estará acessível em `http://localhost:4200`.

---

## 👥 Arquitetura Multi-Usuário e Alta Concorrência (Sem Banco de Dados)

O WorkLine foi desenhado para operar na rede interna corporativa sem necessidade de infraestrutura pesada de banco de dados SQL/NoSQL. O sistema gerencia múltiplos acessos concorrentes através dos seguintes mecanismos:

- **Gerenciamento de Sessões (`SessionService`)**: O backend implementa um serviço em memória para controle persistente do ciclo de vida das sessões. Cada usuário recebe um UUID integrado a cookies HTTP-only com TTL (Time-To-Live) configurável (ex: 8 horas). Isso garante segurança na autenticação das requisições e preserva o estado de acesso sem depender de bancos de dados persistentes.
- **Credenciais Per-User no Frontend**: Cada usuário insere seu **Usuário** e **Senha** do Spotfire no painel lateral de extração. O frontend salva localmente no navegador (`localStorage`) de forma isolada, possui um alternador de visibilidade de senha (olhinho 👁️) e transmite as credenciais de forma segura.
- **Fila de Execução Concorrente (`ExtractionQueueManager`)**: Orquestra as requisições com um limite de navegações simultâneas via `p-limit`. Quando o número de requisições excede a capacidade do servidor, o usuário recebe um evento SSE com sua posição exata na fila (*ex: "Solicitação na fila — Posição 2"*).
- **Isolamento de Diretórios Temporários**: Cada extração é processada em um diretório temporário exclusivo atrelado à sessão do usuário (`src/data/sessions/<sessionId>/<jobId>/`). Um **Garbage Collector** periódico elimina automaticamente arquivos e processos órfãos gerados há mais de 30 minutos.
- **Cache de Extrações em Memória (`ExtractionCacheService`)**: Requisições com filtros idênticos reutilizam os resultados recentemente extraídos (hash SHA-256), retornando dados em menos de 100ms sem abrir instâncias desnecessárias do Puppeteer.

---

## ⚙️ Configuração Adicional

### Configuração do Arquivo `.env`
O backend requer as URLs do sistema corporativo para que o robô Puppeteer possa navegar e extrair os dados. Para configurar, duplique o arquivo `.env.example` localizado em `src/backend`, renomeie-o para `.env` e preencha com as informações da sua organização:

```env
# Porta do Servidor API (Opcional, Padrão: 3000)
PORT=3000

# URL da Ferramenta de BI (Substitua pelo link interno da sua organização)
SPOTFIRE_ANALYSIS_URL=http://<SEU-DOMINIO-BI>:8090/spotfire/wp/analysis?file=/Caminho/do/Relatorio

# Credenciais do Robô / Fallback (Opcional - usuários informam no modal da interface)
SPOTFIRE_USERNAME=
SPOTFIRE_PASSWORD=

# Configurações do Navegador (Puppeteer)
SPOTFIRE_DEBUG=false
SPOTFIRE_BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

# Mapeamento de Tabelas a Baixar (Formato: Aba-Tabela)
SPOTFIRE_DOWNLOAD_TABLES=Tab_Completa-Deslocamentos

# Nome do Arquivo de Relatório Gerado (Opcional, Padrão: workline-report.json)
REPORT_OUTPUT_FILE_NAME=workline-report.json
```

> **Aviso de Segurança**: Por padrão, o arquivo `.env` está incluso no `.gitignore` para prevenir o vazamento acidental de senhas e URLs corporativas em repositórios públicos. Nunca o versione!

### Configuração de Polos e Bases
A estrutura hierárquica de **polos** e **bases operacionais** que aparecem nos menus e no exportador é construída de maneira dinâmica e pode ser integralmente customizada através do arquivo de metadados localizado em `src/backend/polos.json`. 

#### Como adicionar ou editar Polos e Bases
O sistema classifica automaticamente a qual polo, base e tipo (Própria ou Parceira) uma equipe pertence através da extração de prefixos e sufixos do nome da equipe. Existem dois modos de mapeamento (`matchType`):

**1. `direct_prefix` (Mapeamento Direto por Prefixo)**
Ideal quando o prefixo da equipe já determina exatamente a base e se ela é Própria ou Parceira.
```json
{
  "name": "Norte",
  "matchType": "direct_prefix",
  "bases": [
    {
      "name": "Sobral",
      "propria": ["SBL-"],            // Equipes Próprias (ex: SBL-01)
      "parceira": ["SBC-", "SBM-"]    // Equipes Parceiras (ex: SBC-02)
    }
  ]
}
```

**2. `infix_type_with_base_prefix` (Mapeamento Híbrido)**
Ideal quando o prefixo indica apenas a localidade, e um sufixo/infixo interno indica a propriedade (ex: `QXD-EN-01` onde `QXD` é a base Quixadá e `-EN-` significa equipe própria).
```json
{
  "name": "Centro-Norte",
  "matchType": "infix_type_with_base_prefix",
  "typeIdentifiers": {
    "propria": ["-EN-"],
    "parceira": ["-RD-"]
  },
  "bases": [
    {
      "name": "Quixadá",
      "prefixes": ["QXD-", "CNQ-"] // O sistema fará a junção: se tiver QXD- e -EN- será Quixadá Própria.
    }
  ]
}
```

- **Limites de Alertas (Red Flags):** O arquivo `polos.json` também permite a configuração opcional de parâmetros e limites críticos de operação (ex: tempo limite para deslocamentos e ociosidade) através da propriedade `limits`. Esses limites podem ser configurados de forma global (na raiz do JSON) ou segmentados especificamente dentro do bloco de um polo.
