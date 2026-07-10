const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

/**
 * Downloads a video from S3 to the local downloads directory.
 *
 * @param {string} bucket - S3 Bucket Name
 * @param {string} key - S3 Object Key
 * @returns {Promise<string>} Local file path
 */
async function downloadFromS3(bucket, key) {
  try {
    const fileName = path.basename(key);

    const downloadDir = path.resolve("./downloads");

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const localFilePath = path.join(downloadDir, fileName);

    console.log("--------------------------------------");
    console.log("Downloading Video...");
    console.log("Bucket :", bucket);
    console.log("Key    :", key);
    console.log("Saving :", localFilePath);

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    await pipeline(response.Body, fs.createWriteStream(localFilePath));

    console.log("Download Completed");
    console.log("--------------------------------------\n");

    return localFilePath;
  } catch (error) {
    console.error("Download Failed");

    throw error;
  }
}

module.exports = downloadFromS3;
