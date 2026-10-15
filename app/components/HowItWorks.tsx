// Static figure built by figure/build.mjs into public/how-it-works; the iframe keeps its script off the app bundle.
export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-[760px]">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-2">How it works</h2>
      <iframe
        src="/how-it-works/index.html"
        title="How Runway works"
        loading="lazy"
        className="block aspect-[760/700] min-h-[640px] w-full sm:min-h-0"
        style={{ border: 0 }}
      />
    </section>
  );
}
