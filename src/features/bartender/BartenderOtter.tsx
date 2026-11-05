import Svg, { Path, Ellipse, G } from "react-native-svg";
import { colors } from "../../theme/tokens";
/** Preview otter redrawn as a small vector; no bitmap UI or generated label art. */
export function BartenderOtter({ size = 76 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 106 106" accessible={false}>
      <G
        stroke="#674C3C"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M67 83Q105 78 99 91Q89 100 67 94" fill="#CCB09A" />
        <Path
          d="M17 29Q7 20 18 18Q28 6 47 7Q66 6 78 18Q89 19 80 30Q87 45 79 58Q88 81 73 94Q49 104 23 93Q9 80 17 59Q8 44 17 29Z"
          fill="#CCB09A"
        />
        <Ellipse cx={48} cy={42} rx={32} ry={17} fill="#FFF0DB" stroke="none" />
        <Path d="M29 31l7-1m24 0 7 1M45 35q4-3 8 0l-4 4Z" fill="#674C3C" />
        <Path
          d="M49 38v5l-4 3m4-3 4 3M22 40l6-1m-6 7 5-2m43-4-6-1m6 7-5-2"
          fill="none"
        />
        <Path
          d="M23 76Q49 82 73 76v15Q49 99 24 90Z"
          fill={colors.primary}
          stroke="none"
        />
        <Path d="M49 55l16 2-3 14q-7 7-13-1Z" fill={colors.surface} />
        <Path d="M55 73v10m-6 0h13" fill="none" />
        <Path d="M32 61q8-8 15-1l-5 19-15-3Z" fill="#FFF0DB" />
        <Path d="M25 65l9-7m35 8-9-4" fill="none" />
      </G>
    </Svg>
  );
}
