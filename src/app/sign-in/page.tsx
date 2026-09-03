"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20 || value.charCodeAt(i) === 0x7f) return true;
  }
  return false;
}

function safeCallback(from: string | null): string {
  if (!from) return "/";
  let decoded = from;
  try {
    decoded = decodeURIComponent(from);
  } catch {
    return "/";
  }
  // Same-origin path only: one leading slash, not protocol-relative, no
  // backslash or control chars, and not the sign-in page itself.
  if (!decoded.startsWith("/")) return "/";
  if (decoded.startsWith("//") || decoded.includes("\\")) return "/";
  if (hasControlChar(decoded)) return "/";
  if (
    decoded === "/sign-in" ||
    decoded.startsWith("/sign-in/") ||
    decoded.startsWith("/sign-in?")
  ) {
    return "/";
  }
  return decoded;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackURL = safeCallback(searchParams.get("from"));

  useEffect(() => {
    if (!isPending && session) router.replace(callbackURL);
  }, [isPending, session, callbackURL, router]);

  async function signInWithGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({ provider: "google", callbackURL });
      if (res.error) {
        setError("Не вдалося увійти. Спробуйте ще раз.");
        setSubmitting(false);
      }
      // On success the browser is redirected to Google.
    } catch {
      setError("Не вдалося увійти. Спробуйте ще раз.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Вхід</CardTitle>
        <CardDescription>
          Увійдіть, щоб керувати турнірами. Глядачам вхід не потрібен.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          onClick={signInWithGoogle}
          disabled={submitting || isPending || Boolean(session)}
        >
          Увійти через Google
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
