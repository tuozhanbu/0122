import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLLECTION_CARD_MINIMUM_WIDTH = 120;
const NARROW_CONTENT_WIDTH_RATIO = 0.9067;

/** 基于实际可用屏宽计算各页面内容区，保留页面之间不同的留白层级。 */
export default function useFruitQuestPageLayout() {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const availableWidth = width - insets.left - insets.right;
    const standardContentHorizontalInset = Math.max(15, Math.round(availableWidth * 0.04));
    const standardContentWidth = availableWidth - standardContentHorizontalInset * 2;
    const narrowContentWidth = Math.round(availableWidth * NARROW_CONTENT_WIDTH_RATIO);
    const narrowContentHorizontalInset = (availableWidth - narrowContentWidth) / 2;
    const gardenGridSize = narrowContentWidth - 40;
    const collectionGap = Math.max(8, Math.round(standardContentWidth * 0.03));
    const collectionColumnCount = Math.max(
        3,
        Math.floor(
            (standardContentWidth + collectionGap) /
            (COLLECTION_CARD_MINIMUM_WIDTH + collectionGap),
        ),
    );
    const collectionCardWidth = (
        standardContentWidth - collectionGap * (collectionColumnCount - 1)
    ) / collectionColumnCount;

    return {
        standardContentHorizontalInset,
        standardContentWidth,
        gardenContentHorizontalInset: narrowContentHorizontalInset,
        gardenBoardSize: narrowContentWidth,
        gardenGridCellSize: gardenGridSize * 0.3,
        gardenGridGap: gardenGridSize * 0.05,
        gardenFruitDisplaySize: Math.min(60, gardenGridSize / 5),
        gardenUtilityGap: Math.max(20, Math.round(narrowContentWidth * 0.0588)),
        playerStatusGap: Math.max(24, Math.round(standardContentWidth * 0.07)),
        settingsContentHorizontalInset: narrowContentHorizontalInset,
        collectionGap,
        collectionCardWidth,
        collectionFruitDisplaySize: Math.min(60, collectionCardWidth * 0.554),
    };
}
