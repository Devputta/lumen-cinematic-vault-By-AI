import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function PlaceholderPage({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl text-cream sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream-muted">{blurb}</p>
      {children}
      <Link
        to="/gallery"
        className="mt-10 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-5 py-2.5 text-sm text-cream transition-colors hover:border-amber/60"
      >
        <ArrowLeft className="size-4" />
        Back to gallery
      </Link>
    </div>
  );
}
