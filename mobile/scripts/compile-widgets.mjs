import babel from '@babel/core';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const preset = require('expo/node_modules/babel-preset-expo');

const projectRoot = path.resolve(import.meta.dirname, '..');
const dir = path.join(projectRoot, 'src/widgets');
const sourceDir = path.join(dir, 'source');
const widgets = ['StreakWidget', 'StatsWidget', 'DailyRewardWidget'];

for (const name of widgets) {
  const sourceFile = path.join(sourceDir, `${name}.js`);
  const outFile = path.join(dir, `${name}.js`);
  const source = fs.readFileSync(sourceFile, 'utf8');
  const { code } = babel.transformSync(source, {
    presets: [preset],
    filename: sourceFile,
    babelrc: false,
    configFile: false,
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: true },
  });
  const marker = `var ${name}=`;
  const start = code.indexOf(marker);
  if (start === -1) {
    throw new Error(`Failed to extract compiled layout for ${name}`);
  }
  const literalStart = start + marker.length;
  if (code[literalStart] !== '`') {
    throw new Error(`Unexpected layout format for ${name}`);
  }
  let i = literalStart + 1;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
      continue;
    }
    if (code[i] === '`') {
      break;
    }
    i += 1;
  }
  let layout = code.slice(literalStart, i + 1);
  // Widget JS runtime (JavaScriptCore) evaluates this string directly.
  layout = layout.replace(/\/\*#__PURE__\*\//g, '');
  const out = `import { createWidget } from 'expo-widgets';

// Auto-generated from src/widgets/source/${name}.js — run: node scripts/compile-widgets.mjs
const layout = ${layout};

export default createWidget('${name}', layout);
`;
  fs.writeFileSync(outFile, out);
  console.log(`Compiled ${name} (${layout.length} chars)`);
}
