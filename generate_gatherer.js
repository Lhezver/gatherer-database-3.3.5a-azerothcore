const fs = require('fs');
const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    database: 'acore_world',
    user: 'acore',
    password: 'acore'
};

async function generateGatherer() {
    let connection;
    try {
        console.log('Conectando a la base de datos MySQL...');
        connection = await mysql.createConnection(dbConfig);

        console.log('Leyendo WorldMapArea.json...');
        if (!fs.existsSync('WorldMapArea.json')) {
            throw new Error("No se encuentra el archivo WorldMapArea.json en el directorio actual.");
        }
        const worldMapArea = JSON.parse(fs.readFileSync('WorldMapArea.json', 'utf8'));

        // Convertir el objeto JSON en un array para facilitar las búsquedas con .find()
        const areas = Object.values(worldMapArea);

        console.log('Ejecutando consulta SQL...');
        const query = `
            SELECT 
                g.guid, g.id, g.map, g.zoneId, g.areaId, 
                g.position_x, g.position_y, g.position_z, 
                t.name AS object_name, t.type
            FROM acore_world.gameobject g
            JOIN acore_world.gameobject_template t ON g.id = t.entry
            WHERE t.type = 3;
        `;
        const [rows] = await connection.execute(query);
        console.log(`Se encontraron ${rows.length} objetos mineros.`);

        // Estructura para agrupar: zonesData[zoneName][entry] = [ nodes... ]
        const zonesData = {};

        for (const row of rows) {
            // 1. Buscar coincidencia exacta de zona/área asegurando que el mapa coincida (a.mapID === g.map)
            let areaInfo = areas.find(a =>
                (a.areaID === row.zoneId || a.areaID === row.areaId) && a.mapID === row.map
            );

            // 2. Fallback: Si no se encuentra la subzona específica, buscar el mapa base/continente (donde areaID es 0)
            if (!areaInfo) {
                areaInfo = areas.find(a => a.mapID === row.map && a.areaID === 0);
            }

            // Si no hay ninguna coincidencia válida de mapa y zona, se omite el nodo
            if (!areaInfo) continue;

            const zoneName = areaInfo.name.toUpperCase();
            const entry = row.id;

            const locLeft = areaInfo.locLeft;
            const locRight = areaInfo.locRight;
            const locTop = areaInfo.locTop;
            const locBottom = areaInfo.locBottom;

            // Corrección de coordenadas:
            // [1] Horizontal (Eje Este/Oeste -> usa position_y, locLeft, locRight)
            // [2] Vertical (Eje Norte/Sur -> usa position_x, locTop, locBottom)
            const mapX = (locLeft - row.position_y) / (locLeft - locRight);
            const mapY = (locTop - row.position_x) / (locTop - locBottom);

            if (mapX < 0 || mapX > 1 || mapY < 0 || mapY > 1) continue;

            if (!zonesData[zoneName]) {
                zonesData[zoneName] = {
                    gtype: "MINE"
                };
            }

            if (!zonesData[zoneName][entry]) {
                zonesData[zoneName][entry] = [];
            }

            const timestamp = Math.floor(Date.now() / 1000);
            zonesData[zoneName][entry].push([
                Number(mapX.toFixed(14)), // [1] Horizontal
                Number(mapY.toFixed(14)), // [2] Vertical
                0,
                timestamp,
                0,
                "Azerothcore"
            ]);
        }

        // Construcción completa del archivo Gatherer.lua
        let luaContent = "";

        // 1. GatherItems
        luaContent += "GatherItems = {\n    {\n";
        for (const zoneName in zonesData) {
            luaContent += `        ["${zoneName}"] = {\n`;
            for (const entry in zonesData[zoneName]) {
                if (entry === "gtype") {
                    luaContent += `            ["gtype"] = "MINE",\n`;
                    continue;
                }
                luaContent += `            [${entry}] = {\n`;

                zonesData[zoneName][entry].forEach((node, index) => {
                    luaContent += `                {\n`;
                    luaContent += `                    ${node[0]}, -- [1]\n`;
                    luaContent += `                    ${node[1]}, -- [2]\n`;
                    luaContent += `                    ${node[2]}, -- [3]\n`;
                    luaContent += `                    ${node[3]}, -- [4]\n`;
                    luaContent += `                    ${node[4]}, -- [5]\n`;
                    luaContent += `                    "${node[5]}", -- [6]\n`;
                    luaContent += `                }, -- [${index + 1}]\n`;
                });

                luaContent += `            },\n`;
            }
            luaContent += `        },\n`;
        }
        luaContent += `    }, -- [1]\n`;
        luaContent += `    ["dbVersion"] = 3,\n`;
        luaContent += `}\n\n`;

        // 2. GatherDrops y configuraciones restantes
        luaContent += `GatherDrops = nil\n\n`;
        luaContent += `Gatherer_DropRates = {\n`;
        luaContent += `    ["dbVersion"] = 2,\n`;
        luaContent += `}\n\n`;

        luaContent += `Gatherer_SavedSettings_AccountWide = {\n`;
        luaContent += `    ["profile.Default"] = {\n`;
        luaContent += `        ["miniicon.angle"] = 261.8699049401562,\n`;
        luaContent += `    },\n`;
        luaContent += `    ["SETTINGS_VERSION"] = 2,\n`;
        luaContent += `}\n\n`;

        // 3. LibSwagData
        luaContent += `LibSwagData = {\n`;
        luaContent += `    ["items"] = {\n`;
        luaContent += `        [3357] = { ["cat"] = "HERB", ["name"] = "Liferoot" },\n`;
        luaContent += `        [2452] = { ["cat"] = "HERB", ["name"] = "Swiftthistle" },\n`;
        luaContent += `        [2775] = { ["cat"] = "MINE", ["name"] = "Silver Ore" },\n`;
        luaContent += `        [3358] = { ["cat"] = "HERB", ["name"] = "Khadgar's Whisker" },\n`;
        luaContent += `        [13463] = { ["cat"] = "HERB", ["name"] = "Dreamfoil" },\n`;
        luaContent += `        [13464] = { ["cat"] = "HERB", ["name"] = "Golden Sansam" },\n`;
        luaContent += `        [13465] = { ["cat"] = "HERB", ["name"] = "Mountain Silversage" },\n`;
        luaContent += `        [2776] = { ["cat"] = "MINE", ["name"] = "Gold Ore" },\n`;
        luaContent += `        [13466] = { ["cat"] = "HERB", ["name"] = "Plaguebloom" },\n`;
        luaContent += `        [8836] = { ["cat"] = "HERB", ["name"] = "Arthas' Tears" },\n`;
        luaContent += `        [13467] = { ["cat"] = "HERB", ["name"] = "Icecap" },\n`;
        luaContent += `        [13468] = { ["cat"] = "HERB", ["name"] = "Black Lotus" },\n`;
        luaContent += `        [8838] = { ["cat"] = "HERB", ["name"] = "Sungrass" },\n`;
        luaContent += `        [8839] = { ["cat"] = "HERB", ["name"] = "Blindweed" },\n`;
        luaContent += `        [8153] = { ["cat"] = "HERB", ["name"] = "Wildvine" },\n`;
        luaContent += `        [2447] = { ["cat"] = "HERB", ["name"] = "Peacebloom" },\n`;
        luaContent += `        [2770] = { ["cat"] = "MINE", ["name"] = "Copper Ore" },\n`;
        luaContent += `        [3369] = { ["cat"] = "HERB", ["name"] = "Grave Moss" },\n`;
        luaContent += `        [765] = { ["cat"] = "HERB", ["name"] = "Silverleaf" },\n`;
        luaContent += `        [8846] = { ["cat"] = "HERB", ["name"] = "Gromsblood" },\n`;
        luaContent += `        [2771] = { ["cat"] = "MINE", ["name"] = "Tin Ore" },\n`;
        luaContent += `        [3858] = { ["cat"] = "MINE", ["name"] = "Mithril Ore" },\n`;
        luaContent += `        [3819] = { ["cat"] = "HERB", ["name"] = "Wintersbite" },\n`;
        luaContent += `        [785] = { ["cat"] = "HERB", ["name"] = "Mageroyal" },\n`;
        luaContent += `        [2772] = { ["cat"] = "MINE", ["name"] = "Iron Ore" },\n`;
        luaContent += `        [3355] = { ["cat"] = "HERB", ["name"] = "Wild Steelbloom" },\n`;
        luaContent += `        [3820] = { ["cat"] = "HERB", ["name"] = "Stranglekelp" },\n`;
        luaContent += `        [2450] = { ["cat"] = "HERB", ["name"] = "Briarthorn" },\n`;
        luaContent += `        [11370] = { ["cat"] = "MINE", ["name"] = "Dark Iron Ore" },\n`;
        luaContent += `        [2453] = { ["cat"] = "HERB", ["name"] = "Bruiseweed" },\n`;
        luaContent += `        [3356] = { ["cat"] = "HERB", ["name"] = "Kingsblood" },\n`;
        luaContent += `        [10620] = { ["cat"] = "MINE", ["name"] = "Thorium Ore" },\n`;
        luaContent += `        [3818] = { ["cat"] = "HERB", ["name"] = "Fadeleaf" },\n`;
        luaContent += `        [3821] = { ["cat"] = "HERB", ["name"] = "Goldthorn" },\n`;
        luaContent += `        [2449] = { ["cat"] = "HERB", ["name"] = "Earthroot" },\n`;
        luaContent += `        [7911] = { ["cat"] = "MINE", ["name"] = "Truesilver Ore" },\n`;
        luaContent += `        [8845] = { ["cat"] = "HERB", ["name"] = "Ghost Mushroom" },\n`;
        luaContent += `        [4625] = { ["cat"] = "HERB", ["name"] = "Firebloom" },\n`;
        luaContent += `        [8831] = { ["cat"] = "HERB", ["name"] = "Purple Lotus" },\n`;
        luaContent += `    },\n`;
        luaContent += `    ["MINE"] = {\n    },\n`;
        luaContent += `    ["ai"] = {\n    },\n`;
        luaContent += `    ["spells"] = {\n    },\n`;
        luaContent += `    ["cats"] = {\n`;
        luaContent += `        ["MINE"] = {\n`;
        luaContent += `            ["Truesilver Ore"] = 7911,\n`;
        luaContent += `            ["Dark Iron Ore"] = 11370,\n`;
        luaContent += `            ["Tin Ore"] = 2771,\n`;
        luaContent += `            ["Copper Ore"] = 2770,\n`;
        luaContent += `            ["Thorium Ore"] = 10620,\n`;
        luaContent += `            ["Iron Ore"] = 2772,\n`;
        luaContent += `            ["Silver Ore"] = 2775,\n`;
        luaContent += `            ["Gold Ore"] = 2776,\n`;
        luaContent += `            ["Mithril Ore"] = 3858,\n`;
        luaContent += `        },\n`;
        luaContent += `        ["HERB"] = {\n`;
        luaContent += `            ["Briarthorn"] = 2450,\n`;
        luaContent += `            ["Grave Moss"] = 3369,\n`;
        luaContent += `            ["Wild Steelbloom"] = 3355,\n`;
        luaContent += `            ["Gromsblood"] = 8846,\n`;
        luaContent += `            ["Khadgar's Whisker"] = 3358,\n`;
        luaContent += `            ["Swiftthistle"] = 2452,\n`;
        luaContent += `            ["Icecap"] = 13467,\n`;
        luaContent += `            ["Earthroot"] = 2449,\n`;
        luaContent += `            ["Sungrass"] = 8838,\n`;
        luaContent += `            ["Mountain Silversage"] = 13465,\n`;
        luaContent += `            ["Goldthorn"] = 3821,\n`;
        luaContent += `            ["Mageroyal"] = 785,\n`;
        luaContent += `            ["Wildvine"] = 8153,\n`;
        luaContent += `            ["Silverleaf"] = 765,\n`;
        luaContent += `            ["Wintersbite"] = 3819,\n`;
        luaContent += `            ["Black Lotus"] = 13468,\n`;
        luaContent += `            ["Bruiseweed"] = 2453,\n`;
        luaContent += `            ["Kingsblood"] = 3356,\n`;
        luaContent += `            ["Liferoot"] = 3357,\n`;
        luaContent += `            ["Fadeleaf"] = 3818,\n`;
        luaContent += `            ["Dreamfoil"] = 13463,\n`;
        luaContent += `            ["Arthas' Tears"] = 8836,\n`;
        luaContent += `            ["Plaguebloom"] = 13466,\n`;
        luaContent += `            ["Ghost Mushroom"] = 8845,\n`;
        luaContent += `            ["Stranglekelp"] = 3820,\n`;
        luaContent += `            ["Blindweed"] = 8839,\n`;
        luaContent += `            ["Firebloom"] = 4625,\n`;
        luaContent += `            ["Peacebloom"] = 2447,\n`;
        luaContent += `            ["Purple Lotus"] = 8831,\n`;
        luaContent += `            ["Golden Sansam"] = 13464,\n`;
        luaContent += `        },\n`;
        luaContent += `    },\n`;
        luaContent += `    ["HERB"] = {\n    },\n`;
        luaContent += `}\n\n`;

        luaContent += `Gatherer_SharingBlacklist = {\n}\n`;

        fs.writeFileSync('Gatherer.lua', luaContent, 'utf8');
        console.log('¡Archivo Gatherer.lua generado correctamente con la validación de mapID!');

    } catch (error) {
        console.error('Error durante la ejecución:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

generateGatherer();