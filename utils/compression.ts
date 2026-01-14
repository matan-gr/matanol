
/**
 * Compression Utilities using Native Streams API
 * Provides fast, client-side GZIP compression for JSON data.
 */

export const compressData = async (data: any): Promise<Blob> => {
  const jsonString = JSON.stringify(data);
  // Create a stream from the string
  const stream = new Blob([jsonString], { type: 'application/json' }).stream();
  // Pipe through GZIP compressor
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  // Convert back to Blob
  return await new Response(compressedStream).blob();
};

export const decompressData = async <T>(blob: Blob): Promise<T | null> => {
  try {
    const ds = new DecompressionStream('gzip');
    const decompressedStream = blob.stream().pipeThrough(ds);
    const text = await new Response(decompressedStream).text();
    return JSON.parse(text);
  } catch (e) {
    console.warn("Decompression failed or data was not compressed:", e);
    // Fallback: try parsing as plain text in case it wasn't compressed
    try {
        const text = await blob.text();
        return JSON.parse(text);
    } catch (e2) {
        return null;
    }
  }
};
