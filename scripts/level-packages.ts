import type { Plugin } from 'vite';
import type { OutputChunk, OutputBundle } from 'rollup';
import { levels, type LevelId } from '../src/levels';
import { levelTextures } from '../src/assets/catalog';
// Only the static dependency closure of the menu is precached. Each dynamic
// level entry has its own offline package; following dynamicImports here would
// silently download the entire game again.
export function levelPackages(media: Record<string, string>, portraits: string[]) {
  const shellFiles = new Set<string>(['index.html', 'level-packages.json']);
  const plugin: Plugin = {
    name: 'spaceslop-level-packages',
    apply: 'build',
    generateBundle(_options, bundle: OutputBundle) {
      const chunks = Object.values(bundle).filter((item): item is OutputChunk => item.type === 'chunk');
      const entry = (suffix: string) => {
        const c = chunks.find(c => c.facadeModuleId?.replaceAll('\\', '/').endsWith(suffix) || Object.keys(c.modules).some(id => id.replaceAll('\\', '/').endsWith(suffix)));
        if (!c)
          throw Error('Missing bundle entry: ' + suffix);
        return c.fileName;
      };
      function closure(file: string, files = new Set<string>()) {
        if (files.has(file))
          return files;
        files.add(file);
        const c = bundle[file];
        if (c?.type === 'chunk') {
          for (const dependency of c.imports)
            closure(dependency, files);
          for (const css of (c as OutputChunk & {
            viteMetadata?: {
              importedCss: Set<string>;
            };
          }).viteMetadata?.importedCss ?? [])
            files.add(css);
        }
        return files;
      }
      for (const file of closure(entry('/index.html')))
        shellFiles.add(file);
      for (const c of chunks)
        if (c.facadeModuleId?.includes('workbox-window'))
          shellFiles.add(c.fileName);
      const session = entry('/src/app/flight-session.ts');
      const packages = Object.fromEntries((Object.keys(levels) as LevelId[]).map(id => {
        const levelEntry = entry(`/src/rendering/levels/${id}.ts`);
        const required = new Set([...closure(session), ...closure(levelEntry)]);
        return [id, {
          entry: levelEntry,
          required: [...required].sort(),
          media: [...portraits, ...levelTextures[id].map(key => media[key]).filter(Boolean)]
        }];
      }));
      this.emitFile({
        type: 'asset',
        fileName: 'level-packages.json',
        source: JSON.stringify({ version: 1, levels: packages })
      });
    },
  };
  return { plugin, shellFiles };
}
