import fs from 'node:fs';
import path from 'node:path';

import { process } from 'yolkbot/wasm';

const mapDir = path.join(import.meta.dirname, 'maps');
if (fs.existsSync(mapDir)) fs.rmSync(mapDir, { recursive: true });
fs.mkdirSync(mapDir);

const infoDir = path.join(import.meta.dirname, 'info');
if (fs.existsSync(infoDir)) fs.rmSync(infoDir, { recursive: true });
fs.mkdirSync(infoDir);

const UserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

const data = await fetch('https://shellshock.io/js/shellshock.js', {
    headers: {
        'User-Agent': UserAgent
    }
});

const rawJS = await data.text();
const js = await process(rawJS);

const match = js.match(/\[\{filename.*?\}\]/)?.[0];

// eslint-disable-next-line prefer-const
let parsed = [];

eval(`parsed = ${match}`);

parsed.forEach((mapInfo) => {
    fs.writeFileSync(path.join(infoDir, `${mapInfo.filename}.json`), JSON.stringify(mapInfo, null, 4));
});

interface Map {
    filename: string;
    hash: string;
    data: {
        [key: string]: {
            x: number;
            y: number;
            z: number;
            ry: number;
        }[];
    }
    render: {
        [key: string]: string | number;
    }
}

let maps: Map[] = [];

await Promise.all(parsed.map(async (file: Map) => {
    let req = await fetch(`https://shellshock.io/maps/${file.filename}.json?${file.hash}`, {
        headers: {
            'User-Agent': UserAgent
        }
    });

    let data = await req.json();
    maps.push(data);

    fs.writeFileSync(path.join(mapDir, `${file.filename}.json`), JSON.stringify(data, null, 4));
}));

const meshNames = [...new Set(maps.flatMap((map: Map) => Object.keys(map.data)))].sort();
fs.writeFileSync(path.join(import.meta.dirname, 'util', 'meshes.json'), JSON.stringify(meshNames, null, 4));

const renderKeys = [...new Set(maps.flatMap((map: Map) => Object.keys(map.render)))].sort();
fs.writeFileSync(path.join(import.meta.dirname, 'util', 'renderKeys.json'), JSON.stringify(renderKeys, null, 4));
