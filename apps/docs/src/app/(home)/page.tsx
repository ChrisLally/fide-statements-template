import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Atom,
  Blocks,
  BookOpen,
  Bot,
  Box,
  Braces,
  Bug,
  CircleDot,
  Cloud,
  CloudCog,
  Database,
  Diamond,
  FileText,
  Flame,
  FolderOpen,
  Gauge,
  Globe,
  KeyRound,
  LifeBuoy,
  ListOrdered,
  Lock,
  Mountain,
  Package,
  Play,
  Rocket,
  Router,
  Server,
  Shield,
  SquareTerminal,
  Terminal,
  Timer,
  Triangle,
  Upload,
  Users,
  Waves,
  Wrench,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { PromptTabs } from "@/components/mdx/prompt-tabs";

type FeatureCard = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type ChipLink = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
};

const productCards: FeatureCard[] = [
  {
    title: "Fide Workspace",
    description:
      "Mission Control for human-AI teams. Manage agents, view decision traces, and set trust boundaries.",
    href: "/workspace",
    icon: Users,
  },
  {
    title: "Fide Graph",
    description:
      "The memory engine. A unified World Model combining the Global Graph with your private Workspace Graph.",
    href: "/graph",
    icon: Database,
  },
  {
    title: "Fide Gateway",
    description:
      "The intelligent router. It secures each request, injects the right context, and records a clear decision trace.",
    href: "/gateway",
    icon: Router,
  },
  {
    title: "Context Protocol (FCP)",
    description:
      "The open standard for verifiable truth. Cryptographic proofs and schema definitions.",
    href: "/fcp",
    icon: Shield,
  }
];

const postgresModules: ChipLink[] = [
  { label: "AI & Vectors", href: "#", icon: Bot },
  { label: "Cron", href: "#", icon: Timer, description: "Schedule recurring jobs inside Postgres." },
  { label: "Queues", href: "#", icon: ListOrdered, description: "Run durable jobs backed by the database." },
];

const clientLibraries: ChipLink[] = [
  { label: "JavaScript", href: "#", icon: Braces, description: "Client and server SDK support." },
  { label: "Flutter", href: "#", icon: Atom, description: "Build mobile apps with Dart." },
  { label: "Python", href: "#", icon: Terminal, description: "Server-side workflows and scripts." },
  { label: "C#", href: "#", icon: CircleDot, description: "Use Supabase in .NET applications." },
  { label: "Swift", href: "#", icon: Flame, description: "Native iOS and macOS projects." },
  { label: "Kotlin", href: "#", icon: Triangle, description: "Android and JVM integrations." },
];

const migrationLinks: ChipLink[] = [
  { label: "Amazon RDS", href: "#", icon: Cloud },
  { label: "Auth0", href: "#", icon: Shield },
  { label: "Firebase Auth", href: "#", icon: Flame },
  { label: "Firebase Storage", href: "#", icon: Upload },
  { label: "Firestore Data", href: "#", icon: Flame },
  { label: "Heroku", href: "#", icon: CloudCog },
  { label: "MSSQL", href: "#", icon: Server },
  { label: "MySQL", href: "#", icon: Database },
  { label: "Neon", href: "#", icon: CircleDot },
  { label: "Postgres", href: "#", icon: Database },
  { label: "Render", href: "#", icon: Blocks },
  { label: "Vercel Postgres", href: "#", icon: Triangle },
];

const resources: FeatureCard[] = [
  {
    title: "Management API",
    description: "Manage your Supabase projects and organizations.",
    href: "#",
    icon: Wrench,
  },
  {
    title: "Supabase CLI",
    description: "Use the CLI to develop, manage and deploy your projects.",
    href: "#",
    icon: SquareTerminal,
  },
  {
    title: "Platform Guides",
    description: "Learn more about the tools and services powering Supabase.",
    href: "#",
    icon: BookOpen,
  },
  {
    title: "Integrations",
    description: "Explore a variety of integrations from Supabase partners.",
    href: "#",
    icon: Globe,
  },
  {
    title: "Supabase UI",
    description: "A collection of pre-built Supabase components to speed up your project.",
    href: "#",
    icon: Package,
  },
  {
    title: "Troubleshooting",
    description: "Our troubleshooting guide for solutions to common Supabase issues.",
    href: "#",
    icon: Bug,
  },
];

const selfHosting: ChipLink[] = [
  { label: "Auth", href: "#", icon: KeyRound },
  { label: "Realtime", href: "#", icon: Waves },
  { label: "Storage", href: "#", icon: FolderOpen },
  { label: "Analytics", href: "#", icon: Gauge },
];

const gettingStartedTiles = [
  { label: "React", icon: Atom },
  { label: "Next", icon: CircleDot },
  { label: "Svelte", icon: Flame },
  { label: "Vue", icon: Mountain },
  { label: "Nuxt", icon: Triangle },
  { label: "Swift", icon: Flame },
  { label: "Kotlin", icon: Braces },
  { label: "Dart", icon: Rocket },
  { label: "Flutter", icon: Box },
  { label: "Python", icon: Terminal },
];

// function IconChip({ item }: { item: ChipLink }) {
//   const Icon = item.icon;

//   return (
//     <HoverCard openDelay={100}>
//       <HoverCardTrigger asChild>
//         <Link href={item.href}>
//           <Badge variant="outline" className="h-9 gap-2 px-3 py-0 text-sm font-normal">
//             <Icon className="size-3.5" />
//             {item.label}
//           </Badge>
//         </Link>
//       </HoverCardTrigger>
//       <HoverCardContent className="w-72">
//         <p className="text-sm font-medium">{item.label}</p>
//         <p className="mt-1 text-sm text-muted-foreground">
//           {item.description ?? `Open ${item.label} documentation.`}
//         </p>
//       </HoverCardContent>
//     </HoverCard>
//   );
// }

function Feature({ item }: { item: FeatureCard }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="block">
      <Card className="h-full gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" />
            {item.title}
          </CardTitle>
          <CardDescription className="leading-6">{item.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 md:py-12">
      <section className="relative grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute -left-12 top-7 hidden rounded-full border lg:inline-flex"
          aria-label="Hero accent"
        >
          <Diamond className="size-4" />
        </Button>
        <div className="space-y-3 pt-3">
          <h1 className="inline-block text-4xl font-semibold leading-tight md:text-5xl">
            <span className="rounded-sm bg-primary/20 px-2 py-1 whitespace-nowrap">
              Fide Documentation
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            Build trusted human-AI teams with The Fide Workspace (co-working), Gateway (routing and access), Graph (context graph), and Context Protocol (context graph rules).
          </p>
        </div>

        <Card className="gap-2 py-4">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Play className="size-4" />
              Getting Started
            </CardTitle>
            <CardDescription>
            Copy a ready-to-use prompt for your coding assistant to read the Fide docs and get you started. (≈50k tokens of context)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
  
            <PromptTabs />
          </CardContent>
        </Card>
      </section>

      <Separator />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Products</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="md:col-span-1 lg:col-span-2">
            <Feature item={productCards[0]} />
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <Feature item={productCards[1]} />
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <Feature item={productCards[2]} />
          </div>
        </div>
      </section>

      <Separator />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Protocol</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="md:col-span-3 lg:col-span-6">
            <Feature item={productCards[3]} />
          </div>
        </div>
      </section>

      {/* <Separator />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Postgres Modules</h2>
        <div className="flex flex-wrap gap-3">
          {postgresModules.map((item) => (
            <IconChip key={item.label} item={item} />
          ))}
        </div>
      </section>

      <Separator />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Client Libraries</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientLibraries.map((item) => (
            <IconChip key={item.label} item={item} />
          ))}
        </div>
      </section>

      <Separator />
      <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">Migrate to Supabase</h2>
          <p className="text-muted-foreground">
            Bring your existing data, auth and storage to Supabase following our migration guides.
          </p>
          <Link href="#" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Explore more resources
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {migrationLinks.map((item) => (
            <IconChip key={item.label} item={item} />
          ))}
        </div>
      </section>

      <Separator />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Additional resources</h2>
        <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
          {resources.map((item) => (
            <Feature key={item.title} item={item} />
          ))}
        </div>
        <Accordion type="single" collapsible className="md:hidden">
          {resources.map((item) => {
            const Icon = item.icon;
            return (
              <AccordionItem key={item.title} value={item.title}>
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {item.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>
                  <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-medium">
                    View docs
                    <ArrowRight className="size-4" />
                  </Link>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>

      <Separator />
      <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Zap className="size-5" />
            Self-Hosting
          </h2>
          <p className="text-muted-foreground">Get started with self-hosting Supabase.</p>
          <Link href="#" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            More on Self-Hosting
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          {selfHosting.map((item) => (
            <IconChip key={item.label} item={item} />
          ))}
        </div>
      </section>

      <Separator />
      <footer className="space-y-4 pb-8 pt-1 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="#" className="inline-flex items-center gap-1 hover:text-primary">
            <LifeBuoy className="size-3.5" />
            Need some help? Contact support
          </Link>
          <Link href="#" className="inline-flex items-center gap-1 hover:text-primary">
            <BookOpen className="size-3.5" />
            Latest product updates? See Changelog
          </Link>
          <Link href="#" className="inline-flex items-center gap-1 hover:text-primary">
            <CircleDot className="size-3.5" />
            Something&apos;s not right? Check system status
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span>© Supabase Inc</span>
          <Link href="#">Contributing</Link>
          <Link href="#">Author Styleguide</Link>
          <Link href="#">Open Source</Link>
          <Link href="#">SupaSquad</Link>
          <Link href="#">Privacy Settings</Link>
        </div>
      </footer> */}
    </main>
  );
}
