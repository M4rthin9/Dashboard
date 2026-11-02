/** Lazy-loaded decoder works with camera frames on both Android and iOS. */
export async function decodeQrFrame(frame: ImageData): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}
