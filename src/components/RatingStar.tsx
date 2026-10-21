import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
// Original path from Figma 48:1162; fill reflects the selected state.
export function RatingStar({ filled }: { filled: boolean }) {
 return <Svg width={24} height={24} viewBox="40 556 24 24"><Path d="M52 557.5L55.2445 564.075L62.5 565.13L57.25 570.247L58.489 577.473L52 574.061L45.511 577.473L46.75 570.247L41.5 565.13L48.7555 564.075L52 557.5Z" fill={filled ? colors.primary : 'none'} stroke={colors.primary} strokeWidth={1.75} strokeLinejoin="round" /></Svg>;
}
