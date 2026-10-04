const fs = require('fs');

const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    database: 'acore_world',
    user: 'acore',
    password: 'acore'
};

// ---------- Zonas: nombre en WorldMapArea.json -> clave de zona en Gatherer, por continente
// 1 = Kalimdor, 2 = Reinos del Este, 3 = Terrallende, 4 = Rasganorte
const ZONES = {
    1: {
        Ashenvale: 'ASHENVALE', Aszhara: 'AZSHARA', AzuremystIsle: 'AZUREMYST_ISLE',
        Barrens: 'BARRENS', BloodmystIsle: 'BLOODMYST_ISLE', Darkshore: 'DARKSHORE',
        Darnassis: 'DARNASSUS', Desolace: 'DESOLACE', Durotar: 'DUROTAR',
        Dustwallow: 'DUSTWALLOW_MARSH', Felwood: 'FELWOOD', Feralas: 'FERALAS',
        Moonglade: 'MOONGLADE', Mulgore: 'MULGORE', Ogrimmar: 'ORGRIMMAR',
        Silithus: 'SILITHUS', StonetalonMountains: 'STONETALON_MOUNTAINS', Tanaris: 'TANARIS',
        Teldrassil: 'TELDRASSIL', TheExodar: 'EXODAR', ThousandNeedles: 'THOUSAND_NEEDLES',
        ThunderBluff: 'THUNDER_BLUFF', UngoroCrater: 'UNGORO_CRATER', Winterspring: 'WINTERSPRING'
    },
    2: {
        Alterac: 'ALTERAC_MOUNTAINS', Arathi: 'ARATHI_HIGHLANDS', Badlands: 'BADLANDS',
        BlastedLands: 'BLASTED_LANDS', BurningSteppes: 'BURNING_STEPPES', DeadwindPass: 'DEADWIND_PASS',
        DunMorogh: 'DUN_MOROGH', Duskwood: 'DUSKWOOD', EasternPlaguelands: 'EASTERN_PLAGUELANDS',
        Elwynn: 'ELWYNN_FOREST', EversongWoods: 'EVERSONG_WOODS', Ghostlands: 'GHOSTLANDS',
        Hilsbrad: 'HILLSBRAD_FOOTHILLS', Hinterlands: 'HINTERLANDS', Ironforge: 'IRONFORGE',
        LochModan: 'LOCH_MODAN', Redridge: 'REDRIDGE_MOUNTAINS', SearingGorge: 'SEARING_GORGE',
        SilvermoonCity: 'SILVERMOON', Silverpine: 'SILVERPINE_FOREST', Stormwind: 'STORMWIND',
        Stranglethorn: 'STRANGLETHORN_VALE', Sunwell: 'QUEL_DANAS', SwampOfSorrows: 'SWAMP_OF_SORROWS',
        Tirisfal: 'TIRISFAL_GLADES', Undercity: 'UNDERCITY', WesternPlaguelands: 'WESTERN_PLAGUELANDS',
        Westfall: 'WESTFALL', Wetlands: 'WETLANDS'
    },
    3: {
        BladesEdgeMountains: 'BLADES_EDGE_MOUNTAINS', Hellfire: 'HELLFIRE_PENINSULA', Nagrand: 'NAGRAND',
        Netherstorm: 'NETHERSTORM', ShadowmoonValley: 'SHADOWMOON_VALLEY', ShattrathCity: 'SHATTRATH',
        TerokkarForest: 'TEROKKAR_FOREST', Zangarmarsh: 'ZANGARMARSH'
    },
    4: {
        BoreanTundra: 'BOREAN_TUNDRA', CrystalsongForest: 'CRYSTALSONG_FOREST', Dalaran: 'DALARAN',
        Dragonblight: 'DRAGONBLIGHT', GrizzlyHills: 'GRIZZLY_HILLS', HrothgarsLanding: 'HROTHGARS_LANDING',
        HowlingFjord: 'HOWLING_FJORD', IcecrownGlacier: 'ICECROWN_GLACIER', SholazarBasin: 'SHOLAZAR_BASIN',
        TheStormPeaks: 'STORM_PEAKS', LakeWintergrasp: 'LAKE_WINTERGRASP', ZulDrak: 'ZULDRAK'
    }
};

const ZONE_LOOKUP = {};
for (const [continent, zones] of Object.entries(ZONES)) {
    for (const [name, key] of Object.entries(zones)) {
        ZONE_LOOKUP[name] = { continent: Number(continent), key };
    }
}

// ---------- Objetos: nombre -> ID de Gatherer, agrupados por tipo
// MINE = mena, HERB = hierba, OPEN = cofre / tesoro
const NODES = {
    MINE: {
        'Small Thorium Vein': 324, 'Incendicite Mineral Vein': 1610, 'Copper Vein': 1731,
        'Tin Vein': 1732, 'Silver Vein': 1733, 'Gold Vein': 1734, 'Iron Deposit': 1735,
        'Mithril Deposit': 2040, 'Truesilver Deposit': 2047, 'Lesser Bloodstone Deposit': 2653,
        'Indurium Mineral Vein': 19903, 'Ooze Covered Silver Vein': 73940,
        'Ooze Covered Gold Vein': 73941, 'Ooze Covered Truesilver Deposit': 123309,
        'Ooze Covered Mithril Deposit': 123310, 'Ooze Covered Thorium Vein': 123848,
        'Dark Iron Deposit': 165658, 'Rich Thorium Vein': 175404,
        'Ooze Covered Rich Thorium Vein': 177388, 'Hakkari Thorium Vein': 180215,
        'Fel Iron Deposit': 181555, 'Adamantite Deposit': 181556, 'Khorium Vein': 181557,
        'Rich Adamantite Deposit': 181569, 'Nethercite Deposit': 185877, 'Cobalt Deposit': 189978,
        'Rich Cobalt Deposit': 189979, 'Saronite Deposit': 189980, 'Rich Saronite Deposit': 189981,
        'Titanium Vein': 191133
    },
    HERB: {
        'Silverleaf': 1617, 'Peacebloom': 1618, 'Earthroot': 1619, 'Mageroyal': 1620,
        'Briarthorn': 1621, 'Bruiseweed': 1622, 'Wild Steelbloom': 1623, 'Kingsblood': 1624,
        'Grave Moss': 1628, 'Liferoot': 2041, 'Fadeleaf': 2042, "Khadgar's Whisker": 2043,
        'Wintersbite': 2044, 'Stranglekelp': 2045, 'Goldthorn': 2046, 'Firebloom': 2866,
        'Purple Lotus': 142140, "Arthas' Tears": 142141, 'Sungrass': 142142, 'Blindweed': 142143,
        'Ghost Mushroom': 142144, 'Gromsblood': 142145, 'Golden Sansam': 176583,
        'Dreamfoil': 176584, 'Mountain Silversage': 176586, 'Plaguebloom': 176587,
        'Icecap': 176588, 'Black Lotus': 176589, 'Bloodthistle': 181166, 'Felweed': 181270,
        'Dreaming Glory': 181271, 'Ragveil': 181275, 'Flame Cap': 181276, 'Terocone': 181277,
        'Ancient Lichen': 181278, 'Netherbloom': 181279, 'Nightmare Vine': 181280,
        'Mana Thistle': 181281, 'Netherdust Bush': 185881, 'Goldclover': 189973,
        'Tiger Lily': 190169, "Talandra's Rose": 190170, 'Lichbloom': 190171, 'Icethorn': 190172,
        'Frozen Herb': 190175, 'Frost Lotus': 190176, "Adder's Tongue": 191019, 'Firethorn': 191303
    },
    OPEN: {
        'Hidden Strongbox': 2039, 'Giant Clam': 2744, 'Battered Chest': 2843, 'Tattered Chest': 2844,
        'Solid Chest': 2850, 'Water Barrel': 3658, 'Barrel of Melon Juice': 3659,
        'Armor Crate': 3660, 'Weapon Crate': 3661, 'Food Crate': 3662, 'Barrel of Milk': 3705,
        'Barrel of Sweet Nectar': 3706, 'Alliance Strongbox': 3714, 'Box of Assorted Parts': 19019,
        'Scattered Crate': 28604, 'Large Iron Bound Chest': 74447, 'Large Solid Chest': 74448,
        'Large Battered Chest': 75293, "Buccaneer's Strongbox": 123330,
        'Large Mithril Bound Chest': 131978, 'Large Darkwood Chest': 131979,
        'Horde Supply Crate': 142191, "Un'Goro Dirt Pile": 157936, 'Blue Power Crystal': 164658,
        'Green Power Crystal': 164659, 'Red Power Crystal': 164660, 'Yellow Power Crystal': 164661,
        'Cleansed Night Dragon': 164881, 'Cleansed Songflower': 164882, 'Cleansed Windblossom': 164884,
        'Bloodpetal Sprout': 164958, 'Cleansed Whipper Root': 174622, 'Blood of Heroes': 176213,
        'Shellfish Trap': 176582, 'Practice Lockbox': 178244, 'Battered Footlocker': 179486,
        'Waterlogged Footlocker': 179487, 'Dented Footlocker': 179492, 'Mossy Footlocker': 179493,
        'Scarlet Footlocker': 179498, 'Burial Chest': 181665, 'Fel Iron Chest': 181798,
        'Heavy Fel Iron Chest': 181800, 'Adamantite Bound Chest': 181802, 'Felsteel Chest': 181804,
        'Glowcap': 182053, 'Wicker Chest': 184740, 'Primitive Chest': 184793,
        'Solid Fel Iron Chest': 184930, 'Bound Fel Iron Chest': 184931,
        'Bound Adamantite Chest': 184936, 'Netherwing Egg': 185915, 'Everfrost Chip': 193997
    }
};

// nombre (en minúsculas) -> { id, gtype }
const NODE_BY_NAME = new Map();
for (const [gtype, list] of Object.entries(NODES)) {
    for (const [name, id] of Object.entries(list)) {
        NODE_BY_NAME.set(name.toLowerCase(), { id, gtype });
    }
}

// ---------- Coordenadas mundo -> mapa de zona (0..1)
const inRange = v => v >= 0 && v <= 1;

function worldToMap(area, x, y) {
    const mx = (area.locLeft - y) / (area.locLeft - area.locRight);
    const my = (area.locTop - x) / (area.locTop - area.locBottom);
    return inRange(mx) && inRange(my) ? { mx, my } : null;
}

// Las ciudades no se usan al buscar por posición (sus cajas están dentro de las de las zonas vecinas).
const CITIES = new Set([
    'Darnassis', 'Ogrimmar', 'ThunderBluff', 'Stormwind', 'Ironforge',
    'Undercity', 'SilvermoonCity', 'TheExodar', 'ShattrathCity', 'Dalaran'
]);

// mapID -> zonas utilizables para buscar por posición
function indexAreasByMap(worldMapArea) {
    const byMap = new Map();
    for (const area of Object.values(worldMapArea)) {
        if (area.areaID === 0 || !ZONE_LOOKUP[area.name] || CITIES.has(area.name)) continue;
        if (area.locLeft === area.locRight || area.locTop === area.locBottom) continue;
        if (!byMap.has(area.mapID)) byMap.set(area.mapID, []);
        byMap.get(area.mapID).push(area);
    }
    return byMap;
}

// Si el spawn no trae zona válida (zoneId/areaId a 0 o desconocido), se busca la zona
// del mismo mapa cuyas coordenadas lo contengan; con varias, la que lo deja más centrado.
function locateByPosition(row, areasByMap) {
    let best = null;
    for (const area of areasByMap.get(row.map) ?? []) {
        const pos = worldToMap(area, row.position_x, row.position_y);
        if (!pos) continue;
        const offCenter = Math.max(Math.abs(pos.mx - 0.5), Math.abs(pos.my - 0.5));
        if (!best || offCenter < best.offCenter) {
            best = { zone: ZONE_LOOKUP[area.name], pos, offCenter };
        }
    }
    return best;
}

// Busca la zona de un spawn: primero por zoneId, luego por areaId y, si no hay, por posición.
function locate(row, worldMapArea, areasByMap) {
    for (const id of [row.zoneId, row.areaId]) {
        const area = worldMapArea[id];
        if (!area || area.areaID === 0 || area.mapID !== row.map) continue;
        const zone = ZONE_LOOKUP[area.name];
        if (!zone) continue;
        const pos = worldToMap(area, row.position_x, row.position_y);
        if (pos) return { zone, pos };
    }
    return locateByPosition(row, areasByMap);
}

// ---------- Generación del Gatherer.lua
const T = n => '\t'.repeat(n);

// ---------- Resto del archivo (se añade tal cual al final del Gatherer.lua)
const LUA_FOOTER = `GatherDrops = nil
Gatherer_DropRates = {
	["dbVersion"] = 2,
}
Gatherer_SavedSettings_AccountWide = {
	["profile.Default"] = {
	},
	["SETTINGS_VERSION"] = 2,
}
LibSwagData = {
	["items"] = {
		[3357] = {
			["cat"] = "HERB",
			["name"] = "Liferoot",
		},
		[2452] = {
			["cat"] = "HERB",
			["name"] = "Swiftthistle",
		},
		[2775] = {
			["cat"] = "MINE",
			["name"] = "Silver Ore",
		},
		[3358] = {
			["cat"] = "HERB",
			["name"] = "Khadgar's Whisker",
		},
		[13463] = {
			["cat"] = "HERB",
			["name"] = "Dreamfoil",
		},
		[13464] = {
			["cat"] = "HERB",
			["name"] = "Golden Sansam",
		},
		[13465] = {
			["cat"] = "HERB",
			["name"] = "Mountain Silversage",
		},
		[2776] = {
			["cat"] = "MINE",
			["name"] = "Gold Ore",
		},
		[13466] = {
			["cat"] = "HERB",
			["name"] = "Plaguebloom",
		},
		[8836] = {
			["cat"] = "HERB",
			["name"] = "Arthas' Tears",
		},
		[13467] = {
			["cat"] = "HERB",
			["name"] = "Icecap",
		},
		[13468] = {
			["cat"] = "HERB",
			["name"] = "Black Lotus",
		},
		[8838] = {
			["cat"] = "HERB",
			["name"] = "Sungrass",
		},
		[8839] = {
			["cat"] = "HERB",
			["name"] = "Blindweed",
		},
		[8153] = {
			["cat"] = "HERB",
			["name"] = "Wildvine",
		},
		[2447] = {
			["cat"] = "HERB",
			["name"] = "Peacebloom",
		},
		[2770] = {
			["cat"] = "MINE",
			["name"] = "Mena de cobre",
		},
		[3369] = {
			["cat"] = "HERB",
			["name"] = "Grave Moss",
		},
		[765] = {
			["cat"] = "HERB",
			["name"] = "Silverleaf",
		},
		[8846] = {
			["cat"] = "HERB",
			["name"] = "Gromsblood",
		},
		[2771] = {
			["cat"] = "MINE",
			["name"] = "Tin Ore",
		},
		[3858] = {
			["cat"] = "MINE",
			["name"] = "Mithril Ore",
		},
		[3819] = {
			["cat"] = "HERB",
			["name"] = "Wintersbite",
		},
		[785] = {
			["cat"] = "HERB",
			["name"] = "Mageroyal",
		},
		[2772] = {
			["cat"] = "MINE",
			["name"] = "Iron Ore",
		},
		[3355] = {
			["cat"] = "HERB",
			["name"] = "Wild Steelbloom",
		},
		[3820] = {
			["cat"] = "HERB",
			["name"] = "Stranglekelp",
		},
		[2450] = {
			["cat"] = "HERB",
			["name"] = "Briarthorn",
		},
		[8831] = {
			["cat"] = "HERB",
			["name"] = "Purple Lotus",
		},
		[4625] = {
			["cat"] = "HERB",
			["name"] = "Firebloom",
		},
		[3356] = {
			["cat"] = "HERB",
			["name"] = "Kingsblood",
		},
		[10620] = {
			["cat"] = "MINE",
			["name"] = "Thorium Ore",
		},
		[8845] = {
			["cat"] = "HERB",
			["name"] = "Ghost Mushroom",
		},
		[3821] = {
			["cat"] = "HERB",
			["name"] = "Goldthorn",
		},
		[7911] = {
			["cat"] = "MINE",
			["name"] = "Truesilver Ore",
		},
		[2449] = {
			["cat"] = "HERB",
			["name"] = "Earthroot",
		},
		[3818] = {
			["cat"] = "HERB",
			["name"] = "Fadeleaf",
		},
		[2453] = {
			["cat"] = "HERB",
			["name"] = "Bruiseweed",
		},
		[11370] = {
			["cat"] = "MINE",
			["name"] = "Dark Iron Ore",
		},
	},
	["HERB"] = {
	},
	["ai"] = {
	},
	["spells"] = {
	},
	["cats"] = {
		["MINE"] = {
			["Truesilver Ore"] = 7911,
			["Dark Iron Ore"] = 11370,
			["Mena de cobre"] = 2770,
			["Tin Ore"] = 2771,
			["Thorium Ore"] = 10620,
			["Mithril Ore"] = 3858,
			["Silver Ore"] = 2775,
			["Gold Ore"] = 2776,
			["Iron Ore"] = 2772,
		},
		["HERB"] = {
			["Briarthorn"] = 2450,
			["Grave Moss"] = 3369,
			["Wild Steelbloom"] = 3355,
			["Gromsblood"] = 8846,
			["Khadgar's Whisker"] = 3358,
			["Swiftthistle"] = 2452,
			["Wintersbite"] = 3819,
			["Earthroot"] = 2449,
			["Sungrass"] = 8838,
			["Mountain Silversage"] = 13465,
			["Goldthorn"] = 3821,
			["Mageroyal"] = 785,
			["Wildvine"] = 8153,
			["Golden Sansam"] = 13464,
			["Silverleaf"] = 765,
			["Peacebloom"] = 2447,
			["Bruiseweed"] = 2453,
			["Kingsblood"] = 3356,
			["Liferoot"] = 3357,
			["Fadeleaf"] = 3818,
			["Dreamfoil"] = 13463,
			["Arthas' Tears"] = 8836,
			["Plaguebloom"] = 13466,
			["Firebloom"] = 4625,
			["Stranglekelp"] = 3820,
			["Blindweed"] = 8839,
			["Ghost Mushroom"] = 8845,
			["Black Lotus"] = 13468,
			["Purple Lotus"] = 8831,
			["Icecap"] = 13467,
		},
	},
	["MINE"] = {
	},
}
Gatherer_SharingBlacklist = {
}
`;

function buildLua(rows, worldMapArea, timestamp) {
    // data[continente][zona][id] = { gtype, nodes: [...] }
    const data = {};
    let skipped = 0;
    const skippedRows = []; // todos los spawns descartados
    const areasByMap = indexAreasByMap(worldMapArea);

    for (const row of rows) {
        const node = NODE_BY_NAME.get(String(row.object_name).toLowerCase());
        if (!node) continue;

        const found = locate(row, worldMapArea, areasByMap);
        if (!found) {
            skipped++;
            skippedRows.push({
                id: row.id,
                name: row.object_name,
                map: row.map,
                x: row.position_x,
                y: row.position_y
            });
            continue;
        }

        const { zone, pos } = found;
        data[zone.continent] ??= {};
        data[zone.continent][zone.key] ??= {};
        data[zone.continent][zone.key][node.id] ??= { gtype: node.gtype, nodes: [] };
        data[zone.continent][zone.key][node.id].nodes.push([
            Number(pos.mx.toFixed(14)), // [1] Horizontal
            Number(pos.my.toFixed(14)), // [2] Vertical
            0,                          // [3]
            timestamp,                  // [4]
            0,                          // [5]
            'Azerothcore'               // [6]
        ]);
    }

    let lua = 'GatherItems = {\n';
    const last = Math.max(0, ...Object.keys(data).map(Number));
    for (let c = 1; c <= last; c++) {
        lua += `${T(1)}{\n`;
        for (const [zoneKey, ids] of Object.entries(data[c] ?? {})) {
            lua += `${T(2)}["${zoneKey}"] = {\n`;
            for (const [id, { gtype, nodes }] of Object.entries(ids)) {
                lua += `${T(3)}[${id}] = {\n`;
                nodes.forEach((n, i) => {
                    lua += `${T(4)}{\n`;
                    n.forEach((v, k) => {
                        lua += `${T(5)}${typeof v === 'string' ? `"${v}"` : v}, -- [${k + 1}]\n`;
                    });
                    lua += `${T(4)}}, -- [${i + 1}]\n`;
                });
                lua += `${T(4)}["gtype"] = "${gtype}",\n`;
                lua += `${T(3)}},\n`;
            }
            lua += `${T(2)}},\n`;
        }
        lua += `${T(1)}}, -- [${c}]\n`;
    }
    lua += `${T(1)}["dbVersion"] = 3,\n}\n`;
    lua += LUA_FOOTER;

    return { lua, skipped, skippedRows };
}

async function main() {
    const mysql = require('mysql2/promise');
    let connection;
    try {
        if (!fs.existsSync('WorldMapArea.json')) {
            throw new Error('No se encuentra el archivo WorldMapArea.json en el directorio actual.');
        }
        const worldMapArea = JSON.parse(fs.readFileSync('WorldMapArea.json', 'utf8'));

        console.log('Conectando a la base de datos MySQL...');
        connection = await mysql.createConnection(dbConfig);

        const names = [...NODE_BY_NAME.keys()];
        const [rows] = await connection.query(`
            SELECT g.id, g.map, g.zoneId, g.areaId, g.position_x, g.position_y, t.name AS object_name
            FROM gameobject g
            JOIN gameobject_template t ON g.id = t.entry
            WHERE t.name IN (?)
        `, [names]);
        console.log(`Se encontraron ${rows.length} objetos que coinciden con la lista.`);

        const timestamp = Math.floor(Date.now() / 1000);
        const { lua, skipped, skippedRows } = buildLua(rows, worldMapArea, timestamp);
        console.log(`Descartados (zona sin coincidencia o fuera de rango): ${skipped}`);
        for (const o of skippedRows) {
            console.log(`   [${o.id}] ${o.name} | map=${o.map} x=${o.x} y=${o.y}`);
        }

        fs.writeFileSync('Gatherer.lua', lua, 'utf8');
        console.log('¡Archivo Gatherer.lua generado correctamente!');
    } catch (error) {
        console.error('Error durante la ejecución:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = { buildLua };
if (require.main === module) main();
