import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { getPage, getStaticSlugs } from "@/lib/catalog/queries";

export async function generateStaticParams() {
  const { pages } = await getStaticSlugs();
  return pages.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/pages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

// Bodies are plain text (blank line = new paragraph). Rendered as text, never as HTML.
export default async function ContentPage({ params }: PageProps<"/pages/[slug]">) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const paragraphs = page.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-6">
      <Breadcrumbs items={[]} current={page.title} />
      <h1 className="mb-6 text-4xl font-semibold sm:text-5xl">{page.title}</h1>
      <div className="flex flex-col gap-4 leading-relaxed text-foreground/90">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
