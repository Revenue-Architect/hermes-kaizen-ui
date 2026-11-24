import type { HermesPlugin } from '@hermes/plugin-sdk';
import a2ui from './a2ui/plugin';
import openui from './openui/plugin';
import { PLUGIN_ID } from './shared/plugin-id';

// One Desktop half for both toolsets: each renderer draws only its own tool's results.
const plugin: HermesPlugin = {
  id: PLUGIN_ID,
  name: 'GenUI',
  register(ctx) {
    a2ui.register(ctx);
    openui.register(ctx);
  },
};
export default plugin;
