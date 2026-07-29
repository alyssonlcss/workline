// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import pLimit from 'p-limit';

export interface QueueTaskOptions<T> {
  id: string;
  onProgress?: (message: string) => void;
  task: () => Promise<T>;
}

export interface QueueItem {
  id: string;
  enqueuedAt: Date;
  status: 'waiting' | 'running' | 'completed' | 'failed';
}

export class ExtractionQueueManager {
  private readonly limiter;
  private readonly queueMap = new Map<string, QueueItem>();
  private activeCount = 0;

  public constructor(public readonly concurrencyLimit: number = 3) {
    this.limiter = pLimit(concurrencyLimit);
  }

  public getQueueLength(): number {
    return this.limiter.activeCount + this.limiter.pendingCount;
  }

  public getQueuePosition(id: string): { position: number; totalWaiting: number } {
    let position = 1;
    for (const [key, item] of this.queueMap.entries()) {
      if (key === id) break;
      if (item.status === 'waiting') position++;
    }
    const totalWaiting = this.limiter.pendingCount;
    return { position, totalWaiting };
  }

  public async enqueue<T>(options: QueueTaskOptions<T>): Promise<T> {
    const item: QueueItem = {
      id: options.id,
      enqueuedAt: new Date(),
      status: 'waiting',
    };
    this.queueMap.set(options.id, item);

    const { position, totalWaiting } = this.getQueuePosition(options.id);
    if (this.limiter.activeCount >= this.concurrencyLimit) {
      options.onProgress?.(`Solicitação na fila de espera (Posição ${position} de ${totalWaiting + 1})...`);
    }

    return this.limiter(async () => {
      item.status = 'running';
      this.activeCount++;
      try {
        options.onProgress?.('Iniciando processamento da requisição...');
        const result = await options.task();
        item.status = 'completed';
        return result;
      } catch (error) {
        item.status = 'failed';
        throw error;
      } finally {
        this.activeCount--;
        this.queueMap.delete(options.id);
      }
    });
  }
}
