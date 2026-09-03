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

function safeCallback(from: string | null): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const [submitting, setSubmitting] = useState(false);

  const callbackURL = safeCallback(searchParams.get("from"));

  useEffect(() => {
    if (!isPending && session) router.replace(callbackURL);
  }, [isPending, session, callbackURL, router]);

  async function signInWithGoogle() {
    setSubmitting(true);
    await authClient.signIn.social({ provider: "google", callbackURL });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Вхід</CardTitle>
        <CardDescription>
          Увійдіть, щоб керувати турнірами. Глядачам вхід не потрібен.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={signInWithGoogle}
          disabled={submitting || isPending || Boolean(session)}
        >
          Увійти через Google
        </Button>
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
