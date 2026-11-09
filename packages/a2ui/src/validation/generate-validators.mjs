import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const contractRoot = join(here, "../contracts/v0_9");
const readJson = (name) => JSON.parse(readFileSync(join(contractRoot, name), "utf8"));
const basic = readJson("catalog-v0_9-basic.json");
const common = readJson("common-types-v0_9.json");
const extensions = readJson("extension-schemas.json");
const legacy = readJson("legacy-custom-component-schemas.json");
const manifest = readJson("registry-manifest.json");

const ajv = new Ajv2020({
  allErrors: false,
  strict: false,
  strictSchema: false,
  validateFormats: false,
  discriminator: true,
  unevaluated: true,
  code: { source: true, esm: true, optimize: 2 },
});
ajv.addSchema(common);
ajv.addSchema(basic, basic.$id);
ajv.addSchema({ ...basic, $id: "https://a2ui.org/specification/v0_9/catalog.json" }, "https://a2ui.org/specification/v0_9/catalog.json");

const names = [...manifest.basicEnabled, ...Object.keys(legacy), ...Object.keys(extensions)];
const validatorRefs = Object.create(null);
for (const name of names) {
  const id = `https://a2ui-hermes.invalid/v0_9/components/${name}.json`;
  const schema = basic.components[name]
    ? { $id: id, $ref: `${basic.$id}#/components/${name}` }
    : { ...combineCustom(name, legacy[name] ?? extensions[name]), $id: id };
  if (!schema) throw new Error(`Missing local schema for ${name}`);
  ajv.addSchema(schema, id);
  validatorRefs[name] = id;
}

const output = standaloneCode(ajv, validatorRefs);
const modulePath = join(here, "validators.generated.js");
const declarationPath = join(here, "validators.generated.d.ts");
writeFileSync(modulePath, `${output.trimEnd()}\n`, "utf8");
writeFileSync(
  declarationPath,
  `import type { ValidateFunction } from "ajv";\n${names.map((name) => `export const ${name}: ValidateFunction;`).join("\n")}\n`,
  "utf8",
);
process.stdout.write(`Generated ${names.length} standalone local validators at ${modulePath}\n`);

function combineCustom(name, sourceSchema) {
  if (!sourceSchema || typeof sourceSchema !== "object") return undefined;
  return {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1, maxLength: 128 },
      component: { const: name },
      accessibility: { $ref: "https://a2ui.org/specification/v0_9/common_types.json#/$defs/AccessibilityAttributes" },
      weight: { type: "number" },
      ...sourceSchema.properties,
    },
    required: ["id", "component", ...(sourceSchema.required ?? [])],
    additionalProperties: false,
  };
}
