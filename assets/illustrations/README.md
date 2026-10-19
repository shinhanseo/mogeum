# 사진 없는 술의 일러스트

Figma `모금/DrinkIllustration`과 대응하는 고정 104×104 SVG입니다. 실제 제품 병·라벨 이미지가 아니라 주종을 나타내는 그림입니다.

| 주종 | 파일 |
|---|---|
| Whisky | drink-whisky.svg |
| Wine | drink-wine.svg |
| Beer | drink-beer.svg |
| Traditional | drink-traditional.svg |

사진 URL이 있고 로딩에 성공하면 사진, 없거나 실패하면 주종 SVG를 사용합니다. 주종도 미확정이면 임의로 위스키에 매핑하지 말고 중립적인 사진 없는 상태와 주종 확인 진입을 제공합니다. 중립 에셋은 디자인 시스템 이슈에서 추가할 수 있습니다. 이름·가격은 SVG 안에 넣지 않고 텍스트 레이어로 렌더링합니다. 접근성 설명은 카드 이름과 중복되지 않게 처리합니다.

앱에서는 react-native-svg 등 Expo와 호환되는 렌더러를 검증해 사용하고 웹 `<img>` 코드를 그대로 React Native에 붙이지 않습니다. 모구 원본과 제품 사진은 이 폴더에 아직 포함되지 않았습니다.
