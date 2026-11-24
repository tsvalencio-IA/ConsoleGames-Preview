# Homologação do ConsoleGames 705.28.41

A base da homologação é `df28dd51f9624347330ec97dbb804804d72468bf`, identificada como `705.28.40-rio-preto-compacto`. A integração local `c054009` mantém esse commit e o README inicial `58d3004bc28581855708a2acfc25e8ffff49c795` no histórico. A árvore logo após a integração coincide com a candidata original. A tag `recovery/source-df28dd51` aponta para a árvore de recuperação. O ponto só deve ser publicado novamente depois de empacotado com o isolamento da homologação.

As branches anteriores de mapa, expansão residencial, cidade completa, recuperação, vida doméstica, regiões, NPCs e apartamentos já são ancestrais desse SHA. A verificação usou `git merge-base --is-ancestor` para as oito branches. [Candidata de origem](https://github.com/tsvalencio-IA/ConsoleGames/tree/df28dd51f9624347330ec97dbb804804d72468bf)

## O que mudou

| Auditoria | Implementação e estado |
| --- | --- |
| CG-001 | O pacote monta as oito entradas sob `/ConsoleGames-Preview/`. O Pages gera novamente o jogo após adaptar os caminhos e confere 178 hashes dos arquivos finais. A Dança usa os arquivos e o motor da candidata. |
| CG-002 | A preparação gráfica inclui os 44 modelos da frota uma vez por inicialização. A compilação das variantes de iluminação e a opção `cameraFull=1` continuam disponíveis. |
| CG-003 | O Chromium abriu a cena após criar um perfil de teste pela interface, confirmou movimento, retornou ao console e recuperou o perfil ao reabrir. |
| CG-004 | O menu usa uma grade com rolagem vertical, botão de fechar e áreas de toque de pelo menos 44 px. A verificação do pacote incluiu os modos completo e limpo em três tamanhos, com rotação durante a partida. |
| CG-005 | Pedestres seguem destinos, consultam obstáculos e tráfego próximos, aguardam passagem e recalculam desvios em etapas com orçamento limitado. Atendentes do shopping se voltam para o jogador e respondem à abertura da loja. |
| CG-006 | A telemetria separa carregamento dos modelos, compilação, preparação da câmera e primeiro quadro. Permanecem necessárias medições em aparelhos físicos. |
| CG-007 | Os modelos e o guarda-roupa existentes vieram da candidata. O link do Canva exigiu autenticação e o vídeo citado não estava nos anexos acessíveis. |
| CG-008 | Os seis condomínios usam a lógica nativa de apartamentos por unidade. O registro histórico de cada condomínio corresponde à unidade 101. A validação de compra, decoração, recarga e todos os condomínios deve ser tratada por percurso. |
| CG-009 | Lojas, atendentes, compras e entregas usam os contratos de economia e inventário do jogo. A primeira amostra nativa confirmou o débito e a quantidade de um pedido. |
| CG-010 | Os três lagos, a ponte e a natação ficam na Represa. Prancha, barco de pesca, lancha e navio usam os modelos existentes e vagas na marina do Guarujá. |
| CG-011 | O despacho prioriza a viatura com saída livre e reserva um caminhão quando há um incêndio em atendimento. Chegadas físicas e contingências aparecem em registros separados. A prévia usa perfis locais e bloqueia a conexão com o Firebase original. |

## Desempenho observado

Chromium `141.0.7390.37` em Linux, AMD EPYC 9V74 com três vCPUs, WebGL via SwiftShader, tela de 393 × 852 e mesma configuração por par. A referência de inicialização foi regenerada a partir dos módulos do SHA original. O ensaio em tempo real preparado com `OT_ENDURANCE_BASELINE` usa o bundle gravado no SHA e registra separadamente sua revisão. As medições abaixo foram feitas na rodada de integração que recuperou a preparação da frota.

| Medida | Referência .40 | Integração .41 |
| --- | ---: | ---: |
| Passagens da frota no aquecimento integral | 14 | 1 |
| Templates processados no aquecimento integral | 616 | 44 |
| Variantes de luz previstas no aquecimento integral | 14 | 14 |
| Tempo nas chamadas de compilação, modo integral | 28,97 s | 27,55 s |
| Abertura até os controles, modo integral | 71,62 s | 76,03 s |
| Abertura até os controles, qualidade baixa | 16,38 s | 20,22 s |
| Primeiro movimento observado após a tecla, qualidade baixa | 2,48 s | 1,92 s |
| Cadência mediana de quadros em 55 s, qualidade baixa | 2,76 FPS | 2,81 FPS |
| Maior intervalo entre quadros nessa amostra | 1,21 s | 1,11 s |
| Heap JavaScript antes e depois da amostra, sem coleta forçada | 84,1 → 103,6 MB | 90,0 → 93,6 MB |

O tempo de abertura aumentou nessas duas comparações. O aquecimento integral também inclui a espera da GPU e do software de renderização. As amostras de heap contêm alocações e coletas do navegador e são insuficientes para determinar tendência de memória. A meta de 30 FPS e a latência dos controles precisam de medição em hardware físico.

## Sessões com trânsito, acidente e entrega

O ensaio nativo lançou uma ocorrência na mesma via e fez um pedido pago pelo celular no navegador. Ele posicionou apenas os veículos envolvidos no acidente para iniciar o cenário. A ambulância, os bombeiros, a polícia e o entregador percorreram as próprias rotas de jogo. Cada chegada foi registrada com posição, distância à vaga de atendimento e tempo. A contingência teve contagem própria.

Na referência gravada no SHA, a ambulância chegou e a central cobriu as outras equipes em um ensaio de 210 s. O pedido debitou 15 moedas uma vez, entregou dois itens e o motorista voltou. A primeira rodada `.41` de 210 s registrou polícia e ambulância no local, com contingência dos bombeiros. A entrega creditou dois itens por 15 moedas e o veículo de entrega ainda estava retornando ao fim da amostra. Essa rodada teve execução simultânea de outro Chromium, o que limita a comparação dos tempos de quadro.

Após corrigir a seleção de equipes, a rodada de 150 s da revisão `643ca8d62bbc1aab` registrou bombeiros a 1,54 m da vaga e ambulância a 1,68 m. A polícia usou contingência. O jogador fez o pedido pela interface, recebeu dois itens e o motorista retornou aos 147,1 s do ensaio. Essa rodada observou intervalos de quadros superiores a dois segundos no renderizador por software. A substituição de uma equipe parada por uma viatura livre foi acrescentada após esse ensaio e ganhou um teste de regressão específico.

O pacote local `cb1502e3c72c1aa6` abriu os oito jogos e retornou ao console, incluindo Mundo Aberto → Pingue-Pongue incorporado → Mundo Aberto → Console. O Chromium também verificou o bloqueio de conexão com Firebase, a separação de armazenamento e service workers na mesma origem e a criação e recarga do perfil de teste.

A suíte de código passou em **618 de 618 testes** na revisão de origem `b7a699b1c81b5987`. Os quatro casos históricos de corrida, calibração de mãos, rota de socorro e estacionamento foram executados na referência e na candidata.

## Publicação e dados

A página de destino está configurada para GitHub Actions. O workflow `publish-isolated-pages-preview.yml` só roda em `tsvalencio-IA/ConsoleGames-Preview` e exige validação do build e do artefato no Chromium antes de publicar. O empacotamento preserva os arquivos Firebase no código de origem. A versão empacotada mantém perfis, caches, IndexedDB e canais locais em um namespace próprio e bloqueia as conexões do Firebase de produção.

O GitHub devolveu HTTP 403 ao tentar gravar no destino. A instalação selecionada do aplicativo inclui `ConsoleGames`, e a lista de acesso à instalação precisa incluir `ConsoleGames-Preview`. A mudança indispensável é adicionar `ConsoleGames-Preview` em **Repository access → Only select repositories** e salvar. [Acesso do aplicativo](https://github.com/settings/installations/115333490)

O workflow confere o SHA, o manifesto, o HTML, os recursos carregados e os retornos ao console no endereço publicado. O teste usa uma conta local descartável. A homologação permanece separada do repositório original e do Firebase real. [Destino de homologação](https://github.com/tsvalencio-IA/ConsoleGames-Preview/actions)
