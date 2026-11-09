import { useEffect, useMemo, useState, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react';
import { classifyImageSrc, safeCssImageValue } from '../shared/images';
import { useSurface } from './surface';

/**
 * The library's compiled code renders through this policy (see jsx-shim.tsx). Every <img> and <a>
 * the generated UI can produce is replaced by a safe equivalent, and inline styles may not carry
 * unsafe url() values. Nothing here depends on which component asked for the image.
 */
function ImageFallback({ alt, className, style, width, height }: { alt?: string; className?: string; style?: CSSProperties; width?: number | string; height?: number | string }) {
  const { backgroundImage: _bg, ...rest } = (style ?? {}) as CSSProperties;
  void _bg;
  return <span role="img" aria-label={alt || 'Image unavailable'} data-openui-image-fallback="" className={['hermes-openui-image-fallback', className].filter(Boolean).join(' ')}
    style={{ ...rest, ...(width ? { width } : {}), ...(height ? { height } : {}) }}>{alt || 'Image unavailable'}</span>;
}

export function SafeImg(props: ComponentPropsWithRef<'img'>) {
  const surface = useSurface();
  const { src, alt, className, style, width, height, onError, onLoad, crossOrigin: _c, referrerPolicy: _r, srcSet: _s, sizes: _z, ...rest } = props;
  void _c; void _r; void _s; void _z;
  const decision = useMemo(() => classifyImageSrc(src), [src]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (surface.noImages) return <ImageFallback alt={alt} className={className} style={style} width={width} height={height} />;
  if (decision.kind === 'media') {
    const media = surface.renderMedia?.(decision.path, { alt });
    return media ? <span className="hermes-openui-media" data-openui-media="">{media}</span> : <ImageFallback alt={alt} className={className} style={style} width={width} height={height} />;
  }
  if (decision.kind === 'reject' || failed) return <ImageFallback alt={alt} className={className} style={style} width={width} height={height} />;
  return <img {...rest} src={decision.src} alt={alt ?? ''} className={className} style={style} width={width} height={height}
    referrerPolicy="no-referrer" decoding="async" draggable={false}
    onLoad={onLoad} onError={(event) => { setFailed(true); onError?.(event); }} />;
}

const EXTERNAL = /^(?:https?:\/\/|mailto:)/i;
export function SafeLink(props: ComponentPropsWithRef<'a'>) {
  const surface = useSurface();
  const { href, children, onClick, target: _t, rel: _rel, download: _d, ping: _p, referrerPolicy: _r, ...rest } = props;
  void _t; void _rel; void _d; void _p; void _r;
  const ok = typeof href === 'string' && EXTERNAL.test(href.trim()) && !/[\u0000-\u001f\u007f]/.test(href);
  if (!ok || !surface.openExternal) {
    return <span {...(rest as object)} data-openui-link-disabled="" title={typeof href === 'string' ? href : undefined}>{children as ReactNode}</span>;
  }
  return <a {...rest} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
    onClick={(event) => { event.preventDefault(); event.stopPropagation(); try { void surface.openExternal?.(href!.trim()); } catch { /* the bridge refused the URL */ } onClick?.(event); }}>{children}</a>;
}

function cleanStyle(style: unknown): unknown {
  if (!style || typeof style !== 'object') return style;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style as Record<string, unknown>)) {
    if (typeof value === 'string' && /url\(|image-set\(|-webkit-image-set\(/i.test(value) && (!safeCssImageValue(value) || /image-set\(/i.test(value))) { changed = true; continue; }
    next[key] = value;
  }
  return changed ? next : style;
}

const BLOCKED = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'form', 'video', 'audio', 'source', 'track', 'portal', 'applet']);

/** Returns the element type and props to actually render. */
export function applyElementPolicy(type: unknown, props: Record<string, unknown>): [unknown, Record<string, unknown>] {
  if (typeof type !== 'string') return [type, props];
  if (type === 'img') return [SafeImg, props];
  if (type === 'a') return [SafeLink, props];
  if (BLOCKED.has(type)) return ['span', { 'data-openui-blocked-element': type }];
  let next = props;
  if ('style' in props) { const style = cleanStyle(props.style); if (style !== props.style) next = { ...next, style }; }
  if (type !== 'span' && ('srcSet' in next || 'srcset' in next)) { const { srcSet: _a, srcset: _b, ...rest } = next as Record<string, unknown>; void _a; void _b; next = rest; }
  return [type, next];
}
