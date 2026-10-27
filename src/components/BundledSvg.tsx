import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';

const pending = new Map<number, Promise<string>>();
/** Android asset:/ URIs cannot be fetched like HTTP. Read the downloaded original XML unchanged. */
export function loadBundledSvg(module: number) {
  let value = pending.get(module);
  if (!value) {
    value = (async () => {
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      const xml = Platform.OS === 'web'
        ? await (await fetch(asset.uri)).text()
        : await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
      if (!xml.trim().startsWith('<svg')) throw new Error('INVALID_BUNDLED_SVG');
      return xml;
    })();
    pending.set(module, value);
    void value.catch(() => { if (pending.get(module) === value) pending.delete(module); });
  }
  return value;
}
export function BundledSvg({ module }: { module: number }) {
  const [loaded, setLoaded] = useState<{ module: number; xml: string } | null>(null);
  useEffect(() => {
    let active = true;
    void loadBundledSvg(module).then(xml => { if (active) setLoaded({ module, xml }); }).catch(() => {});
    return () => { active = false; };
  }, [module]);
  return loaded?.module === module ? <SvgXml xml={loaded.xml} /> : null;
}
