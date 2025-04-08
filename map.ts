import fs from 'node:fs';
import path from 'node:path';

if (!fs.existsSync(path.join(import.meta.dirname, 'maps')))
    fs.mkdirSync(path.join(import.meta.dirname, 'maps'));

const UserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

const data = await fetch('https://js.getstate.farm/js/latest.js');
const js = await data.text();

const match = js.match(/\[\{filename.*?\}\]/)?.[0];

// eslint-disable-next-line prefer-const
let parsed = [];

eval(`parsed = ${match}`);

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

    fs.writeFileSync(path.join(import.meta.dirname, 'maps', `${file.filename}.json`), JSON.stringify(data, null, 4));
}));

const meshNames = [...new Set(maps.flatMap((map: Map) => Object.keys(map.data)))];
fs.writeFileSync(path.join(import.meta.dirname, 'util', 'meshes.json'), JSON.stringify(meshNames, null, 4));
