"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, User, Lock, Check, AlertCircle, Eye, EyeOff, Trash2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  // Profile state
  const [name, setName] = useState("John Doe")
  const [email] = useState("john.doe@example.com")
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(name)
  const [profileSaved, setProfileSaved] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const handleSaveName = () => {
    if (tempName.trim()) {
      setName(tempName.trim())
      setIsEditingName(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  const handleCancelNameEdit = () => {
    setTempName(name)
    setIsEditingName(false)
  }

  const validatePassword = () => {
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return false
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return false
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return false
    }
    return true
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    setPasswordSuccess(false)

    if (!validatePassword()) return

    // Simulate password change
    setTimeout(() => {
      setPasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSuccess(false), 3000)
    }, 500)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Header */}
      <header className="border-border/50 flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-muted/50 h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-foreground text-xl font-semibold">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Profile Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <User className="text-muted-foreground h-5 w-5" />
              <h2 className="text-foreground text-lg font-semibold">Profile</h2>
            </div>

            <div className="bg-muted/30 space-y-6 rounded-2xl p-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="/placeholder.svg" alt={name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-foreground font-medium">{name}</p>
                  <p className="text-muted-foreground text-sm">{email}</p>
                </div>
              </div>

              <div className="bg-border/50 h-px" />

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground text-sm">
                  Display Name
                </Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="Enter your name"
                      className="bg-background/50 border-border/50 flex-1"
                      autoFocus
                    />
                    <Button onClick={handleSaveName} size="sm">
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelNameEdit}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-foreground">{name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingName(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Email Field (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground text-sm">
                  Email
                </Label>
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{email}</p>
                  <span className="text-muted-foreground text-xs">Cannot be changed</span>
                </div>
              </div>

              {profileSaved && (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <Check className="h-4 w-4" />
                  Profile saved successfully
                </div>
              )}
            </div>
          </section>

          {/* Password Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Lock className="text-muted-foreground h-5 w-5" />
              <h2 className="text-foreground text-lg font-semibold">Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="bg-muted/30 space-y-5 rounded-2xl p-6">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-muted-foreground text-sm">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="bg-background/50 border-border/50 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-muted-foreground text-sm">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-background/50 border-border/50 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">Must be at least 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-muted-foreground text-sm">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={cn(
                      "bg-background/50 border-border/50 pr-10",
                      confirmPassword && newPassword !== confirmPassword && "border-destructive"
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="text-destructive flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {passwordError}
                </div>
              )}

              {/* Success Message */}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <Check className="h-4 w-4" />
                  Password changed successfully
                </div>
              )}

              <Button type="submit" disabled={!currentPassword || !newPassword || !confirmPassword}>
                Update password
              </Button>
            </form>
          </section>

          {/* Danger Zone */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Trash2 className="text-destructive h-5 w-5" />
              <h2 className="text-destructive text-lg font-semibold">Danger Zone</h2>
            </div>

            <div className="bg-destructive/5 border-destructive/20 rounded-2xl border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Delete Account</p>
                  <p className="text-muted-foreground text-sm">
                    Permanently delete your account and all data
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and
                        remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
