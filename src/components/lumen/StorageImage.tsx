import { useSignedUrl } from "@/lib/storage";

/**
 * Renders a private storage object (or a plain URL) as a lazily loaded image.
 * Signed URLs are short-lived and only issued to the owner of the file.
 */
export function StorageImage({
  path,
  alt,
  className,
  eager,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const src = useSignedUrl(path);

  if (!src) {
    return <div className={`${className ?? ""} animate-pulse bg-ink-2`} aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
