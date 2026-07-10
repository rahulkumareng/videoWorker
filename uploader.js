const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const fs = require("fs");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

/**
 * Recursively get all files from a directory
 */
function getAllFiles(dir) {
  let files = [];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Return proper content type
 */
function getContentType(file) {
  if (file.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";

  if (file.endsWith(".ts")) return "video/mp2t";

  if (file.endsWith(".mp4")) return "video/mp4";

  return "application/octet-stream";
}

/**
 * Upload entire output directory to S3
 */
async function uploadDirectory(bucket, outputDir, outputPrefix) {
  const files = getAllFiles(outputDir);

  console.log("--------------------------------");
  console.log("Uploading Files...");
  console.log("--------------------------------");

  for (const file of files) {
    const relativePath = path.relative(outputDir, file);

    const s3Key = path.join(outputPrefix, relativePath).replace(/\\/g, "/");

    console.log("Uploading:", s3Key);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,

        Key: s3Key,

        Body: fs.createReadStream(file),

        ContentType: getContentType(file),
      }),
    );
  }

  console.log("--------------------------------");
  console.log("Upload Completed");
  console.log("--------------------------------");
}

module.exports = uploadDirectory;
