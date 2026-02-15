import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

interface PackageManagerTabsProps {
  packageName: string;
  items?: ('pnpm' | 'npm' | 'yarn' | 'bun')[];
}

export function PackageManagerTabs({
  packageName,
  items = ['pnpm', 'npm', 'yarn', 'bun'],
}: PackageManagerTabsProps) {
  const commands = {
    pnpm: `pnpm add ${packageName}`,
    npm: `npm install ${packageName}`,
    yarn: `yarn add ${packageName}`,
    bun: `bun add ${packageName}`,
  };

  return (
    <Tabs items={items} persist>
      {items.map((pm) => (
        <Tab key={pm} value={pm} className="mt-1">
          <CodeBlock lang="bash" className="pl-4">
            <Pre>
              <code className="language-bash">{commands[pm]}</code>
            </Pre>
          </CodeBlock>
        </Tab>
      ))}
    </Tabs>
  );
}

