import { describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import { OpenuiCard } from '../src/plugin';
import { namesLocalImage, payloadFromSavedFile, readSavedFile } from '../src/shared/surface-card';

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const pathKey = (path: string) => btoa(path).replace(/\+/g, '-').replace(/\//g, '_');
const saved = (program: string, images: [string, string][] = []) => [
  'Readable copy',
  ...images.map(([path, data]) => `<!-- hermes-openui:image ${pathKey(path)} image/png ${data} -->`),
  `<!-- hermes-openui:payload ${btoa(program)} -->`,
  '',
].join('\n');
const asDataUrl = (text: string) => `data:text/markdown;base64,${btoa(text)}`;
const program = 'root = Stack([ImageBlock("/tmp/photo.png", "A photo")])';

const props = (args: Record<string, unknown>, url: string): any => ({
  args, result: {}, sessionId: 's', toolName: 'openui_present', toolCallId: 't', fallback: <p>file card</p>,
  file: { name: 'a.md', kind: 'file', mime: 'text/markdown', path: '/x/a.md', resolveUrl: async () => url },
});

afterEach(cleanup);

describe('saved images', () => {
  it('reads the payload and every image from a saved file', () => {
    const file = readSavedFile('hermes-openui', asDataUrl(saved(program, [['/tmp/photo.png', PIXEL], ['/tmp/two.png', PIXEL]])));
    expect(file.payload).toBe(program);
    expect([...file.images.keys()]).toEqual(['/tmp/photo.png', '/tmp/two.png']);
    expect(file.images.get('/tmp/two.png')).toBe(`data:image/png;base64,${PIXEL}`);
  });

  it('ignores an image with a type it does not draw', () => {
    const text = saved(program, [['/tmp/photo.png', PIXEL]]).replace('image/png', 'image/svg+xml');
    expect(readSavedFile('hermes-openui', text).images.size).toBe(0);
  });

  it('keeps reading saved files written before images existed', () => {
    expect(payloadFromSavedFile('hermes-openui', asDataUrl(saved(program)))).toBe(program);
  });

  it('draws a local image from the saved file when the tool arguments are still there', async () => {
    await act(async () => { render(<OpenuiCard {...props({ program }, asDataUrl(saved(program, [['/tmp/photo.png', PIXEL]])))} />); });
    await waitFor(() => expect(document.querySelector('[data-openui-media] img')).not.toBeNull());
    expect(document.querySelector('[data-openui-media] img')!.getAttribute('src')).toBe(`data:image/png;base64,${PIXEL}`);
  });

  it('draws program and image from the saved file when the arguments are gone', async () => {
    await act(async () => { render(<OpenuiCard {...props({}, asDataUrl(saved(program, [['/tmp/photo.png', PIXEL]])))} />); });
    await waitFor(() => expect(document.querySelector('[data-openui-media] img')).not.toBeNull());
  });

  it('shows the alt text when the saved file has no such image', async () => {
    await act(async () => { render(<OpenuiCard {...props({ program }, asDataUrl(saved(program)))} />); });
    await waitFor(() => expect(screen.getByRole('img', { name: 'A photo' })).toBeTruthy());
    expect(document.querySelector('[data-openui-image-fallback]')).not.toBeNull();
  });
});

describe('image names', () => {
  it('finds a local image whose name has an apostrophe, and draws it', async () => {
    const path = "/tmp/Mary's cat.png";
    const code = `root = Stack([ImageBlock("${path}", "A cat")])`;
    expect(namesLocalImage(code)).toBe(true);
    await act(async () => { render(<OpenuiCard {...props({ program: code }, asDataUrl(saved(code, [[path, PIXEL]])))} />); });
    await waitFor(() => expect(document.querySelector('[data-openui-media] img')).not.toBeNull());
  });
  it('does not treat links or comments as local images', () => {
    expect(namesLocalImage('root = Stack([ImageBlock("https://example.com/a.png", "A")])')).toBe(false);
    expect(namesLocalImage('# "/tmp/a.png"\nroot = Stack([TextContent("hi")])')).toBe(false);
  });
});
