const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

function hasAudio(inputFile) {
    return new Promise((resolve, reject) => {
        exec(
            `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${inputFile}"`,
            (err, stdout) => {
                if (err) return reject(err);

                resolve(stdout.trim().length > 0);
            }
        );
    });
}
function getVideoHeight(inputFile) {
    return new Promise((resolve) => {
        exec(
            `ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${inputFile}"`,
            (err, stdout) => {
                if (err) return resolve(1080);
                const height = parseInt(stdout.trim());
                resolve(isNaN(height) ? 1080 : height);
            }
        );
    });
}

async function transcodeVideo(inputFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const fileName = path.parse(inputFile).name;
            const outputDir = path.join(path.resolve("./output"), fileName);
            fs.mkdirSync(outputDir, { recursive: true });

            const audioExists = await hasAudio(inputFile);
            const sourceHeight = await getVideoHeight(inputFile);
            console.log("hasAudio :: " + audioExists);
            console.log("sourceHeight :: " + sourceHeight);

            let resolutions = [
                { name: "360p", width: 640, height: 360, vBitrate: "800k", aBitrate: "128k" },
                { name: "480p", width: 854, height: 480, vBitrate: "1400k", aBitrate: "128k" },
                { name: "720p", width: 1280, height: 720, vBitrate: "2800k", aBitrate: "128k" },
                { name: "1080p", width: 1920, height: 1080, vBitrate: "5000k", aBitrate: "128k" }
            ];

            // Avoid useless upscaling: only keep resolutions up to the source video's height
            resolutions = resolutions.filter(r => r.height <= sourceHeight);
            if (resolutions.length === 0) {
                resolutions = [{ name: "360p", width: 640, height: 360, vBitrate: "800k", aBitrate: "128k" }];
            }

            for (const res of resolutions) {
                console.log("--------------------------------");
                console.log(`Starting FFmpeg for ${res.name}...`);
                console.log("--------------------------------");

                const resDir = path.join(outputDir, res.name);
                fs.mkdirSync(resDir, { recursive: true });

                const ffmpegArgs = [
                    "-y",
                    "-i", inputFile,
                    "-vf", `scale=-2:${res.height}`,
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-b:v", res.vBitrate,
                ];

                if (audioExists) {
                    ffmpegArgs.push("-c:a", "aac", "-b:a", res.aBitrate);
                }

                ffmpegArgs.push(
                    "-f", "hls",
                    "-hls_time", "6",
                    "-hls_playlist_type", "vod",
                    "-hls_segment_filename", `${resDir}/segment_%03d.ts`,
                    `${resDir}/index.m3u8`
                );

                await new Promise((resFn, rejFn) => {
                    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
                    ffmpeg.stdout.on("data", (data) => console.log(data.toString()));
                    ffmpeg.stderr.on("data", (data) => console.log(data.toString()));
                    ffmpeg.on("close", (code) => {
                        if (code === 0) resFn();
                        else rejFn(new Error(`FFmpeg exited with code ${code} for ${res.name}`));
                    });
                });
                console.log(`Completed ${res.name}`);
            }

            // Generate master.m3u8 manually
            let masterContent = "#EXTM3U\n#EXT-X-VERSION:3\n";
            for (const res of resolutions) {
                const bandwidth = parseInt(res.vBitrate) * 1000 + (audioExists ? parseInt(res.aBitrate) * 1000 : 0);
                masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${res.width}x${res.height}\n`;
                masterContent += `${res.name}/index.m3u8\n`;
            }
            fs.writeFileSync(path.join(outputDir, "master.m3u8"), masterContent);

            console.log("--------------------------------");
            console.log("Transcoding Completed (Sequential)");
            console.log("--------------------------------");

            resolve(outputDir);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = transcodeVideo;