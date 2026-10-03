const fs = require('fs');
const mysql = require('mysql2/promise');

// ---------- Configuración de la base de datos
const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    database: 'acore_world',
    user: 'acore',
    password: 'acore'
};

// ---------- Nombres de zona tal como los usa Gatherer (por areaID)
const ZONE_NAMES = {
    // Kalimdor
    14: 'Durotar', 215: 'Mulgore', 17: 'Barrens', 141: 'Teldrassil', 148: 'Darkshore',
    331: 'Ashenvale', 400: 'Thousand Needles', 406: 'Stonetalon Mountains', 405: 'Desolace',
    357: 'Feralas', 15: 'Dustwallow Marsh', 440: 'Tanaris', 16: 'Azshara', 361: 'Felwood',
    490: "Ungoro Crater", 493: 'Moonglade', 1377: 'Silithus', 618: 'Winterspring',
    1637: 'Orgrimmar', 1638: 'Thunder Bluff', 1657: 'Darnassus',
    // Reinos del Este
    36: 'Alterac Mountains', 45: 'Arathi Highlands', 3: 'Badlands', 4: 'Blasted Lands',
    85: 'Tirisfal Glades', 130: 'Silverpine Forest', 28: 'Western Plaguelands',
    139: 'Eastern Plaguelands', 267: 'Hillsbrad Foothills', 47: 'Hinterlands',
    1: 'Dun Morogh', 51: 'Searing Gorge', 46: 'Burning Steppes', 12: 'Elwynn Forest',
    41: 'Deadwind Pass', 10: 'Duskwood', 38: 'Loch Modan', 44: 'Redridge Mountains',
    33: 'Stranglethorn Vale', 8: 'Swamp of Sorrows', 40: 'Westfall', 11: 'Wetlands',
    1519: 'Stormwind City', 1537: 'Ironforge', 1497: 'Undercity',
    // Terrallende (+ zonas de Quel'Thalas / Azuremyst en el mapa 530)
    3430: 'Eversong Woods', 3433: 'Ghostlands', 4080: "Quel Danas", 3487: 'Silvermoon City',
    3524: 'Azuremyst Isle', 3525: 'Bloodmyst Isle', 3557: 'The Exodar',
    3483: 'Hellfire Peninsula', 3521: 'Zangarmarsh', 3520: 'Shadowmoon Valley',
    3522: "Blades Edge Mountains", 3518: 'Nagrand', 3519: 'Terokkar Forest',
    3523: 'Netherstorm', 3703: 'Shattrath City',
    // Rasganorte
    3537: 'Borean Tundra', 65: 'Dragonblight', 394: 'Grizzly Hills', 495: 'Howling Fjord',
    210: 'Icecrown Glacier', 3711: 'Sholazar Basin', 67: 'Storm Peaks', 66: "Zuldrak",
    4197: 'Lake Wintergrasp', 2817: 'Crystalsong Forest', 4742: "Hrothgar's Landing"
};

function getZoneName(area) {
    const name = ZONE_NAMES[area.areaID]
        ?? area.name.replace(/([a-z])([A-Z])/g, '$1 $2'); // fallback: "EversongWoods" -> "Eversong Woods"
    return name.toUpperCase().replace(/\s+/g, '_');
}

// ---------- Excepciones: nombre del objeto -> ID que usa Gatherer
// Por defecto se usa el menor entry de gameobject_template con ese nombre
// (Copper Vein -> 1731, Mithril Deposit -> 2040, Peacebloom -> 1618).
const NODE_ID_OVERRIDES = {
    // 'Nombre del objeto': 12345,
};

// ---------- Tipo de nodo (gtype) según el nombre del objeto
// Minerales: cualquier nombre con "Vein" o "Deposit". Hierbas: lista de nombres.
// Los objetos que no encajan en ninguno de los tres tipos (MINE, HERB, OPEN) se descartan.
const HERB_NAMES = new Set([
    // Clásico
    'Peacebloom', 'Silverleaf', 'Earthroot', 'Mageroyal', 'Briarthorn', 'Bruiseweed',
    'Wild Steelbloom', 'Kingsblood', 'Liferoot', 'Fadeleaf', 'Goldthorn', "Khadgar's Whisker",
    'Wintersbite', 'Stranglekelp', 'Firebloom', 'Purple Lotus', "Arthas' Tears", 'Sungrass',
    'Blindweed', 'Ghost Mushroom', 'Gromsblood', 'Golden Sansam', 'Dreamfoil',
    'Mountain Silversage', 'Plaguebloom', 'Icecap', 'Black Lotus', 'Grave Moss',
    'Swiftthistle', 'Wildvine',
    // Burning Crusade
    'Felweed', 'Dreaming Glory', 'Ragveil', 'Terocone', 'Ancient Lichen', 'Netherbloom',
    'Nightmare Vine', 'Mana Thistle', 'Flame Cap', 'Fel Lotus',
    // Wrath of the Lich King
    'Goldclover', 'Tiger Lily', "Talandra's Rose", "Adder's Tongue", 'Lichbloom',
    'Icethorn', 'Frozen Herb', 'Firethorn', 'Frost Lotus', 'Deadnettle'
].map(n => n.toLowerCase()));

// Objetos "abribles" (tesoros): Gatherer los guarda con gtype "OPEN".
// Solo se incluyen los nombres de esta lista; el resto de cofres (misiones, etc.) se descarta.
const OPEN_NAMES = new Set([
    'Adamantite Bound Chest', 'Armor Crate',
    'Giant Clam',  'Barrel of Milk',
    'Barrel of Sweet Nectar', 'Barrel of Melon Juice',
    'Battered Chest', 'Box of Assorted Parts', 'Blue Power Crystal',
    'Dark Iron Bound Chest', 'Food Crate',
    'Felsteel Chest', 'Fel Iron Chest', 'Green Power Crystal',
    'Heavy Fel Iron Chest', 'Iron Bound Trunk',
    'Large Battered Chest', 'Large Solid Chest', 'Large Iron Bound Chest',
    'Large Mithril Bound Chest', 'Large Darkwood Chest',
    'Mithril Bound Trunk', 'Red Power Crystal', 'Shellfish Trap',
    'Solid Chest', 'Tattered Chest', "Un'Goro Dirt Pile",
    'Water Barrel', 'Weapon Crate', 'Yellow Power Crystal'
].map(n => n.toLowerCase()));

function getGatherType(name) {
    if (OPEN_NAMES.has(name.toLowerCase())) return 'OPEN';
    if (HERB_NAMES.has(name.toLowerCase())) return 'HERB';
    if (/\b(vein|deposit)\b/i.test(name)) return 'MINE';
    return null;
}

// ---------- Continentes (índice del cliente: 1=Kalimdor, 2=Reinos del Este, 3=Terrallende, 4=Rasganorte)
const EK_IN_530 = new Set([3430, 3433, 4080, 3487]);   // Eversong, Ghostlands, Quel'Danas, Silvermoon
const KAL_IN_530 = new Set([3524, 3525, 3557]);        // Azuremyst, Bloodmyst, Exodar

function getContinent(mapId, zoneId) {
    if (mapId === 0) return 2;
    if (mapId === 1) return 1;
    if (mapId === 571) return 4;
    if (mapId === 530) {
        if (EK_IN_530.has(zoneId)) return 2;
        if (KAL_IN_530.has(zoneId)) return 1;
        return 3;
    }
    return null; // instancias, battlegrounds, etc.
}

// ---------- Conversión de coordenadas mundo -> mapa de zona (0..1)
const inRange = v => v >= 0 && v <= 1;

function worldToMap(a, x, y) {
    const mx = (a.locLeft - y) / (a.locLeft - a.locRight);
    const my = (a.locTop - x) / (a.locTop - a.locBottom);
    if (!inRange(mx) || !inRange(my)) return null;
    return { mx, my };
}

// ---------- Utilidades Lua
const T = n => '\t'.repeat(n);

const MINE_ITEMS = {
    2770: 'Copper Ore', 2771: 'Tin Ore', 2772: 'Iron Ore', 2775: 'Silver Ore',
    2776: 'Gold Ore', 3858: 'Mithril Ore', 7911: 'Truesilver Ore',
    10620: 'Thorium Ore', 11370: 'Dark Iron Ore'
};
const HERB_ITEMS = {
    3357: 'Liferoot', 2452: 'Swiftthistle', 3358: "Khadgar's Whisker", 13463: 'Dreamfoil',
    13464: 'Golden Sansam', 13465: 'Mountain Silversage', 13466: 'Plaguebloom',
    8836: "Arthas' Tears", 13467: 'Icecap', 13468: 'Black Lotus', 8838: 'Sungrass',
    8839: 'Blindweed', 8153: 'Wildvine', 2447: 'Peacebloom', 3369: 'Grave Moss',
    765: 'Silverleaf', 8846: 'Gromsblood', 3819: 'Wintersbite', 785: 'Mageroyal',
    3355: 'Wild Steelbloom', 3820: 'Stranglekelp', 2450: 'Briarthorn', 2453: 'Bruiseweed',
    3356: 'Kingsblood', 3818: 'Fadeleaf', 3821: 'Goldthorn', 2449: 'Earthroot',
    8845: 'Ghost Mushroom', 4625: 'Firebloom', 8831: 'Purple Lotus'
};

function buildLibSwagData() {
    let s = 'LibSwagData = {\n';
    s += `${T(1)}["items"] = {\n`;
    const all = [
        ...Object.entries(HERB_ITEMS).map(([id, n]) => [id, 'HERB', n]),
        ...Object.entries(MINE_ITEMS).map(([id, n]) => [id, 'MINE', n])
    ];
    for (const [id, cat, name] of all) {
        s += `${T(2)}[${id}] = {\n${T(3)}["cat"] = "${cat}",\n${T(3)}["name"] = "${name}",\n${T(2)}},\n`;
    }
    s += `${T(1)}},\n`;
    s += `${T(1)}["HERB"] = {\n${T(1)}},\n`;
    s += `${T(1)}["cats"] = {\n`;
    for (const [cat, list] of [['MINE', MINE_ITEMS], ['HERB', HERB_ITEMS]]) {
        s += `${T(2)}["${cat}"] = {\n`;
        for (const [id, name] of Object.entries(list)) {
            s += `${T(3)}["${name}"] = ${id},\n`;
        }
        s += `${T(2)}},\n`;
    }
    s += `${T(1)}},\n`;
    s += `${T(1)}["spells"] = {\n${T(1)}},\n`;
    s += `${T(1)}["MINE"] = {\n${T(1)}},\n`;
    s += `${T(1)}["ai"] = {\n${T(1)}},\n`;
    s += '}\n';
    return s;
}

async function generateGatherer() {
    let connection;
    try {
        console.log('Conectando a la base de datos MySQL...');
        connection = await mysql.createConnection(dbConfig);

        console.log('Leyendo WorldMapArea.json...');
        if (!fs.existsSync('WorldMapArea.json')) {
            throw new Error('No se encuentra el archivo WorldMapArea.json en el directorio actual.');
        }
        const worldMapArea = JSON.parse(fs.readFileSync('WorldMapArea.json', 'utf8'));

        // Solo zonas reales (areaID != 0) con límites válidos (descarta Dalaran, Nexus, etc. con todo a 0)
        const areas = Object.values(worldMapArea).filter(a =>
            a.areaID !== 0 && a.locLeft !== a.locRight && a.locTop !== a.locBottom
        );

        // Índice rápido: "map:area" -> lista de entradas
        const areaIndex = new Map();
        for (const a of areas) {
            const key = `${a.mapID}:${a.areaID}`;
            if (!areaIndex.has(key)) areaIndex.set(key, []);
            areaIndex.get(key).push(a);
        }

        console.log('Ejecutando consulta SQL...');
        const query = `
            SELECT g.guid, g.id, g.map, g.zoneId, g.areaId,
                   g.position_x, g.position_y, g.position_z,
                   t.name AS object_name, t.type,
                   (SELECT MIN(t2.entry)
                      FROM acore_world.gameobject_template t2
                     WHERE t2.name = t.name AND t2.type = 3) AS canonical_entry
            FROM acore_world.gameobject g
            JOIN acore_world.gameobject_template t ON g.id = t.entry
            WHERE t.type = 3;
        `;
        const [rows] = await connection.execute(query);
        console.log(`Se leyeron ${rows.length} objetos de tipo 3.`);

        // continents[idx][zoneName][entry] = { gtype, nodes: [...] }
        const continents = {};
        const timestamp = Math.floor(Date.now() / 1000);
        let skipped = 0;
        const unknownNames = new Map(); // nombres descartados por no ser mineral, hierba ni tesoro

        for (const row of rows) {
            const gtype = getGatherType(row.object_name);
            if (!gtype) {
                unknownNames.set(row.object_name, (unknownNames.get(row.object_name) || 0) + 1);
                continue;
            }

            const zone = row.zoneId || row.areaId;
            const continent = getContinent(row.map, zone);
            if (!continent) { skipped++; continue; }

            const candidates = [
                ...(areaIndex.get(`${row.map}:${row.zoneId}`) || []),
                ...(areaIndex.get(`${row.map}:${row.areaId}`) || [])
            ];

            let result = null, areaInfo = null;
            for (const a of candidates) {
                const r = worldToMap(a, row.position_x, row.position_y);
                if (r) { result = r; areaInfo = a; break; }
            }
            if (!result) { skipped++; continue; }

            const zoneName = getZoneName(areaInfo);
            // Gatherer agrupa por tipo de nodo (ej. todas las "Mithril Deposit" bajo 2040),
            // no por el entry concreto del gameobject.
            const entry = NODE_ID_OVERRIDES[row.object_name] ?? row.canonical_entry ?? row.id;

            const node = [
                Number(result.mx.toFixed(14)), // [1] Horizontal
                Number(result.my.toFixed(14)), // [2] Vertical
                0,                             // [3]
                timestamp,                     // [4]
                0                              // [5]
            ];
            node.push('Azerothcore'); // [6]

            continents[continent] ??= {};
            continents[continent][zoneName] ??= {};
            continents[continent][zoneName][entry] ??= { gtype, nodes: [] };
            continents[continent][zoneName][entry].nodes.push(node);
        }

        console.log(`Descartados (sin zona válida o fuera de rango): ${skipped}`);
        if (unknownNames.size > 0) {
            const top = [...unknownNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
            console.log(`Descartados por no ser mineral, hierba ni tesoro (${unknownNames.size} nombres distintos). Los más frecuentes:`);
            for (const [name, count] of top) console.log(`   ${name}: ${count}`);
            console.log('Si alguno debería incluirse, añádelo a HERB_NAMES u OPEN_NAMES.');
        }

        // ---------- GatherItems
        let lua = 'GatherItems = {\n';
        const maxContinent = Math.max(0, ...Object.keys(continents).map(Number));
        for (let c = 1; c <= maxContinent; c++) {
            const zones = continents[c];
            if (!zones) { lua += `${T(1)}{\n${T(1)}}, -- [${c}]\n`; continue; }
            lua += `${T(1)}{\n`;
            for (const zoneName of Object.keys(zones)) {
                lua += `${T(2)}["${zoneName}"] = {\n`;
                for (const entry of Object.keys(zones[zoneName])) {
                    const { gtype, nodes } = zones[zoneName][entry];
                    lua += `${T(3)}[${entry}] = {\n`;
                    nodes.forEach((n, i) => {
                        lua += `${T(4)}{\n`;
                        n.forEach((v, k) => {
                            const val = typeof v === 'string' ? `"${v}"` : v;
                            lua += `${T(5)}${val}, -- [${k + 1}]\n`;
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

        // ---------- Resto del archivo
        lua += 'GatherDrops = nil\n';
        lua += 'Gatherer_DropRates = {\n\t["dbVersion"] = 2,\n}\n';
        lua += 'Gatherer_SavedSettings_AccountWide = {\n\t["profile.Default"] = {\n\t\t["miniicon.angle"] = 262.5394472895813,\n\t},\n\t["SETTINGS_VERSION"] = 2,\n}\n';
        lua += buildLibSwagData();
        lua += 'Gatherer_SharingBlacklist = {\n}\n';

        fs.writeFileSync('Gatherer.lua', lua, 'utf8');
        console.log('¡Archivo Gatherer.lua generado correctamente!');
    } catch (error) {
        console.error('Error durante la ejecución:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

generateGatherer();
