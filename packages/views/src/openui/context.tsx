import { createContext, useContext } from 'react';
export type Fields = Record<string,string|boolean|number|string[]>;
export const InteractionContext=createContext<{disabled:boolean;send:(message:string,form?:string,values?:Fields)=>void}>({disabled:true,send:()=>{}});
export const FormContext=createContext<{name:string;values:Fields;set:(name:string,value:Fields[string])=>void}|null>(null);
export const useInteraction=()=>useContext(InteractionContext);
/** The host's `renderMedia` for MEDIA: paths declared in the same reply (legacy renderer images). */
export const MediaContext=createContext<((path:string)=>import('react').ReactNode)|null>(null);
