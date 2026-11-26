# OTThi World — contrato de aceitação integral
Registro de requisitos do proprietário, 26/11/2026. Não é aprovação, resultado de teste ou autorização para alterar a produção.
Base publicada inspecionada: ee03542fa3f3e15732ee8fe7673c4e2e0296e71c.
Auditoria existente: 45896356572.

## Regra de cobertura
Inventariar os objetos e ações realmente disponíveis no runtime e as opções de cada ação, em todos os mapas e modos. Vincular cada opção a pré-condições, controles, estados intermediários, animações, áudio, resultado, persistência, interação com outras entidades, casos de falha, retomada e evidência. O conjunto de exemplos do proprietário não limita o escopo.
Separar cenários executados, falhos, ausentes, impossíveis por regra documentada, não testados e testes preparados/artificialmente acelerados. Não confundir uma asserção de saldo, presença de um botão ou chamada direta de função com uma ação física observada.
Cobrir transições válidas de estados, combinações de controles simultâneos e sequenciais, repetição, interrupção, reconexão, troca de câmera, passageiros e reinicialização. Sequências ilimitadas não são exaustivamente enumeráveis; explicitar limites e critérios de seleção.
Manter os mapas, vias, acessos, colisores, assets, identidades, funcionalidades e dados aprovados; comparar antes/depois. Não reconstruir cidades ou substituir sistemas funcionais para obter aprovação. Não reduzir a qualidade visual ou eliminar entidades para melhorar métricas.
Verificar São Paulo e todos os demais mapas contra a revisão funcional de referência, que deve ser identificada antes de qualquer intervenção. A reclamação do proprietário sobre ruas não constitui, por si só, identificação do commit defeituoso.

## Ciclo de combustível: lacuna concreta verificada no código
- games/otthi/src/modules/90-rio-map-activities.js, rioOpenFuel: exige veículo ocupado e parado, abre modal, executa barra de progresso e credita litros/debita moedas ao final. Não representa retirada de bico, conexão ao veículo, frentista executando o serviço ou manipulação da mangueira.
- games/otthi/src/modules/88-rio-places.js, rioBuildFuel: bombas estáticas; a ação registrada é vehicleOnly.
- games/otthi/src/modules/90-rio-map-activities.js, updateVehiclePhysics: tanque vazio imobiliza veículo e mostra orientação de solicitar socorro.
- tests/rio-physical-map-browser.mjs: aproximação, deslocamento, consumo e compra de 10 litros com verificação contábil. Isso não demonstra o abastecimento físico. Não foi confirmado um serviço de entrega de combustível de ponta a ponta por telefone.
- A capacidade e consumo estão limitados pelo código inspecionado a classes e mapas específicos; requer verificação do inventário completo antes de estender.

### Cenários obrigatórios de aceitação — pendentes de comprovação
1. Veículo com diferentes níveis de tanque e tipos de energia; condução real com consumo coerente, indicação no HUD e aviso de reserva; tanque vazio não permite propulsão.
2. Chegada pela rua original, entrada e saída pelo acesso do posto sem atravessar guias, bombas, paredes ou outros veículos; testar marcha à frente, ré e aproximação pelos lados compatíveis.
3. Estacionamento na bomba correta, motor em estado seguro, ocupantes e câmera preservados.
4. Atendimento físico por frentista ou operação pelo personagem conforme regras do posto; interação com tampa, bico, mangueira, mostrador; início, fluxo, conclusão, devolução do bico e pagamento.
5. Seleção de quantidade, valor, tanque cheio, saldo insuficiente, combustível compatível, cancelamento, afastamento e interrupção durante a operação. Garantir cobrança coerente com o serviço efetivamente recebido, sem duplicação.
6. Pane seca: abrir telefone, solicitar combustível para veículo e posição reais; prestador aceita, percorre rota, chega, desembarca, entrega, abastece, cobra, retoma serviço. Verificar cancelamento, bloqueio viário, impossibilidade de entrega, saldo, reconexão, dois usuários e persistência.
7. Retomar direção após abastecimento; confirmar consumo, som, HUD, câmera, passageiros, propriedade e saldo. Repetir o ciclo e recarregar a página.
8. Inspecionar visualmente a ação inteira em terceira pessoa e câmera livre, paisagem/retrato; sem exigir captura de tela do proprietário como substituto de teste. Não afirmar que está visualmente fiel apenas por verificar valores.

## Outros sistemas
Aplicar a mesma matriz a cada veículo, aeronave, embarcação, residência, profissão, NPC, animal, esporte, missão, serviço, comércio, objeto e ação existente, incluindo combinações de entrada/saída, caminhada, corrida, salto, agachamento, coleta, interação e multiplayer. Incluir as funcionalidades solicitadas ainda ausentes (p.ex. zoológico vivo, embarcações com atividades) como lacunas de produto, não como aprovadas.
