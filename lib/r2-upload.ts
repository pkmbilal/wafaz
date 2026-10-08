import "server-only";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env.server";
import { isUploadContentType, MAX_UPLOAD_BYTES, type UploadContentType } from "@/lib/uploads";

// Presigned uploads to the public media bucket (admin only, AGENTS.md §5.8). Public URLs are built
// in lib/r2.ts. TODO(owner): the R2 bucket needs a CORS rule allowing PUT from the site origin.

export const PRESIGN_EXPIRES_SECONDS = 5 * 60;

type R2 = { client: S3Client; bucket: string };

let r2: R2 | null | undefined;

function getR2(): R2 | null {
  if (r2 !== undefined) return r2;
  const env = serverEnv();
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_PUBLIC_BUCKET;
  r2 =
    accountId && accessKeyId && secretAccessKey && bucket
      ? {
          bucket,
          client: new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
            // Browsers can't send the SDK's default checksum headers on a presigned PUT.
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
          }),
        }
      : null;
  return r2;
}

export function isR2Configured(): boolean {
  return getR2() !== null;
}

// The signature covers the content type and length, so the browser must PUT exactly that file.
export async function presignUpload(key: string, contentType: UploadContentType, size: number): Promise<string> {
  const store = getR2();
  if (!store) throw new Error("R2 is not configured");
  return getSignedUrl(
    store.client,
    new PutObjectCommand({ Bucket: store.bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
}

// Confirms an uploaded object exists and still meets the upload rules before its key is saved.
export async function isValidUploadedObject(key: string): Promise<boolean> {
  const store = getR2();
  if (!store) return false;
  try {
    const head = await store.client.send(new HeadObjectCommand({ Bucket: store.bucket, Key: key }));
    const size = head.ContentLength ?? 0;
    return size > 0 && size <= MAX_UPLOAD_BYTES && isUploadContentType(head.ContentType ?? "");
  } catch {
    return false;
  }
}
