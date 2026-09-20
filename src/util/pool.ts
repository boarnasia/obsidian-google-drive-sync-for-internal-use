/**
 * 同時実行数に上限を付けて回す。
 *
 * 全部を一度に走らせると、数百ファイルの同期で数百のリクエストが同時に飛び、
 * Drive の 429 とネットワークの詰まりを自分で作る。上限を付けたまま並べると、
 * 往復待ちだけが重なって消える。
 */
export async function runPool<T>(items: Iterable<T>, limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < queue.length) await fn(queue[next++]);
  };
  const workers = Math.max(1, Math.min(limit, queue.length));
  await Promise.all(Array.from({ length: workers }, worker));
}
