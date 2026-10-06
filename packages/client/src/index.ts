import type { AcceptedTask, ClaimResponse, DecisionAnswer, Detail, EventAcknowledgement, EventBatch, EventPage, HeartbeatResponse, Ownership, RegisterRunner, RunnerRegistration, TaskList, TaskSnapshot, TaskSubmission, TaskSummary } from '@flow/contracts';

export class FlowApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FlowApiError';
  }
}

export interface ClientOptions { baseUrl: string; token: string }

export class FlowClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  submit(input: TaskSubmission, key: string): Promise<AcceptedTask> {
    return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } });
  }

  list(options: { limit?: number; before?: string } = {}): Promise<TaskList> {
    const query = new URLSearchParams({ limit: String(options.limit ?? 40) });
    if (options.before) query.set('before', options.before);
    return this.request(`/api/tasks?${query}`);
  }

  show(id: string): Promise<TaskSnapshot> { return this.request(`/api/tasks/${encodeURIComponent(id)}`); }
  detail(id: string): Promise<Detail> { return this.request(`/api/details/${encodeURIComponent(id)}`); }
  events(id: string, after = 0): Promise<EventPage> { return this.request(`/api/tasks/${encodeURIComponent(id)}/events?after=${after}`); }

  decide(id: string, answer: DecisionAnswer, key: string): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(answer), headers: { 'Idempotency-Key': key } });
  }

  cancel(id: string, key: string): Promise<TaskSummary> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}', headers: { 'Idempotency-Key': key } });
  }

  registerRunner(input: RegisterRunner): Promise<RunnerRegistration> {
    return this.request('/api/runners', { method: 'POST', body: JSON.stringify(input) });
  }

  revokeRunner(id: string): Promise<{ revoked: boolean }> {
    return this.request(`/api/runners/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
  }

  claim(): Promise<ClaimResponse> { return this.request('/api/runner/claim', { method: 'POST', body: '{}' }); }
  heartbeat(ownership: Ownership): Promise<HeartbeatResponse> { return this.request('/api/runner/heartbeat', { method: 'POST', body: JSON.stringify(ownership) }); }
  report(batch: EventBatch): Promise<EventAcknowledgement> { return this.request('/api/runner/events', { method: 'POST', body: JSON.stringify(batch) }); }

  async *watch(id: string, after = 0, signal?: AbortSignal): AsyncGenerator<EventPage> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${encodeURIComponent(id)}/stream?after=${after}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: 'text/event-stream' }, signal });
    await assertResponse(response);
    if (!response.body) throw new Error('The center returned an empty event stream.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        pending = (pending + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
        if (pending.length > 2_000_000) throw new Error('Event stream exceeded the page limit.');
        const frames = pending.split('\n\n');
        pending = frames.pop() ?? '';
        for (const frame of frames) {
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (data) yield JSON.parse(data) as EventPage;
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15_000) });
    await assertResponse(response);
    return response.json() as Promise<T>;
  }
}

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
  throw new FlowApiError(response.status, body.error?.code ?? 'http_error', body.error?.message ?? `The center returned HTTP ${response.status}.`);
}
