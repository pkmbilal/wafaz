// Placeholder home page. The real home (banners, category grid, New Arrivals, Best Sellers) lands in M3.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-xs font-medium tracking-[0.3em] text-accent uppercase">
        Coming soon
      </p>
      <h1 className="text-4xl font-semibold text-primary sm:text-5xl">
        Indian ethnic wear, made for every day
      </h1>
      <p className="max-w-md text-muted-foreground">
        Kurtis, kurti sets, co-ords and kaftans, shipped across India.
      </p>
    </main>
  );
}
