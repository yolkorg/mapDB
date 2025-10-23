import fs from 'node:fs';
import path from 'node:path';

import { processJS } from 'yolkbot/wasm';

const mapDir = path.join(import.meta.dirname, 'maps');
if (fs.existsSync(mapDir)) fs.rmSync(mapDir, { recursive: true });
fs.mkdirSync(mapDir);

const infoDir = path.join(import.meta.dirname, 'info');
if (fs.existsSync(infoDir)) fs.rmSync(infoDir, { recursive: true });
fs.mkdirSync(infoDir);

const imgDir = path.join(import.meta.dirname, 'img');
if (fs.existsSync(imgDir)) fs.rmSync(imgDir, { recursive: true });
fs.mkdirSync(imgDir);

const UserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

const data = await fetch('https://shellshock.io/js/shellshock.js', {
    headers: {
        'User-Agent': UserAgent
    }
});

const rawJS = await data.text();
const js = processJS(rawJS);

const match = js.match(/\[\{filename.*?\}\]/)?.[0];

// eslint-disable-next-line prefer-const
let parsed: any[] = [];

eval(`parsed = ${match}`);

fs.writeFileSync(path.join(import.meta.dirname, 'util', 'index.json'), JSON.stringify(parsed, null, 4));

const fetchWithRetry = async (url: string, maxRetries: number = 3): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt}/${maxRetries} failed for ${url}: ${lastError.message}`);
            if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    
    throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts: ${lastError?.message}`);
};

await Promise.all(parsed.map(async (mapInfo) => {
    fs.writeFileSync(path.join(infoDir, `${mapInfo.filename}.json`), JSON.stringify(mapInfo, null, 4));

    try {
        const img = await fetchWithRetry('https://shellshock.io/maps/' + mapInfo.filename + '.png?' + mapInfo.hash);
        const buffer = Buffer.from(await img.arrayBuffer());
        fs.writeFileSync(path.join(import.meta.dirname, 'img', mapInfo.filename + '.png'), buffer);
    } catch (error) {
        console.error(`Failed to download image for ${mapInfo.filename}: ${(error as Error).message}`);
    }
}));

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
