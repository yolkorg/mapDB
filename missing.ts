import fs from 'fs';
import path from 'path';

const imgDir = path.resolve(import.meta.dirname, 'img');
const uimgDir = path.resolve(import.meta.dirname, 'uimg');

const imgFiles: string[] = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];
const uimgFiles: string[] = fs.existsSync(uimgDir) ? fs.readdirSync(uimgDir) : [];

const uimgSet = new Set(uimgFiles);

const onlyInImg = imgFiles.filter((file) => !uimgSet.has(file));

console.log('missing files:');
onlyInImg.forEach((file) => console.log(file));