"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { login } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  /** In-app path to return to after signing in (set by the auth proxy). */
  from?: string;
}

export function LoginForm({ from }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound aria-hidden className="size-4 text-primary" />
          Welcome back
        </CardTitle>
        <CardDescription>
          Enter your password to unlock the hub.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {from ? <input type="hidden" name="from" value={from} /> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              className="h-11"
              aria-invalid={state ? true : undefined}
            />
          </div>
          {state ? (
            <p role="alert" className="text-small text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
