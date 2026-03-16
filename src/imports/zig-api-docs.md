Documentação API - ZIG
Base URL: https://api.zigcore.com.br/integration
1. Lojas
Endpoint: /erp/lojas
Método: GET
Descrição: Retorna a lista de lojas associadas à rede especificada.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
rede (string): Identificador da rede.
Exemplo URL: https://api.zigcore.com.br/integration/erp/lojas?{rede}
Resposta:
id (string): Identificador da loja.
name (string): Nome da loja.
Exemplo de Resposta:
[
{
"id": "123",
"name": "Loja A"
},
{
"id": "456",
"name": "Loja B"
Documentação API - ZIG 1
}
]
2. Saída de Produtos
Endpoint: /erp/saida-produtos
Método: GET
Descrição: Retorna uma lista de produtos vendidos em um intervalo de tempo
específico.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
Exemplo URL: https://api.zigcore.com.br/integration/erp/saida-produtos?dtinicio={YYYY-MM-
DD}&dtfim={YYYY-MM-DD}&loja={id}
Resposta:
transactionId (string): Identificador da transação.
transactionDate (string): Data da transação.
productId (string): Identificador do produto.
productSku (string): SKU do produto.
unitValue (int): Valor unitário do produto.
count (int): Quantidade de itens vendidos.
fractionalAmount (float?): Quantidade fracionada.
fractionUnit (string?): Unidade fracionada.
discountValue (int): Valor do desconto.
productName (string): Nome do produto.
productCategory (string): Categoria do produto.
Documentação API - ZIG 2
redeId (string): Identificador da rede.
lojaId (string): Identificador da loja.
eventId (string): Identificador do evento.
eventDate (string): Data do evento.
invoiceId (string?): Identificador da nota fiscal.
employeeName (string): Nome do funcionário.
type (enum): Tipo de transação (Normal, Couvert, ZigCard, Entrance, Tip).
additions (array): Lista de adições associadas à transação.
productId (string): Identificador do produto.
productSku (string): SKU do produto.
count (int): Lista de adições associadas à transação.
Exemplo de Resposta:
[
{
"transactionId": "12345",
"transactionDate": "2024-08-23T12:00:00",
"productId": "98765",
"productSku": "ABC123",
"unitValue": 1500,
"count": 2,
"fractionalAmount": null,
"fractionUnit": null,
"discountValue": 0,
"productName": "Produto X",
"redeId": "1",
"lojaId": "1",
"eventId": "1001",
"eventDate": "2024-08-23",
"invoiceId": null,
"additions": [
Documentação API - ZIG 3
{
"productId": "123",
"productSku": "ADD456",
"count": 1
}
]
}
]
3. Compradores
Endpoint: /erp/compradores
Método: GET
Descrição: Retorna a lista de compradores em uma loja durante um intervalo de
tempo.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
Exemplo URL: https://api.zigcore.com.br/integration/erp/compradores?dtinicio={YYYY-MM-
DD}&dtfim={YYYY-MM-DD}&loja={id}
Resposta:
transactionId (string): Identificador da transação.
userDocument (string): Documento do usuário.
userDocumentType (string): Tipo de documento do usuário.
userPhone (string): Telefone do usuário.
userName (string): Nome do usuário.
userEmail (string?): Email do usuário.
productsValue (int): Valor total dos produtos.
Documentação API - ZIG 4
tipValue (int): Valor da gorjeta.
Exemplo de Resposta:
[
{
"transactionId": "56789",
"userDocument": "123.456.789-00",
"userDocumentType": "CPF",
"userPhone": "+55 11 98765-4321",
"userName": "João Silva",
"userEmail": "joao.silva@email.com",
"productsValue": 20000,
"tipValue": 500
}
]
4. Faturamento
Endpoint: /erp/faturamento
Método: GET
Descrição: Retorna os dados de faturamento de uma loja para um período
específico.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
Exemplo URL: https://api.zigcore.com.br/integration/erp/faturamento?dtinicio={YYYY-MM-
DD}&dtfim={YYYY-MM-DD}&loja={id}
Resposta:
paymentId (int): Identificador do pagamento.
paymentName (string): Nome do método de pagamento.
Documentação API - ZIG 5
value (int): Valor total do faturamento em centavos.
redeId (string): Identificador da rede.
lojaId (string): Identificador da loja.
eventId (string): Identificador do evento.
eventDate (string): Data do evento.
Exemplo de Resposta:
[
{
"paymentId": 1,
"paymentName": "Cartão de Crédito",
"value": 15000,
"redeId": "1",
"lojaId": "1",
"eventId": "1001",
"eventDate": "2024-08-23"
}
]
5. Faturamento (Máquinas Integradas)
Endpoint: /erp/faturamento/detalhesMaquinaIntegrada
Método: GET
Descrição: Retorna detalhes de faturamento para máquinas de pagamento
integradas.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
Documentação API - ZIG 6
Exemplo
URL: https://api.zigcore.com.br/integration/erp/faturamento/detalhesMaquinaIntegrada?
dtinicio={YYYY-MM-DD}&dtfim={YYYY-MM-DD}&loja={id}
Resposta:
paymentId (int): Identificador do pagamento.
paymentName (string): Nome do método de pagamento.
lojaId (string): Identificador da loja.
eventId (string): Identificador do evento.
values (array): Lista de valores por bandeira de cartão.
cardBrand (string): Nome da bandeira do cartão.
totalValue (int): Valor do pagamento em centavos.
Exemplo de Resposta:
[
{
"paymentId": 1,
"paymentName": "Cartão de Crédito",
"lojaId": "1",
"eventId": "1001",
"values": [
{
"cardBrand": "Visa",
"totalValue": 5000
},
{
"cardBrand": "MasterCard",
"totalValue": 10000
}
]
}
]
Documentação API - ZIG 7
6. Notas Fiscais
Endpoint: /erp/invoice
Método: GET
Descrição: Retorna as notas fiscais emitidas para uma loja em um intervalo de
tempo.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
page (int): Número da página de resultados.
Exemplo URL: https://api.zigcore.com.br/integration/erp/invoice?dtinicio={YYYY-MM-
DD}&dtfim={YYYY-MM-DD}&loja={id}&page={page}
Resposta:
id (string): Identificador da nota fiscal.
redeId (string): Identificador da rede.
lojaId (string): Identificador da loja.
eventId (string): Identificador do evento.
eventDate (string): Data do evento.
mode (string): Tipo de nota fiscal. Pode ser nfce , nfse , sat ou ivaVendus.
isCanceled (bool): Indica se a nota fiscal foi cancelada.
xml (string): Dados da nota fiscal em XML.
canceledXml (string?): Dados do cancelamento da nota fiscal.
Exemplo de Resposta:
[
{
"id": "12345",
Documentação API - ZIG 8
"redeId": "1",
"lojaId": "1",
"eventId": "1001",
"eventDate": "2024-08-23",
"mode": "nfce",
"isCanceled": false,
"xml": "<xml_data>",
"canceledXml": null}
]
7 . Check-ins
Endpoint: /erp/checkins
Método: GET
Descrição: Retorna uma lista de check-ins feitos em uma loja durante um período
de tempo.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
desde (string): Data de início (formato YYYY-MM-DD).
dtfim (string?): Data de fim (opcional, formato YYYY-MM-DD).
loja (string): Identificador da loja.
page (int): Número da página de resultados.
Exemplo URL: https://api.zigcore.com.br/integration/erp/checkins?desde={YYYY-MM-DD}&dtfim=
{YYYY-MM-DD}&loja={id}&page={page}
Resposta:
checkinTime (string): Data e hora do check-in.
name (string): Nome do usuário que fez o check-in.
document (string): Documento do usuário.
documentType (string): Tipo de documento do usuário.
phone (string): Telefone do usuário.
Documentação API - ZIG 9
isForeign (bool): Indica se o usuário é estrangeiro.
Exemplo de Resposta:
[
{
"checkinTime": "2024-08-23T12:00:00",
"name": "João Silva",
"document": "123.456.789-00",
"documentType": "CPF",
"phone": "+55 11 98765-4321",
"isForeign": false}
]
8. Recargas
Endpoint: /erp/recharges
Método: GET
Descrição: Retorna uma lista de recargas ou pré-pagamentos em uma loja
durante um intervalo de tempo.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
dtinicio (string): Data de início (formato YYYY-MM-DD).
dtfim (string): Data de fim (formato YYYY-MM-DD).
loja (string): Identificador da loja.
Exemplo URL: https://api.zigcore.com.br/integration/erp/recharges?dtinicio={YYYY-MM-
DD}&dtfim={YYYY-MM-DD}&loja={id}
Resposta:
date (string): Data da recarga.
author (string): Nome do responsável pela recarga.
authorId (string): Identificador do responsável.
totalValue (int): Valor total da recarga.
Documentação API - ZIG 10
userDocument (string): Documento do usuário.
userDocumentType (string): Tipo de documento do usuário.
userPhone (string): Telefone do usuário.
userName (string): Nome do usuário.
userEmail (string?): Email do usuário.
isForeign (bool): Indica se o usuário é estrangeiro.
Exemplo de Resposta:
[
{
"date": "2024-08-23",
"author": "Maria Souza",
"authorId": "789",
"totalValue": 10000,
"userDocument": "123.456.789-00",
"userDocumentType": "CPF",
"userPhone": "+55 11 98765-4321",
"userName": "José Silva",
"userEmail": "jose.silva@email.com",
"isForeign": false}
]
9. Bônus
Endpoint: /cashback/give
Método: POST
Descrição: Cria um bônus para consumo.
Cabeçalho: Authorization {seu-token-de-integração}
Parâmetros:
document (string): Número do documento.
documentType (string): Tipo do documento (CPF, RG, Telefone).
Documentação API - ZIG 11
username (string): Nome do usuário.
value (number): Valor do bônus. (sem vígulas ou pontos)
cashbackId (UUID): Código único identificador do bônus.
obs (string): Observações.
Exemplo URL: https://api.zigcore.com.br/cashback/give
Resposta:
no-body-response
Documentação API - ZIG 12