import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { A2uiCard } from '../src/plugin';
import { validateAndNormalize } from '../src/validation/index';

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const CATALOG = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
const payload = (components: object[]) => [
  { version: 'v0.9', createSurface: { surfaceId: 's', catalogId: CATALOG } },
  { version: 'v0.9', updateComponents: { surfaceId: 's', components } },
].map((line) => JSON.stringify(line)).join('\n');
const pathKey = (path: string) => btoa(path).replace(/\+/g, '-').replace(/\//g, '_');
const savedFile = (text: string, images: string[] = []) => `data:text/markdown;base64,${btoa([
  'Readable copy',
  ...images.map((path) => `<!-- hermes-a2ui:image ${pathKey(path)} image/png ${PIXEL} -->`),
  `<!-- hermes-a2ui:payload ${btoa(text)} -->`,
  '',
].join('\n'))}`;
const props = (args: Record<string, unknown>, url: string): any => ({
  args, result: {}, sessionId: 's', toolName: 'a2ui_present', toolCallId: 't', fallback: <p>file card</p>,
  file: { name: 'a.md', kind: 'file', mime: 'text/markdown', path: '/x/a.md', resolveUrl: async () => url },
});

afterEach(cleanup);

describe('A2UI images', () => {
  it('accepts an Image component', () => {
    expect(validateAndNormalize(payload([{ id: 'root', component: 'Image', url: '/tmp/a.png', description: 'A' }])).ok).toBe(true);
  });

  it('draws a local Image from the saved file', async () => {
    const text = payload([{ id: 'root', component: 'Image', url: '/tmp/a.png', description: 'A chart', variant: 'mediumFeature' }]);
    await act(async () => { render(<A2uiCard {...props({ payload: text }, savedFile(text, ['/tmp/a.png']))} />); });
    await waitFor(() => expect(screen.getByRole('img', { name: 'A chart' }).getAttribute('src')).toBe(`data:image/png;base64,${PIXEL}`));
    expect((screen.getByRole('img', { name: 'A chart' }) as HTMLImageElement).style.width).toBe('240px');
  });

  it('draws an https Image without reading the saved file', async () => {
    let read = false;
    const text = payload([{ id: 'root', component: 'Image', url: 'https://example.com/a.png', description: 'Web' }]);
    const base = props({ payload: text }, '');
    base.file.resolveUrl = async () => { read = true; return ''; };
    await act(async () => { render(<A2uiCard {...(base as any)} />); });
    expect(screen.getByRole('img', { name: 'Web' }).getAttribute('src')).toBe('https://example.com/a.png');
    expect(read).toBe(false);
  });

  it('shows the description when the image is not in the saved file', async () => {
    const text = payload([{ id: 'root', component: 'Image', url: '/tmp/gone.png', description: 'Gone' }]);
    await act(async () => { render(<A2uiCard {...props({ payload: text }, savedFile(text))} />); });
    await waitFor(() => expect(screen.getByRole('img', { name: 'Gone' }).tagName).toBe('SPAN'));
  });

  it('fills the existing media slots', async () => {
    const text = payload([{ id: 'root', component: 'BeforeAfterViewer', title: 'T', before: 'B', after: 'A', beforeMedia: '/tmp/b.png', afterMedia: '/tmp/b.png' }]);
    await act(async () => { render(<A2uiCard {...props({ payload: text }, savedFile(text, ['/tmp/b.png']))} />); });
    await waitFor(() => expect(document.querySelector('img')?.getAttribute('src')).toBe(`data:image/png;base64,${PIXEL}`));
  });
});

describe('A2UI image names', () => {
  it('draws a local Image whose name has an apostrophe', async () => {
    const path = "/tmp/Mary's cat.png";
    const text = payload([{ id: 'root', component: 'Image', url: path, description: 'Cat' }]);
    await act(async () => { render(<A2uiCard {...props({ payload: text }, savedFile(text, [path]))} />); });
    await waitFor(() => expect(screen.getByRole('img', { name: 'Cat' }).getAttribute('src')).toBe(`data:image/png;base64,${PIXEL}`));
  });
});
