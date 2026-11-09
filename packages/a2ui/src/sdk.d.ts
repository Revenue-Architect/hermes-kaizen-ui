declare module '@hermes/plugin-sdk' {
  import type { ReactNode, ComponentType, ButtonHTMLAttributes, InputHTMLAttributes, HTMLAttributes, SVGProps } from 'react';
  export const Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }>;
  export const Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
  export const Badge: ComponentType<HTMLAttributes<HTMLSpanElement> & { variant?: string }>;
  export const Checkbox: ComponentType<{ checked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; id?: string; 'aria-label'?: string }>;
  export const icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>>;
  export const Dialog: ComponentType<{ children?: ReactNode }>;
  export const DialogTrigger: ComponentType<{ asChild?: boolean; children?: ReactNode }>;
  export const DialogContent: ComponentType<HTMLAttributes<HTMLDivElement> & { children?: ReactNode; showCloseButton?: boolean; fitContent?: boolean }>;
  export const DialogHeader: ComponentType<HTMLAttributes<HTMLDivElement> & { children?: ReactNode }>;
  export const DialogTitle: ComponentType<HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }>;
  export const TOOL_MEDIA_RENDERER_AREA: string;
  interface ReadableStore<T> { get(): T; listen(listener: (value: T) => void): () => void }
  export function useValue<T>(store: ReadableStore<T>): T;
  export const host: {
    composer: { submit(sessionId: string | null, text: string): boolean };
    state: {
      busyBySession: ReadableStore<Record<string, boolean>>;
      focusedSessionId: ReadableStore<string | null>;
      focusedStoredSessionId: ReadableStore<string | null>;
    };
  };
  export interface ToolMediaRendererProps {
    file: { path: string; name: string; kind: string; mime: string; resolveUrl(): Promise<string> };
    toolName: string; toolCallId: string; args: Record<string, unknown>; result: unknown;
    sessionId: string | null; fallback: ReactNode;
  }
  export interface PluginContext {
    register(contribution:{id:string;area:string;title?:string;data?:unknown}): () => void;
    onDispose(callback:()=>void):void;
    storage: { get<T>(key:string, fallback:T): T; set(key:string, value:unknown): void; remove(key:string): void };
  }
  export interface HermesPlugin { id:string;name?:string;defaultEnabled?:boolean;register(ctx:PluginContext):void }
}
