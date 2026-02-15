import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

const prompt =
  'Read the Fide docs and explain how we might use Fide for orchestration, context memory, and real time llm routing (Fide is launching soon)? https://fide.work/docs/llms-full.txt';

type PromptTarget = 'OpenClaw' | 'Claude Code';

interface PromptTabsProps {
  items?: PromptTarget[];
}

export function PromptTabs({ items = ['OpenClaw', 'Claude Code'] }: PromptTabsProps) {
  const prompts: Record<PromptTarget, string> = {
    OpenClaw: prompt,
    'Claude Code': prompt,
  };

  return (
    <Tabs items={items} persist>
      {items.map((item) => (
        <Tab key={item} value={item} className="mt-1">
          <CodeBlock lang="bash" className="pl-4">
            <Pre>
              <code className="language-bash">{prompts[item]}</code>
            </Pre>
          </CodeBlock>
        </Tab>
      ))}
    </Tabs>
  );
}
