"use client";

import { LayoutDashboard, NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { AgendaItemRow } from "@/components/agenda/agenda-item";
import { EventChip } from "@/components/calendar/event-chip";
import { ScriptReadingView } from "@/components/content/script/script-reading-view";
import { NavLink } from "@/components/shell/nav-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavItem } from "@/lib/navigation";

// href matches this page so NavLink's real active-state logic renders one item active.
const demoNavItems: NavItem[] = [
  { href: "/styleguide", label: "Current section", icon: LayoutDashboard },
  { href: "/styleguide/other", label: "Other section", icon: NotebookPen },
];

export function ComponentsGallery() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="styleguide-name">Name</Label>
            <Input id="styleguide-name" placeholder="Luis Guisado" />
          </div>
          <Select defaultValue="work">
            <SelectTrigger>
              <SelectValue placeholder="Track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work">Work</SelectItem>
              <SelectItem value="content">Content</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="work">
        <TabsList>
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
        <TabsContent value="work">Work-track tab content.</TabsContent>
        <TabsContent value="content">Content-track tab content.</TabsContent>
      </Tabs>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Open dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogDescription>
                This is a sample dialog rendered in the app skin.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Open menu
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="max-w-sm overflow-hidden rounded-xl border border-border">
          <Command>
            <CommandInput placeholder="Search or jump to..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Navigate">
                <CommandItem>Dashboard</CommandItem>
                <CommandItem>Calendar</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>

        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" />}>
            Hover me
          </TooltipTrigger>
          <TooltipContent>A helpful tooltip</TooltipContent>
        </Tooltip>

        <Button variant="outline" onClick={() => toast("Saved successfully")}>
          Show toast
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex max-w-xs flex-col gap-1">
        <EventChip
          event={{
            id: "styleguide-work",
            track: "work",
            title: "Sprint planning",
            description: null,
            startsAt: new Date(),
            endsAt: new Date(),
            allDay: false,
            conflictNote: null,
            linkedIdeas: [],
          }}
        />
        <EventChip
          event={{
            id: "styleguide-content",
            track: "content",
            title: "Record voiceover",
            description: null,
            startsAt: new Date(),
            endsAt: new Date(),
            allDay: false,
            conflictNote: null,
            linkedIdeas: [],
          }}
        />
      </div>

      <div className="flex max-w-xs flex-col gap-1">
        <AgendaItemRow
          item={{
            event: {
              id: "styleguide-agenda-work",
              track: "work",
              title: "Sprint planning",
              description: null,
              startsAt: new Date(),
              endsAt: new Date(),
              allDay: false,
              conflictNote: null,
              linkedIdeas: [],
            },
            timeLabel: "Now",
            inProgress: true,
          }}
        />
        <AgendaItemRow
          item={{
            event: {
              id: "styleguide-agenda-content",
              track: "content",
              title: "Record voiceover",
              description: null,
              startsAt: new Date(),
              endsAt: new Date(),
              allDay: true,
              conflictNote: null,
              linkedIdeas: [],
            },
            timeLabel: "All day",
            inProgress: false,
          }}
        />
      </div>

      <div className="max-w-lg rounded-xl border border-border p-4">
        <ScriptReadingView
          content={
            "# Cold open\n\nHook the viewer in the first five seconds.\n\n## Beat 1\n\n- Show the glitch\n- Ask the question\n\n> Don't explain the trick yet — that's the payoff.\n\nUse `speedrun.com` for splits, or a fenced block for setup:\n\n```bash\nffmpeg -i raw.mp4 -c copy clip.mp4\n```"
          }
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex w-56 flex-col gap-1 rounded-lg border border-border p-2">
          {demoNavItems.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon aria-hidden className="size-5" />}
              variant="sidebar"
            />
          ))}
        </div>
        <div className="flex max-w-xs rounded-lg border border-border">
          {demoNavItems.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon aria-hidden className="size-5" />}
              variant="bottom"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
