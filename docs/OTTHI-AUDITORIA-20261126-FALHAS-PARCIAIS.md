# Auditoria integral — falhas parciais verificadas
Execução: https://github.com/tsvalencio-IA/ConsoleGames-Preview/actions/runs/45896356572
Revisão testada: c16f1789aa26b64bf02595dd0c7701f3d083d315.
Grupos 0, 1 e 2: 32 scripts, 13 aprovados e 19 reprovados. Não é contagem de defeitos distintos. Artefatos originais: 15154307151, 15154850484, 15153693113.
Nenhum resultado foi descartado ou convertido em aprovado.

| Cenário reprovado | Evidência nos logs | Investigação necessária |
|---|---|---|
| rio-map-performance | git show 38aa21c não contém rio-preto-map.json | Corrigir referência histórica com prova do arquivo/revisão; repetir comparação |
| rio-street-map | #rioPretoPlayBtn não localizado | Verificar entrada real do mapa versus seletor antigo |
| vehicle-orbit | toque em elemento invisível | Verificar visibilidade dos controles e sequência nativa |
| world-camera | modo peace inativo; botão câmera ausente | Verificar modo permitido e fluxo de entrada; não confundir com teste de câmera pós-helicóptero |
| world-coast-rotation | orientation.lock chamado uma vez; esperado zero | Verificar bloqueio de orientação e rotação física |
| world-fleet-passengers | retirada de veículo excedeu 30 s | Investigar garagem, disponibilidade, passageiros e transição |
| world-michelle | aproximação melhorou; etapa posterior excedeu 30 s | Isolar etapa da missão e interação |
| world-services-touch | dois acessos à oficina e dois elevadores passaram; etapa posterior excedeu 30 s | Investigar painel de elevador, contexto e sequência |
| emergency-visual-lifecycle | releaseIncidentResponder indefinido ao executar app histórico com funções novas | Teste híbrido inválido até comprovar dependências; testar runtime atual completo |
| rio-v51-world | 18 versus 42 | Identificar diferença de catálogo/versão antes de alterar |
| world-candidate-smoke | seletor .player-journey encontra dois elementos | Verificar se ambos são intencionais e interações acessíveis |
| world-coherence | elemento de formulário invisível | Verificar fluxo real e contrato de login |
| rio-physical-map | getBoundingClientRect de elemento nulo antes de abastecimento | Verificar controle e mapa; abastecimento não validado nessa execução |
| rio-walkable-buildings | rio-preto-compacto versus rio-preto | Confirmar mapa alvo e validar geometria nele |
| world-integrated-session | 208 NPCs versus expectativa histórica de 138 | Comparar inventário de identidades, não diminuir população para passar |
| world-mobile-layout | fixture de presença online não comprovada | Reproduzir conexão e presença; testar dois clientes sem produção |
| world-phone-return-recovery | inicialização excedeu 120 s | Investigar condição de espera e retorno do motorista |
| world-startup-camera | inicialização excedeu 120 s | Investigar condição de entrada e desempenho |
| world-workshop-auto | seis entregas realizadas; saldo +8 e alimento +1 inesperados | Investigar origem das alterações e contrato econômico, sem alterar saldo real |

A tabela contém 19 cenários reprovados: 8 + 4 + 7. A contagem de registros é derivada dos logs, não de expectativas. Nenhum diagnóstico acima confirma causa de regressão sem reprodução e comparação com a base publicada.
