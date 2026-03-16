import { StockRepository } from '../repositories/StockRepository';
import { ProductService } from './ProductService';
import { ProductRepository } from '../repositories/ProductRepository';
import { PriceHistoryRepository } from '../repositories/PriceHistoryRepository';
import type { StockEntry, StockMovement } from '../types';
import { formatCurrency } from '../utils/calculations';

/**
 * Service Pattern: Lógica de negócio para estoque
 */
export class StockService {
  /**
   * Processa entrada de estoque (recebimento)
   */
  static async processStockEntry(
    entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>
  ): Promise<{
    entry: StockEntry;
    movement: StockMovement;
  }> {
    // Validar entrada
    this.validateStockEntry(entry);

    // Buscar produto atual diretamente por ID
    const product = await ProductRepository.findById(entry.productId);

    if (!product) {
      throw new Error('Produto não encontrado');
    }
    
    // Validação de segurança de tenant
    if (product.companyId !== entry.companyId) {
       throw new Error('Produto não pertence à empresa selecionada');
    }

    // Calcular novo custo médio
    const newAvgCost = ProductService.calculateWeightedAverageCost(
      product.currentStock,
      product.averageCost,
      entry.quantity,
      entry.unitPrice
    );

    // Criar entrada de estoque
    const stockEntry = await StockRepository.createEntry(entry);

    // Atualizar produto
    await ProductService.updateStock(entry.productId, entry.quantity, newAvgCost);

    // Registrar histórico de preço
    await PriceHistoryRepository.create({
      companyId: entry.companyId,
      productId: entry.productId,
      supplierId: entry.supplierId,
      price: entry.unitPrice,
      quantity: entry.quantity,
      invoiceNumber: entry.notes,
    });

    // Criar movimentação
    const movement = await StockRepository.createMovement({
      companyId: entry.companyId,
      productId: entry.productId,
      type: 'entrada',
      quantity: entry.quantity,
      reason: `Entrada via fornecedor`,
      cost: entry.totalPrice,
      batchNumber: entry.batchNumber,
      notes: entry.notes,
    });

    return { entry: stockEntry, movement };
  }

  /**
   * Registra saída de estoque (consumo, venda, etc)
   */
  static async processStockOutput(
    companyId: string,
    productId: string,
    quantity: number,
    reason: string,
    type: 'saida' | 'venda' | 'desperdicio' = 'saida',
    userId?: string
  ): Promise<StockMovement> {
    if (quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // Verificar se há estoque suficiente
    const product = await ProductRepository.findById(productId);

    if (!product) {
      throw new Error('Produto não encontrado');
    }
    
    if (product.companyId !== companyId) {
      throw new Error('Produto não pertence à empresa selecionada');
    }

    if (product.currentStock < quantity) {
      throw new Error('Estoque insuficiente');
    }

    // Atualizar estoque (negativo)
    await ProductService.updateStock(productId, -quantity);

    // Criar movimentação
    return StockRepository.createMovement({
      companyId,
      productId,
      type,
      quantity,
      reason,
      cost: product.averageCost * quantity,
      userId,
    });
  }

  /**
   * Busca todas as entradas de estoque
   */
  static async getAllEntries(companyId: string): Promise<StockEntry[]> {
    return StockRepository.findAllEntries(companyId);
  }

  /**
   * Busca todas as movimentações
   */
  static async getAllMovements(companyId: string): Promise<StockMovement[]> {
    return StockRepository.findAllMovements(companyId);
  }

  /**
   * Reverte (Exclui) uma entrada de estoque
   * AVISO: Isso reverterá o estoque. O custo médio será recalculado matematicamente
   * revertendo a operação de média ponderada.
   */
  static async deleteStockEntry(entryId: string, userId: string, reason: string): Promise<StockMovement> {
    const entry = await StockRepository.findById(entryId);
    
    if (!entry) {
      throw new Error('Entrada não encontrada');
    }

    const product = await ProductRepository.findById(entry.productId);
    if (!product) {
      throw new Error('Produto associado não encontrado');
    }

    // Verificar se é possível reverter o estoque (não pode ficar negativo)
    // Nota: Em alguns casos de negócio, pode-se permitir negativo para correção,
    // mas por segurança vamos bloquear se o produto já foi consumido.
    if (product.currentStock < entry.quantity) {
      throw new Error('Não é possível reverter esta entrada: Os produtos já foram consumidos ou vendidos.');
    }

    // Calcular reversão do Custo Médio
    // Fórmula Inversa:
    // (TotalAtual - ValorEntrada) / (QtdAtual - QtdEntrada)
    
    const currentTotalValue = product.currentStock * product.averageCost;
    const entryTotalValue = entry.quantity * entry.unitPrice;
    const newStock = product.currentStock - entry.quantity;
    
    let newAvgCost = product.averageCost; // Fallback
    
    if (newStock > 0) {
      const newTotalValue = currentTotalValue - entryTotalValue;
      // Proteção contra valores negativos muito pequenos devido a ponto flutuante
      const sanitizedTotalValue = Math.max(0, newTotalValue);
      newAvgCost = sanitizedTotalValue / newStock;
    } else {
      newAvgCost = 0; // Se zerou o estoque, zera o custo
    }

    // 1. Atualizar Produto (Remove estoque e atualiza custo)
    await ProductService.updateStock(product.id, -entry.quantity, newAvgCost);

    // 2. Excluir a Entrada (Delete físico para permitir re-lançamento limpo)
    await StockRepository.deleteEntry(entryId);

    // 3. Registrar Movimentação de Estorno (Para auditoria)
    // Nota: Poderíamos deletar a movimentação original também, mas um estorno é mais seguro para rastreio.
    // Porém, o usuário pediu para "alterar", então vamos fazer um "Delete" limpo da entrada
    // e criar uma movimentação de "Correção de Entrada".
    const movement = await StockRepository.createMovement({
      companyId: entry.companyId,
      productId: entry.productId,
      type: 'saida', // Saída técnica
      quantity: entry.quantity,
      reason: `Estorno: ${reason}`,
      cost: entry.totalPrice, // Valor total que saiu
      notes: `Cancelamento de entrada. Motivo: ${reason}`,
      userId: userId,
    });

    return movement;
  }

  /**
   * Atualiza uma entrada de estoque
   * Processo: Reverte a entrada anterior -> Aplica a nova entrada -> Atualiza registro
   */
  static async updateStockEntry(
    entryId: string,
    updates: Omit<StockEntry, 'id' | 'entryDate' | 'userId' | 'companyId'>,
    userId: string
  ): Promise<{ entry: StockEntry; movement: StockMovement }> {
    // 1. Buscar a entrada original
    const oldEntry = await StockRepository.findById(entryId);
    if (!oldEntry) throw new Error('Entrada original não encontrada');

    // 2. Reverter os efeitos da entrada antiga
    // Reutilizamos a lógica de validação do deleteStockEntry (verifica se tem estoque para remover)
    const product = await ProductRepository.findById(oldEntry.productId);
    if (!product) throw new Error('Produto não encontrado');

    if (product.currentStock < oldEntry.quantity) {
      throw new Error('Não é possível editar esta entrada: O estoque já foi consumido.');
    }

    // Cálculo reverso do custo (remover a entrada antiga)
    const currentTotalVal = product.currentStock * product.averageCost;
    const oldEntryTotalVal = oldEntry.quantity * oldEntry.unitPrice;
    const stockAfterRevert = product.currentStock - oldEntry.quantity;
    
    let costAfterRevert = product.averageCost;
    if (stockAfterRevert > 0) {
      costAfterRevert = Math.max(0, currentTotalVal - oldEntryTotalVal) / stockAfterRevert;
    } else {
      costAfterRevert = 0;
    }

    // 3. Aplicar os efeitos da nova entrada (updates) no estoque "revertido"
    // Updates podem conter apenas campos parciais? No nosso caso, o form manda tudo.
    // Vamos assumir que 'updates' tem os dados completos do form.
    
    const newQuantity = updates.quantity;
    const newUnitPrice = updates.unitPrice;
    const newTotalValue = newQuantity * newUnitPrice;

    // Novo Custo Médio = (ValorTotalRevertido + ValorNovo) / (EstoqueRevertido + QtdNova)
    const finalStock = stockAfterRevert + newQuantity;
    const finalTotalValue = (stockAfterRevert * costAfterRevert) + newTotalValue;
    const finalAvgCost = finalStock > 0 ? finalTotalValue / finalStock : 0;

    // 4. Persistir alterações
    
    // 4.1 Atualizar Produto
    // A diferença de estoque é (NewQty - OldQty), mas já calculamos o finalAvgCost absoluto.
    // Então vamos atualizar o produto diretamente com os valores finais calculados para precisão
    // Mas o ProductService.updateStock é incremental. Vamos fazer:
    // Revert Old (-OldQty, CostAfterRevert) -> Apply New (+NewQty, FinalCost)
    // Para ser atômico e seguro com a função updateStock existente:
    
    // Passo A: Remover estoque antigo
    await ProductService.updateStock(product.id, -oldEntry.quantity, costAfterRevert);
    
    // Passo B: Adicionar estoque novo
    await ProductService.updateStock(product.id, newQuantity, finalAvgCost);

    // 4.2 Atualizar a Entrada no Banco
    const updatedEntry = await StockRepository.updateEntry(entryId, {
      ...updates,
      totalPrice: newTotalValue
    });

    // 4.3 Registrar Movimentação de Ajuste
    // Em vez de duas movimentações (saída e entrada), vamos criar uma de "Correção"
    const movement = await StockRepository.createMovement({
      companyId: oldEntry.companyId,
      productId: oldEntry.productId,
      type: 'ajuste', 
      quantity: newQuantity - oldEntry.quantity, // Delta
      reason: `Correção de Entrada #${entryId.slice(0, 8)}`,
      cost: newTotalValue - oldEntryTotalVal, // Delta valor
      notes: `Edição de recebimento. De ${oldEntry.quantity}un x ${formatCurrency(oldEntry.unitPrice)} para ${newQuantity}un x ${formatCurrency(newUnitPrice)}`,
      userId: userId,
    });

    return { entry: updatedEntry, movement };
  }

  /**
   * Realiza balanço de estoque (ajuste direto para valor contado)
   */
  static async setStockBalance(
    companyId: string,
    productId: string,
    actualQuantity: number,
    userId: string,
    notes?: string
  ): Promise<StockMovement> {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new Error('Produto não encontrado');
    if (product.companyId !== companyId) throw new Error('Acesso negado');

    const difference = actualQuantity - product.currentStock;
    if (difference === 0) {
      throw new Error('O estoque atual já é igual à quantidade informada');
    }

    // Update product stock directly (absolute value)
    await ProductRepository.update(productId, { currentStock: actualQuantity });

    // Create adjustment movement
    return StockRepository.createMovement({
      companyId,
      productId,
      type: 'ajuste',
      quantity: difference,
      reason: 'Balanço de estoque',
      cost: Math.abs(difference * product.averageCost),
      userId,
      notes: notes || `Balanço realizado: de ${product.currentStock} para ${actualQuantity}`
    });
  }

  /**
   * Validações de entrada de estoque
   */
  private static validateStockEntry(entry: Partial<StockEntry>): void {
    if (!entry.companyId) {
      throw new Error('Empresa é obrigatória');
    }
    
    if (!entry.productId) {
      throw new Error('Produto é obrigatório');
    }

    if (!entry.supplierId) {
      throw new Error('Fornecedor é obrigatório');
    }

    if (!entry.quantity || entry.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    if (!entry.unitPrice || entry.unitPrice <= 0) {
      throw new Error('Preço unitário deve ser maior que zero');
    }
  }
}
