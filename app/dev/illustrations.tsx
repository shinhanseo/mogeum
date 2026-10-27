import { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { loadBundledSvg } from '../../src/components/BundledSvg';
import { DrinkArt, BookmarkArt } from '../../src/features/discovery/DrinkArt';

const assets = [require('../../assets/discovery/whisky.svg'), require('../../assets/discovery/beer.svg'), require('../../assets/discovery/wine.svg'), require('../../assets/discovery/traditional.svg'), require('../../assets/discovery/bookmark.svg')];
/** Bundled originals only; does not read a session, user files or remote product images. */
export default function IllustrationProbe() {
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    if (!__DEV__) return;
    let alive = true;
    void Promise.all(assets.map(async module => {
      const xml = await loadBundledSvg(module);
      return { sha256: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, xml), nonEmpty: xml.length > 100, svgRoot: xml.trim().startsWith('<svg') };
    })).then(async items => {
      const report = { platform: Platform.OS, status: items.every(item => item.nonEmpty && item.svgRoot) ? 'passed' : 'failed', items };
      await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}illustration-probe.json`, JSON.stringify(report));
      if (alive) setStatus(JSON.stringify(report, null, 2));
    }).catch(() => { if (alive) setStatus('failed · bundled SVG loading'); });
    return () => { alive = false; };
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 16 }}><Text>개발 검증 · Figma 원본 SVG · 서버 저장 없음</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(['whisky', 'beer', 'wine', 'traditional'] as const).map(category => <DrinkArt key={category} category={category} />)}<BookmarkArt /></View><Text selectable>{status}</Text></ScrollView>;
}
