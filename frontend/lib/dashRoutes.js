import {
  Activity,
  BarChart3,
  Bot,
  ClipboardList,
  History,
  Key,
  Layers,
  LogOut,
  MessageSquare,
  Send,
  Settings2,
  Users,
} from "lucide-react";

export const mainNavItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    description: "View key metrics and account activity at a glance.",
  },
  {
    href: "/dashboard/live-feed",
    label: "Live Feed",
    icon: Activity,
    description: "Monitor incoming and outgoing messages in real time.",
  },
  {
    href: "/dashboard/groups",
    label: "Contacts & Segments",
    icon: Users,
    description: "Organize contacts into groups and targeted segments.",
  },
  {
    href: "/dashboard/scheduled",
    label: "Scheduler",
    icon: Send,
    description: "Schedule campaigns and messages for future delivery.",
  },
  {
    href: "/dashboard/templates",
    label: "Templates",
    icon: ClipboardList,
    description: "Create and manage reusable message templates.",
  },
  {
    href: "/dashboard/auto-reply",
    label: "Auto Reply",
    icon: Bot,
    description: "Set up automated responses for customer interactions.",
  },
  {
    href: "/dashboard/ai-templates",
    label: "AI Templates",
    icon: Layers,
    description: "Generate AI-powered message templates in seconds.",
  },
  {
    href: "/dashboard/history",
    label: "History",
    icon: History,
    description: "Review past campaigns, messages, and activity logs.",
  },
];

export const manageNavItems = [
  {
    href: "/dashboard/api-keys",
    label: "API Keys",
    icon: Key,
    description: "",
  },
];

export const settingsNavItem = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: Settings2,
};
