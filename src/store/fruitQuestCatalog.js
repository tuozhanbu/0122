export const FRUIT_QUEST_ENERGY_LIMIT = 100;
export const FRUIT_QUEST_ENERGY_RECOVERY_INTERVAL_MS = 5000;
export const FRUIT_QUEST_HARVEST_ENERGY_COST = 5;
export const FRUIT_QUEST_HARVEST_FRUIT_COUNT = 9;
export const FRUIT_QUEST_ENERGY_BOOST_AMOUNT = 5;
export const FRUIT_QUEST_ENERGY_BOOST_COOLDOWN_MS = 60000;
export const FRUIT_QUEST_AUTO_HARVEST_INTERVAL_MS = 5000;

export const FRUIT_QUEST_CATALOG = [
    {
        id: 'apple',
        nameKey: '苹果',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/apple.png'),
    },
    {
        id: 'banana',
        nameKey: '香蕉',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/banana.png'),
    },
    {
        id: 'watermelon',
        nameKey: '西瓜',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/watermelon.png'),
    },
    {
        id: 'kiwi',
        nameKey: '猕猴桃',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/kiwi.png'),
    },
    {
        id: 'strawberry',
        nameKey: '草莓',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/strawberry.png'),
    },
    {
        id: 'grape',
        nameKey: '葡萄',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/grape.png'),
    },
    {
        id: 'cherry',
        nameKey: '樱桃',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/cherry.png'),
    },
    {
        id: 'orange',
        nameKey: '橙子',
        rarityKey: '普通',
        image: require('@/assets/fruit-quest/fruits/orange.png'),
    },
    {
        id: 'star-fruit',
        nameKey: '星辰果',
        rarityKey: '稀有',
        image: require('@/assets/fruit-quest/fruits/star-fruit.png'),
    },
    {
        id: 'rainbow-strawberry',
        nameKey: '彩虹草莓',
        rarityKey: '稀有',
        image: require('@/assets/fruit-quest/fruits/rainbow-strawberry.png'),
    },
    {
        id: 'golden-apple',
        nameKey: '黄金苹果',
        rarityKey: '稀有',
        image: require('@/assets/fruit-quest/fruits/golden-apple.png'),
    },
    {
        id: 'ice-crystal-grape',
        nameKey: '冰晶葡萄',
        rarityKey: '稀有',
        image: require('@/assets/fruit-quest/fruits/ice-crystal-grape.png'),
    },
    {
        id: 'moonlight-orange',
        nameKey: '月光橙子',
        rarityKey: '稀有',
        image: require('@/assets/fruit-quest/fruits/moonlight-orange.png'),
    },
    {
        id: 'galaxy-melon',
        nameKey: '银河瓜',
        rarityKey: '传奇',
        image: require('@/assets/fruit-quest/fruits/galaxy-melon.png'),
    },
];

export const FRUIT_QUEST_INITIAL_GARDEN_GRID = [
    'apple', 'watermelon', 'strawberry',
    'grape', 'apple', 'banana',
    'cherry', 'kiwi', 'apple',
];

const COMMON_HARVEST_FRUIT_IDS = [
    'apple', 'banana', 'watermelon', 'kiwi', 'strawberry',
    'grape', 'cherry', 'orange',
];

const RARE_HARVEST_FRUIT_IDS = [
    'star-fruit', 'rainbow-strawberry', 'golden-apple',
    'ice-crystal-grape', 'moonlight-orange',
];

const LEGENDARY_HARVEST_FRUIT_IDS = ['galaxy-melon'];
const LEGENDARY_HARVEST_CHANCE = 0.02;
const RARE_HARVEST_CHANCE = 0.18;

const DAILY_ORDER_FRUIT_IDS = [
    'apple', 'banana', 'watermelon', 'kiwi',
    'strawberry', 'grape', 'cherry', 'orange',
];

const getRandomFruitId = (fruitIds) => {
    return fruitIds[Math.floor(Math.random() * fruitIds.length)];
};

const getRandomHarvestFruitId = () => {
    const rarityRoll = Math.random();
    if (rarityRoll < LEGENDARY_HARVEST_CHANCE) {
        return getRandomFruitId(LEGENDARY_HARVEST_FRUIT_IDS);
    }
    if (rarityRoll < LEGENDARY_HARVEST_CHANCE + RARE_HARVEST_CHANCE) {
        return getRandomFruitId(RARE_HARVEST_FRUIT_IDS);
    }
    return getRandomFruitId(COMMON_HARVEST_FRUIT_IDS);
};

/** 每次收获固定获得九个水果：普通 80%、稀有 18%、传奇 2%。 */
export const createFruitQuestHarvestFruitIds = () => {
    return Array.from(
        { length: FRUIT_QUEST_HARVEST_FRUIT_COUNT },
        getRandomHarvestFruitId,
    );
};

const getDateSeed = (dateKey) => {
    return Array.from(dateKey).reduce((seed, character) => {
        return (seed * 31 + character.charCodeAt(0)) >>> 0;
    }, 0);
};

/** 同一自然日固定生成两种不同的普通水果订单，避免重启后订单变更。 */
export const createFruitQuestDailyOrderFruitIds = (dateKey) => {
    const dateSeed = getDateSeed(dateKey);
    const firstFruitIndex = dateSeed % DAILY_ORDER_FRUIT_IDS.length;
    const remainingFruitCount = DAILY_ORDER_FRUIT_IDS.length - 1;
    const secondFruitIndex = (
        firstFruitIndex + 1 + Math.floor(dateSeed / DAILY_ORDER_FRUIT_IDS.length) % remainingFruitCount
    ) % DAILY_ORDER_FRUIT_IDS.length;

    return [
        DAILY_ORDER_FRUIT_IDS[firstFruitIndex],
        DAILY_ORDER_FRUIT_IDS[secondFruitIndex],
    ];
};

export const FRUIT_QUEST_COLLECTION_DISPLAY_ORDER = [
    'apple', 'banana', 'orange',
    'grape', 'cherry', 'watermelon',
    'moonlight-orange', 'kiwi', 'rainbow-strawberry',
    'golden-apple', 'star-fruit', 'ice-crystal-grape',
    'strawberry', 'galaxy-melon',
];

export const getFruitQuestFruit = (fruitId) => {
    const fruit = FRUIT_QUEST_CATALOG.find((item) => item.id === fruitId);
    if (!fruit) {
        throw new Error(`Unknown Fruit Quest fruit: ${fruitId}`);
    }
    return fruit;
};
