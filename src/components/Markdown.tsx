import { Link } from "react-router-dom";
import {
    parseInline,
    parseMarkdown,
    type MdBlock,
    type MdInline,
} from "@/core/markdown";

interface Props {
    text: string;
}

/**
 * Renders the assistant's markdown.
 *
 * Everything goes through React elements — there is no `innerHTML` and no
 * sanitiser to get wrong — so model output is text by construction. Links that
 * start with `/` become router links, which is what turns the calculator
 * catalogue the model was given into working navigation.
 *
 * See `core/markdown.ts` for the supported subset (which is deliberately small).
 */
export default function Markdown({ text }: Props) {
    const blocks = parseMarkdown(text);
    return <div className="chat-md">{blocks.map(renderBlock)}</div>;
}

function renderBlock(block: MdBlock, index: number) {
    switch (block.kind) {
        case "heading": {
            const level = Math.min(Math.max(block.level, 1), 4);
            const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
            return (
                <Tag key={index} className="chat-md-h">
                    <Inline nodes={block.content} />
                </Tag>
            );
        }

        case "paragraph":
            return (
                <p key={index}>
                    <Inline nodes={block.content} />
                </p>
            );

        case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
                <Tag key={index} className="chat-md-list">
                    {block.items.map((item, itemIndex) => (
                        <li
                            key={itemIndex}
                            // Indentation rather than real nesting: it costs a
                            // style attribute instead of a recursive structure,
                            // and reads identically for a chat answer.
                            style={
                                item.depth > 0
                                    ? { marginLeft: `${item.depth * 16}px` }
                                    : undefined
                            }
                        >
                            <Inline nodes={item.content} />
                        </li>
                    ))}
                </Tag>
            );
        }

        case "codeBlock":
            return (
                <pre key={index} className="chat-md-pre">
                    <code data-language={block.language || undefined}>
                        {block.text}
                    </code>
                </pre>
            );

        case "quote":
            return (
                <blockquote key={index}>
                    <Inline nodes={block.content} />
                </blockquote>
            );

        case "table":
            return (
                <div key={index} className="chat-md-table-wrap">
                    <table className="chat-md-table">
                        <thead>
                            <tr>
                                {block.head.map((cell, cellIndex) => (
                                    <th key={cellIndex}>
                                        <Inline nodes={parseInline(cell)} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex}>
                                            <Inline nodes={parseInline(cell)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case "rule":
            return <hr key={index} className="chat-md-rule" />;
    }
}

function Inline({ nodes }: { nodes: MdInline[] }) {
    return (
        <>
            {nodes.map((node, index) => (
                <InlineNode key={index} node={node} />
            ))}
        </>
    );
}

function InlineNode({ node }: { node: MdInline }) {
    switch (node.kind) {
        case "text":
            return <>{node.text}</>;

        case "strong":
            return (
                <strong>
                    <Inline nodes={node.content} />
                </strong>
            );

        case "em":
            return (
                <em>
                    <Inline nodes={node.content} />
                </em>
            );

        case "code":
            return <code className="chat-md-code">{node.text}</code>;

        case "link": {
            const label = <Inline nodes={node.content} />;

            // Same-origin app routes become router links so the chat can hand
            // the user straight to a calculator without a page reload.
            if (node.href.startsWith("/")) {
                return <Link to={node.href}>{label}</Link>;
            }

            if (/^https?:\/\//i.test(node.href)) {
                return (
                    <a
                        href={node.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {label}
                    </a>
                );
            }

            return <span>{node.href}</span>;
        }
    }
}
