import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "@/sanity/env";

const builder = createImageUrlBuilder({ projectId, dataset });

export type CutoutUrlOptions = {
  /** Layout width in CSS pixels (Sanity width is multiplied by `dpr`). */
  width?: number;
  dpr?: number;
};

/**
 * Build a CDN URL for a cutout. Force PNG so transparency is preserved
 * (Sanity may otherwise auto-convert to a lossy format).
 */
export function urlForCutout(
  source: SanityImageSource,
  options?: CutoutUrlOptions,
) {
  const dpr = options?.dpr ?? 2;
  let image = builder.image(source).format("png").fit("max");
  if (options?.width != null && options.width > 0) {
    image = image.width(Math.round(options.width * dpr));
  }
  return image;
}
