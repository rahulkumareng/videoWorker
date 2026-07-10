const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function transcodeVideo(inputFile) {
    return new Promise((resolve, reject) => {

        const fileName = path.parse(inputFile).name;

        const outputDir = path.join(
            path.resolve("./output"),
            fileName
        );

        fs.mkdirSync(outputDir, { recursive: true });

        const ffmpegArgs = [
            "-y",

            "-i",
            inputFile,

            "-filter:v:0",
            "scale=w=640:h=360",

            "-filter:v:1",
            "scale=w=854:h=480",

            "-filter:v:2",
            "scale=w=1280:h=720",

            "-filter:v:3",
            "scale=w=1920:h=1080",

            "-map",
            "0:v",

            "-map",
            "0:a",

            "-map",
            "0:v",

            "-map",
            "0:a",

            "-map",
            "0:v",

            "-map",
            "0:a",

            "-map",
            "0:v",

            "-map",
            "0:a",

            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-c:a",
            "aac",

            "-b:v:0",
            "800k",

            "-b:v:1",
            "1400k",

            "-b:v:2",
            "2800k",

            "-b:v:3",
            "5000k",

            "-b:a",
            "128k",

            "-var_stream_map",
            "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3",

            "-master_pl_name",
            "master.m3u8",

            "-f",
            "hls",

            "-hls_time",
            "6",

            "-hls_playlist_type",
            "vod",

            "-hls_segment_filename",
            `${outputDir}/v%v/segment_%03d.ts`,

            `${outputDir}/v%v/index.m3u8`
        ];

        console.log("--------------------------------");
        console.log("Starting FFmpeg...");
        console.log("--------------------------------");

        const ffmpeg = spawn("ffmpeg", ffmpegArgs);

        ffmpeg.stdout.on("data", (data) => {
            console.log(data.toString());
        });

        ffmpeg.stderr.on("data", (data) => {
            console.log(data.toString());
        });

        ffmpeg.on("close", (code) => {

            if (code === 0) {

                console.log("--------------------------------");
                console.log("Transcoding Completed");
                console.log("--------------------------------");

                resolve(outputDir);

            } else {

                reject(
                    new Error(`FFmpeg exited with code ${code}`)
                );

            }

        });

    });
}

module.exports = transcodeVideo;