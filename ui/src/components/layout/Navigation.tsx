import type React from "react";
import { BookOpen, Server, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavigationItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const items: NavigationItem[] = [
    { path: "/", icon: <BookOpen className="h-4 w-4" />, label: "Knowledge Base" },
    { path: "/mcp", icon: <Server className="h-4 w-4" />, label: "MCP" },
    { path: "/settings", icon: <Settings className="h-4 w-4" />, label: "Settings" },
  ];

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
