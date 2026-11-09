import { openuiPromptOptions } from '@openuidev/react-ui/genui-lib';
import { openuiLibrary } from './library';

/** Hermes Desktop's own rules, appended to the library's. Kept short: the library prompt carries the language. */
export const desktopRules = [
  'Pass the program in the `program` argument of openui_present, without a code fence. The program starts with `root = Stack([...])`. References, $variables and @Set/@Reset are supported; every statement must be reachable from root.',
  'At most 2.5 MB, 1000 components. Plain short answers stay prose. Mark synthetic data as examples.',
  'Not available (the whole program is rejected): Query(), Mutation(), @Run, tool calls, custom actions. Generated UI cannot call tools, fetch data, run code or open files.',
  'Actions: Button("Label") with no action sends its label; @ToAssistant("message", optionalContext) sends one ordinary chat message with an [A2UI_INTERACTION] attachment (context.renderer=openui; read context.message, context.form and context.values as user input). Buttons inside a Form include that Form\'s current values, including unchanged defaults. Only an explicit click sends; typing, selecting, tabs, accordions, carousels, steps, Modal and EditableTable edits stay local. A view locks once it has been answered.',
  '@OpenUrl("https://...") opens a web link in the system browser after a click; only http(s) and mailto links work. Any other action is shown disabled.',
  'Images: Image, ImageBlock, ImageGallery, ImageText, ImageTextLarge and the image slots of cards load https:, http: and data:image/* up to 2 MB. A local image also works: give its full path as the source (PNG, JPEG, GIF or WebP, up to 5 MB each and 10 MB per view) and it is copied into the view. Never invent a URL or path. A failed image shows its alt text, so always give a meaningful alt.',
  'Never send or apply anything on the user\'s behalf from a button label alone: a planning or review button is not consent to send mail, schedule, book or change data.',
  'Use one unique name per Form field (at most 16 fields per Form) and never nest Forms. Give every Form a Buttons(...) argument.',
];

export const libraryPrompt = openuiLibrary.prompt({
  ...openuiPromptOptions,
  preamble: 'You write OpenUI Lang programs (the published @openuidev/react-ui openuiLibrary) that Hermes draws inline in the chat. Where the instructions below say your ENTIRE response must be openui-lang, that applies only to the program passed to openui_present; the rest of your reply is normal chat.',
  additionalRules: [...(openuiPromptOptions.additionalRules ?? []), ...desktopRules],
  toolCalls: false,
  bindings: true,
  builtinFunctions: true,
});
export { openuiLibrary };
export const librarySchema = openuiLibrary.toJSONSchema();
