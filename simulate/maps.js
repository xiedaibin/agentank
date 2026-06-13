// simulate/maps.js
// 本地模拟器地图模块

const rawMaps = {
    // 经典地图: 15 列 x 11 行
    classic: [
        "xxxxxxxxxxxxxxx",
        "x......x......x",
        "x.mm.o.m.o.mm.x",
        "x.m........m..x",
        "x...oo.m.oo...x",
        "xxm........mxxx",
        "x...oo.m.oo...x",
        "x.m........m..x",
        "x.mm.o.m.o.mm.x",
        "x......x......x",
        "xxxxxxxxxxxxxxx"
    ],
    // 走廊地图
    corridor: [
        "xxxxxxxxxxxxxxxxxxxxxx",
        "x....................x",
        "x.x.xxx.xxxxxx.xxx.x.x",
        "x.m.o.m...xx...m.o.m.x",
        "x.x.xxx.xxxxxx.xxx.x.x",
        "x....................x",
        "xxxxxxxxxxxxxxxxxxxxxx"
    ]
};

// 辅助函数：将 [y][x] 的可视化字符串模板转置为 [x][y] 物理矩阵
function getMap(mapId) {
    const template = rawMaps[mapId] || rawMaps.classic;
    const h = template.length;
    const w = template[0].length;
    
    const map = [];
    for (let x = 0; x < w; x++) {
        map[x] = [];
        for (let y = 0; y < h; y++) {
            map[x][y] = template[y][x];
        }
    }
    return {
        map: map,
        width: w,
        height: h,
        // 预设出生点: 双方出生在左右两侧对称位置
        spawns: [
            [2, Math.floor(h / 2)],
            [w - 3, Math.floor(h / 2)]
        ]
    };
}

module.exports = {
    getMap,
    listMaps: () => Object.keys(rawMaps)
};
