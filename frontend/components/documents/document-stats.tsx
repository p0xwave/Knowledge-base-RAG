"use client"

import { FileText, HardDrive, Clock } from "lucide-react"

interface DocumentStatsProps {
  documentCount: number
  totalSize: string
  lastUpload: string
}

export function DocumentStats({ documentCount, totalSize, lastUpload }: DocumentStatsProps) {
  const stats = [
    {
      icon: FileText,
      value: documentCount,
      label: "Documents",
      color: "bg-primary/10",
      textColor: "text-primary",
    },
    {
      icon: HardDrive,
      value: totalSize,
      label: "Total size",
      color: "bg-blue-500/10",
      textColor: "text-blue-500",
    },
    {
      icon: Clock,
      value: lastUpload,
      label: "Last upload",
      color: "bg-emerald-500/10",
      textColor: "text-emerald-500",
    },
  ]

  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      {stats.map(({ icon: Icon, value, label, color, textColor }) => (
        <div key={label} className="bg-muted/30 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
              <Icon className={`h-5 w-5 ${textColor}`} />
            </div>
            <div>
              <p className="text-foreground text-2xl font-semibold">{value}</p>
              <p className="text-muted-foreground text-sm">{label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
