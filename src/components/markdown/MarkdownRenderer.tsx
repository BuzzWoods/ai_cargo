import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface MarkdownRendererProps {
  markdown: string;
}

const headingClassNames = {
  h1: "mt-0 mb-4 text-2xl font-semibold text-slate-900",
  h2: "mt-0 mb-3 text-xl font-semibold text-slate-900",
  h3: "mt-0 mb-3 text-lg font-semibold text-slate-900",
  h4: "mt-0 mb-2 text-base font-semibold text-slate-900",
  h5: "mt-0 mb-2 text-sm font-semibold text-slate-900",
  h6: "mt-0 mb-2 text-sm font-semibold text-slate-700",
} as const;

const MarkdownRenderer = ({ markdown }: MarkdownRendererProps) => (
  <div className="markdown-body text-[15px] leading-7 text-slate-700">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: (props: ComponentPropsWithoutRef<"h1">) => (
          <h1 {...props} className={headingClassNames.h1} />
        ),
        h2: (props: ComponentPropsWithoutRef<"h2">) => (
          <h2 {...props} className={headingClassNames.h2} />
        ),
        h3: (props: ComponentPropsWithoutRef<"h3">) => (
          <h3 {...props} className={headingClassNames.h3} />
        ),
        h4: (props: ComponentPropsWithoutRef<"h4">) => (
          <h4 {...props} className={headingClassNames.h4} />
        ),
        h5: (props: ComponentPropsWithoutRef<"h5">) => (
          <h5 {...props} className={headingClassNames.h5} />
        ),
        h6: (props: ComponentPropsWithoutRef<"h6">) => (
          <h6 {...props} className={headingClassNames.h6} />
        ),
        p: (props: ComponentPropsWithoutRef<"p">) => (
          <p {...props} className="my-0 whitespace-pre-wrap" />
        ),
        ul: (props: ComponentPropsWithoutRef<"ul">) => (
          <ul
            {...props}
            className="my-0 list-disc space-y-1 pl-5 marker:text-sky-500"
          />
        ),
        ol: (props: ComponentPropsWithoutRef<"ol">) => (
          <ol
            {...props}
            className="my-0 list-decimal space-y-1 pl-5 marker:text-sky-500"
          />
        ),
        li: (props: ComponentPropsWithoutRef<"li">) => (
          <li {...props} className="pl-1" />
        ),
        a: (props: ComponentPropsWithoutRef<"a">) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 underline underline-offset-2"
          />
        ),
        blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
          <blockquote
            {...props}
            className="my-0 rounded-r-xl border-l-4 border-sky-200 bg-sky-50 px-4 py-3 text-slate-700"
          />
        ),
        pre: (props: ComponentPropsWithoutRef<"pre">) => (
          <pre
            {...props}
            className="my-0 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-100"
          />
        ),
        code: (props: ComponentPropsWithoutRef<"code">) => {
          const isInlineCode = !props.className;

          if (isInlineCode) {
            return (
              <code
                {...props}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-700"
              />
            );
          }

          return <code {...props} className="font-mono text-slate-100" />;
        },
        table: (props: ComponentPropsWithoutRef<"table">) => (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table {...props} className="min-w-full border-collapse bg-white text-sm" />
          </div>
        ),
        thead: (props: ComponentPropsWithoutRef<"thead">) => (
          <thead {...props} className="bg-slate-50" />
        ),
        tr: (props: ComponentPropsWithoutRef<"tr">) => (
          <tr {...props} className="border-b border-slate-200 last:border-b-0" />
        ),
        th: (props: ComponentPropsWithoutRef<"th">) => (
          <th
            {...props}
            className="px-3 py-2 text-left font-semibold text-slate-900"
          />
        ),
        td: (props: ComponentPropsWithoutRef<"td">) => (
          <td {...props} className="px-3 py-2 text-slate-700" />
        ),
        hr: () => <div className="border-t border-slate-200" />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);

export default MarkdownRenderer;
