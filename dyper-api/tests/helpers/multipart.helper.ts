// Aide aux tests : construit un corps multipart/form-data (fichier + champs texte).
const BOUNDARY = '----dypertestboundary';

export interface MultipartOptions {
  file?: { content: Buffer; filename: string; contentType: string };
  fields?: Record<string, string>;
}

export function buildMultipart(options: MultipartOptions): {
  payload: Buffer;
  contentType: string;
} {
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(options.fields ?? {})) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    );
  }

  if (options.file) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${options.file.filename}"\r\n` +
          `Content-Type: ${options.file.contentType}\r\n\r\n`
      )
    );
    chunks.push(options.file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${BOUNDARY}`,
  };
}
