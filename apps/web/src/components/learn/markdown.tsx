import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders generated study material. Raw HTML is not rendered (react-markdown's default), so
 * generated text can never inject markup; links open outside the app.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="pt-2 text-lg font-semibold" {...p} />,
          h2: (p) => <h3 className="pt-2 text-lg font-semibold" {...p} />,
          h3: (p) => <h3 className="pt-2 text-lg font-semibold" {...p} />,
          h4: (p) => <h4 className="pt-1 font-semibold" {...p} />,
          p: (p) => <p {...p} />,
          ul: (p) => <ul className="list-disc space-y-1 pl-6" {...p} />,
          ol: (p) => <ol className="list-decimal space-y-1 pl-6" {...p} />,
          blockquote: (p) => <blockquote className="border-l-4 border-primary/40 bg-muted/40 py-2 pl-4 italic" {...p} />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: (p) => <th className="border px-2 py-1 text-left font-semibold" {...p} />,
          td: (p) => <td className="border px-2 py-1" {...p} />,
          a: ({ href, ...p }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" {...p} />,
          code: (p) => <code className="rounded bg-muted px-1 font-mono text-sm" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
