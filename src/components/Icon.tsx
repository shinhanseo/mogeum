import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';
export function Icon({ name, size = 24, color = colors.muted }: { name: 'shelf' | 'heart' | 'plus' | 'search' | 'close' | 'photo'; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {name === 'shelf' && <><Rect x="4" y="4" width="16" height="16" rx="3" /><Path d="M12 4v16M4 12h16" /></>}
    {name === 'heart' && <Path d="M20.5 5.5C17 2 13.5 4 12 6 10.5 4 7 2 3.5 5.5-1 10 6 16 12 21c6-5 13-11 8.5-15.5Z" />}
    {name === 'plus' && <Path d="M12 4v16M4 12h16" />}
    {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" />}
    {name === 'search' && <><Circle cx="10.5" cy="10.5" r="6.5" /><Path d="m16 16 5 5" /></>}
    {name === 'photo' && <><Rect x="3" y="4" width="18" height="16" rx="3" /><Circle cx="8" cy="9" r="1" /><Path d="m4 17 5-5 4 4 3-3 5 5" /></>}
  </Svg>;
}
