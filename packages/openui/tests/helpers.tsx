import { vi } from 'vitest';
import type { BlockProps as TranscriptCodeBlockProps } from '../src/v2/block';

export const props = (code: string, o: Partial<TranscriptCodeBlockProps> = {}): TranscriptCodeBlockProps => ({ code, fenceClosed: true, streaming: false, readOnly: false, busy: false,
  origin: { messageId: 'example-message', blockIndex: 2 },
  submitInteraction: vi.fn(async () => ({ status: 'accepted' as const })), renderMedia: () => null, ...o });
