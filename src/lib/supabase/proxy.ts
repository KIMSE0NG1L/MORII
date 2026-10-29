import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const isAuthed = Boolean(userId);
  const { pathname } = request.nextUrl;

  if (!isAuthed && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!userId) {
    return response;
  }

  // Session is already verified above - forward the id so pages can skip
  // re-checking it on every navigation (see requireAuth in src/lib/session.ts).
  // Always overwrite rather than append, so a client-supplied header is never trusted.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-user-id", userId);
  const forwarded = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.cookies.getAll().forEach((cookie) => forwarded.cookies.set(cookie));
  return forwarded;
}
