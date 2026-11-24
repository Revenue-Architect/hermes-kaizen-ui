import { vi } from 'vitest';
import * as React from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react';
export function Button({ variant: _variant, size: _size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: string; size?: string}) { return <button {...props}/>; }
export function Badge({ variant: _variant, ...props }: HTMLAttributes<HTMLSpanElement> & {variant?:string}) { return <span {...props}/>; }
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props}/>; }
export const TOOL_MEDIA_RENDERER_AREA = 'transcript.toolMedia';
const atom = <T,>(value: T) => ({ get: () => value, listen: () => () => undefined });
export const host = {
  composer: { submit: vi.fn(() => true) },
  state: { busyBySession: atom<Record<string, boolean>>({}), focusedSessionId: atom<string | null>(null), focusedStoredSessionId: atom<string | null>(null) },
};
export const useValue = <T,>(store: { get(): T }): T => store.get();
export function Checkbox({ checked, onCheckedChange, ...props }: {checked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; id?: string; 'aria-label'?: string}) { return <input type="checkbox" checked={checked} onChange={event => onCheckedChange?.(event.target.checked)} {...props}/>; }

const iconExports = [
  'AlertCircle', 'AlertTriangle', 'AudioLines', 'BarChart3', 'Bell', 'Bookmark',
  'BookmarkFilled', 'Box', 'Check', 'CheckCircle2', 'ChevronLeft', 'ChevronRight',
  'Clock', 'Cpu', 'CreditCard', 'CircleLetterA', 'Download', 'Eye', 'EyeOff',
  'ExternalLink', 'FileText', 'FolderOpen', 'Globe', 'HelpCircle', 'ImageIcon',
  'Info', 'LayoutDashboard', 'Link', 'Lock', 'LogIn', 'Mail', 'MoreHorizontal',
  'MoreVertical', 'Network', 'NotebookTabs', 'Package', 'Pause', 'Pencil', 'Play',
  'Plus', 'RefreshCw', 'Search', 'Send', 'Settings', 'Starmap', 'StopFilled',
  'Trash2', 'Upload', 'Users', 'Volume2', 'VolumeX', 'X',
] as const;
export const icons = Object.fromEntries(iconExports.map(name => [name, (props: React.SVGProps<SVGSVGElement>) => <svg data-sdk-icon={name} {...props}/>])) as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;

type DialogState = { open: boolean; setOpen: (open: boolean) => void };
const DialogContext = React.createContext<DialogState>({ open: false, setOpen: () => undefined });
export function Dialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <DialogContext.Provider value={{open, setOpen}}>{children}</DialogContext.Provider>;
}
export function DialogTrigger({ asChild, children }: { asChild?: boolean; children?: React.ReactNode }) {
  const { setOpen } = React.useContext(DialogContext);
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, { onClick: event => { child.props.onClick?.(event); setOpen(true); } });
  }
  return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
}
export function DialogContent({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode; showCloseButton?: boolean; fitContent?: boolean }) {
  const { open, setOpen } = React.useContext(DialogContext);
  if (!open) return null;
  return <div role="dialog" aria-modal="true" {...props}><button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>{children}</div>;
}
export function DialogHeader({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) { return <div {...props}>{children}</div>; }
export function DialogTitle({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) { return <h2 {...props}>{children}</h2>; }
