const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Generate a thumbnail image from the video at the 1-second mark.
 *
 * @param {string} inputFile - Path to the original video file
 * @param {string} outputDir - Directory to save thumbnail.jpg
 * @returns {Promise<string>} Path to the generated thumbnail
 */
function generateThumbnail(inputFile, outputDir) {
  return new Promise((resolve, reject) => {
    const thumbnailPath = path.join(outputDir, "thumbnail.jpg");

    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-ss", "1",          // seek to 1 second (before -i for fast input seeking)
      "-i", inputFile,
      "-vframes", "1",     // extract 1 frame
      "-q:v", "2",         // high quality JPEG
      "-vf", "scale=1280:720:force_original_aspect_ratio=decrease",
      thumbnailPath,
    ]);

    ffmpeg.stderr.on("data", () => {}); // suppress ffmpeg logs

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log("Thumbnail Generated:", thumbnailPath);
        resolve(thumbnailPath);
      } else {
        reject(new Error(`Thumbnail generation failed with code ${code}`));
      }
    });
  });
}

/**
 * Get video duration and resolution using ffprobe
 *
 * @param {string} inputFile - Path to the original video file
 * @returns {Promise<{duration: number, resolution: string}>}
 */
function getVideoInfo(inputFile) {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -show_entries format=duration -of json "${inputFile}"`;

    exec(cmd, (err, stdout) => {
      if (err) return reject(err);

      try {
        const probe = JSON.parse(stdout);

        const stream = probe.streams && probe.streams[0];
        const format = probe.format;

        const width = stream ? stream.width : 0;
        const height = stream ? stream.height : 0;
        const resolution = `${width}x${height}`;

        // Duration can come from the stream or format level
        const duration = parseFloat(
          (stream && stream.duration) || (format && format.duration) || "0",
        );

        resolve({ duration, resolution });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

/**
 * Generate a human-readable title from a videoId slug.
 * e.g. "sample-vedo-final-testing-3mb" → "Sample Vedo Final Testing 3mb"
 *
 * @param {string} videoId
 * @returns {string}
 */
function toTitle(videoId) {
  return videoId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Create metadata.json for a processed video and write it into the output directory.
 *
 * @param {string} inputFile  - Path to the original downloaded video
 * @param {string} outputDir  - The HLS output directory (will contain metadata.json after this)
 * @returns {Promise<string>}   Path to the created metadata.json
 */
async function createMetadata(inputFile, outputDir) {
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

  if (!cloudfrontDomain) {
    throw new Error("CLOUDFRONT_DOMAIN is not set in environment variables");
  }

  const videoId = path.parse(inputFile).name;
  const { duration, resolution } = await getVideoInfo(inputFile);

  // Generate the actual thumbnail image
  await generateThumbnail(inputFile, outputDir);

  const baseUrl = `https://${cloudfrontDomain}/videos/processed/${videoId}`;

  const metadata = {
    videoId,
    title: toTitle(videoId),
    thumbnail: `${baseUrl}/thumbnail.jpg`,
    manifestUrl: `${baseUrl}/master.m3u8`,
    duration,
    resolution,
    createdAt: new Date().toISOString(),
  };

  const metadataPath = path.join(outputDir, "metadata.json");

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log("--------------------------------");
  console.log("Metadata Created");
  console.log("VideoId   :", metadata.videoId);
  console.log("Title     :", metadata.title);
  console.log("Duration  :", metadata.duration);
  console.log("Resolution:", metadata.resolution);
  console.log("Manifest  :", metadata.manifestUrl);
  console.log("--------------------------------\n");

  return metadataPath;
}

module.exports = createMetadata;
