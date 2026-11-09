import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { classifyImageSrc, MAX_DATA_IMAGE_BYTES, safeCssImageValue } from '../src/v2/images';
import { LibraryOpenuiBlock, setOpenExternal } from '../src/v2/block';
import { props } from './helpers';
afterEach(cleanup);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('image source policy', () => {
  for (const ok of ['https://example.com/a.png', 'http://example.com/a.png', 'http://192.168.1.20:8080/cam.jpg', 'http://nas.local/p.webp', 'http://[::1]/a.png', png, 'data:image/svg+xml;base64,PHN2Zy8+'])
    it('allows ' + ok.slice(0, 40), () => expect(classifyImageSrc(ok).kind).toBe('url'));
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'file:///C:/secret.png', 'blob:https://x/1', 'ftp://x/a.png', 'vbscript:x', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,@@@', 'data:application/javascript,alert(1)', '//cdn.example.com/a.png', 'relative/a.png', 'a.png', '', '   ', 'https://user:pass@example.com/a.png', 'ws://x/a.png', 'chrome://settings', 42, null, undefined])
    it('rejects ' + JSON.stringify(bad)?.slice(0, 40), () => expect(classifyImageSrc(bad).kind).toBe('reject'));
  it('limits data:image to 2 MB decoded', () => {
    const exact = 'data:image/png;base64,' + 'A'.repeat(Math.floor(MAX_DATA_IMAGE_BYTES / 3) * 4);
    expect(classifyImageSrc(exact).kind).toBe('url');
    expect(classifyImageSrc('data:image/png;base64,' + 'A'.repeat(Math.ceil((MAX_DATA_IMAGE_BYTES + 3) / 3) * 4)).kind).toBe('reject');
  });
  it('treats scheme-less absolute image paths and MEDIA: declarations as Hermes artifacts', () => {
    expect(classifyImageSrc('/tmp/chart.png')).toEqual({ kind: 'media', path: '/tmp/chart.png' });
    expect(classifyImageSrc('MEDIA:/tmp/chart.png')).toEqual({ kind: 'media', path: '/tmp/chart.png' });
    expect(classifyImageSrc('C:\\Users\\k\\a.jpg').kind).toBe('media');
    expect(classifyImageSrc('/etc/passwd').kind).toBe('reject');
  });
  it('css url() values are screened too', () => {
    expect(safeCssImageValue('url("https://example.com/a.png")')).toBe(true);
    expect(safeCssImageValue('url(javascript:alert(1))')).toBe(false);
    expect(safeCssImageValue('url("file:///x.png")')).toBe(false);
    expect(safeCssImageValue('linear-gradient(red, blue)')).toBe(true);
  });
});

describe('rendered images', () => {
  const prog = (src: string, alt = 'Alt text here') => `root = Stack([Image("${alt}", "${src}")])`;
  it('loads https with no referrer and no credentials', () => {
    const { container } = render(<LibraryOpenuiBlock {...props(prog('https://example.com/a.png'))} />);
    const img = container.querySelector('img')!; expect(img.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer'); expect(img.hasAttribute('crossorigin')).toBe(false);
  });
  it('loads http LAN hosts and small data:image', () => {
    for (const src of ['http://192.168.1.5:3000/x.jpg', png]) { const { container, unmount } = render(<LibraryOpenuiBlock {...props(prog(src))} />); expect(container.querySelector('img')).not.toBeNull(); unmount(); }
  });
  for (const src of ['javascript:alert(1)', 'file:///C:/secret.png', 'data:text/html;base64,PGgxPg==', 'blob:https://x/1'])
    it('rejects ' + src.slice(0, 22) + ' and shows styled alt text, no <img>', () => {
      const { container } = render(<LibraryOpenuiBlock {...props(prog(src))} />);
      expect(container.querySelector('img')).toBeNull();
      const fb = container.querySelector('[data-openui-image-fallback]')!; expect(fb.textContent).toBe('Alt text here');
    });
  it('falls back to alt text when the image fails to load', () => {
    const { container } = render(<LibraryOpenuiBlock {...props(prog('https://example.com/missing.png', 'Missing photo'))} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull(); expect(container.querySelector('[data-openui-image-fallback]')!.textContent).toBe('Missing photo');
  });
  it('delegates declared artifacts to the host media renderer, and shows alt text when the host has none', () => {
    const renderMedia = vi.fn((path: string) => <span data-testid="media">{path}</span>);
    const { container, unmount } = render(<LibraryOpenuiBlock {...props(prog('MEDIA:/tmp/chart.png'), { renderMedia })} />);
    expect(renderMedia).toHaveBeenCalledWith('/tmp/chart.png'); expect(screen.getByTestId('media').textContent).toBe('/tmp/chart.png'); expect(container.querySelector('img')).toBeNull(); unmount();
    const r = render(<LibraryOpenuiBlock {...props(prog('/tmp/chart.png'), { renderMedia: undefined as any })} />);
    expect(r.container.querySelector('[data-openui-image-fallback]')).not.toBeNull();
  });
  it('every image-bearing component routes through the policy', () => {
    const code = `root = Stack([ImageBlock("javascript:1", "a"), ImageGallery([{src: "file:///x.png", alt: "b"}]), ImageText("javascript:2", "c", "T"), ImageTextLarge("file:///y.png", "d", "T"), ListBlock([ListItem("L", "s", {src: "javascript:3", alt: "e"})], "image")])`;
    const { container } = render(<LibraryOpenuiBlock {...props(code)} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:|file:\/\//i);
  });
  it('markdown links never navigate: only http(s)/mailto, only through the audited bridge', () => {
    const open = vi.fn(); setOpenExternal(open);
    try {
      const { container } = render(<LibraryOpenuiBlock {...props('root = Stack([MarkDownRenderer("[good](https://example.com/x) and [bad](javascript:alert(1))")])')} />);
      const a = container.querySelector('a')!; expect(a.getAttribute('rel')).toContain('noopener'); expect(a.getAttribute('target')).toBe('_blank');
      expect(container.querySelectorAll('a').length).toBe(1);
      expect(fireEvent.click(a)).toBe(false); expect(open).toHaveBeenCalledWith('https://example.com/x');
    } finally { setOpenExternal(undefined); }
  });
});
