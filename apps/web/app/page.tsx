import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { TabTrigger, Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Sidebar } from "@/components/sidebar";
import { Plus } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 min-h-16 bg-topbg border-b border-line flex items-center gap-2 px-6 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1.5 text-xs text-muted mr-auto min-w-[130px]">
            <span>
              <b className="text-ink">Today</b>
            </span>
          </nav>

          <div
            className="flex items-center gap-1.5"
            aria-label="Preview sync status"
          >
            <div className="w-2 h-2 rounded-full bg-success-tx flex-none" />
            <span className="text-xs text-muted font-mono">Preview data</span>
          </div>

          <UserButton />
        </header>

        <main className="flex-1 max-w-[1220px] w-full mx-auto px-7 py-6 pb-24">
          <Banner
            id="preview-notice"
            variant="info"
            label="Design System Preview"
          >
            This page demonstrates the design tokens and components defined in
            Work Package 2. Product actions are disabled until their related
            workflows are available.
          </Banner>

          <div className="flex items-end justify-between gap-6 flex-wrap mb-4 mt-6">
            <div>
              <p className="text-[11px] font-mono text-green-ink uppercase tracking-wider">
                Saturday · Aug 9
              </p>
              <h1 className="font-serif font-semibold text-[clamp(28px,3.6vw,38px)] leading-tight tracking-tight mt-1">
                Run of day
              </h1>
              <p className="text-sm text-muted max-w-[52ch] leading-relaxed mt-1">
                Qualifying sessions and service for Car #262.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              disabled
              aria-describedby="preview-notice"
            >
              <Plus className="w-4 h-4" />
              Add movement
            </Button>
          </div>

          <Tabs className="mb-3" defaultValue="plan">
            <TabsList>
              <TabTrigger value="plan">Plan</TabTrigger>
              <TabTrigger value="work">Work</TabTrigger>
              <TabTrigger value="records">Records</TabTrigger>
              <TabTrigger value="forms">Forms</TabTrigger>
            </TabsList>
            <TabsContent value="plan" className="sr-only">
              Plan preview selected.
            </TabsContent>
            <TabsContent value="work" className="sr-only">
              Work preview selected.
            </TabsContent>
            <TabsContent value="records" className="sr-only">
              Records preview selected.
            </TabsContent>
            <TabsContent value="forms" className="sr-only">
              Forms preview selected.
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-4 gap-2.5 mb-3.5 max-sm:grid-cols-2">
            <StatCard value="8" label="Movements today" meta="4 confirmed" />
            <StatCard value="3" label="Open work" meta="1 overdue" />
            <StatCard value="12" label="Crew on site" meta="6 acknowledged" />
            <StatCard value="2" label="Changes" meta="Awaiting review" />
          </div>

          <div className="grid grid-cols-[1.35fr_0.65fr] gap-3.5 items-start max-md:grid-cols-1">
            <div className="rounded-xl border border-line bg-card overflow-visible">
              <div className="flex items-center justify-between gap-3 p-4 pb-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold">Schedule</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Saturday session plan
                  </p>
                </div>
                <Badge variant="success">Published</Badge>
              </div>

              <div className="divide-y divide-line2">
                {[
                  {
                    time: "08:00",
                    title: "Gates open",
                    meta: "Paddock entrance",
                    state: "green",
                  },
                  {
                    time: "09:00",
                    title: "Driver briefing",
                    meta: "Main conference room",
                    state: "green",
                  },
                  {
                    time: "10:30",
                    title: "Qualifying — Group A",
                    meta: "Car #262 · Driver: Miller",
                    state: "yellow",
                  },
                  {
                    time: "12:00",
                    title: "Service — Fuel & tires",
                    meta: "Pit 14 · Crew: 6 assigned",
                    state: "neutral",
                  },
                  {
                    time: "14:00",
                    title: "Qualifying — Group B",
                    meta: "Car #262 · Driver: Chen",
                    state: "neutral",
                  },
                ].map((item) => (
                  <div
                    key={item.time}
                    className="flex items-center gap-3 px-4 py-3 flex-wrap"
                  >
                    <span className="font-mono text-sm text-ink2 flex-none w-14">
                      {item.time}
                    </span>
                    <div className="flex-1 min-w-[150px]">
                      <b className="text-sm font-bold block">{item.title}</b>
                      <small className="text-xs text-muted block mt-0.5">
                        {item.meta}
                      </small>
                    </div>
                    <Badge
                      variant={
                        item.state === "green"
                          ? "success"
                          : item.state === "yellow"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {item.state === "green"
                        ? "Confirmed"
                        : item.state === "yellow"
                          ? "Pending"
                          : "Draft"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3.5">
              <Card>
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add movement
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add work item
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add record
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pending changes</CardTitle>
                  <CardDescription>
                    2 changes need your acknowledgement
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Banner variant="warning">
                    <b className="block text-xs">Service time changed</b>
                    Pit 14 service moved to 12:30
                  </Banner>
                  <Banner variant="info">
                    <b className="block text-xs">New route note</b>
                    Construction on Highway 9 — use alternate
                  </Banner>
                </CardContent>
              </Card>

              <div className="rounded-xl border border-line bg-card p-4">
                <h3 className="text-sm font-semibold mb-1">Components</h3>
                <p className="text-xs text-muted mb-3">
                  Available design system elements
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>neutral</Badge>
                  <Badge variant="success">success</Badge>
                  <Badge variant="warning">warning</Badge>
                  <Badge variant="info">info</Badge>
                  <Badge variant="danger">danger</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    Primary
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    Secondary
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    Ghost
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled
                    aria-describedby="preview-notice"
                  >
                    Danger
                  </Button>
                </div>
                <div className="mt-3">
                  <Input
                    disabled
                    aria-describedby="preview-notice"
                    placeholder="Search movements..."
                  />
                </div>
                <EmptyState
                  title="No results"
                  description="Try adjusting your search or filters."
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
