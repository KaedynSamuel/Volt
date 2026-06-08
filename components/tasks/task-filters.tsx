"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Filter, SortAsc, LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskFiltersProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
  activeFilter: string
  onFilterChange: (filter: string) => void
}

const filters = [
  { id: "all", label: "All Tasks" },
  { id: "my-tasks", label: "My Tasks" },
  { id: "assigned", label: "Assigned to Me" },
  { id: "created", label: "Created by Me" },
]

export function TaskFilters({
  view,
  onViewChange,
  activeFilter,
  onFilterChange,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              activeFilter === filter.id &&
                "bg-gradient-to-r from-primary to-accent text-primary-foreground"
            )}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 sm:ml-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9 w-full sm:w-64 bg-input" />
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SortAsc className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Due Date</DropdownMenuItem>
            <DropdownMenuItem>Priority</DropdownMenuItem>
            <DropdownMenuItem>Status</DropdownMenuItem>
            <DropdownMenuItem>Created Date</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>High Priority</DropdownMenuItem>
            <DropdownMenuItem>In Progress</DropdownMenuItem>
            <DropdownMenuItem>Completed</DropdownMenuItem>
            <DropdownMenuItem>Overdue</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewChange("grid")}
            className={cn(
              "rounded-none",
              view === "grid" && "bg-muted"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewChange("list")}
            className={cn(
              "rounded-none",
              view === "list" && "bg-muted"
            )}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
