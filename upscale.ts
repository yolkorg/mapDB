import fs from 'node:fs';
import path from 'node:path';

const imgDir = path.join(import.meta.dirname, 'img');
const upscaleDir = path.join(import.meta.dirname, 'uimg');

const headers = {
    'accept': '*/*',
    'Referer': 'https://cloudinary.com/',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
}

const cloudinaryJSReq = await fetch('https://cloudinary.com/wp-content/themes/cld-2021/acf-modules/2022/tools/v2/assets/js/app.js?ver=1.0.0', { headers });
const cloudinaryJS = await cloudinaryJSReq.text();

const prodCloudName = cloudinaryJS.match(/const cloudName = \(isLocal\) \? '.*?' : '(.*?)';/)?.[1] || '';
const prodApiKey = cloudinaryJS.match(/const api_key = \(isLocal\) \? '.*?' : '(.*?)';/)?.[1] || '';
const prodUploadPreset = cloudinaryJS.match(/const uploadPreset = \(isLocal\) \? '.*?' : '(.*?)';/)?.[1] || '';

console.log(`[Cloudinary] Cloud Name: ${prodCloudName}, API Key: ${prodApiKey}, Upload Preset: ${prodUploadPreset}`);

const upscale = async (input: Buffer): Promise<Buffer> => {
    const timestamp = Date.now() / 1000;

    const signatureReq = await fetch('https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params', {
        body: JSON.stringify({
            paramsToSign: {
                timestamp,
                upload_preset: prodUploadPreset,
                source: 'ml'
            }
        }),
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });

    const signature = (await signatureReq.json()).signature;

    const formData = new FormData();
    formData.append('upload_preset', prodUploadPreset);
    formData.append('source', 'ml');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', prodApiKey);
    formData.append('file', new Blob([new Uint8Array(input)], { type: 'image/png' }), 'image.png');

    const uploadReq = await fetch(`https://api.cloudinary.com/v1_1/${prodCloudName}/auto/upload`, {
        body: formData,
        headers,
        method: 'POST'
    });

    const uploadRes = await uploadReq.json();

    if (!uploadReq.ok) throw new Error(`Cloudinary upload failed: ${uploadRes.error.message}`);

    const pubId = uploadRes.public_id as string;

    const resultImgReq = await fetch(`https://res.cloudinary.com/${prodCloudName}/image/upload/f_png,w_512,e_upscale,q_auto/${pubId}.png`);
    const resultBuffer = Buffer.from(await resultImgReq.arrayBuffer());
    return resultBuffer;
};

if (!fs.existsSync(upscaleDir)) fs.mkdirSync(upscaleDir);

const imgFiles = fs.readdirSync(imgDir).filter(file => file.endsWith('.png'));

const processImage = async (file: string, isRetry: boolean) => {
    const inputPath = path.join(imgDir, file);
    const outputPath = path.join(upscaleDir, file);

    const inputBuffer = fs.readFileSync(inputPath);
    console.log(`Upscaling image: ${file}`);

    try {
        const outputBuffer = await upscale(inputBuffer);
        fs.writeFileSync(outputPath, outputBuffer);
        console.log(`Upscaled image saved: ${outputPath}`);
    } catch (error) {
        console.error(`Failed to upscale image ${file}: ${(error as Error).message}`);
        if (!isRetry) {
            console.log(`Retrying upscale for image: ${file}`);
            await processImage(file, true);
        } else console.log(`Skipping image after 2 failures: ${file}`);
    }
};

await Promise.all(imgFiles.map((e) => processImage(e, false)));

console.log('All images processed.');