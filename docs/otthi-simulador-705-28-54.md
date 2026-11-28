# Homologação do OTThi World 705.28.54

A referência publicada é `705.28.53-camera-multiplayer`, commit `a791268ec4486520bb2c43fcc02c0cdadaac9c43`. A candidata `705.28.54-simulador-servicos` continua em `fix/otthi-visual-recovery-20261126` no ConsoleGames-Preview. A versão publicada permanece na `.53`. [Mundo Aberto](https://tsvalencio-ia.github.io/ConsoleGames-Preview/games/otthi/?map=rio-preto) · [Branch de desenvolvimento](https://github.com/tsvalencio-IA/ConsoleGames-Preview/tree/fix/otthi-visual-recovery-20261126)

## Verificações da primeira revisão da candidata

O commit `bfbe505` passou no abastecimento no posto, no socorro de combustível solicitado pelo celular e na Jornada com rotação. O jogo debitou uma vez, creditou o tanque após o atendimento e preservou os dados após recarga. A compra de imóvel, a edição de móveis e a navegação entre comércio, Guarujá e serra também passaram no navegador. [Serviços](https://github.com/tsvalencio-IA/ConsoleGames-Preview/actions/runs/46071438215/job/140749048807) · [Moradia e regiões](https://github.com/tsvalencio-IA/ConsoleGames-Preview/actions/runs/46071438215/job/140749048793)

O pacote local do Pages conferiu 178 hashes e oito rotas. No Chromium com perfil descartável e rede externa bloqueada, a atualização `.53` → `.54` trocou o service worker e reabriu offline com perfil, moedas, XP, inventário, frota e progresso intactos. A instalação em celular físico segue pendente.

## Sessão prolongada

Dois percursos de 15 minutos no mesmo runner Ubuntu 24.04.5, Chromium 141 com SwiftShader, viewport 393×852 e DPR 0,62. Cada sessão manteve 208 NPCs e 44 modelos de trânsito.

| Observação | `.53` | `.54` em `bfbe505` |
| --- | ---: | ---: |
| Mediana dos P95 de quadro por minuto | 525,3 ms | 553,8 ms |
| Pior intervalo entre quadros | 2.273 ms | 2.531,7 ms |
| Variação do heap após GC entre 5 e 15 min | +261.632 B | +981.472 B |
| Pedidos recebidos e retornos concluídos | 4 / 3 | 5 / 4 |
| Ocorrências com todos os agentes físicos | 1 de 5 | 1 de 5 |
| Ocorrências liberadas por contingência | 3 | 4 |

O atendimento físico reprovou e os intervalos entre quadros pioraram nesse percurso. As duas simulações avançaram tempos diferentes sob a mesma agenda. A variação de heap não demonstra crescimento indefinido. O artefato registra tempos, pagamentos, posições, ocorrências e capturas. [Evidências das duas sessões](https://github.com/tsvalencio-IA/ConsoleGames-Preview/actions/runs/46071438215/artifacts/15234003778)

No percurso separado de 20 segundos com caminhada, giro e zoom, o P95 passou de 683,3 para 571,6 ms e o P50 de 257,4 para 283 ms. Essa observação local por software não substitui uma sessão prolongada ou uma medição no celular.

## Continuidade

Os ajustes seguintes abrangem cruzamento de pedestres com colisão ativa, encaixe do personagem no sofá, pouso no telhado do terminal e correções na preparação de testes antigos. O telhado tem espaço para pousar e decolar. O desembarque continua no pátio. O convés da embarcação existente não oferece espaço livre suficiente para essa operação.

Antes de promover, compare os registros do próprio candidato com a referência, confira cada chegada física sem contabilizar contingência e teste estabilidade e instalação nos aparelhos-alvo. O módulo de emergência permanece com a lógica da `.53` enquanto as variantes de rota estão em teste.
