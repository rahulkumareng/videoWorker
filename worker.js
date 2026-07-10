const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");

const downloadFromS3 = require("./download");
const transcodeVideo = require("./transcode");
const uploadDirectory = require("./uploader");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
});

async function startWorker() {
  console.log("FFmpeg Worker Started...");
  console.log("Waiting for jobs...\n");

  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: process.env.QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        }),
      );

      if (!response.Messages) {
        continue;
      }

      for (const message of response.Messages) {
        console.log("====================================");

        const body = JSON.parse(message.Body);
        console.log(message.Body);

        if (body.Event === "s3:TestEvent") {
          console.log("Ignoring S3 Test Event");

          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: process.env.QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );

          continue;
        }

        const record = body.Records[0];

        const bucket = record.s3.bucket.name;

        const key = decodeURIComponent(
          record.s3.object.key.replace(/\+/g, " "),
        );

        console.log("Bucket :", bucket);
        console.log("Key    :", key);

        const inputFile = await downloadFromS3(bucket, key);
        const outputDir = await transcodeVideo(inputFile);
        const fileName = path.parse(inputFile).name;
        await uploadDirectory(
          bucket,
          outputDir,
          `videos/processed/${fileName}`,
        );

        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: process.env.QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );

        console.log("Job Completed");
        console.log("====================================\n");
      }
    } catch (err) {
      console.error(err);
    }
  }
}

startWorker();
